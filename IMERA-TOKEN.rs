// src/token/lib.rs
use candid::{CandidType, Deserialize, Principal, Nat};
use ic_cdk_macros::*;
use ic_stable_structures::{StableBTreeMap, memory_manager::*};
use std::cell::RefCell;
use std::collections::HashMap;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize)]
pub struct TransferArgs {
    pub from_subaccount: Option<[u8; 32]>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize)]
pub struct TransferResult {
    #[serde(rename = "Ok")]
    pub ok: Option<Nat>, // Transaction ID
    #[serde(rename = "Err")]
    pub err: Option<String>,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = 
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    static BALANCES: RefCell<StableBTreeMap<String, u64, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));
    
    static CONFIG: RefCell<TokenConfig> = RefCell::new(TokenConfig::default());
    static TRANSACTION_COUNTER: RefCell<u64> = RefCell::new(0);
}

#[derive(Default)]
struct TokenConfig {
    name: String,
    symbol: String,
    decimals: u8,
    total_supply: u64,
    fee: u64,
    minting_account: Option<Principal>,
    reward_distributor: Option<Principal>,
}

#[init]
fn init(minting_account: Principal, reward_distributor: Principal) {
    CONFIG.with(|c| {
        let mut config = c.borrow_mut();
        config.name = "Imera Token".to_string();
        config.symbol = "IMERA".to_string();
        config.decimals = 8;
        config.total_supply = 1_000_000_000 * 10_u64.pow(8); // 1B tokens
        config.fee = 10_000; // 0.0001 IMERA
        config.minting_account = Some(minting_account);
        config.reward_distributor = Some(reward_distributor);
    });
    
    // Initialize minting account balance
    BALANCES.with(|b| {
        let total_supply = CONFIG.with(|c| c.borrow().total_supply);
        b.borrow_mut().insert(minting_account.to_text(), total_supply);
    });
}

// ICRC-1 Standard Functions

#[query]
pub fn icrc1_name() -> String {
    CONFIG.with(|c| c.borrow().name.clone())
}

#[query]
pub fn icrc1_symbol() -> String {
    CONFIG.with(|c| c.borrow().symbol.clone())
}

#[query]
pub fn icrc1_decimals() -> u8 {
    CONFIG.with(|c| c.borrow().decimals)
}

#[query]
pub fn icrc1_total_supply() -> Nat {
    Nat::from(CONFIG.with(|c| c.borrow().total_supply))
}

#[query]
pub fn icrc1_balance_of(account: Account) -> Nat {
    let account_id = account_to_string(&account);
    let balance = BALANCES.with(|b| {
        b.borrow().get(&account_id).unwrap_or(0)
    });
    Nat::from(balance)
}

#[update]
pub fn icrc1_transfer(args: TransferArgs) -> TransferResult {
    let caller = ic_cdk::caller();
    let from_account = Account {
        owner: caller,
        subaccount: args.from_subaccount,
    };
    
    let from_id = account_to_string(&from_account);
    let to_id = account_to_string(&args.to);
    
    // Validate transfer
    if from_id == to_id {
        return TransferResult {
            ok: None,
            err: Some("Cannot transfer to self".to_string()),
        };
    }
    
    let amount = args.amount.0.to_u64().unwrap_or(0);
    let fee = CONFIG.with(|c| c.borrow().fee);
    
    if amount == 0 {
        return TransferResult {
            ok: None,
            err: Some("Amount must be greater than 0".to_string()),
        };
    }
    
    // Check balance
    let from_balance = BALANCES.with(|b| {
        b.borrow().get(&from_id).unwrap_or(0)
    });
    
    if from_balance < amount + fee {
        return TransferResult {
            ok: None,
            err: Some("Insufficient balance".to_string()),
        };
    }
    
    // Execute transfer
    BALANCES.with(|b| {
        let mut balances = b.borrow_mut();
        
        // Debit from sender
        let new_from_balance = from_balance - amount - fee;
        balances.insert(from_id, new_from_balance);
        
        // Credit to receiver
        let to_balance = balances.get(&to_id).unwrap_or(0);
        balances.insert(to_id, to_balance + amount);
        
        // Fee goes to treasury (minting account)
        let minting_account = CONFIG.with(|c| c.borrow().minting_account.unwrap());
        let minting_id = minting_account.to_text();
        let minting_balance = balances.get(&minting_id).unwrap_or(0);
        balances.insert(minting_id, minting_balance + fee);
    });
    
    // Generate transaction ID
    let tx_id = TRANSACTION_COUNTER.with(|c| {
        let mut counter = c.borrow_mut();
        *counter += 1;
        *counter
    });
    
    TransferResult {
        ok: Some(Nat::from(tx_id)),
        err: None,
    }
}

// Mint function - called by reward distributor
#[update]
pub fn mint_rewards(to: Principal, amount: u64) -> Result<String, String> {
    let caller = ic_cdk::caller();
    
    // Only reward distributor can mint
    let authorized = CONFIG.with(|c| {
        c.borrow().reward_distributor == Some(caller)
    });
    
    if !authorized {
        return Err("Unauthorized".to_string());
    }
    
    // Mint tokens
    let account_id = to.to_text();
    BALANCES.with(|b| {
        let mut balances = b.borrow_mut();
        let current_balance = balances.get(&account_id).unwrap_or(0);
        balances.insert(account_id, current_balance + amount);
    });
    
    Ok(format!("Minted {} IMERA to {}", amount, to.to_text()))
}

fn account_to_string(account: &Account) -> String {
    match &account.subaccount {
        Some(subaccount) => {
            format!("{}:{}", account.owner.to_text(), hex::encode(subaccount))
        }
        None => account.owner.to_text(),
    }
}