# driftlock

A Soroban smart contract that enforces on-chain token withdrawal rate limits. Designed for DAOs and protocol treasuries that need to cap outflows within rolling time windows, preventing draining attacks or unauthorized large transfers.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Contract API](#contract-api)
- [Error Reference](#error-reference)
- [Security Considerations](#security-considerations)
- [Development](#development)
- [Project Structure](#project-structure)

---

## Overview

`driftlock` acts as a guarded treasury layer. Rather than allowing unrestricted token transfers, it enforces a configurable cap on how much can be withdrawn within a given ledger window. If a withdrawal would exceed the cap, it is rejected until the window resets. The window resets automatically on the next withdrawal attempt after expiry - no cron job or external trigger required.

---

## How It Works

1. **Initialization:** Admin sets the token address, cap (max withdrawable amount), and window duration in ledgers.
2. **Deposit:** Anyone can fund the contract by depositing tokens.
3. **Withdraw:** Admin withdraws tokens to a recipient. The contract checks whether the cumulative amount withdrawn in the current window exceeds the cap. If so, the transaction is rejected.
4. **Window reset:** When a withdrawal is attempted after the window duration has elapsed since `window_start`, the spent counter resets to zero and a new window begins.

---

## Contract API

### `initialize`
```rust
fn initialize(e: Env, admin: Address, token: Address, cap: i128, window: u32)
```

Initializes the contract. Called once at deployment.

| Parameter | Type | Description |
|---|---|---|
| `admin` | `Address` | Address authorized to withdraw and configure the contract |
| `token` | `Address` | Stellar Asset Contract address of the token to rate-limit |
| `cap` | `i128` | Maximum tokens withdrawable per window |
| `window` | `u32` | Window duration in ledgers |

---

### `withdraw`
```rust
fn withdraw(e: Env, caller: Address, recipient: Address, amount: i128) -> Result
```

Attempts to transfer `amount` tokens to `recipient`. Enforces the rate limit.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Must be admin |
| `recipient` | `Address` | Address to receive tokens |
| `amount` | `i128` | Amount to transfer |

**Execution steps:**
1. Verify `caller` is admin -> `Unauthorized` if not
2. Check if current window has expired; if so, reset `spent` to zero
3. Check `spent + amount <= cap` -> `RateLimitExceeded` if not
4. Check contract has sufficient balance -> `InsufficientBalance` if not
5. Update `spent`, transfer tokens

---

### `deposit`
```rust
fn deposit(e: Env, from: Address, amount: i128)
```

Transfers `amount` tokens from `from` into the contract. Open to any caller.

| Parameter | Type | Description |
|---|---|---|
| `from` | `Address` | Funding address; must have pre-approved the transfer |
| `amount` | `i128` | Amount to deposit |

---

### `set_cap`
```rust
fn set_cap(e: Env, caller: Address, new_cap: i128) -> Result
```

Updates the withdrawal cap. Takes effect immediately on the current window.

| Parameter | Type | Description |
|---|---|---|
| `caller` | `Address` | Must be admin |
| `new_cap` | `i128` | New maximum withdrawal amount per window |

---

### `window_state`
```rust
fn window_state(e: Env) -> (i128, i128, u32, u32)
```

Returns the current rate limit state as `(cap, spent, window, window_start)`.

| Return Field | Type | Description |
|---|---|---|
| `cap` | `i128` | Current withdrawal cap per window |
| `spent` | `i128` | Amount withdrawn in the current window |
| `window` | `u32` | Window duration in ledgers |
| `window_start` | `u32` | Ledger sequence when the current window started |

---

## Error Reference

| Variant | Code | Description |
|---|---|---|
| `RateLimitExceeded` | `1` | Withdrawal would exceed the cap for the current window |
| `Unauthorized` | `2` | Caller is not the admin |
| `InsufficientBalance` | `3` | Contract holds less than the requested withdrawal amount |

---

## Security Considerations

- **Admin-only withdrawals.** Only the admin address can initiate transfers. The admin cannot be changed post-deployment in the current implementation.
- **Window reset on demand.** The window resets lazily on the next withdrawal attempt after expiry. There is no automatic reset - a window that has expired but has seen no withdrawal activity remains in the expired state until the next call.
- **Cap applies per window, not per transaction.** Multiple small withdrawals within a window accumulate against the cap. A single large withdrawal that would exceed it is rejected entirely - there is no partial fulfillment.
- **Deposit is permissionless.** Anyone can fund the contract. Ensure the token contract's `approve` flow is handled correctly before calling `deposit`.
- **No cap on deposits.** There is no upper bound on how much can be deposited. Rate limiting applies only to outflows.

---

## Development

### Prerequisites

- Rust stable toolchain
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)

### Build
```bash
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/driftlock.wasm`

### Test
```bash
cargo test
```

| Test | Description |
|---|---|
| `test_withdraw_within_limit` | Withdrawal under cap succeeds and updates spent |
| `test_withdraw_exceeds_limit` | Cumulative withdrawal over cap returns `RateLimitExceeded` |
| `test_window_reset_after_expiry` | Spent resets after window duration elapses |
| `test_unauthorized_withdraw` | Non-admin withdraw returns `Unauthorized` |
| `test_set_cap` | Admin can update cap successfully |
| `test_set_cap_unauthorized` | Non-admin cap update returns `Unauthorized` |
| `test_deposit_and_withdraw` | Deposit followed by withdrawal transfers correctly |

---

## Project Structure
```text
.
├── src/
│   ├── lib.rs       # Contract logic and storage
│   └── test.rs      # Unit tests
├── Cargo.toml       # Dependencies and release profiles
└── README.md
