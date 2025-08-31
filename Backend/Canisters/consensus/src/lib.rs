use candid::{CandidType, Deserialize, Principal, encode_one, decode_one};
use ic_cdk_macros::*;
use ic_stable_structures::{
    StableVec, 
    memory_manager::*,
    DefaultMemoryImpl,
    Storable,
    storable::Bound
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::borrow::Cow;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone)]
pub struct Block {
    pub index: u64,
    pub timestamp: u64,
    pub interval_ids: Vec<u64>,
    pub batch_merkle_root: String,
    pub winner_count: u32,
    pub hash: String,
}

// Implement Storable for Block
impl Storable for Block {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 512,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub uid: u32,
    pub cluster_center: (i32, i32),
    pub participants: u8,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct IntervalResult {
    pub interval_id: u64,
    pub valid: bool,
    pub merkle_root: String,
    pub valid_submissions: u32,
    pub cluster_winners: Vec<ClusterWinner>,
}

// This was missing - define ValidationResult
type ValidationResult = IntervalResult;

#[derive(CandidType, Deserialize)]
pub struct ConsensusRequest {
    pub interval_id: u64,
    pub validation_result: ValidationResult,
    pub edge_server_id: String,
}

#[derive(CandidType, Deserialize)]
pub struct BatchConsensusRequest {
    pub batch_id: String,
    pub interval_ids: Vec<u64>,
    pub batch_results: Vec<IntervalResult>,
    pub batch_merkle_root: String,
    pub edge_server_id: String,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize)]
pub struct ConsensusResult {
    pub success: bool,
    pub block_index: Option<u64>,
    pub block_hash: Option<String>,
    pub confirmations_received: u32,
    pub confirmations_required: u32,
    pub status: String,
}

#[derive(Default)]
struct Config {
    validator_canister: Option<Principal>,
    distributor_canister: Option<Principal>,
    min_confirmations: u8,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = 
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    static BLOCKCHAIN: RefCell<StableVec<Block, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ).unwrap()
    );
    
    static PENDING_CONSENSUS: RefCell<HashMap<u64, Vec<ValidationResult>>> = 
        RefCell::new(HashMap::new());
    
    static CONFIG: RefCell<Config> = RefCell::new(Config::default());
}

#[update]
pub async fn submit_consensus(request: ConsensusRequest) -> Result<String, String> {
    PENDING_CONSENSUS.with(|p| {
        p.borrow_mut()
            .entry(request.interval_id)
            .or_default()
            .push(request.validation_result);
    });
    
    let should_finalize = PENDING_CONSENSUS.with(|p| {
        p.borrow()
            .get(&request.interval_id)
            .map(|results| results.len() >= 2)
            .unwrap_or(false)
    });
    
    if should_finalize {
        finalize_consensus(request.interval_id).await
    } else {
        Ok("pending".to_string())
    }
}

#[update]
pub async fn submit_batch_consensus(request: BatchConsensusRequest) -> ConsensusResult {
    let block = Block {
        index: BLOCKCHAIN.with(|b| b.borrow().len()),
        timestamp: ic_cdk::api::time(),
        interval_ids: request.interval_ids,
        batch_merkle_root: request.batch_merkle_root,
        winner_count: request.batch_results.iter()
            .map(|r| r.cluster_winners.len() as u32)
            .sum(),
        hash: calculate_block_hash(&request.batch_id),
    };
    
    BLOCKCHAIN.with(|b| {
        b.borrow_mut().push(&block).unwrap();
    });
    
    ConsensusResult {
        success: true,
        block_index: Some(block.index),
        block_hash: Some(block.hash),
        confirmations_received: 1,
        confirmations_required: 2,
        status: "Block created".to_string(),
    }
}

async fn finalize_consensus(interval_id: u64) -> Result<String, String> {
    let results = PENDING_CONSENSUS.with(|p| {
        p.borrow_mut().remove(&interval_id).unwrap_or_default()
    });
    
    if results.is_empty() {
        return Err("No consensus data".to_string());
    }
    
    let mut merkle_votes: HashMap<String, u32> = HashMap::new();
    for result in &results {
        *merkle_votes.entry(result.merkle_root.clone()).or_default() += 1;
    }
    
    let winning_merkle = merkle_votes
        .into_iter()
        .max_by_key(|(_, votes)| *votes)
        .map(|(merkle, _)| merkle)
        .unwrap_or_default();
    
    let block = Block {
        index: BLOCKCHAIN.with(|b| b.borrow().len()),
        timestamp: ic_cdk::api::time(),
        interval_ids: vec![interval_id],
        batch_merkle_root: winning_merkle.clone(),
        winner_count: results.iter()
            .map(|r| r.cluster_winners.len() as u32)
            .sum(),
        hash: calculate_block_hash(&interval_id.to_string()),
    };
    
    BLOCKCHAIN.with(|b| {
        b.borrow_mut().push(&block).unwrap();
    });
    
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

fn calculate_block_hash(data: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.update(ic_cdk::api::time().to_string());
    hex::encode(hasher.finalize())
}

#[init]
fn init() {
    ic_cdk::println!("Consensus canister initialized");
}
