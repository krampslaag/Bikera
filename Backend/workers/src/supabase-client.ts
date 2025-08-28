import { createClient } from '@supabase/supabase-js';

export class SupabaseClient {
  private supabase: any;
  
  constructor(url: string, key: string) {
    this.supabase = createClient(url, key);
  }
  
  async storeBatchResults(
    batch: any, 
    validationResult: any, 
    consensusResult: any
  ): Promise<void> {
    // Store batch results
    const { error: batchError } = await this.supabase
      .from('batch_results')
      .insert({
        batch_id: batch.batchId,
        interval_ids: batch.intervals.map(i => i.intervalId),
        validation_result: validationResult,
        consensus_result: consensusResult,
        merkle_root: validationResult.batch_merkle_root,
        winners_count: validationResult.results.reduce(
          (sum, r) => sum + r.cluster_winners.length, 0
        )
      });
    
    if (batchError) throw batchError;
    
    // Store winners
    const winners = [];
    for (const result of validationResult.results) {
      for (const winner of result.cluster_winners) {
        winners.push({
          batch_id: batch.batchId,
          interval_id: result.interval_id,
          user_id_index: winner.uid,
          cluster_center: `(${winner.cluster_center[0]},${winner.cluster_center[1]})`,
          participants: winner.participants,
          reward_amount: this.calculateReward(winner.participants)
        });
      }
    }
    
    if (winners.length > 0) {
      const { error: winnersError } = await this.supabase
        .from('interval_winners')
        .insert(winners);
      
      if (winnersError) throw winnersError;
    }
  }
  
  async storeMovementData(submissions: any[]): Promise<void> {
    const { error } = await this.supabase
      .from('movement_data')
      .insert(submissions);
    
    if (error) throw error;
  }
  
  private calculateReward(participants: number): number {
    if (participants <= 5) return 100;
    if (participants <= 10) return 200;
    if (participants <= 20) return 500;
    return 1000;
  }
}