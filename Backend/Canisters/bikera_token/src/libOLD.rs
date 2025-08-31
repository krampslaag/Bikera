// src/lib.rs - Bikera ICRC-1 Token Canister
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk_macros::*;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use std::cell::RefCell;
use std::collections::HashMap;
use serde_bytes::ByteBuf;
use std::borrow::Cow;

// Type aliases
type Memory = VirtualMemory<DefaultMemoryImpl>;

// ICRC-1 Standard Types
#[derive(CandidType, Deserialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct TransferArg {
    pub from_subaccount: Option<[u8; 32]>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum TransferError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

#[derive(CandidType, Deserialize, Clone)]
pub struct StandardRecord {
    pub name: String,
    pub url: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct TokenInitArgs {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: Nat,
    pub minting_account: Option<Account>,
    pub initial_balances: Vec<(Account, Nat)>,
    pub max_supply: Option<Nat>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct MintRequest {
    pub to: Account,
    pub amount: Nat,
    pub memo: Option<ByteBuf>,
    pub created_at_time: Option<u64>,
}

// Storable implementations
impl Storable for Account {
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 64,
            is_fixed_size: false,
        };

    fn to_bytes(&self) -> Cow<[u8]> {
        use candid::Encode;
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        use candid::Decode;
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

impl Storable for Nat {
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;

    fn to_bytes(&self) -> Cow<[u8]> {
        use candid::Encode;
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        use candid::Decode;
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Transaction {
    pub operation: Operation,
    pub timestamp: u64,
    pub memo: Option<ByteBuf>,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum Operation {
    Transfer {
        from: Account,
        to: Account,
        amount: Nat,
        fee: Option<Nat>,
    },
    Mint {
        to: Account,
        amount: Nat,
    },
    Burn {
        from: Account,
        amount: Nat,
    },
}

impl Storable for Transaction {
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;

    fn to_bytes(&self) -> Cow<[u8]> {
        use candid::Encode;
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        use candid::Decode;
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

// Token metadata
#[derive(CandidType, Deserialize, Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: Nat,
    pub total_supply: Nat,
    pub minting_account: Option<Account>,
    pub max_supply: Option<Nat>,
}

// Memory management
const BALANCES_MEMORY_ID: u8 = 0;
const TRANSACTIONS_MEMORY_ID: u8 = 1;
const METADATA_MEMORY_ID: u8 = 2;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static BALANCES: RefCell<StableBTreeMap<Account, Nat, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(BALANCES_MEMORY_ID)))
        )
    );

    static TRANSACTIONS: RefCell<StableBTreeMap<Nat, Transaction, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(TRANSACTIONS_MEMORY_ID)))
        )
    );

    static METADATA: RefCell<TokenMetadata> = RefCell::new(TokenMetadata {
        name: "Bikera Token".to_string(),
        symbol: "BIKERA".to_string(),
        decimals: 8,
        fee: Nat::from(10_000u64),
        total_supply: Nat::from(0u64),
        minting_account: None,
        max_supply: Some(Nat::from(1_000_000_000_000_000u64)), // 10M tokens with 8 decimals
    });

    static TX_COUNTER: RefCell<u64> = RefCell::new(0);

    // Rate limiting and security
    static TRANSFER_LOCKS: RefCell<HashMap<Principal, bool>> = RefCell::new(HashMap::new());
}

#[init]
fn init(args: TokenInitArgs) {
    METADATA.with(|m| {
        let mut metadata = m.borrow_mut();
        metadata.name = args.name;
        metadata.symbol = args.symbol;
        metadata.decimals = args.decimals;
        metadata.fee = args.fee;
        metadata.minting_account = args.minting_account;
        metadata.max_supply = args.max_supply;
    });

    // Set initial balances
    if !args.initial_balances.is_empty() {
        BALANCES.with(|balances| {
            let mut balances = balances.borrow_mut();
            let mut total = Nat::from(0u64);
            
            for (account, amount) in args.initial_balances {
                balances.insert(account, amount.clone());
                total += amount;
            }
            
            METADATA.with(|m| {
                m.borrow_mut().total_supply = total;
            });
        });
    }
}

// ICRC-1 Standard Query Methods
#[query]
fn icrc1_name() -> String {
    METADATA.with(|m| m.borrow().name.clone())
}

#[query]
fn icrc1_symbol() -> String {
    METADATA.with(|m| m.borrow().symbol.clone())
}

#[query]
fn icrc1_decimals() -> u8 {
    METADATA.with(|m| m.borrow().decimals)
}

#[query]
fn icrc1_fee() -> Nat {
    METADATA.with(|m| m.borrow().fee.clone())
}

#[query]
fn icrc1_metadata() -> Vec<(String, candid::types::value::Value)> {
    METADATA.with(|m| {
        let metadata = m.borrow();
        vec![
            ("icrc1:name".to_string(), candid::types::value::Value::Text(metadata.name.clone())),
            ("icrc1:symbol".to_string(), candid::types::value::Value::Text(metadata.symbol.clone())),
            ("icrc1:decimals".to_string(), candid::types::value::Value::Nat(candid::Nat::from(metadata.decimals))),
            ("icrc1:fee".to_string(), candid::types::value::Value::Nat(candid::Nat::from(&metadata.fee))),
        ]
    })
}

#[query]
fn icrc1_total_supply() -> Nat {
    METADATA.with(|m| m.borrow().total_supply.clone())
}

#[query]
fn icrc1_minting_account() -> Option<Account> {
    METADATA.with(|m| m.borrow().minting_account.clone())
}

#[query]
fn icrc1_balance_of(account: Account) -> Nat {
    BALANCES.with(|balances| {
        balances.borrow().get(&account).unwrap_or(Nat::from(0u64))
    })
}

#[query]
fn icrc1_supported_standards() -> Vec<StandardRecord> {
    vec![
        StandardRecord {
            name: "ICRC-1".to_string(),
            url: "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1".to_string(),
        }
    ]
}

// ICRC-1 Standard Update Methods
#[update]
fn icrc1_transfer(args: TransferArg) -> Result<Nat, TransferError> {
    let caller = ic_cdk::api::caller();
    
    // Prevent anonymous callers
    if caller == Principal::anonymous() {
        return Err(TransferError::GenericError {
            error_code: Nat::from(403u32),
            message: "Anonymous transfers not allowed".to_string(),
        });
    }

    // Acquire lock to prevent reentrancy
    acquire_lock(caller)?;

    let result = perform_transfer(caller, args);
    
    // Release lock
    release_lock(caller);
    
    result
}

fn perform_transfer(caller: Principal, args: TransferArg) -> Result<Nat, TransferError> {
    let from_account = Account {
        owner: caller,
        subaccount: args.from_subaccount,
    };

    // Validate transfer parameters
    if args.amount == Nat::from(0u64) {
        return Err(TransferError::GenericError {
            error_code: Nat::from(400u32),
            message: "Transfer amount must be greater than zero".to_string(),
        });
    }

    // Check for self-transfer
    if from_account == args.to {
        return Err(TransferError::GenericError {
            error_code: Nat::from(400u32),
            message: "Cannot transfer to self".to_string(),
        });
    }

    // Get fee
    let fee = args.fee.unwrap_or_else(|| METADATA.with(|m| m.borrow().fee.clone()));
    let expected_fee = METADATA.with(|m| m.borrow().fee.clone());
    
    if fee != expected_fee {
        return Err(TransferError::BadFee { expected_fee });
    }

    // Check timestamp if provided
    if let Some(created_at_time) = args.created_at_time {
        let current_time = ic_cdk::api::time();
        let time_window = 24 * 60 * 60 * 1_000_000_000; // 24 hours in nanoseconds
        
        if created_at_time > current_time {
            return Err(TransferError::CreatedInFuture { ledger_time: current_time });
        }
        
        if current_time - created_at_time > time_window {
            return Err(TransferError::TooOld);
        }
    }

    // Perform balance transfer
    BALANCES.with(|balances| {
        let mut balances = balances.borrow_mut();
        
        let from_balance = balances.get(&from_account).unwrap_or(Nat::from(0u64));
        let total_deduction = &args.amount + &fee;
        
        if from_balance < total_deduction {
            return Err(TransferError::InsufficientFunds { balance: from_balance });
        }

        // Update balances
        let new_from_balance = from_balance - &total_deduction;
        if new_from_balance == Nat::from(0u64) {
            balances.remove(&from_account);
        } else {
            balances.insert(from_account.clone(), new_from_balance);
        }

        let to_balance = balances.get(&args.to).unwrap_or(Nat::from(0u64));
        balances.insert(args.to.clone(), to_balance + &args.amount);

        // Record transaction
        let block_index = record_transaction(Transaction {
            operation: Operation::Transfer {
                from: from_account,
                to: args.to.clone(),
                amount: args.amount.clone(),
                fee: Some(fee),
            },
            timestamp: ic_cdk::api::time(),
            memo: args.memo,
        });

        Ok(block_index)
    })
}

// Minting functions for rewards canister
#[update]
fn mint_rewards(request: MintRequest) -> Result<Nat, String> {
    let caller = ic_cdk::api::caller();
    
    // Only minting account can mint
    let is_authorized = METADATA.with(|m| {
        m.borrow().minting_account
            .as_ref()
            .map(|account| account.owner == caller)
            .unwrap_or(false)
    });
    
    if !is_authorized {
        return Err("Unauthorized: Only rewards canister can mint".to_string());
    }

    // Check max supply if set
    METADATA.with(|m| {
        let metadata = m.borrow();
        if let Some(max_supply) = &metadata.max_supply {
            if &metadata.total_supply + &request.amount > *max_supply {
                return Err("Cannot mint: would exceed max supply".to_string());
            }
        }
        Ok(())
    })?;

    // Mint tokens
    BALANCES.with(|balances| {
        let mut balances = balances.borrow_mut();
        let current_balance = balances.get(&request.to).unwrap_or(Nat::from(0u64));
        balances.insert(request.to.clone(), current_balance + &request.amount);
    });

    // Update total supply
    METADATA.with(|m| {
        let mut metadata = m.borrow_mut();
        metadata.total_supply += &request.amount;
    });

    // Record mint transaction
    let block_index = record_transaction(Transaction {
        operation: Operation::Mint {
            to: request.to.clone(),
            amount: request.amount.clone(),
        },
        timestamp: ic_cdk::api::time(),
        memo: request.memo,
    });

    Ok(block_index)
}

#[update]
fn batch_mint_rewards(recipients: Vec<MintRequest>) -> Vec<Result<Nat, String>> {
    let caller = ic_cdk::api::caller();
    
    // Check authorization once
    let is_authorized = METADATA.with(|m| {
        m.borrow().minting_account
            .as_ref()
            .map(|account| account.owner == caller)
            .unwrap_or(false)
    });
    
    if !is_authorized {
        return vec![Err("Unauthorized".to_string()); recipients.len()];
    }

    let mut results = Vec::new();
    let mut total_minted = Nat::from(0u64);

    for request in recipients {
        // Check max supply
        let can_mint = METADATA.with(|m| {
            let metadata = m.borrow();
            if let Some(max_supply) = &metadata.max_supply {
                &metadata.total_supply + &total_minted + &request.amount <= *max_supply
            } else {
                true
            }
        });

        if !can_mint {
            results.push(Err("Would exceed max supply".to_string()));
            continue;
        }

        // Mint tokens
        BALANCES.with(|balances| {
            let mut balances = balances.borrow_mut();
            let current = balances.get(&request.to).unwrap_or(Nat::from(0u64));
            balances.insert(request.to.clone(), current + &request.amount);
        });

        total_minted += &request.amount;

        // Record transaction
        let block_index = record_transaction(Transaction {
            operation: Operation::Mint {
                to: request.to.clone(),
                amount: request.amount.clone(),
            },
            timestamp: ic_cdk::api::time(),
            memo: request.memo,
        });

        results.push(Ok(block_index));
    }

    // Update total supply
    METADATA.with(|m| {
        m.borrow_mut().total_supply += &total_minted;
    });

    results
}

// Utility functions
fn record_transaction(transaction: Transaction) -> Nat {
    TX_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        let block_index = Nat::from(*counter);
        
        TRANSACTIONS.with(|transactions| {
            transactions.borrow_mut().insert(block_index.clone(), transaction);
        });
        
        block_index
    })
}

fn acquire_lock(principal: Principal) -> Result<(), TransferError> {
    TRANSFER_LOCKS.with(|locks| {
        let mut locks = locks.borrow_mut();
        if locks.get(&principal).unwrap_or(&false) {
            Err(TransferError::TemporarilyUnavailable)
        } else {
            locks.insert(principal, true);
            Ok(())
        }
    })
}

fn release_lock(principal: Principal) {
    TRANSFER_LOCKS.with(|locks| {
        locks.borrow_mut().remove(&principal);
    });
}

// Additional utility methods
#[query]
fn get_transaction(block_index: Nat) -> Option<Transaction> {
    TRANSACTIONS.with(|transactions| {
        transactions.borrow().get(&block_index)
    })
}

#[query]
fn get_holder_count() -> u64 {
    BALANCES.with(|balances| balances.borrow().len())
}

#[query]
fn canister_status() -> candid::types::value::Value {
    use candid::types::value::Value;
    
    let cycles = ic_cdk::api::canister_balance128();
    let memory_size = ic_cdk::api::stable::stable64_size();
    
    Value::Record(vec![
        ("cycles".to_string(), Value::Nat(candid::Nat::from(cycles))),
        ("memory_size".to_string(), Value::Nat(candid::Nat::from(memory_size))),
        ("holder_count".to_string(), Value::Nat(candid::Nat::from(get_holder_count()))),
        ("total_supply".to_string(), Value::Nat(candid::Nat::from(icrc1_total_supply()))),
    ])
}

// Security: Inspect message to reject malicious requests
#[inspect_message]
fn inspect_message() {
    let method_name = ic_cdk::api::call::method_name();
    let caller = ic_cdk::api::caller();
    
    // Reject anonymous callers for state-changing operations
    let state_changing_methods = vec!["icrc1_transfer", "mint_rewards", "batch_mint_rewards"];
    if caller == Principal::anonymous() && state_changing_methods.contains(&method_name.as_str()) {
        return;
    }
    
    ic_cdk::api::call::accept_message();
}