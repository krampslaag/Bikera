// backend/workers/src/batcher.ts
// Handles batching of multiple intervals to reduce ICP calls

import { DataCompressor } from './compressor';
import * as crypto from 'crypto';

// ============= TYPE DEFINITIONS =============

export interface FullSubmission {
  user_id: string;
  lat: number;
  lon: number;
  timestamp: number;
  speed?: number;
  altitude?: number;
}

export interface CompactSubmission {
  uid: number;      // User index (compressed)
  lat: number;      // Lat * 1000000 as integer
  lon: number;      // Lon * 1000000 as integer
  t: number;        // Timestamp in seconds
}

export interface IntervalData {
  intervalId: number;
  submissions: CompactSubmission[];
  merkleRoot?: string;
  winners?: CompactWinner[];
  startTime: number;
  endTime: number;
}

export interface CompactWinner {
  uid: number;
  gridX: number;
  gridY: number;
  participants: number;
}

export interface IntervalBatch {
  batchId: string;
  intervals: IntervalData[];
  startTime: number;
  endTime: number;
  totalSubmissions: number;
  userMapping?: Record<number, string>;
}

export interface BatcherConfig {
  batchSize: number;              // Number of intervals per batch
  intervalDuration: number;       // Duration of each interval in ms
  maxWinnersPerInterval: number;  // Max winners per interval
  minClusterSize: number;         // Min participants for cluster
}

// ============= INTERVAL BATCHER CLASS =============

export class IntervalBatcher {
  private pendingIntervals: Map<number, IntervalData> = new Map();
  private processedBatches: string[] = [];
  private config: BatcherConfig;
  
  constructor(
    private compressor: DataCompressor,
    config?: Partial<BatcherConfig>
  ) {
    // Default configuration
    this.config = {
      batchSize: 5,                          // Process 5 intervals at once
      intervalDuration: 30 * 60 * 1000,      // 30 minutes
      maxWinnersPerInterval: 100,            // Max 100 winners per interval
      minClusterSize: 2,                     // Min 2 people per cluster
      ...config
    };
  }

  // ============= SUBMISSION HANDLING =============
  
  /**
   * Add a new submission to the appropriate interval
   */
  addSubmission(submission: FullSubmission): void {
    const intervalId = this.getIntervalId(submission.timestamp);
    
    // Create interval if doesn't exist
    if (!this.pendingIntervals.has(intervalId)) {
      const startTime = intervalId * this.config.intervalDuration;
      const endTime = startTime + this.config.intervalDuration;
      
      this.pendingIntervals.set(intervalId, {
        intervalId,
        submissions: [],
        startTime,
        endTime
      });
    }
    
    // Compress and add submission
    const compact = this.compressor.compress(submission);
    const interval = this.pendingIntervals.get(intervalId)!;
    interval.submissions.push(compact);
  }

  /**
   * Add multiple submissions at once
   */
  addBulkSubmissions(submissions: FullSubmission[]): void {
    submissions.forEach(sub => this.addSubmission(sub));
  }

  // ============= INTERVAL MANAGEMENT =============
  
  /**
   * Get interval ID for a given timestamp
   */
  private getIntervalId(timestamp: number): number {
    return Math.floor(timestamp / this.config.intervalDuration);
  }

  /**
   * Check if we should process batches
   */
  shouldProcessBatch(): boolean {
    const now = Date.now();
    const currentHour = new Date(now).getHours();
    const currentMinute = new Date(now).getMinutes();
    
    // Process at end of each hour
    const isEndOfHour = currentMinute >= 55;
    
    // Or if we have enough intervals
    const hasEnoughIntervals = this.pendingIntervals.size >= this.config.batchSize;
    
    // Or if oldest interval is too old (> 2 hours)
    const oldestInterval = Math.min(...Array.from(this.pendingIntervals.keys()));
    const currentInterval = this.getIntervalId(now);
    const isTooOld = (currentInterval - oldestInterval) > 4; // 4 intervals = 2 hours
    
    return isEndOfHour || hasEnoughIntervals || isTooOld;
  }

  // ============= BATCH PROCESSING =============
  
  /**
   * Get next batch for processing
   */
  getBatch(): IntervalBatch | null {
    if (this.pendingIntervals.size === 0) {
      return null;
    }
    
    // Sort intervals by ID (chronological order)
    const sortedIntervals = Array.from(this.pendingIntervals.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, this.config.batchSize);
    
    if (sortedIntervals.length === 0) {
      return null;
    }
    
    // Create batch
    const intervals = sortedIntervals.map(([_, data]) => data);
    const startTime = intervals[0].startTime;
    const endTime = intervals[intervals.length - 1].endTime;
    const batchId = `batch_${startTime}_${endTime}_${Date.now()}`;
    
    // Calculate total submissions
    const totalSubmissions = intervals.reduce(
      (sum, interval) => sum + interval.submissions.length, 
      0
    );
    
    // Remove processed intervals from pending
    sortedIntervals.forEach(([id]) => this.pendingIntervals.delete(id));
    
    // Track processed batch
    this.processedBatches.push(batchId);
    if (this.processedBatches.length > 100) {
      this.processedBatches.shift(); // Keep only last 100
    }
    
    return {
      batchId,
      intervals,
      startTime,
      endTime,
      totalSubmissions,
      userMapping: this.compressor.getUserMapping()
    };
  }

  /**
   * Process batch locally (clustering and winner selection)
   */
  processLocally(batch: IntervalBatch): IntervalBatch {
    for (const interval of batch.intervals) {
      // Skip if already processed
      if (interval.merkleRoot) continue;
      
      // Perform clustering
      const clusters = this.clusterSubmissions(interval.submissions);
      
      // Select winners
      interval.winners = this.selectWinners(clusters);
      
      // Compute merkle root
      interval.merkleRoot = this.computeMerkleRoot(interval.winners);
    }
    
    return batch;
  }

  // ============= CLUSTERING ALGORITHM =============
  
  /**
   * Cluster submissions by geographic proximity
   */
  private clusterSubmissions(
    submissions: CompactSubmission[]
  ): Map<string, CompactSubmission[]> {
    const clusters = new Map<string, CompactSubmission[]>();
    
    for (const sub of submissions) {
      // Grid clustering at 0.01 degree precision (~1km)
      // Since coordinates are multiplied by 1,000,000
      const gridX = Math.floor(sub.lat / 10000);
      const gridY = Math.floor(sub.lon / 10000);
      const key = `${gridX},${gridY}`;
      
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key)!.push(sub);
    }
    
    return clusters;
  }

  /**
   * Select winners from clusters
   */
  private selectWinners(
    clusters: Map<string, CompactSubmission[]>
  ): CompactWinner[] {
    const winners: CompactWinner[] = [];
    
    for (const [key, submissions] of clusters) {
      // Check minimum cluster size
      if (submissions.length < this.config.minClusterSize) {
        continue;
      }
      
      const [gridX, gridY] = key.split(',').map(Number);
      
      // Deterministic random selection based on grid position
      // This ensures consensus across different nodes
      const seed = gridX * 1000 + gridY;
      const winnerIdx = this.deterministicRandom(seed, submissions.length);
      const winner = submissions[winnerIdx];
      
      winners.push({
        uid: winner.uid,
        gridX,
        gridY,
        participants: submissions.length
      });
    }
    
    // Limit winners per interval
    return winners.slice(0, this.config.maxWinnersPerInterval);
  }

  /**
   * Deterministic random number generator
   */
  private deterministicRandom(seed: number, max: number): number {
    // Simple deterministic random using seed
    const x = Math.sin(seed) * 10000;
    return Math.floor((x - Math.floor(x)) * max);
  }

  // ============= MERKLE ROOT COMPUTATION =============
  
  /**
   * Compute merkle root for winners
   */
  private computeMerkleRoot(winners: CompactWinner[]): string {
    if (winners.length === 0) {
      return 'empty';
    }
    
    // Create leaf nodes
    const leaves = winners.map(winner => {
      const data = `${winner.uid}:${winner.gridX}:${winner.gridY}:${winner.participants}`;
      return this.hash(data);
    });
    
    // Build merkle tree
    return this.buildMerkleTree(leaves);
  }

  /**
   * Build merkle tree from leaves
   */
  private buildMerkleTree(leaves: string[]): string {
    if (leaves.length === 0) return 'empty';
    if (leaves.length === 1) return leaves[0];
    
    const nextLevel: string[] = [];
    
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = leaves[i + 1] || left; // Duplicate last if odd number
      nextLevel.push(this.hash(left + right));
    }
    
    return this.buildMerkleTree(nextLevel);
  }

  /**
   * Hash function using SHA-256
   */
  private hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // ============= STATE MANAGEMENT =============
  
  /**
   * Get current batcher statistics
   */
  getStats(): {
    pendingIntervals: number;
    pendingSubmissions: number;
    processedBatches: number;
    shouldProcess: boolean;
    oldestInterval?: number;
    newestInterval?: number;
  } {
    const pendingSubmissions = Array.from(this.pendingIntervals.values())
      .reduce((sum, interval) => sum + interval.submissions.length, 0);
    
    const intervalIds = Array.from(this.pendingIntervals.keys());
    
    return {
      pendingIntervals: this.pendingIntervals.size,
      pendingSubmissions,
      processedBatches: this.processedBatches.length,
      shouldProcess: this.shouldProcessBatch(),
      oldestInterval: intervalIds.length > 0 ? Math.min(...intervalIds) : undefined,
      newestInterval: intervalIds.length > 0 ? Math.max(...intervalIds) : undefined
    };
  }

  /**
   * Serialize batcher state for persistence
   */
  serialize(): string {
    return JSON.stringify({
      pendingIntervals: Array.from(this.pendingIntervals.entries()),
      processedBatches: this.processedBatches,
      config: this.config
    });
  }

  /**
   * Restore batcher state from serialized data
   */
  restore(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.pendingIntervals) {
        this.pendingIntervals = new Map(parsed.pendingIntervals);
      }
      
      if (parsed.processedBatches) {
        this.processedBatches = parsed.processedBatches;
      }
      
      if (parsed.config) {
        this.config = { ...this.config, ...parsed.config };
      }
    } catch (error) {
      console.error('Failed to restore batcher state:', error);
    }
  }

  /**
   * Clear all pending intervals (use with caution)
   */
  clear(): void {
    this.pendingIntervals.clear();
  }

  /**
   * Force process specific intervals
   */
  forceProcessIntervals(intervalIds: number[]): IntervalBatch | null {
    const intervals: IntervalData[] = [];
    
    for (const id of intervalIds) {
      const interval = this.pendingIntervals.get(id);
      if (interval) {
        intervals.push(interval);
        this.pendingIntervals.delete(id);
      }
    }
    
    if (intervals.length === 0) {
      return null;
    }
    
    const startTime = intervals[0].startTime;
    const endTime = intervals[intervals.length - 1].endTime;
    const batchId = `forced_${startTime}_${endTime}_${Date.now()}`;
    
    return {
      batchId,
      intervals,
      startTime,
      endTime,
      totalSubmissions: intervals.reduce((sum, i) => sum + i.submissions.length, 0),
      userMapping: this.compressor.getUserMapping()
    };
  }
}