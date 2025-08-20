// src/services/ConsensusBatchService.ts


import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTimer from 'react-native-background-timer';
import ICPIntegrationService, { CompressedSubmission, Winner } from './ICPIntegrationService';
import CloudFlareAPI from './CloudFlareAPI';

interface QueuedSubmission {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  distance: number;
  intervalId: bigint;
}

interface IntervalBatch {
  intervalId: bigint;
  submissions: CompressedSubmission[];
  potentialRewards: Map<string, number>;
  startTime: number;
  endTime: number;
}

class ConsensusBatchService {
  private static instance: ConsensusBatchService;
  private intervalTimer: number | null = null;
  private currentInterval: IntervalBatch | null = null;
  private submissionQueue: Map<bigint, QueuedSubmission[]> = new Map();
  private isProcessing: boolean = false;
  private INTERVAL_DURATION = 5 * 60 * 1000; // 5 minutes
  private SUBMISSION_DELAY = 2 * 60 * 1000; // 2 minute delay after interval ends (7 minutes total)

  private constructor() {
    this.initializeService();
  }

  static getInstance(): ConsensusBatchService {
    if (!ConsensusBatchService.instance) {
      ConsensusBatchService.instance = new ConsensusBatchService();
    }
    return ConsensusBatchService.instance;
  }

  // Initialize the batch processing service
  private async initializeService() {
    // Load any pending submissions from storage
    await this.loadPendingSubmissions();
    
    // Start interval timer
    this.startIntervalTimer();
    
    // Process any completed intervals
    await this.processCompletedIntervals();
  }

  // Start the interval timer
  private startIntervalTimer() {
    // Clear existing timer
    if (this.intervalTimer) {
      BackgroundTimer.clearInterval(this.intervalTimer);
    }

    // Check every minute
    this.intervalTimer = BackgroundTimer.setInterval(() => {
      this.checkAndProcessInterval();
    }, 60000); // 1 minute

    // Also check immediately
    this.checkAndProcessInterval();
  }

  // Check if current interval should be processed
  private async checkAndProcessInterval() {
    const now = Date.now();
    const currentIntervalId = this.getCurrentIntervalId();
    
    // Check if we've moved to a new interval
    if (!this.currentInterval || this.currentInterval.intervalId !== currentIntervalId) {
      // Save previous interval if exists
      if (this.currentInterval) {
        await this.saveIntervalBatch(this.currentInterval);
      }
      
      // Start new interval
      this.currentInterval = {
        intervalId: currentIntervalId,
        submissions: [],
        potentialRewards: new Map(),
        startTime: Number(currentIntervalId),
        endTime: Number(currentIntervalId) + this.INTERVAL_DURATION,
      };
    }

    // Process any intervals that are ready (12 minutes after end)
    await this.processCompletedIntervals();
  }

  // Get current interval ID
  private getCurrentIntervalId(): bigint {
    const now = Date.now();
    return BigInt(Math.floor(now / this.INTERVAL_DURATION) * this.INTERVAL_DURATION);
  }

  // Add submission to current batch
  async addSubmission(
    userId: string,
    latitude: number,
    longitude: number,
    distance: number,
    timestamp?: number
  ) {
    const intervalId = this.getCurrentIntervalId();
    const submission: CompressedSubmission = {
      user_id: userId,
      lat: latitude,
      lon: longitude,
      t: BigInt(timestamp || Date.now()),
    };

    // Add to ICP service accumulator
    ICPIntegrationService.addMiningSubmission(
      userId,
      latitude,
      longitude,
      timestamp || Date.now()
    );

    // Add to local tracking
    if (this.currentInterval && this.currentInterval.intervalId === intervalId) {
      this.currentInterval.submissions.push(submission);
      
      // Track potential rewards
      const currentReward = this.currentInterval.potentialRewards.get(userId) || 0;
      this.currentInterval.potentialRewards.set(userId, currentReward + distance);
    }

    // Also queue for persistence
    if (!this.submissionQueue.has(intervalId)) {
      this.submissionQueue.set(intervalId, []);
    }
    
    this.submissionQueue.get(intervalId)!.push({
      userId,
      latitude,
      longitude,
      timestamp: timestamp || Date.now(),
      distance,
      intervalId,
    });

    // Save to storage periodically
    if (this.submissionQueue.get(intervalId)!.length % 10 === 0) {
      await this.savePendingSubmissions();
    }
  }

  // Process completed intervals
  private async processCompletedIntervals() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const now = Date.now();

    try {
      // Get all saved interval batches
      const savedBatches = await this.getSavedIntervalBatches();
      
      for (const batch of savedBatches) {
        const intervalEndTime = Number(batch.intervalId) + this.INTERVAL_DURATION;
        const processingTime = intervalEndTime + this.SUBMISSION_DELAY;
        
        // Check if this interval is ready to be processed
        if (now >= processingTime) {
          await this.processIntervalBatch(batch);
        }
      }
    } catch (error) {
      console.error('Error processing completed intervals:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single interval batch
  private async processIntervalBatch(batch: IntervalBatch) {
    try {
      console.log(`Processing interval ${batch.intervalId}`);
      
      // Calculate winners based on distances
      const targetDistance = await this.getTargetDistance(batch.intervalId);
      const winners = this.calculateWinners(batch, targetDistance);
      
      // Submit to ICP consensus
      const result = await ICPIntegrationService.submitBatchToConsensus(
        batch.intervalId,
        winners,
        batch.submissions
      );
      
      if (result.success) {
        console.log(`Interval ${batch.intervalId} submitted to ICP: ${result.message}`);
        
        // Remove processed batch from storage
        await this.removeProcessedBatch(batch.intervalId);
        
        // Notify CloudFlare of successful submission
        await this.notifyCloudFlare(batch.intervalId, result.message);
      } else {
        console.error(`Failed to submit interval ${batch.intervalId}: ${result.message}`);
        
        // Retry logic - mark for retry
        await this.markBatchForRetry(batch);
      }
    } catch (error) {
      console.error(`Error processing interval batch ${batch.intervalId}:`, error);
    }
  }

  // Calculate winners for the interval
  private calculateWinners(batch: IntervalBatch, targetDistance: number): Winner[] {
    const userDistances = Array.from(batch.potentialRewards.entries());
    
    // Sort by closest to target distance
    const sorted = userDistances
      .map(([userId, distance]) => ({
        userId,
        distance,
        difference: Math.abs(distance - targetDistance),
      }))
      .sort((a, b) => a.difference - b.difference);
    
    // Reward distribution (top 10 miners)
    const rewardTiers = [1000, 500, 250, 100, 50, 25, 10, 5, 3, 1];
    const winners: Winner[] = [];
    
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      winners.push({
        user_id: sorted[i].userId,
        reward: BigInt(rewardTiers[i] || 1),
        rank: i + 1,
      });
    }
    
    return winners;
  }

  // Get target distance for the interval
  private async getTargetDistance(intervalId: bigint): Promise<number> {
    try {
      // Fetch from CloudFlare or calculate based on interval
      const response = await CloudFlareAPI.getCompetitionStatus();
      return response.targetDistance || 5.0; // Default 5km
    } catch (error) {
      // Use deterministic calculation as fallback
      const seed = Number(intervalId % 1000n);
      return 3 + (seed % 7); // Between 3-10 km
    }
  }

  // Notify CloudFlare of successful ICP submission
  private async notifyCloudFlare(intervalId: bigint, message: string) {
    try {
      await CloudFlareAPI.request('/consensus/confirmation', {
        method: 'POST',
        body: JSON.stringify({
          intervalId: intervalId.toString(),
          status: 'confirmed',
          message,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error('Failed to notify CloudFlare:', error);
    }
  }

  // Storage management methods
  
  private async savePendingSubmissions() {
    try {
      const data = {
        submissions: Array.from(this.submissionQueue.entries()).map(([key, value]) => ({
          intervalId: key.toString(),
          submissions: value,
        })),
        lastSaved: Date.now(),
      };
      
      await AsyncStorage.setItem('pending_submissions', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save pending submissions:', error);
    }
  }

  private async loadPendingSubmissions() {
    try {
      const data = await AsyncStorage.getItem('pending_submissions');
      if (data) {
        const parsed = JSON.parse(data);
        for (const item of parsed.submissions) {
          this.submissionQueue.set(BigInt(item.intervalId), item.submissions);
        }
      }
    } catch (error) {
      console.error('Failed to load pending submissions:', error);
    }
  }

  private async saveIntervalBatch(batch: IntervalBatch) {
    try {
      const key = `interval_batch_${batch.intervalId}`;
      const data = {
        ...batch,
        intervalId: batch.intervalId.toString(),
        potentialRewards: Array.from(batch.potentialRewards.entries()),
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save interval batch:', error);
    }
  }

  private async getSavedIntervalBatches(): Promise<IntervalBatch[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const batchKeys = keys.filter(key => key.startsWith('interval_batch_'));
      const batches: IntervalBatch[] = [];
      
      for (const key of batchKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          batches.push({
            ...parsed,
            intervalId: BigInt(parsed.intervalId),
            potentialRewards: new Map(parsed.potentialRewards),
          });
        }
      }
      
      return batches;
    } catch (error) {
      console.error('Failed to get saved interval batches:', error);
      return [];
    }
  }

  private async removeProcessedBatch(intervalId: bigint) {
    try {
      const key = `interval_batch_${intervalId}`;
      await AsyncStorage.removeItem(key);
      
      // Also remove from queue
      this.submissionQueue.delete(intervalId);
      await this.savePendingSubmissions();
    } catch (error) {
      console.error('Failed to remove processed batch:', error);
    }
  }

  private async markBatchForRetry(batch: IntervalBatch) {
    try {
      const key = `retry_batch_${batch.intervalId}`;
      const retryData = {
        batch,
        retryCount: 1,
        nextRetry: Date.now() + 5 * 60 * 1000, // Retry in 5 minutes
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(retryData));
    } catch (error) {
      console.error('Failed to mark batch for retry:', error);
    }
  }

  // Public methods for external access
  
  async forceProcessInterval(intervalId: bigint) {
    const batches = await this.getSavedIntervalBatches();
    const batch = batches.find(b => b.intervalId === intervalId);
    
    if (batch) {
      await this.processIntervalBatch(batch);
    }
  }

  async getIntervalStatus(intervalId: bigint): Promise<{
    status: string;
    submissionCount: number;
    userCount: number;
  }> {
    const submissions = this.submissionQueue.get(intervalId) || [];
    const uniqueUsers = new Set(submissions.map(s => s.userId));
    
    return {
      status: submissions.length > 0 ? 'active' : 'pending',
      submissionCount: submissions.length,
      userCount: uniqueUsers.size,
    };
  }

  // Clean up resources
  destroy() {
    if (this.intervalTimer) {
      BackgroundTimer.clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

export default ConsensusBatchService.getInstance();
export { ConsensusBatchService, QueuedSubmission, IntervalBatch };