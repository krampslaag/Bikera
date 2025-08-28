use candid::{CandidType, Deserialize};
use ic_cdk_macros::*;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

// ===== DATA STRUCTURES =====
#[derive(CandidType, Deserialize)]
pub struct BatchValidationRequest {
    pub interval_ids: Vec<u64>,
    pub submissions_batch: Vec<Vec<CompactSubmission>>,
    pub signature: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CompactSubmission {
    pub uid: u32,      // User ID as index
    pub lat: i32,      // Latitude * 1000000
    pub lon: i32,      // Longitude * 1000000
    pub t: u64,        // Timestamp in seconds
}

#[derive(CandidType, Deserialize)]
pub struct BatchValidationResult {
    pub results: Vec<IntervalResult>,
    pub batch_merkle_root: String,
}

#[derive(CandidType, Deserialize)]
pub struct IntervalResult {
    pub interval_id: u64,
    pub valid: bool,
    pub merkle_root: String,
    pub valid_submissions: u32,
    pub cluster_winners: Vec<ClusterWinner>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub uid: u32,
    pub cluster_center: (i32, i32),
    pub participants: u8,
}

// ===== MAIN VALIDATION FUNCTION =====
#[query]
pub fn validate_batch(request: BatchValidationRequest) -> BatchValidationResult {
    // Verify signature
    if !verify_signature(&request) {
        return BatchValidationResult {
            results: vec![],
            batch_merkle_root: String::from("invalid"),
        };
    }
    
    let mut results = Vec::new();
    let mut all_merkle_roots = Vec::new();
    
    // Process each interval
    for (idx, interval_id) in request.interval_ids.iter().enumerate() {
        if let Some(submissions) = request.submissions_batch.get(idx) {
            let result = process_interval(*interval_id, submissions);
            all_merkle_roots.push(result.merkle_root.clone());
            results.push(result);
        }
    }
    
    // Compute batch merkle root
    let batch_merkle_root = compute_batch_merkle_root(&all_merkle_roots);
    
    BatchValidationResult {
        results,
        batch_merkle_root,
    }
}

fn process_interval(interval_id: u64, submissions: &[CompactSubmission]) -> IntervalResult {
    // Filter valid submissions
    let valid_submissions: Vec<_> = submissions
        .iter()
        .filter(|s| is_valid_submission(s, interval_id))
        .cloned()
        .collect();
    
    // Cluster submissions
    let clusters = cluster_submissions(&valid_submissions);
    
    // Select winners
    let winners = select_cluster_winners(clusters);
    
    // Compute merkle root
    let merkle_root = compute_merkle_root(&winners);
    
    IntervalResult {
        interval_id,
        valid: true,
        merkle_root,
        valid_submissions: valid_submissions.len() as u32,
        cluster_winners: winners,
    }
}

// ===== HELPER FUNCTIONS =====
fn cluster_submissions(submissions: &[CompactSubmission]) -> HashMap<(i32, i32), Vec<CompactSubmission>> {
    let mut clusters = HashMap::new();
    
    for sub in submissions {
        // Grid clustering: 0.01 degree precision (~1km)
        let grid_x = sub.lat / 10000;
        let grid_y = sub.lon / 10000;
        
        clusters.entry((grid_x, grid_y))
            .or_insert_with(Vec::new)
            .push(sub.clone());
    }
    
    clusters
}

fn select_cluster_winners(clusters: HashMap<(i32, i32), Vec<CompactSubmission>>) -> Vec<ClusterWinner> {
    clusters
        .into_iter()
        .filter_map(|((grid_x, grid_y), submissions)| {
            if submissions.len() >= 2 {
                let winner_idx = ((grid_x + grid_y) as usize) % submissions.len();
                let winner = &submissions[winner_idx];
                
                Some(ClusterWinner {
                    uid: winner.uid,
                    cluster_center: (grid_x, grid_y),
                    participants: submissions.len() as u8,
                })
            } else {
                None
            }
        })
        .take(100) // Max 100 winners per interval
        .collect()
}

fn is_valid_submission(sub: &CompactSubmission, interval_id: u64) -> bool {
    let lat = sub.lat as f64 / 1_000_000.0;
    let lon = sub.lon as f64 / 1_000_000.0;
    
    // Check valid coordinates
    if lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0 {
        return false;
    }
    
    // Check timestamp is within interval (30 minutes)
    let interval_start = interval_id * 1800; // 30 minutes in seconds
    let interval_end = interval_start + 1800;
    
    sub.t >= interval_start && sub.t <= interval_end
}

fn verify_signature(request: &BatchValidationRequest) -> bool {
    // TODO: Implement proper HMAC verification
    request.signature.len() > 10
}

fn compute_merkle_root(winners: &[ClusterWinner]) -> String {
    if winners.is_empty() {
        return String::from("empty");
    }
    
    let mut hasher = Sha256::new();
    for winner in winners {
        hasher.update(winner.uid.to_be_bytes());
        hasher.update(winner.cluster_center.0.to_be_bytes());
        hasher.update(winner.cluster_center.1.to_be_bytes());
        hasher.update(&[winner.participants]);
    }
    
    hex::encode(hasher.finalize())
}

fn compute_batch_merkle_root(roots: &[String]) -> String {
    let mut hasher = Sha256::new();
    for root in roots {
        hasher.update(root.as_bytes());
    }
    hex::encode(hasher.finalize())
}

#[init]
fn init() {
    ic_cdk::println!("Validator canister initialized");
}