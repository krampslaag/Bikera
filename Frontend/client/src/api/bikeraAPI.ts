// frontend/src/api/bikeraAPI.ts
class BikeraAPI {
  private baseURL: string;
  private headers: HeadersInit;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'https://api.bikera.org';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAuthToken()}`
    };
  }

  private getAuthToken(): string {
    return localStorage.getItem('bikera_auth_token') || '';
  }

  // Movement tracking
  async submitMovement(data: MovementData): Promise<any> {
    return this.post('/api/movement/submit', data);
  }

  async submitMovementBatch(movements: MovementData[]): Promise<any> {
    return this.post('/api/movement/batch', { movements });
  }

  // User management
  async getUserProfile(userId?: string): Promise<UserProfile> {
    const id = userId || 'current';
    return this.get(`/api/user/profile?userId=${id}`);
  }

  async updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.put('/api/user/profile', data);
  }

  // Rewards
  async getUserRewards(userId?: string): Promise<RewardsData> {
    const id = userId || 'current';
    return this.get(`/api/user/rewards?userId=${id}`);
  }

  async claimRewards(sessionId: string): Promise<ClaimResult> {
    return this.post('/api/rewards/claim', { sessionId });
  }

  // Statistics
  async getGlobalStats(): Promise<GlobalStats> {
    return this.get('/api/stats/global');
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    return this.get(`/api/stats/leaderboard?limit=${limit}`);
  }

  // Session management
  async startSession(): Promise<SessionData> {
    return this.post('/api/session/start', {
      timestamp: Date.now()
    });
  }

  async endSession(sessionId: string): Promise<SessionSummary> {
    return this.post('/api/session/end', { sessionId });
  }

  // Helper methods
  private async get(path: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'GET',
      headers: this.headers
    });
    return this.handleResponse(response);
  }

  private async post(path: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  private async put(path: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'API request failed');
    }
    return response.json();
  }
}

export default new BikeraAPI();
