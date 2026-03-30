#![no_std]
extern crate alloc;

use soroban_sdk::{
    contract, contracterror, contractimpl, contractmeta, contracttype, token, Address, Env,
};

contractmeta!(
    key = "Description",
    val = "DriftLock: On-chain token withdrawal rate limiter for DAOs and protocol treasuries on Soroban"
);

#[contracterror]
#[repr(u32)]
#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub enum Error {
    RateLimitExceeded = 1,
    Unauthorized = 2,
    InsufficientBalance = 3,
    NotInitialized = 4,
}

#[contracttype]
pub enum StorageKey {
    Admin,
    Token,
    Cap,
    Window,
    Spent,
    WindowStart,
}

#[contract]
pub struct DriftLock;

#[contractimpl]
impl DriftLock {
    /// Initialize the contract with rate limit parameters.
    pub fn initialize(
        e: Env,
        admin: Address,
        token: Address,
        cap: i128,
        window: u32,
    ) {
        admin.require_auth();
        e.storage().instance().set(&StorageKey::Admin, &admin);
        e.storage().instance().set(&StorageKey::Token, &token);
        e.storage().instance().set(&StorageKey::Cap, &cap);
        e.storage().instance().set(&StorageKey::Window, &window);
        e.storage().instance().set(&StorageKey::Spent, &0i128);
        e.storage()
            .instance()
            .set(&StorageKey::WindowStart, &e.ledger().sequence());
    }

    /// Withdraw tokens to recipient, enforcing the rate limit.
    pub fn withdraw(
        e: Env,
        caller: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        let admin: Address = e
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .ok_or(Error::NotInitialized)?;

        if caller != admin {
            return Err(Error::Unauthorized);
        }

        let cap: i128 = e.storage().instance().get(&StorageKey::Cap).unwrap();
        let window: u32 = e.storage().instance().get(&StorageKey::Window).unwrap();
        let mut spent: i128 = e.storage().instance().get(&StorageKey::Spent).unwrap();
        let mut window_start: u32 =
            e.storage().instance().get(&StorageKey::WindowStart).unwrap();

        let current_ledger = e.ledger().sequence();

        // Reset window if expired
        if current_ledger >= window_start + window {
            spent = 0;
            window_start = current_ledger;
            e.storage()
                .instance()
                .set(&StorageKey::WindowStart, &window_start);
        }

        // Enforce rate limit
        if spent + amount > cap {
            return Err(Error::RateLimitExceeded);
        }

        // Update spent
        spent += amount;
        e.storage().instance().set(&StorageKey::Spent, &spent);

        // Check balance and transfer
        let token_address: Address =
            e.storage().instance().get(&StorageKey::Token).unwrap();
        let token_client = token::Client::new(&e, &token_address);

        let balance = token_client.balance(&e.current_contract_address());
        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        token_client.transfer(&e.current_contract_address(), &recipient, &amount);

        Ok(())
    }

    /// Deposit tokens into the contract.
    pub fn deposit(e: Env, from: Address, amount: i128) {
        from.require_auth();
        let token_address: Address =
            e.storage().instance().get(&StorageKey::Token).unwrap();
        let token_client = token::Client::new(&e, &token_address);
        token_client.transfer(&from, &e.current_contract_address(), &amount);
    }

    /// Update the withdrawal cap. Admin only.
    pub fn set_cap(e: Env, caller: Address, new_cap: i128) -> Result<(), Error> {
        caller.require_auth();
        let admin: Address = e
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if caller != admin {
            return Err(Error::Unauthorized);
        }
        e.storage().instance().set(&StorageKey::Cap, &new_cap);
        Ok(())
    }

    /// View current window state: (cap, spent, window, window_start).
    pub fn window_state(e: Env) -> (i128, i128, u32, u32) {
        let cap: i128 = e.storage().instance().get(&StorageKey::Cap).unwrap();
        let spent: i128 = e.storage().instance().get(&StorageKey::Spent).unwrap();
        let window: u32 = e.storage().instance().get(&StorageKey::Window).unwrap();
        let window_start: u32 = e
            .storage()
            .instance()
            .get(&StorageKey::WindowStart)
            .unwrap();
        (cap, spent, window, window_start)
    }
}