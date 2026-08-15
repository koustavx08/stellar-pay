#![no_std]

//! A tip jar that holds XLM on behalf of its owner.
//!
//! Tippers call [`TipJar::tip`], which moves tokens from them into the contract
//! and records who gave how much. Only the owner can move funds back out.
//!
//! The contract never handles raw XLM: on Stellar, native XLM is exposed to
//! contracts through the Stellar Asset Contract, so transfers go through the
//! standard token interface and this contract works with any SEP-41 token.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

/// Tip notes are capped so a single tip cannot bloat instance storage.
const MAX_MESSAGE_LEN: u32 = 140;

/// Roughly 30 days of ledgers, at ~5 seconds per ledger.
const LEDGERS_PER_MONTH: u32 = 518_400;
/// Bump TTLs once they drop below ~7 days remaining.
const TTL_THRESHOLD: u32 = 120_960;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The only address allowed to withdraw.
    Owner,
    /// Address of the token this jar accepts (the native XLM SAC in our deployment).
    Token,
    /// Running total ever tipped, in stroops.
    Total,
    /// Number of successful tips.
    Count,
    /// The most recent tip note.
    LastMessage,
    /// Per-tipper running total, in stroops.
    Tipper(Address),
}

/// Emitted on every successful tip. Indexers can follow the `from` topic to
/// build a leaderboard without reading contract storage.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tip {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub message: String,
}

/// Emitted when the owner empties the jar.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdraw {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    MessageTooLong = 4,
    NothingToWithdraw = 5,
}

#[contract]
pub struct TipJar;

#[contractimpl]
impl TipJar {
    /// Sets the owner and the accepted token. Callable exactly once.
    pub fn initialize(env: Env, owner: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Total, &0i128);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::LastMessage, &String::from_str(&env, ""));

        Ok(())
    }

    /// Moves `amount` from `from` into the jar and records the tip.
    ///
    /// `from.require_auth()` is what makes this safe: the token transfer below
    /// debits `from`, so the contract must prove that `from` authorized this
    /// exact call. Without it, anyone could drain anyone else's balance.
    pub fn tip(env: Env, from: Address, amount: i128, message: String) -> Result<(), Error> {
        from.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if message.len() > MAX_MESSAGE_LEN {
            return Err(Error::MessageTooLong);
        }

        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        // Pull the funds in first: if the tipper cannot cover the amount this
        // panics and the whole invocation rolls back, so the counters below
        // can never record a tip that did not actually settle.
        token::TokenClient::new(&env, &token_id).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let total: i128 = env.storage().instance().get(&DataKey::Total).unwrap_or(0);
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        env.storage().instance().set(&DataKey::Total, &(total + amount));
        env.storage().instance().set(&DataKey::Count, &(count + 1));
        env.storage().instance().set(&DataKey::LastMessage, &message);

        let tipper_key = DataKey::Tipper(from.clone());
        let given: i128 = env.storage().persistent().get(&tipper_key).unwrap_or(0);
        env.storage().persistent().set(&tipper_key, &(given + amount));
        env.storage()
            .persistent()
            .extend_ttl(&tipper_key, TTL_THRESHOLD, LEDGERS_PER_MONTH);

        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, LEDGERS_PER_MONTH);

        Tip {
            from,
            amount,
            message,
        }
        .publish(&env);

        Ok(())
    }

    /// Sends the jar's entire balance to `to`. Owner only.
    pub fn withdraw(env: Env, to: Address) -> Result<i128, Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)?;
        owner.require_auth();

        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        let client = token::TokenClient::new(&env, &token_id);
        let balance = client.balance(&env.current_contract_address());
        if balance <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        client.transfer(&env.current_contract_address(), &to, &balance);
        Withdraw {
            to,
            amount: balance,
        }
        .publish(&env);

        Ok(balance)
    }

    /// Total ever tipped, in stroops.
    pub fn total_tips(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Total).unwrap_or(0)
    }

    /// Number of tips received.
    pub fn tip_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// How much a single address has tipped, in stroops.
    pub fn tips_by(env: Env, who: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Tipper(who))
            .unwrap_or(0)
    }

    /// The note attached to the most recent tip.
    pub fn last_message(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::LastMessage)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    /// Current balance held by the jar, in stroops.
    pub fn balance(env: Env) -> Result<i128, Error> {
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        Ok(token::TokenClient::new(&env, &token_id).balance(&env.current_contract_address()))
    }

    pub fn owner(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)
    }

    pub fn token(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod test;
