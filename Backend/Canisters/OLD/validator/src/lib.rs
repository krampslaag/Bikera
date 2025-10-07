use candid::{CandidType, Deserialize};
use ic_cdk_macros::*;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
pub struct BatchValidationRequest {
    pub interval_ids: Vec<u64>,
    pub submissions_batch: Vec<Vec<CompactSubmission>>,
    pub signature: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CompactSubmission {
    pub uid: u32,
    pub lat: i32,
    pub lon: i32,
    pub t: u64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct BatchValidationResult {
    pub results: Vec<IntervalResult>,
    pub batch_merkle_root: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct IntervalResult {
    pub valid: bool,
    pub interval_id: u64,
    pub merkle_root: String,
    pub cluster_winners: Vec<ClusterWinner>,
    pub valid_submissions: u32,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ClusterWinner {
    pub uid: u32,
    pub cluster_center: (i32, i32),
    pub participants: u8,
}

#[query]
pub fn validate_batch(request: BatchValidationRequest) -> BatchValidationResult {
    // Basic validation
    let mut all_winners = Vec::new();
    let mut total_valid = 0u32;
    
    for (_interval_idx, submissions) in request.submissions_batch.iter().enumerate() {
        // Validate each submission
        let valid_submissions: Vec<_> = submissions
            .iter()
            .filter(|s| is_valid_location(s.lat, s.lon))
            .collect();
        
        total_valid += valid_submissions.len() as u32;
        
        // Simple clustering - group by approximate location
        let mut location_groups: HashMap<(i32, i32), Vec<&CompactSubmission>> = HashMap::new();
        
        for submission in &valid_submissions {
            // Grid-based clustering (1km precision)
            let grid_lat = submission.lat / 1000;
            let grid_lon = submission.lon / 1000;
            location_groups.entry((grid_lat, grid_lon)).or_default().push(submission);
        }
        
        // Select winners from each cluster
        for ((grid_lat, grid_lon), group) in location_groups {
            if group.len() >= 1 {  // Minimum 2 people per cluster
                let winner_idx = (grid_lat + grid_lon) as usize % group.len();
                let winner = group[winner_idx];
                
                all_winners.push(ClusterWinner {
                    uid: winner.uid,
                    cluster_center: (grid_lat, grid_lon),
                    participants: group.len() as u8,
                    });
                }
            }
      }
        let merkle_root = compute_merkle_root(&all_winners); 
           
        let interval_results: Vec<IntervalResult> = request.interval_ids.iter().map(|&interval_id| {
             IntervalResult {
                valid: !all_winners.is_empty(),
                interval_id,
                merkle_root: merkle_root.clone(),
                cluster_winners: all_winners.clone(),
                valid_submissions: total_valid,
                }
          }).collect();
          
    
    
    BatchValidationResult {
        results: interval_results,
        batch_merkle_root: merkle_root,
    }
}

fn is_valid_location(lat: i32, lon: i32) -> bool {
    // Lat/lon are in microdegrees (-90 to 90, -180 to 180)
    lat >= -90_000_000 && lat <= 90_000_000 && 
    lon >= -180_000_000 && lon <= 180_000_000
}

fn compute_merkle_root(winners: &[ClusterWinner]) -> String {
    if winners.is_empty() {
        return "empty".to_string();
    }
    
    let mut hasher = Sha256::new();
    for winner in winners {
        hasher.update(&winner.uid.to_string());
        hasher.update(&winner.cluster_center.0.to_be_bytes());
        hasher.update(&winner.cluster_center.1.to_be_bytes());
    }
    
    hex::encode(hasher.finalize())
}
