#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short,
    token, Address, Env, String,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,               // Donor/platform admin address
    FundToken,           // Token used for tranche releases (XLM or USDC)
    TrancheAmount,       // Fixed amount released per approved proof
    Grant(String),       // proof_hash → GrantRecord
}

// ─── Grant Record ─────────────────────────────────────────────────────────────
// Stored on-chain for each submitted proof. Immutable after submission except
// for the `approved` and `released` flags set by the auditor and admin.
#[contracttype]
#[derive(Clone)]
pub struct GrantRecord {
    pub proof_hash:  String,  // SHA-256 of the NGO's expense report / receipt bundle
    pub ngo_wallet:  Address, // Where the tranche is sent upon approval
    pub amount_spent: i128,   // Self-reported spend amount (in stroops)
    pub approved:    bool,    // Set to true by auditor after proof review
    pub released:    bool,    // Set to true after on-chain token transfer
}

// ─── Contract Errors ──────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadySubmitted  = 1, // Duplicate proof_hash detected
    NotFound          = 2, // proof_hash not in storage
    NotApproved       = 3, // Tranche release attempted before audit approval
    AlreadyReleased   = 4, // Tranche already sent for this proof
    Unauthorized      = 5, // Caller is not the admin
}

// ─── Contract ─────────────────────────────────────────────────────────────────
#[contract]
pub struct GrantProofContract;

#[contractimpl]
impl GrantProofContract {

    // ── initialize ────────────────────────────────────────────────────────────
    // Deployed once by the donor platform. Sets the admin, the disbursement
    // token, and the fixed tranche size released per approved proof.
    pub fn initialize(
        env:            Env,
        admin:          Address,
        fund_token:     Address,
        tranche_amount: i128,
    ) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin,         &admin);
        env.storage().instance().set(&DataKey::FundToken,     &fund_token);
        env.storage().instance().set(&DataKey::TrancheAmount, &tranche_amount);
    }

    // ── submit_proof ──────────────────────────────────────────────────────────
    // Called by the NGO after completing a funded activity. They upload a receipt
    // bundle off-chain (e.g., IPFS) and submit only the hash here — keeping
    // the on-chain footprint minimal while ensuring tamper-evidence.
    //
    // Duplicate detection: same proof_hash = same document = rejected.
    // This prevents NGOs from claiming a tranche twice for one report.
    pub fn submit_proof(
        env:          Env,
        proof_hash:   String,
        ngo_wallet:   Address,
        amount_spent: i128,
    ) -> Result<(), ContractError> {
        // NGO wallet must sign — confirms they own the destination address
        ngo_wallet.require_auth();

        let key = DataKey::Grant(proof_hash.clone());

        // ❌ Block resubmission of the same proof document
        if env.storage().persistent().has(&key) {
            return Err(ContractError::AlreadySubmitted);
        }

        let record = GrantRecord {
            proof_hash: proof_hash.clone(),
            ngo_wallet,
            amount_spent,
            approved: false,
            released: false,
        };

        env.storage().persistent().set(&key, &record);

        // Emit event so donor dashboards pick up new submissions instantly
        env.events().publish(
            (symbol_short!("submitted"),),
            proof_hash,
        );

        Ok(())
    }

    // ── audit_proof ───────────────────────────────────────────────────────────
    // Called by the donor/admin after reviewing the off-chain documents linked
    // to the proof_hash. Sets approved = true and emits a public audit event —
    // creating a permanent, transparent record that this proof passed review.
    //
    // Returns true on success for easy front-end assertion.
    pub fn audit_proof(
        env:        Env,
        proof_hash: String,
    ) -> Result<bool, ContractError> {
        // Only the designated donor admin may approve proofs
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Grant(proof_hash.clone());

        let mut record: GrantRecord = env.storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::NotFound)?;

        record.approved = true;
        env.storage().persistent().set(&key, &record);

        // ✅ Public audit event — visible on Stellar explorer to any donor
        env.events().publish(
            (symbol_short!("audited"),),
            (proof_hash, true),
        );

        Ok(true)
    }

    // ── release_tranche ───────────────────────────────────────────────────────
    // Admin triggers a one-time token transfer to the NGO's wallet after
    // a proof is approved. Guards:
    //   1. Proof must be audited first (NotApproved)
    //   2. Tranche can only be released once per proof (AlreadyReleased)
    //
    // Uses Stellar's SEP-41 token interface — works for native XLM or USDC.
    pub fn release_tranche(
        env:        Env,
        proof_hash: String,
    ) -> Result<(), ContractError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Grant(proof_hash.clone());

        let mut record: GrantRecord = env.storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::NotFound)?;

        // ❌ Cannot release funds for an unaudited proof
        if !record.approved {
            return Err(ContractError::NotApproved);
        }

        // ❌ Prevent double-spend — one proof = one tranche
        if record.released {
            return Err(ContractError::AlreadyReleased);
        }

        let fund_token:     Address = env.storage().instance().get(&DataKey::FundToken).unwrap();
        let tranche_amount: i128    = env.storage().instance().get(&DataKey::TrancheAmount).unwrap();

        // Execute the on-chain transfer from contract → NGO wallet
        let token_client = token::Client::new(&env, &fund_token);
        token_client.transfer(
            &env.current_contract_address(),
            &record.ngo_wallet,
            &tranche_amount,
        );

        record.released = true;
        env.storage().persistent().set(&key, &record);

        // Emit release event with full traceability (who got what, when)
        env.events().publish(
            (symbol_short!("released"),),
            (proof_hash, record.ngo_wallet, tranche_amount),
        );

        Ok(())
    }

    // ── get_grant ─────────────────────────────────────────────────────────────
    // Read-only view for donor dashboards and public auditors.
    pub fn get_grant(env: Env, proof_hash: String) -> Option<GrantRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Grant(proof_hash))
    }
}

    #[cfg(test)]
    mod test;