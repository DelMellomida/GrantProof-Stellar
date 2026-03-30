#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, token, Address, Env, String};
    use crate::{GrantProofContract, GrantProofContractClient};

    // ─── Helper: deploy contract + fund it with tokens ────────────────────────
    fn setup(env: &Env) -> (GrantProofContractClient<'_>, Address, Address, i128) {
        let contract_id = env.register_contract(None, GrantProofContract);
        let client      = GrantProofContractClient::new(env, &contract_id);

        let admin          = Address::generate(env);
        let tranche_amount = 1_000_000_000_i128; // 100 XLM

        // Deploy mock token and pre-fund the contract so it can release tranches
        let token = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = token.address();
        let token_admin_client = token::StellarAssetClient::new(env, &token_id);
        token_admin_client
            .mock_all_auths()
            .mint(&contract_id, &(tranche_amount * 10));

        client
            .mock_all_auths()
            .initialize(&admin, &token_id, &tranche_amount);

        (client, admin, token_id, tranche_amount)
    }

    // ─── TEST 1: Happy Path ───────────────────────────────────────────────────
    // Full end-to-end: NGO submits proof → admin audits → tranche released →
    // assert NGO wallet balance equals tranche_amount.
    #[test]
    fn test_submit_audit_and_release_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, token_id, tranche_amount) = setup(&env);

        let ngo_wallet = Address::generate(&env);
        let proof_hash = String::from_str(&env, "sha256_receipt_bundle_q1_2026");

        // Step 1 — NGO submits expense proof
        client
            .submit_proof(&proof_hash, &ngo_wallet, &500_000_000);

        // Step 2 — Donor admin audits and approves
        let audit_result = client.audit_proof(&proof_hash);
        assert_eq!(audit_result, true);

        // Step 3 — Admin releases tranche
        client
            .release_tranche(&proof_hash);

        // Assert funds actually arrived in the NGO wallet
        let balance = token::Client::new(&env, &token_id).balance(&ngo_wallet);
        assert_eq!(balance, tranche_amount, "NGO wallet must hold the full tranche");
    }

    // ─── TEST 2: Edge Case — Duplicate Proof Rejected ─────────────────────────
    // An NGO submitting the same proof_hash twice must be rejected with
    // AlreadySubmitted — preventing a single receipt from unlocking two tranches.
    #[test]
    fn test_duplicate_proof_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, _, _) = setup(&env);

        let ngo_wallet = Address::generate(&env);
        let proof_hash = String::from_str(&env, "sha256_duplicate_test");

        // First submission succeeds
        client
            .submit_proof(&proof_hash, &ngo_wallet, &200_000_000);

        // Second submission with same hash must fail
        let second = client.try_submit_proof(&proof_hash, &ngo_wallet, &200_000_000);
        assert!(
            second.is_err() || matches!(second, Ok(Err(_))),
            "Duplicate proof must fail on second submission"
        );
    }

    // ─── TEST 3: State Verification ───────────────────────────────────────────
    // After submit_proof, storage must reflect approved=false and released=false.
    // After audit_proof, approved must flip to true while released stays false.
    #[test]
    fn test_storage_state_after_submit_and_audit() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, _, _) = setup(&env);

        let ngo_wallet = Address::generate(&env);
        let proof_hash = String::from_str(&env, "sha256_state_check");

        client
            .submit_proof(&proof_hash, &ngo_wallet, &300_000_000);

        // ── Assert state after submission ─────────────────────────────────────
        let record = client.get_grant(&proof_hash).expect("Record must exist");
        assert!(!record.approved, "approved must be false before audit");
        assert!(!record.released, "released must be false before tranche release");
        assert_eq!(record.ngo_wallet, ngo_wallet, "Stored wallet must match");

        // ── Assert state after audit ──────────────────────────────────────────
        client.audit_proof(&proof_hash);
        let audited = client.get_grant(&proof_hash).expect("Record must still exist");
        assert!(audited.approved,  "approved must be true after audit");
        assert!(!audited.released, "released must still be false before release_tranche");
    }
}