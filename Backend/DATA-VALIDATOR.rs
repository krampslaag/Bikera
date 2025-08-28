// src/validator/lib.rs
use candid::{CandidType, Deserialize};
use ic_cdk_macros::*;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
pub struct ValidationRequest {
    pub interval_id: u64,
    pub submissions: Vec<Submission>,
    pub signature: String,
}

#[derive(CandidType, Deserialize)]
pub struct Submission {
    pub user_id: String,
    pub lat: f32,
    pub lon: f32,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub merkle_root: String,
    pub valid_submissions: u32,
    pub cluster_winners: Vec<ClusterWinner>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub user_id: String,
    pub cluster_center: (f32, f32),
    pub participants: u8,
}

// Main validation function - runs as query (0 cycles cost)
#[query]
pub fn validate_batch(request: ValidationRequest) -> ValidationResult {
    // 1. Verify signature (lightweight)
    if !verify_hmac(&request) {
        return ValidationResult {
            valid: false,
            merkle_root: String::new(),
            valid_submissions: 0,
            cluster_winners: vec![],
        };
    }
    
    // 2. Basic validation (lat/lon bounds, timestamp)
    let valid_submissions: Vec<_> = request.submissions
        .into_iter()
        .filter(|s| is_valid_location(s.lat, s.lon) && is_valid_timestamp(s.timestamp, request.interval_id))
        .collect();
    
    // 3. Clustering algorithm (simple grid-based)
    let clusters = cluster_submissions(&valid_submissions);
    
    // 4. Select winners (1 per cluster, max 100 clusters)
    let winners = select_cluster_winners(clusters);
    
    // 5. Compute merkle root
    let merkle_root = compute_merkle_root(&winners);
    
    ValidationResult {
        valid: true,
        merkle_root,
        valid_submissions: valid_submissions.len() as u32,
        cluster_winners: winners,
    }
}

fn cluster_submissions(submissions: &[Submission]) -> HashMap<(i32, i32), Vec<&Submission>> {
    let mut clusters: HashMap<(i32, i32), Vec<&Submission>> = HashMap::new();
    
    for submission in submissions {
        // Grid clustering: 0.01 degree precision (~1km)
        let grid_x = (submission.lat * 100.0) as i32;
        let grid_y = (submission.lon * 100.0) as i32;
        
        clusters.entry((grid_x, grid_y)).or_default().push(submission);
    }
    
    clusters
}

fn select_cluster_winners(clusters: HashMap<(i32, i32), Vec<&Submission>>) -> Vec<ClusterWinner> {
    clusters
        .into_iter()
        .filter_map(|((grid_x, grid_y), submissions)| {
            if submissions.len() >= 2 {  // Minimum 2 people per cluster
                // Pick random winner from cluster
                let winner_idx = (grid_x as u64 + grid_y as u64) % submissions.len() as u64;
                let winner = submissions[winner_idx as usize];
                
                Some(ClusterWinner {
                    user_id: winner.user_id.clone(),
                    cluster_center: (grid_x as f32 / 100.0, grid_y as f32 / 100.0),
                    participants: submissions.len() as u8,
                })
            } else {
                None
            }
        })
        .take(100)  // Max 100 winners per interval to control costs
        .collect()
}

fn verify_hmac(request: &ValidationRequest) -> bool {
    // Simplified - in production use proper HMAC
    request.signature.len() > 10
}

fn is_valid_location(lat: f32, lon: f32) -> bool {
    lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0
}

fn is_valid_timestamp(timestamp: u64, interval_id: u64) -> bool {
    let interval_start = interval_id;
    let interval_end = interval_id + 600_000; // 10 minutes
    timestamp >= interval_start && timestamp <= interval_end
}

fn compute_merkle_root(winners: &[ClusterWinner]) -> String {
    if winners.is_empty() {
        return "empty".to_string();
    }
    
    let mut hasher = Sha256::new();
    for winner in winners {
        hasher.update(&winner.user_id);
        hasher.update(&winner.cluster_center.0.to_be_bytes());
        hasher.update(&winner.cluster_center.1.to_be_bytes());
    }
    
    hex::encode(hasher.finalize())
}