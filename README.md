# GrantProof 🔍

> Verifiable on-chain proof of NGO fund usage — donors audit receipts, Stellar releases the next tranche automatically.

---

## The Problem

An NGO in Jakarta receives a $10,000 donor grant for flood relief, but the donor — a diaspora
community in the US — has no way to verify how the money was spent. The NGO submits a PDF report
by email weeks later, which no one can authenticate, and donor trust erodes. The next grant cycle
is delayed or cancelled entirely because there is no tamper-proof audit trail.

---

## The Solution

GrantProof puts the accountability layer on Stellar:

1. **NGO submits a proof hash** — the SHA-256 of their expense report/receipt bundle (stored on IPFS).
   The hash is registered on-chain, making the document tamper-evident without exposing private data.
2. **Donor/admin audits the proof** — reviews the off-chain document and calls `audit_proof()`,
   creating a permanent public record that this proof passed review.
3. **Tranche is released automatically** — `release_tranche()` transfers XLM or USDC directly to
   the NGO wallet, one time per proof, with no way to double-claim.

Donors anywhere in the world can query the contract or watch the Stellar explorer to see exactly
when proofs were submitted, approved, and paid — in real time.

---

## Stellar Features Used

| Feature                    | Usage                                                        |
|----------------------------|--------------------------------------------------------------|
| **Soroban smart contract** | Core proof registry, audit flag, tranche release logic       |
| **XLM / USDC transfers**   | Tranche disbursed directly to NGO wallet upon audit approval |
| **On-chain events**        | `submitted`, `audited`, `released` — full public audit trail |
| **Trustlines**             | NGO establishes trustline for USDC before receiving payment  |

---

## Contract Functions (MVP)

| Function           | Who calls it | What it does                                              |
|--------------------|-------------|-----------------------------------------------------------|
| `submit_proof()`   | NGO         | Registers proof hash + wallet, blocks duplicates          |
| `audit_proof()`    | Admin/Donor | Sets `approved = true`, emits public audit event          |
| `release_tranche()`| Admin       | Transfers fixed tranche to NGO wallet, sets `released = true` |

---

## Suggested MVP Timeline

| Day | Milestone                                                         |
|-----|-------------------------------------------------------------------|
| 1   | Soroban contract coded, 3 unit tests passing                      |
| 2   | Deploy to Stellar testnet, CLI invocations verified               |
| 3   | Minimal React front-end — NGO submit form + donor audit dashboard |
| 4   | Demo flow recorded: submit → audit → release → balance confirmed  |
| 5   | Polish, README, submit                                            |

---

## Prerequisites

```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI v21+
cargo install --locked soroban-cli --features opt

soroban --version   # should print 21.x.x
```

---

## Build

```bash
soroban contract build
# Output: target/wasm32-unknown-unknown/release/grant_proof.wasm
```

---

## Test

```bash
cargo test

# Expected:
# test tests::test_submit_audit_and_release_succeeds ... ok
# test tests::test_duplicate_proof_is_rejected ... ok
# test tests::test_storage_state_after_submit_and_audit ... ok
# test result: ok. 3 passed; 0 failed
```

---

## Deploy to Testnet

```bash
# Fund a testnet identity
soroban keys generate --global grantadmin --network testnet
soroban keys fund grantadmin --network testnet

# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/grant_proof.wasm \
  --source grantadmin \
  --network testnet
# → Outputs CONTRACT_ID
```

---

## Initialize

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source grantadmin \
  --network testnet \
  -- initialize \
  --admin       <ADMIN_ADDRESS> \
  --fund_token  <XLM_TOKEN_ADDRESS> \
  --tranche_amount 1000000000
  # 1000000000 stroops = 100 XLM
```

---

## Sample CLI Invocations

### `submit_proof` — NGO submits expense proof
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source ngo_wallet \
  --network testnet \
  -- submit_proof \
  --proof_hash   "a3f5c2b1d9e04712..." \
  --ngo_wallet   <NGO_STELLAR_ADDRESS> \
  --amount_spent 500000000
```

### `audit_proof` — donor admin approves
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source grantadmin \
  --network testnet \
  -- audit_proof \
  --proof_hash "a3f5c2b1d9e04712..."
```

### `release_tranche` — release funds to NGO
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source grantadmin \
  --network testnet \
  -- release_tranche \
  --proof_hash "a3f5c2b1d9e04712..."
```

### `get_grant` — read current state (public)
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_grant \
  --proof_hash "a3f5c2b1d9e04712..."
```

---

## Why This Wins

GrantProof demonstrates Soroban's value beyond payments — as a trust layer for social impact
coordination. It has a clear real-world user (NGOs and diaspora donors in SEA), a demo-able
2-minute flow, and composability potential (plug in a front-end, IPFS storage, or a DAO voting
layer for multi-sig audit approval). The on-chain audit trail is something no existing NGO
reporting tool offers today.

---

## Reference Repositories

- Stellar Bootcamp 2026: https://github.com/armlynobinguar/Stellar-Bootcamp-2026
- Full-Stack Reference (Community Treasury): https://github.com/armlynobinguar/community-treasury

---

## License

MIT License © 2026 GrantProof Team