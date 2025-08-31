// XP Token Canister - Non-transferable achievement token
// 1 XP = 1 KM traveled
// Located at: Backend/Canisters/xp_token/src/lib.rs

use candid::{CandidType, Deserialize, Principal};
use ic_cdk_macros::*;
use ic_cdk::api::time;
use std::cell::RefCell;
use std::collections::HashMap;
use serde::Serialize;

// ============= DATA STRUCTURES =============

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct XPBalance {
    pub principal: Principal,
    pub balance: u64,  // Total XP (1 XP = 1 KM)
    pub last_mint: u64, // Timestamp of last mint
    pub total_mints: u32, // Number of times XP was minted
}

#[derive(CandidType, Deserialize, Serialize, Clone)]
pub struct MintEvent {
    pub user: Principal,
    pub amount: u64,
    pub date_range: String,
    pub timestamp: u64,
    pub data_hash: String,
    pub minted_by: Principal,
}

#[derive(CandidType, Deserialize, Serialize)]
pub struct MintRequest {
    pub user_principal: Principal,
    pub xp_amount: u64,  // In smallest units (1 XP = 1000 units for precision)
    pub data_hash: String,
    pub period_start: String,
    pub period_end: String,
}

#[derive(CandidType, Deserialize, Serialize)]
pub struct BatchMintRequest {
    pub distributions: Vec<MintRequest>,
    pub batch_hash: String,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Serialize)]
pub struct XPStats {
    pub total_supply: u64,
    pub total_users: u64,
    pub total_mints: u64,
    pub average_balance: u64,
}

#[derive(CandidType, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u32,
    pub principal: Principal,
    pub balance: u64,
    pub username: Option<String>,
}

#[derive(Default)]
struct XPLedger {
    balances: HashMap<Principal, XPBalance>,
    total_supply: u64,
    minting_history: Vec<MintEvent>,
    authorized_minters: Vec<Principal>,
    owner: Option<Principal>,
    metadata: TokenMetadata,
}

#[derive(CandidType, Deserialize, Serialize, Clone)]
struct TokenMetadata {
    name: String,
    symbol: String,
    decimals: u8,
    description: String,
}

impl Default for TokenMetadata {
    fn default() -> Self {
        TokenMetadata {
            name: "Bikera Experience Points".to_string(),
            symbol: "XP".to_string(),
            decimals: 3, // 1 XP = 1.000 units for precision
            description: "Non-transferable achievement tokens. 1 XP = 1 KM traveled.".to_string(),
        }
    }
}

// ============= STATE MANAGEMENT =============

thread_local! {
    static LEDGER: RefCell<XPLedger> = RefCell::new(XPLedger::default());
}

// ============= INITIALIZATION =============

#[init]
fn init() {
    LEDGER.with(|ledger| {
        let mut l = ledger.borrow_mut();
        l.owner = Some(ic_cdk::caller());
        l.authorized_minters.push(ic_cdk::caller());
        
        // Add the consensus and rewards canisters as authorized minters
        // These should be passed as init arguments in production
    });
    
    ic_cdk::println!("XP Token canister initialized");
}

// ============= MINTING FUNCTIONS =============

#[update]
fn mint_xp(request: MintRequest) -> Result<String, String> {
    // Check authorization
    if !is_authorized_minter() {
        return Err("Unauthorized: Only authorized minters can mint XP".to_string());
    }
    
    // Validate amount (max 1000 km per mint for safety)
    if request.xp_amount > 1_000_000 {
        return Err("Amount exceeds maximum single mint limit (1000 XP)".to_string());
    }
    
    LEDGER.with(|ledger| {
        let mut l = ledger.borrow_mut();
        
        // Get or create balance
        let mut balance = l.balances.get(&request.user_principal)
            .cloned()
            .unwrap_or(XPBalance {
                principal: request.user_principal,
                balance: 0,
                last_mint: 0,
                total_mints: 0,
            });
        
        // Update balance
        balance.balance += request.xp_amount;
        balance.last_mint = time();
        balance.total_mints += 1;
        
        // Update ledger
        l.balances.insert(request.user_principal, balance.clone());
        l.total_supply += request.xp_amount;
        
        // Record mint event
        l.minting_history.push(MintEvent {
            user: request.user_principal,
            amount: request.xp_amount,
            date_range: format!("{} to {}", request.period_start, request.period_end),
            timestamp: time(),
            data_hash: request.data_hash,
            minted_by: ic_cdk::caller(),
        });
        
        Ok(format!(
            "Minted {} XP for principal {}. New balance: {}",
            request.xp_amount / 1000, // Convert to display units
            request.user_principal,
            balance.balance / 1000
        ))
    })
}

#[update]
fn batch_mint_xp(batch: BatchMintRequest) -> Result<BatchMintResult, String> {
    // Check authorization
    if !is_authorized_minter() {
        return Err("Unauthorized: Only authorized minters can mint XP".to_string());
    }
    
    // Validate batch size
    if batch.distributions.len() > 1000 {
        return Err("Batch size exceeds maximum (1000)".to_string());
    }
    
    let mut successful_mints = 0;
    let mut failed_mints = Vec::new();
    let mut total_minted = 0u64;
    
    for request in batch.distributions {
        match mint_xp(request.clone()) {
            Ok(_) => {
                successful_mints += 1;
                total_minted += request.xp_amount;
            },
            Err(e) => {
                failed_mints.push((request.user_principal.to_string(), e));
            }
        }
    }
    
    Ok(BatchMintResult {
        successful_mints,
        failed_mints,
        total_minted,
        timestamp: time(),
    })
}

// ============= QUERY FUNCTIONS =============

#[query]
fn get_balance(user: Principal) -> u64 {
    LEDGER.with(|ledger| {
        ledger.borrow()
            .balances
            .get(&user)
            .map(|b| b.balance)
            .unwrap_or(0)
    })
}

#[query]
fn get_balance_details(user: Principal) -> Option<XPBalance> {
    LEDGER.with(|ledger| {
        ledger.borrow().balances.get(&user).cloned()
    })
}

#[query]
fn get_total_supply() -> u64 {
    LEDGER.with(|ledger| ledger.borrow().total_supply)
}

#[query]
fn get_stats() -> XPStats {
    LEDGER.with(|ledger| {
        let l = ledger.borrow();
        let total_users = l.balances.len() as u64;
        let average_balance = if total_users > 0 {
            l.total_supply / total_users
        } else {
            0
        };
        
        XPStats {
            total_supply: l.total_supply,
            total_users,
            total_mints: l.minting_history.len() as u64,
            average_balance,
        }
    })
}

#[query]
fn get_leaderboard(limit: usize) -> Vec<LeaderboardEntry> {
    LEDGER.with(|ledger| {
        let mut balances: Vec<_> = ledger.borrow()
            .balances
            .iter()
            .map(|(principal, balance)| (*principal, balance.balance))
            .collect();
        
        // Sort by balance descending
        balances.sort_by(|a, b| b.1.cmp(&a.1));
        
        // Take top N and create leaderboard entries
        balances.iter()
            .take(limit.min(100)) // Max 100 entries
            .enumerate()
            .map(|(index, (principal, balance))| LeaderboardEntry {
                rank: (index + 1) as u32,
                principal: *principal,
                balance: *balance,
                username: None, // Could be fetched from user registry
            })
            .collect()
    })
}

#[query]
fn get_metadata() -> TokenMetadata {
    LEDGER.with(|ledger| ledger.borrow().metadata.clone())
}

#[query]
fn get_mint_history(user: Principal, limit: usize) -> Vec<MintEvent> {
    LEDGER.with(|ledger| {
        ledger.borrow()
            .minting_history
            .iter()
            .filter(|event| event.user == user)
            .rev()
            .take(limit.min(50))
            .cloned()
            .collect()
    })
}

// ============= ADMIN FUNCTIONS =============

#[update]
fn add_authorized_minter(minter: Principal) -> Result<String, String> {
    if !is_owner() {
        return Err("Only owner can add authorized minters".to_string());
    }
    
    LEDGER.with(|ledger| {
        let mut l = ledger.borrow_mut();
        if !l.authorized_minters.contains(&minter) {
            l.authorized_minters.push(minter);
            Ok(format!("Added {} as authorized minter", minter))
        } else {
            Err("Minter already authorized".to_string())
        }
    })
}

#[update]
fn remove_authorized_minter(minter: Principal) -> Result<String, String> {
    if !is_owner() {
        return Err("Only owner can remove authorized minters".to_string());
    }
    
    LEDGER.with(|ledger| {
        let mut l = ledger.borrow_mut();
        l.authorized_minters.retain(|&x| x != minter);
        Ok(format!("Removed {} from authorized minters", minter))
    })
}

#[query]
fn get_authorized_minters() -> Vec<Principal> {
    LEDGER.with(|ledger| ledger.borrow().authorized_minters.clone())
}

// ============= HELPER FUNCTIONS =============

fn is_authorized_minter() -> bool {
    let caller = ic_cdk::caller();
    LEDGER.with(|ledger| {
        ledger.borrow().authorized_minters.contains(&caller)
    })
}

fn is_owner() -> bool {
    let caller = ic_cdk::caller();
    LEDGER.with(|ledger| {
        ledger.borrow().owner == Some(caller)
    })
}

// ============= TRANSFER FUNCTIONS (INTENTIONALLY NOT IMPLEMENTED) =============
// XP tokens are soulbound - they cannot be transferred between accounts
// These functions return errors to make it clear that transfers are not supported

#[update]
fn transfer(_to: Principal, _amount: u64) -> Result<String, String> {
    Err("XP tokens are non-transferable. They are permanently bound to the earning account.".to_string())
}

#[update]
fn transfer_from(_from: Principal, _to: Principal, _amount: u64) -> Result<String, String> {
    Err("XP tokens are non-transferable. They cannot be moved between accounts.".to_string())
}

// ============= RESULT TYPES =============

#[derive(CandidType, Deserialize, Serialize)]
struct BatchMintResult {
    successful_mints: u32,
    failed_mints: Vec<(String, String)>,
    total_minted: u64,
    timestamp: u64,
}

// ============= CANDID INTERFACE =============

ic_cdk::export_candid!();