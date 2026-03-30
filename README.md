# GrantProof 🔍

> Verifiable on-chain proof of NGO fund usage — donors audit receipts, Stellar releases the next tranche automatically.

---


## Important
🔗 https://stellar.expert/explorer/testnet/tx/c3be61fc9136f854f2c39ca2c8c8644960f64aac2a61c81636b1b4805cddff86
🔗 https://lab.stellar.org/r/testnet/contract/CALNJGO4OMS6PCZIW3HFGDIDFMDCH6YODCOE5SRVQ7EVSCUKWESJ5OIM

Contract ID: CALNJGO4OMS6PCZIW3HFGDIDFMDCH6YODCOE5SRVQ7EVSCUKWESJ5OIM

---

## Quick Start (5 commands)

Use this if you want the fastest path to run the live testnet flow.

```bash
# 1) Derive native XLM token contract (SAC) on testnet
stellar contract id asset --asset native --network testnet

# 2) One-time initialize (replace placeholders)
stellar contract invoke --id <GRANTPROOF_CONTRACT_ID_C...> --source <ADMIN_ALIAS> --network testnet -- initialize --admin <ADMIN_G...> --fund_token <TOKEN_CONTRACT_C...> --tranche_amount 1000000000

# 3) Fund GrantProof contract with token balance (replace placeholders)
stellar contract invoke --id <TOKEN_CONTRACT_C...> --source <FUNDER_ALIAS> --network testnet -- transfer --from <FUNDER_G...> --to <GRANTPROOF_CONTRACT_ID_C...> --amount 1000000000

# 4) Run frontend
cd frontend && npm install && npm run dev

# 5) Verify contract token balance before release
stellar contract invoke --id <TOKEN_CONTRACT_C...> --network testnet -- balance --id <GRANTPROOF_CONTRACT_ID_C...>
```

Expected user flow in UI: initialize (once) → submit_proof → audit_proof → release_tranche → get_grant.

---

## The Problem

An NGO in Philippines receives a $10,000 donor grant for flood relief, but the donor — a diaspora
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

## Frontend (React + Vite)

The repo now includes a frontend app in `frontend/` that connects to the deployed Soroban contract.

### 1) Configure environment

```bash
cd frontend
cp .env.example .env
```

Default values are already set for your Testnet deployment:

- `VITE_CONTRACT_ID=CALNJGO4OMS6PCZIW3HFGDIDFMDCH6YODCOE5SRVQ7EVSCUKWESJ5OIM`
- `VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015`
- `VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`

### 2) Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local URL from Vite, connect Freighter, and use the four MVP flows:

0. Admin `initialize` (required once)
1. NGO `submit_proof`
2. Admin `audit_proof`
3. Admin `release_tranche`
4. Public `get_grant`

> Note: Freighter must be on Testnet and the connected account must match the role required by each contract function.

### Frontend notes (important)

- `fund_token` in initialize **must** be a Soroban token contract address (`C...`), not a wallet (`G...`).
- `fund_token` must **not** be your GrantProof contract ID.
- `release_tranche` sends tokens **from the GrantProof contract balance**. You must pre-fund the contract.

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
  --fund_token  <TOKEN_CONTRACT_ADDRESS_C...> \
  --tranche_amount 1000000000
  # 1000000000 stroops = 100 XLM
```

---

## Get fund token contract address (SAC)

For native XLM on testnet:

```bash
stellar contract id asset --asset native --network testnet
# Returns a C... token contract address
```

Example output used in this project:

`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

For other assets (USDC-like), use:

```bash
stellar contract id asset --asset "<ASSET_CODE>:<ISSUER_G...>" --network testnet
```

---

## Fund the contract before release

`release_tranche` transfers from the GrantProof contract to NGO wallet. If contract balance is 0, release fails.

### 1) Get source wallet address

```bash
stellar keys address <YOUR_SOURCE_ALIAS>
```

### 2) Transfer token funds to GrantProof contract

```bash
stellar contract invoke \
  --id <TOKEN_CONTRACT_ADDRESS_C...> \
  --source <YOUR_SOURCE_ALIAS> \
  --network testnet \
  -- transfer \
  --from <YOUR_SOURCE_G...> \
  --to <GRANTPROOF_CONTRACT_ID_C...> \
  --amount <AMOUNT>
```

Example:

```bash
stellar contract invoke \
  --id CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --source jhondel \
  --network testnet \
  -- transfer \
  --from GCIGI6EC5PFDLRRCNC4I4XPECCYDURZJKP5WDVQJDD26U2FMNC7IXQMF \
  --to CALNJGO4OMS6PCZIW3HFGDIDFMDCH6YODCOE5SRVQ7EVSCUKWESJ5OIM \
  --amount 1000000000
```

### 3) Verify contract token balance

```bash
stellar contract invoke \
  --id <TOKEN_CONTRACT_ADDRESS_C...> \
  --network testnet \
  -- balance \
  --id <GRANTPROOF_CONTRACT_ID_C...>
```

---

## Common Errors and Fixes

### `Do not know how to serialize a BigInt`
- Cause: frontend tried to `JSON.stringify` a `BigInt` value from `get_grant`.
- Fix: already handled in frontend via BigInt-safe stringify.

### `Contract panic ... UnreachableCodeReached ... audit_proof`
- Cause: contract likely not initialized yet (`Admin` / `FundToken` / `TrancheAmount` missing).
- Fix: run `initialize` once on the same contract ID.

### `not a contract address`
- Cause: `fund_token` was not a `C...` token contract address.
- Fix: use `stellar contract id asset ...` to derive proper SAC contract ID.

### `Contract re-entry is not allowed`
- Cause: `fund_token` was set to the GrantProof contract ID itself.
- Fix: re-initialize using a separate token contract address.

### `Error(Contract, #10)` with `zero balance is not sufficient to spend`
- Cause: GrantProof contract has no balance in fund token.
- Fix: transfer tokens to GrantProof contract address, then retry `release_tranche`.

### `Contract error: AlreadySubmitted`
- Cause: duplicate `proof_hash` submitted.
- Fix: use a new proof hash or continue flow with existing one (`audit_proof` → `release_tranche`).

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

MIT License © 2026 GrantProof