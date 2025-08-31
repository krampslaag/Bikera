// src/services/ICPIntegrationService.ts
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { AuthClient } from '@dfinity/auth-client';
import { idlFactory } from '../declarations/consensus_canister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// Configuration
const ICP_HOST = process.env.ICP_HOST || 'https://ic0.app';
const CANISTER_ID = process.env.CONSENSUS_CANISTER_ID || 'your-canister-id';
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || '';

// Types matching the Rust canister
interface BatchSubmission {
  interval_id: bigint;
  submissions: CompressedSubmission[];
  winners: Winner[];
  merkle_root: string;
  timestamp: bigint;
  signature: string;
}

interface CompressedSubmission {
  user_id: string;
  lat: number;
  lon: number;
  t: bigint;
}

interface Winner {
  user_id: string;
  reward: bigint;
  rank: number;
}

interface Block {
  index: bigint;
  timestamp: bigint;
  interval_id: bigint;
  merkle_root: string;
  winner_count: number;
  total_rewards: bigint;
  previous_hash: string;
  hash: string;
}

interface UserRewards {
  total_rewards: bigint;
  pending_rewards: bigint;
  last_claim: bigint;
  principal?: string;
}

interface ClaimResult {
  success: boolean;
  amount: bigint;
  transaction_id: string;
}

interface CanisterStats {
  total_blocks: bigint;
  total_users: bigint;
  total_rewards_distributed: bigint;
  cycles_balance: bigint;
}

class ICPIntegrationService {
  private agent: HttpAgent | null = null;
  private actor: any = null;
  private authClient: AuthClient | null = null;
  private identity: Identity | null = null;
  private currentIntervalId: bigint | null = null;
  private batchAccumulator: Map<bigint, CompressedSubmission[]> = new Map();

  constructor() {
    this.initializeAgent();
  }

  // Initialize ICP agent and actor
  private async initializeAgent() {
    try {
      // Create auth client
      this.authClient = await AuthClient.create();
      
      // Check if already authenticated
      const isAuthenticated = await this.authClient.isAuthenticated();
      
      if (isAuthenticated) {
        this.identity = this.authClient.getIdentity();
      }

      // Create agent
      this.agent = new HttpAgent({
        host: ICP_HOST,
        identity: this.identity,
      });

      // In development, fetch root key
      if (process.env.NODE_ENV === 'development') {
        await this.agent.fetchRootKey();
      }

      // Create actor
      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: Principal.fromText(CANISTER_ID),
      });

      console.log('ICP Integration initialized');
    } catch (error) {
      console.error('Failed to initialize ICP agent:', error);
    }
  }

  // Authenticate with Internet Identity
  async authenticateWithII(): Promise<boolean> {
    try {
      if (!this.authClient) {
        await this.initializeAgent();
      }

      const result = await new Promise<boolean>((resolve) => {
        this.authClient!.login({
          identityProvider: 'https://identity.ic0.app',
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        });
      });

      if (result) {
        this.identity = this.authClient!.getIdentity();
        await this.initializeAgent();
      }

      return result;
    } catch (error) {
      console.error('II authentication failed:', error);
      return false;
    }
  }

  // Get current interval ID (5-minute intervals)
  getCurrentIntervalId(): bigint {
    const now = Date.now();
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    return BigInt(Math.floor(now / intervalMs) * intervalMs);
  }

  // Add mining submission to batch
  addMiningSubmission(
    userId: string,
    latitude: number,
    longitude: number,
    timestamp: number
  ) {
    const intervalId = this.getCurrentIntervalId();
    
    if (!this.batchAccumulator.has(intervalId)) {
      this.batchAccumulator.set(intervalId, []);
    }

    const submission: CompressedSubmission = {
      user_id: userId,
      lat: latitude,
      lon: longitude,
      t: BigInt(timestamp),
    };

    this.batchAccumulator.get(intervalId)!.push(submission);
  }

  // Process and submit batch to ICP canister
  async submitBatchToConsensus(
    intervalId: bigint,
    winners: Winner[],
    submissions?: CompressedSubmission[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.actor) {
        throw new Error('ICP actor not initialized');
      }

      // Use provided submissions or get from accumulator
      const batchSubmissions = submissions || this.batchAccumulator.get(intervalId) || [];
      
      if (batchSubmissions.length === 0) {
        return {
          success: false,
          message: 'No submissions for this interval',
        };
      }

      // Calculate merkle root from submissions
      const merkleRoot = this.calculateMerkleRoot(batchSubmissions);

      // Create signature using API key
      const signature = this.createSignature(intervalId, merkleRoot);

      // Create batch submission
      const batch: BatchSubmission = {
        interval_id: intervalId,
        submissions: batchSubmissions,
        winners,
        merkle_root: merkleRoot,
        timestamp: BigInt(Date.now()),
        signature,
      };

      // Submit to ICP canister
      const result = await this.actor.process_batch(batch);

      // Clear accumulator for this interval
      this.batchAccumulator.delete(intervalId);

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error('Failed to submit batch to consensus:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Calculate merkle root from submissions
  private calculateMerkleRoot(submissions: CompressedSubmission[]): string {
    if (submissions.length === 0) return '';

    // Create leaf nodes from submissions
    const leaves = submissions.map(sub => {
      const data = `${sub.user_id}:${sub.lat}:${sub.lon}:${sub.t}`;
      return CryptoJS.SHA256(data).toString();
    });

    // Build merkle tree
    let currentLevel = leaves;
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left;
        const combined = CryptoJS.SHA256(left + right).toString();
        nextLevel.push(combined);
      }
      
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  // Create HMAC signature for authentication
  private createSignature(intervalId: bigint, merkleRoot: string): string {
    const data = `${intervalId}${merkleRoot}`;
    return CryptoJS.HmacSHA256(data, CLOUDFLARE_API_KEY).toString();
  }

  // Claim rewards from ICP canister
  async claimRewards(
    userId: string,
    principal?: Principal
  ): Promise<ClaimResult | null> {
    try {
      if (!this.actor) {
        throw new Error('ICP actor not initialized');
      }

      // Use current identity's principal if not provided
      const claimPrincipal = principal || this.identity?.getPrincipal();
      
      if (!claimPrincipal) {
        throw new Error('No principal available for claiming');
      }

      const result = await this.actor.claim_rewards(userId, claimPrincipal);
      return result;
    } catch (error) {
      console.error('Failed to claim rewards:', error);
      return null;
    }
  }

  // Get user rewards
  async getUserRewards(userId: string): Promise<UserRewards | null> {
    try {
      if (!this.actor) {
        throw new Error('ICP actor not initialized');
      }

      const rewards = await this.actor.get_user_rewards(userId);
      return rewards[0] || null; // ICP returns Option type as array
    } catch (error) {
      console.error('Failed to get user rewards:', error);
      return null;
    }
  }

  // Get blockchain data
  async getBlockchain(start: number, limit: number): Promise<Block[]> {
    try {
      if (!this.actor) {
        throw new Error('ICP actor not initialized');
      }

      const blocks = await this.actor.get_blockchain(BigInt(start), BigInt(limit));
      return blocks;
    } catch (error) {
      console.error('Failed to get blockchain:', error);
      return [];
    }
  }

  // Get canister statistics
  async getStats(): Promise<CanisterStats | null> {
    try {
      if (!this.actor) {
        throw new Error('ICP actor not initialized');
      }

      const stats = await this.actor.get_stats();
      return stats;
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  }

  // Check if user is authenticated with ICP
  isAuthenticated(): boolean {
    return this.identity !== null;
  }

  // Get current principal
  getPrincipal(): Principal | null {
    return this.identity?.getPrincipal() || null;
  }

  // Logout from Internet Identity
  async logout() {
    if (this.authClient) {
      await this.authClient.logout();
      this.identity = null;
      await this.initializeAgent();
    }
  }

  // Calculate winners from submissions (for local processing)
  calculateWinners(
    submissions: CompressedSubmission[],
    targetDistance: number
  ): Winner[] {
    // Group by user
    const userDistances = new Map<string, number>();
    
    for (let i = 1; i < submissions.length; i++) {
      const prev = submissions[i - 1];
      const curr = submissions[i];
      
      if (prev.user_id === curr.user_id) {
        const distance = this.calculateDistance(
          prev.lat,
          prev.lon,
          curr.lat,
          curr.lon
        );
        
        const currentTotal = userDistances.get(curr.user_id) || 0;
        userDistances.set(curr.user_id, currentTotal + distance);
      }
    }

    // Sort by closest to target distance
    const sorted = Array.from(userDistances.entries())
      .map(([userId, distance]) => ({
        userId,
        distance,
        difference: Math.abs(distance - targetDistance),
      }))
      .sort((a, b) => a.difference - b.difference);

    // Assign rewards (top 10 get rewards)
    const winners: Winner[] = [];
    const rewardTiers = [1000, 500, 250, 100, 50, 25, 10, 5, 3, 1];
    
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      winners.push({
        user_id: sorted[i].userId,
        reward: BigInt(rewardTiers[i] || 1),
        rank: i + 1,
      });
    }

    return winners;
  }

  // Calculate distance using Haversine formula
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Store identity for persistence
  async saveIdentity() {
    if (this.identity) {
      // Serialize identity for storage
      // Note: This is simplified - in production, use proper key management
      const identityData = JSON.stringify({
        principal: this.identity.getPrincipal().toString(),
        // Add other necessary identity data
      });
      await AsyncStorage.setItem('icp_identity', identityData);
    }
  }

  // Load stored identity
  async loadIdentity() {
    try {
      const identityData = await AsyncStorage.getItem('icp_identity');
      if (identityData) {
        // Reconstruct identity from stored data
        // Note: This is simplified - in production, use proper key management
        const data = JSON.parse(identityData);
        // Reconstruct identity...
      }
    } catch (error) {
      console.error('Failed to load identity:', error);
    }
  }
}

export default new ICPIntegrationService();
export { 
  ICPIntegrationService,
  BatchSubmission,
  CompressedSubmission,
  Winner,
  Block,
  UserRewards,
  ClaimResult,
  CanisterStats,
};