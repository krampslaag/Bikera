use candid::{CandidType, Deserialize, Principal, encode_one, decode_one};
use ic_cdk_macros::*;
use ic_stable_structures::{
    StableBTreeMap, 
    memory_manager::*,
    DefaultMemoryImpl,
    Storable,
    storable::Bound
};
use std::cell::RefCell;
use std::borrow::Cow;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone)]
pub struct UserRewards {
    pub user_id: String,
    pub total_rewards: u64,
    pub pending_rewards: u64,
    pub last_claim: u64,
    pub principal: Option<Principal>,
}

// Implement Storable for UserRewards
impl Storable for UserRewards {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 256,
        is_fixed_size: false,
    };
}

// Define ClusterWinner type that was missing
#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub uid: u32,
    pub cluster_center: (i32, i32),
    pub participants: u8,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = 
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    static USER_REWARDS: RefCell<StableBTreeMap<String, UserRewards, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));
}

#[update]
pub fn distribute_rewards(interval_id: u64, winners: Vec<ClusterWinner>) -> String {
    let mut updated = 0;
    
    USER_REWARDS.with(|rewards| {
        let mut rewards_map = rewards.borrow_mut();
        
        for winner in winners {
            let reward = calculate_reward(winner.participants);
            let user_id = format!("user_{}", winner.uid);
            
            let mut user_rewards = rewards_map
                .get(&user_id)
                .unwrap_or(UserRewards {
                    user_id: user_id.clone(),
                    total_rewards: 0,
                    pending_rewards: 0,
                    last_claim: 0,
                    principal: None,
                });
            
            user_rewards.total_rewards += reward;
            user_rewards.pending_rewards += reward;
            
            rewards_map.insert(user_id.clone(), user_rewards);
            updated += 1;
        }
    });
    
    format!("Updated {} users for interval {}", updated, interval_id)
}

#[derive(CandidType, Deserialize)]
pub struct ClaimRequest {
    pub user_id: String,
    pub amount: Option<u64>,
}

#[derive(CandidType, Deserialize)]
pub struct ClaimResult {
    pub success: bool,
    pub amount_claimed: u64,
    pub remaining_balance: u64,
    pub transaction_id: Option<String>,
    pub error: Option<String>,
}

#[update]
pub async fn claim_rewards(request: ClaimRequest) -> ClaimResult {
    let caller = ic_cdk::caller();
    
    USER_REWARDS.with(|rewards| {
        let mut rewards_map = rewards.borrow_mut();
        
        if let Some(mut user_rewards) = rewards_map.get(&request.user_id) {
            if user_rewards.principal.is_none() {
                user_rewards.principal = Some(caller);
            } else if user_rewards.principal != Some(caller) {
                return ClaimResult {
                    success: false,
                    amount_claimed: 0,
                    remaining_balance: user_rewards.pending_rewards,
                    transaction_id: None,
                    error: Some("Principal mismatch".to_string()),
                };
            }
            
            let amount = request.amount.unwrap_or(user_rewards.pending_rewards);
            
            if amount > user_rewards.pending_rewards {
                return ClaimResult {
                    success: false,
                    amount_claimed: 0,
                    remaining_balance: user_rewards.pending_rewards,
                    transaction_id: None,
                    error: Some("Insufficient balance".to_string()),
                };
            }
            
            user_rewards.pending_rewards -= amount;
            user_rewards.last_claim = ic_cdk::api::time();
            
            rewards_map.insert(request.user_id.clone(), user_rewards.clone());
            
            ClaimResult {
                success: true,
                amount_claimed: amount,
                remaining_balance: user_rewards.pending_rewards,
                transaction_id: Some(format!("tx_{}", ic_cdk::api::time())),
                error: None,
            }
        } else {
            ClaimResult {
                success: false,
                amount_claimed: 0,
                remaining_balance: 0,
                transaction_id: None,
                error: Some("User not found".to_string()),
            }
        }
    })
}

#[query]
pub fn get_user_rewards(user_id: String) -> Option<UserRewards> {
    USER_REWARDS.with(|rewards| {
        rewards.borrow().get(&user_id)
    })
}

fn calculate_reward(participants: u8) -> u64 {
    match participants {
        2..=5 => 100,
        6..=10 => 200,
        11..=20 => 500,
        _ => 1000,
    }
}

#[init]
fn init() {
    ic_cdk::println!("Rewards canister initialized");
}
