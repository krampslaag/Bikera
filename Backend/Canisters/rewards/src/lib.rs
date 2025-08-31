use candid::{CandidType, Deserialize, Principal};
use ic_cdk_macros::*;
use ic_stable_structures::{StableBTreeMap, memory_manager::*, Storable, DefaultMemoryImpl};
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use std::cell::RefCell;

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
    const BOUND: Bound = Bound::Unbounded;
    
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
            // Calculate reward based on cluster size
            let reward = calculate_reward(winner.participants);
            
            let mut user_rewards = rewards_map
                .get(&winner.user_id)
                .unwrap_or(UserRewards {
                    user_id: winner.user_id.clone(),
                    total_rewards: 0,
                    pending_rewards: 0,
                    last_claim: 0,
                    principal: None,
                });
            
            user_rewards.total_rewards += reward;
            user_rewards.pending_rewards += reward;
            
            rewards_map.insert(winner.user_id.clone(), user_rewards);
            updated += 1;
        }
    });
    
    format!("Updated {} users for interval {}", updated, interval_id)
}

#[update]
pub async fn claim_rewards(user_id: String) -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let user_id_clone = user_id.clone(); // Clone for later use
    
    let amount = USER_REWARDS.with(|rewards| {
        let mut rewards_map = rewards.borrow_mut();
        
        if let Some(mut user_rewards) = rewards_map.get(&user_id) {
            // Link principal if first time
            if user_rewards.principal.is_none() {
                user_rewards.principal = Some(caller);
            } else if user_rewards.principal != Some(caller) {
                return Err("Principal mismatch".to_string());
            }
            
            let pending = user_rewards.pending_rewards;
            if pending == 0 {
                return Err("No pending rewards".to_string());
            }
            
            // Update state
            user_rewards.pending_rewards = 0;
            user_rewards.last_claim = ic_cdk::api::time();
            
            rewards_map.insert(user_id, user_rewards);
            
            Ok(pending)
        } else {
            Err("User not found".to_string())
        }
    })?;
    
    ic_cdk::println!("Claimed {} rewards for user {}", amount, user_id_clone);
    
    Ok(amount)
}

#[query]
pub fn get_user_rewards(user_id: String) -> Option<UserRewards> {
    USER_REWARDS.with(|rewards| {
        rewards.borrow().get(&user_id)
    })
}

#[query]
pub fn get_total_rewards() -> u64 {
    USER_REWARDS.with(|rewards| {
        rewards.borrow()
            .iter()
            .map(|(_, user)| user.total_rewards)
            .sum()
    })
}

fn calculate_reward(participants: u8) -> u64 {
    // More participants = more reward (network effect)
    match participants {
        2..=5 => 100,
        6..=10 => 200,
        11..=20 => 500,
        _ => 1000,
    }
}
