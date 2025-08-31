use candid::{CandidType, Deserialize, Principal};
use ic_cdk_macros::*;
use ic_stable_structures::{StableVec, memory_manager::*, Storable, DefaultMemoryImpl};
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use std::cell::RefCell;
use std::collections::HashMap;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone)]
pub struct Block {
    pub index: u64,
    pub interval_id: u64,
    pub merkle_root: String,
    pub winner_count: u32,
    pub timestamp: u64,
    pub hash: String,
}

// Implement Storable for Block
impl Storable for Block {
    const BOUND: Bound = Bound::Bounded { max_size: 1024, is_fixed_size: false };
    
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        use candid::Encode;
        std::borrow::Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        use candid::Decode;
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub user_id: String,
    pub cluster_center: (f32, f32),
    pub participants: u8,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub merkle_root: String,
    pub valid_submissions: u32,
    pub cluster_winners: Vec<ClusterWinner>,
}

#[derive(CandidType, Deserialize)]
pub struct ConsensusRequest {
    pub interval_id: u64,
    pub validation_result: ValidationResult,
    pub edge_server_id: String,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = 
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    static BLOCKCHAIN: RefCell<StableVec<Block, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ).unwrap()
    );
    
    // Temporary consensus data (cleared after finalization)
    static PENDING_CONSENSUS: RefCell<HashMap<u64, Vec<ValidationResult>>> = 
        RefCell::new(HashMap::new());
    
    static CONFIG: RefCell<Config> = RefCell::new(Config::default());
}

#[derive(Default)]
struct Config {
    validator_canister: Option<Principal>,
    distributor_canister: Option<Principal>,
    min_confirmations: u8,
}

#[update]
pub async fn submit_consensus(request: ConsensusRequest) -> Result<String, String> {
    // Store validation result
    PENDING_CONSENSUS.with(|p| {
        p.borrow_mut()
            .entry(request.interval_id)
            .or_default()
            .push(request.validation_result);
    });
    
    // Check if we have enough confirmations
    let should_finalize = PENDING_CONSENSUS.with(|p| {
        p.borrow()
            .get(&request.interval_id)
            .map(|results| results.len() >= 2) // Require 2 edge servers
            .unwrap_or(false)
    });
    
    if should_finalize {
        finalize_consensus(request.interval_id).await
    } else {
        Ok("pending".to_string())
    }
}

async fn finalize_consensus(interval_id: u64) -> Result<String, String> {
    // Get all validation results
    let results = PENDING_CONSENSUS.with(|p| {
        p.borrow_mut().remove(&interval_id).unwrap_or_default()
    });
    
    if results.is_empty() {
        return Err("No consensus data".to_string());
    }
    
    // Simple consensus: majority merkle root wins
    let mut merkle_votes: HashMap<String, u32> = HashMap::new();
    for result in &results {
        *merkle_votes.entry(result.merkle_root.clone()).or_default() += 1;
    }
    
    let winning_merkle = merkle_votes
        .into_iter()
        .max_by_key(|(_, votes)| *votes)
        .map(|(merkle, _)| merkle)
        .unwrap_or_default();
    
    // Find the result with winning merkle root
    let winning_result = results
        .into_iter()
        .find(|r| r.merkle_root == winning_merkle)
        .ok_or("No winning result found".to_string())?;
    
    // Create block
    let block = Block {
        index: BLOCKCHAIN.with(|b| b.borrow().len()),
        interval_id,
        merkle_root: winning_merkle.clone(),
        winner_count: winning_result.cluster_winners.len() as u32,
        timestamp: ic_cdk::api::time(),
        hash: calculate_block_hash(interval_id, &winning_merkle),
    };
    
    // Store block
    BLOCKCHAIN.with(|b| {
        b.borrow_mut().push(&block).unwrap();
    });
    
    // Notify reward distributor
    let distributor = CONFIG.with(|c| c.borrow().distributor_canister);
    if let Some(distributor_canister) = distributor {
        let _: Result<(String,), _> = ic_cdk::call(
            distributor_canister,
            "distribute_rewards",
            (interval_id, winning_result.cluster_winners),
        ).await;
    }
    
    Ok(format!("Block {} created", block.index))
}

#[query]
pub fn get_latest_blocks(count: u32) -> Vec<Block> {
    BLOCKCHAIN.with(|b| {
        let blockchain = b.borrow();
        let len = blockchain.len();
        let start = if len > count as u64 { len - count as u64 } else { 0 };
        
        (start..len)
            .filter_map(|i| blockchain.get(i))
            .collect()
    })
}

fn calculate_block_hash(interval_id: u64, merkle_root: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(interval_id.to_string());
    hasher.update(merkle_root);
    hasher.update(ic_cdk::api::time().to_string());
    hex::encode(hasher.finalize())
}
