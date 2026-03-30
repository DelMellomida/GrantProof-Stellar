#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

fn setup() -> (Env, Address, Address, Address, Address) {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let recipient = Address::generate(&e);
    let token_admin = Address::generate(&e);

    let token_contract = e.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();

    let contract_id = e.register(DriftLock, ());
    let client = DriftLockClient::new(&e, &contract_id);

    // cap: 1000, window: 100 ledgers
    client.initialize(&admin, &token_address, &1000i128, &100u32);

    // Fund the contract
    let sac = StellarAssetClient::new(&e, &token_address);
    sac.mint(&contract_id, &5000i128);

    (e, contract_id, admin, recipient, token_address)
}

#[test]
fn test_withdraw_within_limit() {
    let (e, contract_id, admin, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.withdraw(&admin, &recipient, &500i128);

    let (cap, spent, _, _) = client.window_state();
    assert_eq!(cap, 1000);
    assert_eq!(spent, 500);
}

#[test]
fn test_withdraw_exceeds_limit() {
    let (e, contract_id, admin, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.withdraw(&admin, &recipient, &800i128).unwrap();

    let result = std::panic::catch_unwind(|| {
        client.withdraw(&admin, &recipient, &300i128);
    });
    assert!(result.is_err());
}

#[test]
fn test_window_reset_after_expiry() {
    let (e, contract_id, admin, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.withdraw(&admin, &recipient, &1000i128).unwrap();

    // Advance ledger past the 100-ledger window
    e.ledger().with_mut(|l| l.sequence_number += 101);

    // Should succeed — new window, spent reset to 0
    client.withdraw(&admin, &recipient, &1000i128).unwrap();

    let (_, spent, _, _) = client.window_state();
    assert_eq!(spent, 1000);
}

#[test]
fn test_unauthorized_withdraw() {
    let (e, contract_id, _, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    let rando = Address::generate(&e);
    let result = std::panic::catch_unwind(|| {
        client.withdraw(&rando, &recipient, &100i128);
    });
    assert!(result.is_err());
}

#[test]
fn test_set_cap() {
    let (e, contract_id, admin, _, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.set_cap(&admin, &2000i128).unwrap();
    let (cap, _, _, _) = client.window_state();
    assert_eq!(cap, 2000);
}

#[test]
fn test_set_cap_unauthorized() {
    let (e, contract_id, _, _, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    let rando = Address::generate(&e);
    let result = std::panic::catch_unwind(|| {
        client.set_cap(&rando, &9999i128);
    });
    assert!(result.is_err());
}

#[test]
fn test_deposit_and_withdraw() {
    let (e, contract_id, admin, recipient, token_address) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    let depositor = Address::generate(&e);
    let sac = StellarAssetClient::new(&e, &token_address);
    sac.mint(&depositor, &500i128);

    // Deposit 500 into the contract
    client.deposit(&depositor, &500i128);

    // Withdraw 500
    client.withdraw(&admin, &recipient, &500i128).unwrap();

    let token_client = TokenClient::new(&e, &token_address);
    assert_eq!(token_client.balance(&recipient), 500);
}

#[test]
fn test_multiple_withdrawals_within_window() {
    let (e, contract_id, admin, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.withdraw(&admin, &recipient, &300i128);
    client.withdraw(&admin, &recipient, &300i128);
    client.withdraw(&admin, &recipient, &300i128);

    let (_, spent, _, _) = client.window_state();
    assert_eq!(spent, 900);

    // One more 300 would exceed cap of 1000
    let result = std::panic::catch_unwind(|| {
        client.withdraw(&admin, &recipient, &300i128);
    });
    assert!(result.is_err());
}

#[test]
fn test_window_state_returns_correct_values() {
    let (e, contract_id, admin, recipient, _) = setup();
    let client = DriftLockClient::new(&e, &contract_id);

    client.withdraw(&admin, &recipient, &250i128);

    let (cap, spent, window, _) = client.window_state();
    assert_eq!(cap, 1000);
    assert_eq!(spent, 250);
    assert_eq!(window, 100);
}