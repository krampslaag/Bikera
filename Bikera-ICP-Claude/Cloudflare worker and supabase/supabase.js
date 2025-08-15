// supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
  }
  }
});

// Real-time subscription for live updates
export function subscribeToMiningUpdates(userId, callback) {
  return supabase
    .channel('mining-updates')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mining_rewards',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();
}

// Helper functions
export const miningService = {
  async getUserStats(userId) {
    const { data, error } = await supabase
      .from('user_mining_stats')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    return { data, error };
  },

  async getRecentSubmissions(userId, limit = 10) {
    const { data, error } = await supabase
      .from('location_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);
      
    return { data, error };
  },

  async getLeaderboard(limit = 100) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(limit);
      
    return { data, error };
  },

  async getCurrentInterval() {
    const { data, error } = await supabase
      .rpc('get_current_interval');
      
    return { data, error };
  }
};