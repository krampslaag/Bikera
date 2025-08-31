// src/api-routes.ts
import { Env } from './index';

export class APIRouter {
  constructor(private env: Env) {}

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    // Enable CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Route matching
      const routes = [
        { pattern: /^\/api\/movement\/submit$/, handler: this.submitMovement },
        { pattern: /^\/api\/movement\/batch$/, handler: this.submitBatch },
        { pattern: /^\/api\/user\/profile$/, handler: this.getUserProfile },
        { pattern: /^\/api\/user\/rewards$/, handler: this.getUserRewards },
        { pattern: /^\/api\/stats\/global$/, handler: this.getGlobalStats },
        { pattern: /^\/api\/stats\/leaderboard$/, handler: this.getLeaderboard },
        { pattern: /^\/api\/health$/, handler: this.healthCheck }
      ];

      for (const route of routes) {
        if (route.pattern.test(url.pathname)) {
          const response = await route.handler.call(this, request);
          return new Response(JSON.stringify(response), { headers });
        }
      }

      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers
      });
    }
  }

  private async submitMovement(request: Request) {
    const data = await request.json();
    
    // Validate movement data
    if (!this.validateMovementData(data)) {
      throw new Error('Invalid movement data');
    }

    // Get durable object for processing
    const id = this.env.MOVEMENT_PROCESSOR.idFromName('main');
    const stub = this.env.MOVEMENT_PROCESSOR.get(id);
    
    // Add to processing queue
    await stub.fetch('https://internal/add', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    return {
      success: true,
      message: 'Movement data submitted',
      id: crypto.randomUUID()
    };
  }

  private async submitBatch(request: Request) {
    const batch = await request.json();
    
    // Process batch of movements
    const results = [];
    for (const movement of batch.movements) {
      if (this.validateMovementData(movement)) {
        results.push(await this.submitMovement(
          new Request('https://internal', {
            method: 'POST',
            body: JSON.stringify(movement)
          })
        ));
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    };
  }

  private async getUserProfile(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      throw new Error('User ID required');
    }

    // Fetch from Supabase
    const supabaseUrl = `${this.env.SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}`;
    const response = await fetch(supabaseUrl, {
      headers: {
        'apikey': this.env.SUPABASE_KEY,
        'Authorization': `Bearer ${this.env.SUPABASE_KEY}`
      }
    });

    const data = await response.json();
    return data[0] || null;
  }

  private async getUserRewards(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    // Fetch from ICP canister
    const icpClient = await this.getICPClient();
    const rewards = await icpClient.getUserRewards(userId);
    
    return rewards;
  }

  private async getGlobalStats(request: Request) {
    // Aggregate stats from KV store
    const stats = await this.env.RESULTS.get('global_stats', 'json');
    
    return stats || {
      totalUsers: 0,
      totalDistance: 0,
      totalRewards: 0,
      activeRides: 0
    };
  }

  private async getLeaderboard(request: Request) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // Fetch from Supabase
    const supabaseUrl = `${this.env.SUPABASE_URL}/rest/v1/leaderboard?order=total_rewards.desc&limit=${limit}`;
    const response = await fetch(supabaseUrl, {
      headers: {
        'apikey': this.env.SUPABASE_KEY,
        'Authorization': `Bearer ${this.env.SUPABASE_KEY}`
      }
    });

    return await response.json();
  }

  private async healthCheck(request: Request) {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        worker: 'operational',
        icp: await this.checkICPConnection(),
        supabase: await this.checkSupabaseConnection()
      }
    };
  }

  private validateMovementData(data: any): boolean {
    return !!(
      data.user_id &&
      data.latitude &&
      data.longitude &&
      data.timestamp &&
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number'
    );
  }

  private async getICPClient() {
    // Implementation for ICP client
    // This would connect to your ICP canisters
    return {
      getUserRewards: async (userId: string) => {
        // Call ICP canister
        return { total: 0, pending: 0, claimed: 0 };
      }
    };
  }

  private async checkICPConnection(): Promise<string> {
    try {
      // Check ICP connection
      return 'operational';
    } catch {
      return 'degraded';
    }
  }

  private async checkSupabaseConnection(): Promise<string> {
    try {
      const response = await fetch(`${this.env.SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': this.env.SUPABASE_KEY }
      });
      return response.ok ? 'operational' : 'degraded';
    } catch {
      return 'offline';
    }
  }
}
