// src/services/CloudFlareAPI.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configuration
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://your-worker.workers.dev';
const API_VERSION = 'v1';

// Types
interface UserData {
  id: string;
  username: string;
  walletAddress: string;
  telegramId?: string;
  totalDistance: number;
  totalRewards: number;
  blocksMined: number;
  rank?: number;
  createdAt: string;
  updatedAt: string;
}

interface MiningSession {
  id: string;
  userId: string;
  startLocation: LocationData;
  endLocation?: LocationData;
  distance: number;
  status: 'active' | 'completed' | 'cancelled';
  reward?: number;
  blockNumber?: number;
  startTime: string;
  endTime?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  altitude?: number;
  speed?: number;
}

interface BlockData {
  id: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  targetDistance: number;
  travelDistance: number;
  winnerId: string;
  minerAddress: string;
  reward: number;
}

interface AuthResponse {
  user: UserData;
  token: string;
  refreshToken?: string;
}

interface CompetitionStatus {
  isActive: boolean;
  startTime?: string;
  targetDistance?: number;
  participants: number;
  currentLeader?: {
    userId: string;
    username: string;
    distance: number;
  };
}

class CloudFlareAPI {
  private baseURL: string;
  private authToken: string | null = null;
  private userId: string | null = null;

  constructor() {
    this.baseURL = `${CLOUDFLARE_WORKER_URL}/api/${API_VERSION}`;
    this.loadAuthData();
  }

  // Load stored authentication data
  private async loadAuthData() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      if (token && userId) {
        this.authToken = token;
        this.userId = userId;
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
    }
  }

  // Store authentication data
  private async saveAuthData(token: string, userId: string) {
    try {
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', userId);
      this.authToken = token;
      this.userId = userId;
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }

  // Clear authentication data
  private async clearAuthData() {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userId');
      this.authToken = null;
      this.userId = null;
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  // Base request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Platform': Platform.OS,
      'X-App-Version': '1.0.0',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized - clear auth and throw
          await this.clearAuthData();
          throw new Error('Unauthorized - Please login again');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Request Error (${endpoint}):`, error);
      throw error;
    }
  }

  // ============= Authentication Methods =============

  async register(
    username: string,
    walletAddress: string,
    telegramId?: string
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        walletAddress,
        telegramId,
        platform: Platform.OS,
      }),
    });

    await this.saveAuthData(response.token, response.user.id);
    return response;
  }

  async login(walletAddress: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        walletAddress,
        platform: Platform.OS,
      }),
    });

    await this.saveAuthData(response.token, response.user.id);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      await this.clearAuthData();
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
    });

    await this.saveAuthData(response.token, response.user.id);
    return response;
  }

  async startSession(userId: string, deviceId: string) {
    return this.request('/api/session/start', {
      method: 'POST',
      body: JSON.stringify({ userId, deviceId })
    });
  }
  
  async endSession(sessionId: string, userId: string) {
    return this.request('/api/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId, userId })
    });
  }


  // ============= User Methods =============

  async getUserProfile(userId?: string): Promise<UserData> {
    const id = userId || this.userId;
    if (!id) throw new Error('User ID required');
    
    return this.request<UserData>(`/users/${id}`);
  }

  async updateUserProfile(updates: Partial<UserData>): Promise<UserData> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request<UserData>(`/users/${this.userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUserStats(userId?: string): Promise<{
    totalDistance: number;
    totalRewards: number;
    blocksMined: number;
    weeklyDistance: number;
    weeklyRewards: number;
    weeklyBlocksMined: number;
    rank: number;
    achievements: string[];
  }> {
    const id = userId || this.userId;
    if (!id) throw new Error('User ID required');
    
    return this.request(`/users/${id}/stats`);
  }

  async getLeaderboard(
    period: 'daily' | 'weekly' | 'monthly' | 'all' = 'weekly',
    limit = 100
  ): Promise<UserData[]> {
    return this.request(`/leaderboard?period=${period}&limit=${limit}`);
  }

  // ============= Mining Methods =============

  async submitDistance(submission: {
    sessionId: string;
    userId: string;
    distanceMeters: number;
    durationSeconds: number;
    averageSpeed: number;
    maxSpeed: number;
    timestamp: number;
    deviceId: string;
  }): Promise<any> {
    return this.request('/api/submit-distance', {
      method: 'POST',
      body: JSON.stringify(submission)
    });
  }

  async startMiningSession(location: LocationData): Promise<MiningSession> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request<MiningSession>('/mining/start', {
      method: 'POST',
      body: JSON.stringify({
        userId: this.userId,
        location,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  async updateMiningLocation(
    sessionId: string,
    location: LocationData
  ): Promise<{
    distance: number;
    currentReward: number;
  }> {
    return this.request(`/mining/sessions/${sessionId}/location`, {
      method: 'POST',
      body: JSON.stringify({
        location,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  async endMiningSession(
    sessionId: string,
    location: LocationData
  ): Promise<MiningSession> {
    return this.request<MiningSession>(`/mining/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({
        location,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  async getActiveMiningSession(): Promise<MiningSession | null> {
    if (!this.userId) throw new Error('Not authenticated');
    
    try {
      return await this.request<MiningSession>(`/mining/sessions/active`);
    } catch (error) {
      return null;
    }
  }

  async getMiningHistory(
    limit = 50,
    offset = 0
  ): Promise<MiningSession[]> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request(`/mining/history?limit=${limit}&offset=${offset}`);
  }

  async submitMiningProof(
    sessionId: string,
    proof: {
      distance: number;
      locations: LocationData[];
      duration: number;
    }
  ): Promise<{
    valid: boolean;
    reward?: number;
    blockNumber?: number;
    intervalId?: string;
  }> {
    // Submit to CloudFlare for initial validation
    const result = await this.request<{
      valid: boolean;
      reward?: number;
      blockNumber?: number;
      intervalId?: string;
      submissions?: any[];
    }>(`/mining/sessions/${sessionId}/proof`, {
      method: 'POST',
      body: JSON.stringify(proof),
    });

    // Store for batch submission to ICP
    if (result.valid && result.intervalId) {
      await this.queueForICPSubmission({
        sessionId,
        intervalId: result.intervalId,
        userId: this.userId!,
        locations: proof.locations,
        reward: result.reward || 0,
      });
    }

    return result;
  }

  // Queue submissions for ICP consensus
  private async queueForICPSubmission(data: {
    sessionId: string;
    intervalId: string;
    userId: string;
    locations: LocationData[];
    reward: number;
  }): Promise<void> {
    try {
      // Store in local queue for batch processing
      const queue = await AsyncStorage.getItem('icp_submission_queue') || '[]';
      const queueData = JSON.parse(queue);
      queueData.push(data);
      await AsyncStorage.setItem('icp_submission_queue', JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to queue ICP submission:', error);
    }
  }

  // ============= Competition Methods =============

  async getCompetitionStatus(): Promise<CompetitionStatus> {
    return this.request<CompetitionStatus>('/competition/status');
  }

  async joinCompetition(): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request('/competition/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: this.userId,
      }),
    });
  }

  async getCompetitionLeaderboard(): Promise<{
    targetDistance: number;
    timeRemaining: number;
    participants: Array<{
      userId: string;
      username: string;
      distance: number;
      progress: number;
    }>;
  }> {
    return this.request('/competition/leaderboard');
  }

  // ============= Block Methods =============

  async getLatestBlocks(limit = 10): Promise<BlockData[]> {
    return this.request(`/blocks?limit=${limit}`);
  }

  async getBlock(blockNumber: number): Promise<BlockData> {
    return this.request(`/blocks/${blockNumber}`);
  }

  async getBlocksByMiner(
    minerAddress: string,
    limit = 50
  ): Promise<BlockData[]> {
    return this.request(`/blocks/miner/${minerAddress}?limit=${limit}`);
  }

  // ============= Rewards Methods =============

  async claimRewards(): Promise<{
    success: boolean;
    amount: number;
    transactionHash?: string;
  }> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request('/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({
        userId: this.userId,
      }),
    });
  }

  async getRewardHistory(
    limit = 50,
    offset = 0
  ): Promise<Array<{
    id: string;
    amount: number;
    type: 'mining' | 'competition' | 'bonus';
    timestamp: string;
    transactionHash?: string;
  }>> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request(`/rewards/history?limit=${limit}&offset=${offset}`);
  }

  async getPendingRewards(): Promise<{
    total: number;
    breakdown: {
      mining: number;
      competition: number;
      bonus: number;
    };
  }> {
    if (!this.userId) throw new Error('Not authenticated');
    
    return this.request('/rewards/pending');
  }

  // ============= Network Status Methods =============

  async getNetworkStatus(): Promise<{
    totalMiners: number;
    activeMiners: number;
    totalDistance: number;
    totalRewards: number;
    currentDifficulty: number;
    averageBlockTime: number;
    networkHashrate: string;
  }> {
    return this.request('/network/status');
  }

  async getMinerDistribution(): Promise<Array<{
    country: string;
    count: number;
    percentage: number;
  }>> {
    return this.request('/network/distribution');
  }

  // ============= Utility Methods =============

  isAuthenticated(): boolean {
    return !!this.authToken && !!this.userId;
  }

  getCurrentUserId(): string | null {
    return this.userId;
  }

  async validateSession(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;
    
    try {
      await this.getUserProfile();
      return true;
    } catch (error) {
      await this.clearAuthData();
      return false;
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(
    onMessage: (data: any) => void,
    onError?: (error: any) => void
  ): WebSocket | null {
    if (!this.authToken) {
      console.error('Cannot connect WebSocket: Not authenticated');
      return null;
    }

    const wsUrl = CLOUDFLARE_WORKER_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws?token=${this.authToken}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return ws;
  }
}

export default new CloudFlareAPI();
export { CloudFlareAPI, UserData, MiningSession, LocationData, BlockData, CompetitionStatus };