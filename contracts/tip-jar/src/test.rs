#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token, Address, Env, String,
};

/// Spins up a tip jar plus a mock XLM token, with `funded` stroops handed to
/// each tipper so the transfer inside `tip` can actually settle.
struct Harness {
    env: Env,
    client: TipJarClient<'static>,
    token: token::TokenClient<'static>,
    owner: Address,
    alice: Address,
    bob: Address,
}

fn setup(funded: i128) -> Harness {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Stands in for the native XLM Stellar Asset Contract used on testnet.
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer.clone());
    let token_id = asset.address();

    let mint = token::StellarAssetClient::new(&env, &token_id);
    mint.mint(&alice, &funded);
    mint.mint(&bob, &funded);

    let contract_id = env.register(TipJar, ());
    let client = TipJarClient::new(&env, &contract_id);
    client.initialize(&owner, &token_id);

    Harness {
        token: token::TokenClient::new(&env, &token_id),
        env,
        client,
        owner,
        alice,
        bob,
    }
}

#[test]
fn initialize_sets_owner_and_token() {
    let h = setup(1_000);
    assert_eq!(h.client.owner(), h.owner);
    assert_eq!(h.client.token(), h.token.address);
    assert_eq!(h.client.total_tips(), 0);
    assert_eq!(h.client.tip_count(), 0);
    assert_eq!(h.client.last_message(), String::from_str(&h.env, ""));
}

#[test]
fn initialize_is_only_callable_once() {
    let h = setup(1_000);
    let result = h.client.try_initialize(&h.owner, &h.token.address);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn tip_moves_funds_and_records_the_tipper() {
    let h = setup(1_000);
    let note = String::from_str(&h.env, "great work");

    h.client.tip(&h.alice, &250, &note);

    // The tokens really moved: tipper debited, jar credited.
    assert_eq!(h.token.balance(&h.alice), 750);
    assert_eq!(h.token.balance(&h.client.address), 250);

    assert_eq!(h.client.total_tips(), 250);
    assert_eq!(h.client.tip_count(), 1);
    assert_eq!(h.client.tips_by(&h.alice), 250);
    assert_eq!(h.client.tips_by(&h.bob), 0);
    assert_eq!(h.client.last_message(), note);
    assert_eq!(h.client.balance(), 250);
}

#[test]
fn tips_accumulate_per_address() {
    let h = setup(1_000);
    let note = String::from_str(&h.env, "again");

    h.client.tip(&h.alice, &100, &note);
    h.client.tip(&h.alice, &50, &note);
    h.client.tip(&h.bob, &400, &note);

    assert_eq!(h.client.tips_by(&h.alice), 150);
    assert_eq!(h.client.tips_by(&h.bob), 400);
    assert_eq!(h.client.total_tips(), 550);
    assert_eq!(h.client.tip_count(), 3);
}

#[test]
fn tip_emits_an_event() {
    let h = setup(1_000);
    let note = String::from_str(&h.env, "thanks");

    h.client.tip(&h.alice, &75, &note);

    // The token contract emits its own `transfer` event during the tip, so we
    // narrow to the jar's own events rather than assuming a single event.
    let ours = h.env.events().all().filter_by_contract(&h.client.address);

    // What the event carries is checked through the state it mirrors
    // (`total_tips`, `tips_by`, `last_message`); here we only pin down that the
    // jar emits exactly one, so a refactor cannot silently double-publish.
    assert_eq!(
        ours.events().len(),
        1,
        "expected exactly one tip event from the jar"
    );
}

#[test]
fn tip_rejects_non_positive_amounts() {
    let h = setup(1_000);
    let note = String::from_str(&h.env, "nope");

    assert_eq!(
        h.client.try_tip(&h.alice, &0, &note),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        h.client.try_tip(&h.alice, &-5, &note),
        Err(Ok(Error::InvalidAmount))
    );

    // A rejected tip must leave no trace.
    assert_eq!(h.client.total_tips(), 0);
    assert_eq!(h.client.tip_count(), 0);
    assert_eq!(h.token.balance(&h.alice), 1_000);
}

#[test]
fn tip_rejects_an_oversized_message() {
    let h = setup(1_000);
    let long = String::from_str(&h.env, LONG_MESSAGE);

    assert_eq!(
        h.client.try_tip(&h.alice, &10, &long),
        Err(Ok(Error::MessageTooLong))
    );
    assert_eq!(h.client.tip_count(), 0);
}

#[test]
fn tip_requires_the_tipper_to_authorize() {
    let env = Env::default();
    // Note: no mock_all_auths here, so the missing signature is a real failure.
    let issuer = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(issuer);
    let token_id = asset.address();

    let owner = Address::generate(&env);
    let alice = Address::generate(&env);
    let contract_id = env.register(TipJar, ());
    let client = TipJarClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.initialize(&owner, &token_id);
    env.set_auths(&[]);

    let note = String::from_str(&env, "unsigned");
    let result = client.try_tip(&alice, &10, &note);
    assert!(result.is_err(), "an unauthorized tip must not succeed");
}

#[test]
fn tip_fails_when_the_tipper_cannot_cover_it() {
    let h = setup(100);
    let note = String::from_str(&h.env, "overdraft");

    // The token contract panics on an underfunded transfer, which rolls the
    // whole invocation back rather than recording a phantom tip.
    let result = h.client.try_tip(&h.alice, &500, &note);
    assert!(result.is_err());
    assert_eq!(h.client.total_tips(), 0);
    assert_eq!(h.token.balance(&h.alice), 100);
}

#[test]
fn owner_can_withdraw_everything() {
    let h = setup(1_000);
    let note = String::from_str(&h.env, "for you");

    h.client.tip(&h.alice, &300, &note);
    h.client.tip(&h.bob, &200, &note);

    let taken = h.client.withdraw(&h.owner);

    assert_eq!(taken, 500);
    assert_eq!(h.token.balance(&h.owner), 500);
    assert_eq!(h.token.balance(&h.client.address), 0);
    // Withdrawing moves funds but must not erase the tipping history.
    assert_eq!(h.client.total_tips(), 500);
    assert_eq!(h.client.tips_by(&h.alice), 300);
}

#[test]
fn withdraw_rejects_an_empty_jar() {
    let h = setup(1_000);
    assert_eq!(
        h.client.try_withdraw(&h.owner),
        Err(Ok(Error::NothingToWithdraw))
    );
}

#[test]
fn withdraw_requires_the_owner_signature() {
    let h = setup(1_000);
    h.client
        .tip(&h.alice, &300, &String::from_str(&h.env, "hi"));

    // Drop the blanket auth mock so the owner check is enforced for real.
    h.env.set_auths(&[]);

    let result = h.client.try_withdraw(&h.alice);
    assert!(result.is_err(), "a non-owner must not be able to withdraw");
    assert_eq!(h.token.balance(&h.client.address), 300);
}

const LONG_MESSAGE: &str = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
