// Minimal ICP canister that only handles consensus and rewards
// Cost: ~10-50 ICP/month for 10,000 users

use candid::{CandidType, Deserialize, Principal, Nat};
use ic_cdk_macros::*;
use ic_ledger_types::{
    AccountIdentifier, Tokens, DEFAULT_FEE, 
    MAINNET_LEDGER_CANISTER_ID, transfer
};
use serde_json::{Value, json};
use sha2::{Sha256, Digest};
use std::cell::RefCell;
use std::collections::{HashMap, BTreeMap};

// Stable storage for blockchain
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableVec,
    Storable, storable::Bound,
};
use borsh::{BorshSerialize, BorshDeserialize};

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Main blockchain structure - minimal to save storage costs
#[derive(CandidType, Deserialize, BorshSerialize, BorshDeserialize, Clone)]
pub struct Block {
    pub index: u64,
    pub timestamp: u64,
    pub interval_id: u64,
    pub merkle_root: String,
    pub winner_count: u32,
    pub total_rewards: u64,
    pub previous_hash: String,
    pub hash: String,
}

// Batch submission from CloudFlare
#[derive(CandidType, Deserialize)]
pub struct BatchSubmission {
    pub interval_id: u64,
    pub submissions: Vec<CompressedSubmission>,
    pub winners: Vec<Winner>,
    pub merkle_root: String,
    pub timestamp: u64,
    pub signature: String, // From CloudFlare API key
}

#[derive(CandidType, Deserialize)]
pub struct CompressedSubmission {
    pub user_id: String, // UUID from PostgreSQL
    pub lat: f32,        // Using f32 to save space
    pub lon: f32,
    pub t: u64,          // Short field names to save cycles
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Winner {
    pub user_id: String,
    pub reward: u64,
    pub rank: u8,
}

// User account mapping
#[derive(CandidType, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct UserAccount {
    pub postgres_id: String,
    pub principal: Option<Principal>,
    pub account_id: Option<AccountIdentifier>,
    pub total_rewards: u64,
    pub pending_rewards: u64,
    pub last_claim: u64,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = 
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    // Minimal storage - only essentials
    static BLOCKCHAIN: RefCell<StableVec<Block, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ).unwrap()
    );
    
    static USER_ACCOUNTS: RefCell<StableBTreeMap<String, UserAccount, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))
        ));
    
    // Temporary storage for batch processing (cleared after each interval)
    static PENDING_BATCHES: RefCell<HashMap<u64, Vec<BatchSubmission>>> = 
        RefCell::new(HashMap::new());
    
    static CONFIG: RefCell<Config> = RefCell::new(Config::default());
}

#[derive(Default)]
struct Config {
    api_keys: Vec<String>,
    ledger_canister: Principal,
    token_canister: Option<Principal>, // For IMERA token
    owner: Option<Principal>,
    paused: bool,
}

// Initialize canister
#[init]
fn init(api_key: String, owner: Principal) {
    CONFIG.with(|c| {
        let mut config = c.borrow_mut();
        config.api_keys.push(api_key);
        config.owner = Some(owner);
        config.ledger_canister = MAINNET_LEDGER_CANISTER_ID;
    });
    
    ic_cdk::println!("Consensus canister initialized");
}

// Main batch processing endpoint - called by CloudFlare
#[update]
pub async fn process_batch(batch: BatchSubmission) -> Result<ProcessResult, String> {
    // Verify API signature
    if !verify_signature(&batch) {
        return Err("Invalid signature".to_string());
    }
    
    // Check if not paused
    if CONFIG.with(|c| c.borrow().paused) {
        return Err("System paused for maintenance".to_string());
    }
    
    // Store batch (accumulate multiple edge servers)
    PENDING_BATCHES.with(|b| {
        b.borrow_mut()
            .entry(batch.interval_id)
            .or_insert_with(Vec::new)
            .push(batch.clone());
    });
    
    // Check if we should finalize this interval
    let should_finalize = should_finalize_interval(batch.interval_id);
    
    if should_finalize {
        finalize_interval(batch.interval_id).await
    } else {
        Ok(ProcessResult {
            status: "pending".to_string(),
            message: format!("Batch received for interval {}", batch.interval_id),
        })
    }
}

async fn finalize_interval(interval_id: u64) -> Result<ProcessResult, String> {
    // Get all batches for this interval
    let batches = PENDING_BATCHES.with(|b| {
        b.borrow_mut().remove(&interval_id).unwrap_or_default()
    });
    
    if batches.is_empty() {
        return Err("No batches for interval".to_string());
    }
    
    // Merge all winners from different edge servers
    let mut all_winners: HashMap<String, u64> = HashMap::new();
    let mut merkle_leaves = Vec::new();
    
    for batch in batches {
        for winner in batch.winners {
            *all_winners.entry(winner.user_id.clone()).or_insert(0) += winner.reward;
        }
        merkle_leaves.push(batch.merkle_root);
    }
    
    // Create block
    let block = Block {
        index: get_next_block_index(),
        timestamp: ic_cdk::api::time(),
        interval_id,
        merkle_root: calculate_merkle_root(&merkle_leaves),
        winner_count: all_winners.len() as u32,
        total_rewards: all_winners.values().sum(),
        previous_hash: get_last_block_hash(),
        hash: String::new(), // Will be set below
    };
    
    let block_hash = calculate_block_hash(&block);
    let mut final_block = block;
    final_block.hash = block_hash;
    
    // Store block
    BLOCKCHAIN.with(|b| {
        b.borrow_mut().push(&final_block).unwrap();
    });
    
    // Update user rewards (but don't transfer yet - lazy distribution)
    for (user_id, reward) in all_winners.iter() {
        update_user_rewards(user_id, *reward);
    }
    
    Ok(ProcessResult {
        status: "finalized".to_string(),
        message: format!(
            "Interval {} finalized. Block #{} created with {} winners", 
            interval_id, final_block.index, final_block.winner_count
        ),
    })
}

fn update_user_rewards(user_id: &str, reward: u64) {
    USER_ACCOUNTS.with(|accounts| {
        let mut accounts = accounts.borrow_mut();
        
        let mut account = accounts.get(&user_id.to_string()).unwrap_or(UserAccount {
            postgres_id: user_id.to_string(),
            principal: None,
            account_id: None,
            total_rewards: 0,
            pending_rewards: 0,
            last_claim: 0,
        });
        
        account.total_rewards += reward;
        account.pending_rewards += reward;
        
        accounts.insert(user_id.to_string(), account);
    });
}

// User claims rewards (lazy distribution - only when user wants)
#[update]
pub async fn claim_rewards(user_id: String, principal: Principal) -> Result<ClaimResult, String> {
    let pending = USER_ACCOUNTS.with(|accounts| {
        let mut accounts = accounts.borrow_mut();
        
        if let Some(mut account) = accounts.get(&user_id) {
            // Link principal if not linked
            if account.principal.is_none() {
                account.principal = Some(principal);
                account.account_id = Some(AccountIdentifier::from(&principal));
                accounts.insert(user_id.clone(), account.clone());
            }
            
            // Check if principal matches
            if account.principal != Some(principal) {
                return Err("Principal mismatch".to_string());
            }
            
            let pending = account.pending_rewards;
            
            if pending == 0 {
                return Err("No pending rewards".to_string());
            }
            
            // Update account
            account.pending_rewards = 0;
            account.last_claim = ic_cdk::api::time();
            accounts.insert(user_id.clone(), account.clone());
            
            Ok((pending, account.account_id.unwrap()))
        } else {
            Err("User not found".to_string())
        }
    })?;
    
    let (amount, recipient) = pending;
    
    // Transfer ICP or IMERA tokens
    if let Some(token_canister) = CONFIG.with(|c| c.borrow().token_canister) {
        // Transfer IMERA tokens
        transfer_tokens(token_canister, recipient, amount).await
    } else {
        // Transfer ICP (for testing)
        transfer_icp(recipient, amount).await
    }
}

async fn transfer_tokens(
    token_canister: Principal,
    to: AccountIdentifier,
    amount: u64,
) -> Result<ClaimResult, String> {
    // Call IMERA token canister
    let result: Result<(Result<Nat, String>,), _> = ic_cdk::call(
        token_canister,
        "transfer",
        (to, Nat::from(amount)),
    ).await;
    
    match result {
        Ok((Ok(_),)) => Ok(ClaimResult {
            success: true,
            amount,
            transaction_id: format!("tx_{}", ic_cdk::api::time()),
        }),
        _ => Err("Transfer failed".to_string()),
    }
}

async fn transfer_icp(to: AccountIdentifier, amount: u64) -> Result<ClaimResult, String> {
    let amount_e8s = amount * 10_000; // Convert to e8s (0.0001 ICP per IMERA for testing)
    
    let transfer_args = transfer(
        to,
        Tokens::from_e8s(amount_e8s),
        DEFAULT_FEE,
        None,
        None,
        None,
    );
    
    let result = ic_ledger_types::transfer(transfer_args).await;
    
    match result {
        Ok(block_height) => Ok(ClaimResult {
            success: true,
            amount,
            transaction_id: block_height.to_string(),
        }),
        Err(e) => Err(format!("Transfer failed: {:?}", e)),
    }
}

// Query functions (cheap - no cycles cost)

#[query]
fn get_blockchain(start: u64, limit: u64) -> Vec<Block> {
    BLOCKCHAIN.with(|b| {
        let blockchain = b.borrow();
        let mut blocks = Vec::new();
        
        for i in start..std::cmp::min(start + limit, blockchain.len()) {
            if let Some(block) = blockchain.get(i) {
                blocks.push(block);
            }
        }
        
        blocks
    })
}

#[query]
fn get_user_rewards(user_id: String) -> Option<UserRewards> {
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow().get(&user_id).map(|account| UserRewards {
            total_rewards: account.total_rewards,
            pending_rewards: account.pending_rewards,
            last_claim: account.last_claim,
            principal: account.principal.map(|p| p.to_string()),
        })
    })
}

#[query]
fn get_stats() -> CanisterStats {
    let total_blocks = BLOCKCHAIN.with(|b| b.borrow().len());
    let total_users = USER_ACCOUNTS.with(|a| a.borrow().len());
    let total_rewards = USER_ACCOUNTS.with(|accounts| {
        accounts.borrow().iter()
            .map(|(_, account)| account.total_rewards)
            .sum()
    });
    
    CanisterStats {
        total_blocks,
        total_users: total_users as u64,
        total_rewards_distributed: total_rewards,
        cycles_balance: ic_cdk::api::canister_balance(),
    }
}

// Admin functions

#[update(guard = "is_owner")]
fn add_api_key(api_key: String) {
    CONFIG.with(|c| {
        c.borrow_mut().api_keys.push(api_key);
    });
}

#[update(guard = "is_owner")]
fn set_token_canister(canister_id: Principal) {
    CONFIG.with(|c| {
        c.borrow_mut().token_canister = Some(canister_id);
    });
}

#[update(guard = "is_owner")]
fn pause_system(paused: bool) {
    CONFIG.with(|c| {
        c.borrow_mut().paused = paused;
    });
}

fn is_owner() -> Result<(), String> {
    let caller = ic_cdk::caller();
    CONFIG.with(|c| {
        if c.borrow().owner == Some(caller) {
            Ok(())
        } else {
            Err("Not authorized".to_string())
        }
    })
}

// Helper functions

fn verify_signature(batch: &BatchSubmission) -> bool {
    // Verify HMAC signature from CloudFlare
    let api_keys = CONFIG.with(|c| c.borrow().api_keys.clone());
    
    for api_key in api_keys {
        let expected_signature = calculate_hmac(
            &api_key,
            &format!("{}{}", batch.interval_id, batch.merkle_root)
        );
        
        if expected_signature == batch.signature {
            return true;
        }
    }
    
    false
}

fn calculate_hmac(key: &str, data: &str) -> String {
    use hmac::{Hmac, Mac};
    type HmacSha256 = Hmac<Sha256>;
    
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).unwrap();
    mac.update(data.as_bytes());
    let result = mac.finalize();
    
    hex::encode(result.into_bytes())
}

fn should_finalize_interval(interval_id: u64) -> bool {
    // Finalize after 12 minutes (give 2 minutes buffer after 10-minute interval)
    let interval_end = interval_id + 600_000; // 10 minutes in ms
    let buffer = 120_000; // 2 minutes buffer
    let now = ic_cdk::api::time() / 1_000_000; // Convert to ms
    
    now > interval_end + buffer
}

fn calculate_merkle_root(leaves: &[String]) -> String {
    if leaves.is_empty() {
        return String::new();
    }
    
    if leaves.len() == 1 {
        return leaves[0].clone();
    }
    
    // Simple merkle tree implementation
    let mut current_level = leaves.to_vec();
    
    while current_level.len() > 1 {
        let mut next_level = Vec::new();
        
        for i in (0..current_level.len()).step_by(2) {
            let left = &current_level[i];
            let right = if i + 1 < current_level.len() {
                &current_level[i + 1]
            } else {
                left
            };
            
            let mut hasher = Sha256::new();
            hasher.update(left);
            hasher.update(right);
            next_level.push(hex::encode(hasher.finalize()));
        }
        
        current_level = next_level;
    }
    
    current_level[0].clone()
}

fn calculate_block_hash(block: &Block) -> String {
    let mut hasher = Sha256::new();
    hasher.update(block.index.to_string());
    hasher.update(block.timestamp.to_string());
    hasher.update(block.interval_id.to_string());
    hasher.update(&block.merkle_root);
    hasher.update(block.winner_count.to_string());
    hasher.update(block.total_rewards.to_string());
    hasher.update(&block.previous_hash);
    
    hex::encode(hasher.finalize())
}

fn get_next_block_index() -> u64 {
    BLOCKCHAIN.with(|b| b.borrow().len())
}

fn get_last_block_hash() -> String {
    BLOCKCHAIN.with(|b| {
        let blockchain = b.borrow();
        if blockchain.len() == 0 {
            "0".to_string()
        } else {
            blockchain.get(blockchain.len() - 1).unwrap().hash.clone()
        }
    })
}

// Types for responses

#[derive(CandidType, Deserialize)]
pub struct ProcessResult {
    pub status: String,
    pub message: String,
}

#[derive(CandidType, Deserialize)]
pub struct ClaimResult {
    pub success: bool,
    pub amount: u64,
    pub transaction_id: String,
}

#[derive(CandidType, Deserialize)]
pub struct UserRewards {
    pub total_rewards: u64,
    pub pending_rewards: u64,
    pub last_claim: u64,
    pub principal: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub struct CanisterStats {
    pub total_blocks: u64,
    pub total_users: u64,
    pub total_rewards_distributed: u64,
    pub cycles_balance: u128,
}

// Implement Storable for stable storage
impl Storable for Block {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        std::borrow::Cow::Owned(self.try_to_vec().unwrap())
    }
    
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self::try_from_slice(&bytes).unwrap()
    }
    
    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for UserAccount {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        std::borrow::Cow::Owned(self.try_to_vec().unwrap())
    }
    
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self::try_from_slice(&bytes).unwrap()
    }
    
    const BOUND: Bound = Bound::Unbounded;
}