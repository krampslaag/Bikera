// Complete Bikera Cloudflare Worker - Privacy-First Implementation
// Main worker.js file that handles distance-only data (no GPS stored)

import { Router } from 'itty-router';
import { createClient } from '@supabase/supabase-js';
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';

// ============= DURABLE OBJECT FOR RATE LIMITING =============
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.userLimits = new Map();
    this.ipLimits = new Map();
    
    // Restore state
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get(['userLimits', 'ipLimits']);
      if (stored.userLimits) this.userLimits = stored.userLimits;
      if (stored.ipLimits) this.ipLimits = stored.ipLimits;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/check-user') {
      const userId = url.searchParams.get('userId');
      const window = parseInt(url.searchParams.get('window') || '150000'); // 2.5 minutes
      
      if (!userId) {
        return new Response(JSON.stringify({ allowed: false, reason: 'Missing userId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const now = Date.now();
      const lastSubmit = this.userLimits.get(userId) || 0;
      
      if (now - lastSubmit < window) {
        return new Response(JSON.stringify({ 
          allowed: false, 
          reason: 'Rate limit exceeded',
          retryAfter: window - (now - lastSubmit)
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      this.userLimits.set(userId, now);
      await this.state.storage.put('userLimits', this.userLimits);
      
      // Clean old entries
      for (const [key, time] of this.userLimits.entries()) {
        if (now - time > window * 2) {
          this.userLimits.delete(key);
        }
      }
      
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/check-ip') {
      const ip = url.searchParams.get('ip');
      const window = parseInt(url.searchParams.get('window') || '60000'); // 1 minute
      const limit = parseInt(url.searchParams.get('limit') || '1000');
      
      if (!ip) {
        return new Response(JSON.stringify({ allowed: false, reason: 'Missing IP' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const now = Date.now();
      const key = `${ip}:${Math.floor(now / window)}`;
      const count = (this.ipLimits.get(key) || 0) + 1;
      
      if (count > limit) {
        return new Response(JSON.stringify({ 
          allowed: false, 
          reason: 'IP rate limit exceeded'
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      this.ipLimits.set(key, count);
      await this.state.storage.put('ipLimits', this.ipLimits);
      
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
}

// ============= MAIN WORKER CLASS =============
export default {
  async fetch(request, env, ctx) {
    const router = Router();
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Supabase client
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

    // ============= HELPER FUNCTIONS =============
    
    // Validate distance submission (no GPS coordinates)
    async function validateDistanceSubmission(submission) {
      // Basic validation
      if (!submission.userId || !submission.sessionId || !submission.distanceMeters) {
        return { valid: false, reason: 'Missing required fields' };
      }

      // Check distance is reasonable
      if (submission.distanceMeters < 0 || submission.distanceMeters > 500000) {
        return { valid: false, reason: 'Invalid distance' };
      }

      // Speed validation
      if (submission.durationSeconds > 0) {
        const avgSpeed = submission.distanceMeters / submission.durationSeconds;
        if (avgSpeed > 13.89) { // 50 km/h max
          return { valid: false, reason: 'Speed exceeds maximum' };
        }
      }

      // Get previous submission for session
      const { data: previousSubmission } = await supabase
        .from('distance_submissions')
        .select('*')
        .eq('session_id', submission.sessionId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (previousSubmission) {
        const timeDelta = (submission.timestamp - previousSubmission.timestamp) / 1000;
        
        // Check for reasonable progression
        if (timeDelta > 0) {
          const maxDistance = timeDelta * 13.89; // Max speed * time
          if (submission.distanceMeters - previousSubmission.cumulative_distance > maxDistance) {
            return { valid: false, reason: 'Distance increase too rapid' };
          }
        }
      }

      return { valid: true };
    }

    // Calculate winners for mining interval with anti-gaming rules
    async function calculateWinners(submissions) {
      // Generate random target distance (0-5km)
      const targetDistance = Math.random() * 5000;
      
      // Score each submission based on proximity to target
      const scored = submissions.map(sub => {
        const diff = Math.abs(sub.distance_meters - targetDistance);
        const score = diff <= 5000 ? (5000 - diff) / 5000 : 0;
        return { ...sub, score };
      });

      // Sort by score
      scored.sort((a, b) => b.score - a.score);
      
      // Select top 10% but MAX 50 winners
      const potentialWinnerCount = Math.max(1, Math.floor(submissions.length * 0.1));
      const maxWinners = 50;
      const actualWinnerCount = Math.min(potentialWinnerCount, maxWinners);
      
      // Get potential winners
      let potentialWinners = scored.slice(0, actualWinnerCount);
      
      // Apply anti-gaming rules when more than 4 winners
      if (actualWinnerCount > 4) {
        // Get user win history for today
        const today = new Date().toISOString().split('T')[0];
        const winHistoryKey = `win_history_${today}`;
        const lastWinnerKey = `last_interval_winners`;
        
        // Fetch win counts and last winners from KV
        const [winHistory, lastWinners] = await Promise.all([
          env.BikeraWorkerClaude.get(winHistoryKey, { type: 'json' }) || {},
          env.BikeraWorkerClaude.get(lastWinnerKey, { type: 'json' }) || []
        ]);
        
        // Filter out users who exceeded daily limit or won last interval
        const eligibleWinners = [];
        const excludedUsers = [];
        
        for (const winner of potentialWinners) {
          const userId = winner.user_id;
          const dailyWins = winHistory[userId] || 0;
          const wonLastInterval = lastWinners.includes(userId);
          
          // Check anti-gaming conditions
          if (dailyWins >= 38) {
            excludedUsers.push({ userId, reason: 'daily_limit_exceeded', wins: dailyWins });
          } else if (wonLastInterval) {
            excludedUsers.push({ userId, reason: 'consecutive_win_prevented' });
          } else {
            eligibleWinners.push(winner);
          }
        }
        
        // If we filtered out too many, add next best eligible users
        if (eligibleWinners.length < actualWinnerCount) {
          const remaining = scored.slice(actualWinnerCount);
          for (const candidate of remaining) {
            if (eligibleWinners.length >= actualWinnerCount) break;
            
            const userId = candidate.user_id;
            const dailyWins = winHistory[userId] || 0;
            const wonLastInterval = lastWinners.includes(userId);
            
            if (dailyWins < 38 && !wonLastInterval) {
              eligibleWinners.push(candidate);
            }
          }
        }
        
        // Update win history for eligible winners
        const newWinHistory = { ...winHistory };
        const currentWinners = [];
        
        for (const winner of eligibleWinners) {
          const userId = winner.user_id;
          newWinHistory[userId] = (newWinHistory[userId] || 0) + 1;
          currentWinners.push(userId);
        }
        
        // Store updated history and current winners
        await Promise.all([
          env.BikeraWorkerClaude.put(winHistoryKey, JSON.stringify(newWinHistory), {
            expirationTtl: 86400 // Expires after 24 hours
          }),
          env.BikeraWorkerClaude.put(lastWinnerKey, JSON.stringify(currentWinners), {
            expirationTtl: 600 // Expires after 10 minutes (2 intervals)
          })
        ]);
        
        // Log excluded users for transparency
        if (excludedUsers.length > 0) {
          console.log('Users excluded from winning:', excludedUsers);
        }
        
        potentialWinners = eligibleWinners;
      }
      
      // Distribute 500 tokens equally among final winners
      const finalWinnerCount = potentialWinners.length;
      const rewardPerWinner = finalWinnerCount > 0 ? 500 / finalWinnerCount : 0;
      
      return {
        targetDistance,
        totalParticipants: submissions.length,
        eligibleWinners: finalWinnerCount,
        winners: potentialWinners.map((w, index) => ({
          userId: w.user_id,
          distance: w.distance_meters,
          reward: rewardPerWinner,
          rank: index + 1
        }))
      };
    }

    // ============= API ROUTES =============

    // Handle OPTIONS for CORS

    router.post('/api/auth/register', async (req) => {
      const { username, email, solanaWallet } = await req.json();
      
      if (!solanaWallet) {
        return new Response(JSON.stringify({ 
          error: 'Solana wallet address required' 
        }), { 
          status: 400,
          headers: corsHeaders 
        });
      }
      
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          username,
          email,
          solana_wallet: solanaWallet,
          device_id: req.headers.get('X-Device-ID')
          // Don't specify id - let Supabase auto-generate UUID
        })
        .select()
        .single();
      
      if (error) {
        return new Response(JSON.stringify({ 
          error: error.message 
        }), { 
          status: 400,
          headers: corsHeaders 
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        userId: user.id, // This will be the UUID
        username: user.username,
        walletAddress: user.solana_wallet
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    });

    router.post('/api/auth/login', async (req) => {
      const { username } = await req.json();
  
      // Simple lookup - no password since you don't store it
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
  
        if (!user) {
        return new Response(JSON.stringify({ 
          error: 'User not found' 
        }), { 
         status: 404,
         headers: corsHeaders 
          });
       }
  
      return new Response(JSON.stringify({
        success: true,
        userId: user.id,
        username: user.username
       }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    });

      // Add to worker.js - Uses mining_intervals table
    router.get('/api/competition/status', async (req) => {  
      // Call your Supabase function
      const { data } = await supabase
       .rpc('get_current_interval_status');
  
      return new Response(JSON.stringify({
       isActive: true,
          intervalId: data[0].current_interval_id,
          secondsRemaining: data[0].seconds_remaining,
          participants: data[0].current_participants,
          projectedWinners: data[0].projected_winners,
          usersAtLimit: data[0].users_at_daily_limit
          }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    });

    router.options('*', () => {
      return new Response(null, { headers: corsHeaders });
    });

    // Health check
    router.get('/health', () => {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        timestamp: Date.now(),
        version: '2.0.0'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    });

    // Add to worker.js - Uses mining_intervals table
  router.get('/api/blocks', async (req) => {
   const { data: intervals } = await supabase
    .from('mining_intervals')
    .select('*')
    .eq('processed', true)
    .order('end_time', { ascending: false })
    .limit(20);
  
    return new Response(JSON.stringify(intervals), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  });




    // Submit distance (privacy-first: no GPS coordinates)
    router.post('/api/submit-distance', async (req) => {
      try {
        const submission = await req.json();
        const clientIp = req.headers.get('CF-Connecting-IP') || 'unknown';

        // Rate limiting - User (2.5 min between submissions)
        const rateLimiterId = env.RATE_LIMITER.idFromName(submission.userId);
        const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);
        
        const userRateCheck = await rateLimiter.fetch(
          new Request(`http://rate-limiter/check-user?userId=${submission.userId}&window=${env.USER_RATE_LIMIT_WINDOW}`)
        );
        
        if (!userRateCheck.ok) {
          const result = await userRateCheck.json();
          return new Response(JSON.stringify(result), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Rate limiting - IP
        const ipRateCheck = await rateLimiter.fetch(
          new Request(`http://rate-limiter/check-ip?ip=${clientIp}&window=${env.IP_RATE_LIMIT_WINDOW}&limit=${env.IP_RATE_LIMIT}`)
        );
        
        if (!ipRateCheck.ok) {
          const result = await ipRateCheck.json();
          return new Response(JSON.stringify(result), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Validate submission
        const validation = await validateDistanceSubmission(submission);
        if (!validation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: validation.reason
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Calculate cumulative distance for session
        const { data: sessionData } = await supabase
          .from('movement_sessions')
          .select('total_distance_meters')
          .eq('session_id', submission.sessionId)
          .single();

        const cumulativeDistance = (sessionData?.total_distance_meters || 0) + submission.distanceMeters;

        // Store distance submission (NO GPS COORDINATES!)
        const { data, error } = await supabase
          .from('distance_submissions')
          .insert({
            session_id: submission.sessionId,
            user_id: submission.userId,
            distance_meters: submission.distanceMeters,
            cumulative_distance: cumulativeDistance,
            duration_seconds: submission.durationSeconds,
            average_speed: submission.averageSpeed,
            max_speed: submission.maxSpeed,
            timestamp: submission.timestamp,
            device_id: submission.deviceId,
            validated: true
          })
          .select()
          .single();

        if (error) throw error;

        // Update session totals
        await supabase
          .from('movement_sessions')
          .update({
            total_distance_meters: cumulativeDistance,
            total_duration_seconds: submission.durationSeconds,
            last_update: new Date().toISOString()
          })
          .eq('session_id', submission.sessionId);

        // Update daily aggregate for XP calculation
        const today = new Date().toISOString().split('T')[0];
        await supabase.rpc('increment_daily_distance', {
          p_user_id: submission.userId,
          p_date: today,
          p_distance: submission.distanceMeters
        });

        // Queue for batch processing (5-minute intervals)
        await env.LOCATION_QUEUE.send({
          type: 'distance',
          intervalId: `interval_${Math.floor(Date.now() / 300000)}`,
          submission: data
        });

        return new Response(JSON.stringify({
          success: true,
          submissionId: data.id,
          cumulativeDistance,
          message: 'Distance recorded successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Submit distance error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to submit distance'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // Start mining session

    router.post('/api/session/start', async (req) => {
      try {
        const { userId, deviceId } = await req.json();
        
        // Verify user exists (userId should be UUID)
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();
        
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found. Please register first.'
          }), {
            status: 404,
            headers: corsHeaders
          });
        }
        
        // Check for existing active session
        const { data: existingSession } = await supabase
          .from('movement_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();
    
        if (existingSession) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Active session already exists',
            sessionId: existingSession.session_id
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
    
        // Create new session with UUID userId
        const sessionId = `session_${userId}_${Date.now()}`;
        const { data: session, error } = await supabase
          .from('movement_sessions')
          .insert({
            session_id: sessionId,
            user_id: userId, // This is now a UUID
            device_id: deviceId,
            status: 'active',
            started_at: new Date().toISOString()
          })
          .select()
          .single();
    
        if (error) throw error;
    
        return new Response(JSON.stringify({
          success: true,
          sessionId: session.session_id,
          startTime: session.started_at
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    
      } catch (error) {
        console.error('Start session error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to start session'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // End mining session
    router.post('/api/session/end', async (req) => {
      try {
        const { sessionId, userId } = await req.json();

        // Update session status
        const { data: session, error } = await supabase
          .from('movement_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString()
          })
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          session: {
            sessionId: session.session_id,
            totalDistance: session.total_distance_meters,
            totalDuration: session.total_duration_seconds,
            status: session.status
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('End session error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to end session'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // Get user stats
    router.get('/api/stats/:userId', async (req) => {
      try {
        const { userId } = req.params;

        // Get user stats
        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .single();

        // Get recent sessions
        const { data: recentSessions } = await supabase
          .from('movement_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(10);

        // Get XP balance (will come from ICP later)
        const { data: xpData } = await supabase
          .from('user_xp_tracking')
          .select('SUM(xp_minted)')
          .eq('user_id', userId)
          .single();

        return new Response(JSON.stringify({
          stats: stats || {
            total_distance_meters: 0,
            total_duration_seconds: 0,
            total_sessions: 0,
            average_speed: 0
          },
          recentSessions,
          xpBalance: xpData?.sum || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Get stats error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to fetch stats'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // Process mining interval (called by cron or manually)
    router.post('/api/process-interval', async (req) => {
      try {
        const { intervalId } = await req.json();
        
        // Get all submissions for this interval
        const fiveMinutesAgo = Date.now() - 300000;
        const { data: submissions } = await supabase
          .from('distance_submissions')
          .select('*')
          .gte('timestamp', fiveMinutesAgo)
          .lte('timestamp', Date.now());

        if (!submissions || submissions.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No submissions for interval'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Calculate winners with anti-gaming rules
        const results = await calculateWinners(submissions);
        
        // Store interval results with additional metadata
        await supabase.from('mining_intervals').insert({
          interval_id: intervalId,
          start_time: fiveMinutesAgo,
          end_time: Date.now(),
          target_distance: results.targetDistance,
          total_participants: results.totalParticipants,
          eligible_winners: results.eligibleWinners,
          participants: submissions.map(s => ({
            user_id: s.user_id,
            distance: s.distance_meters
          })),
          winners: results.winners,
          processed: true,
          anti_gaming_applied: results.eligibleWinners !== results.totalParticipants
        });

        // Update user statistics for rate limiting
        if (results.winners.length > 0) {
          // Update daily win counts in user_stats
          const winnerIds = results.winners.map(w => w.userId);
          await supabase.rpc('increment_daily_wins', { 
            user_ids: winnerIds 
          });
        }

        // Queue for ICP processing
        await env.LOCATION_QUEUE.send({
          type: 'rewards',
          intervalId,
          winners: results.winners
        });

        return new Response(JSON.stringify({
          success: true,
          intervalId,
          targetDistance: results.targetDistance,
          totalParticipants: results.totalParticipants,
          eligibleWinners: results.eligibleWinners,
          winners: results.winners.length,
          rewardPerWinner: results.winners.length > 0 ? results.winners[0].reward : 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Process interval error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to process interval'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // Distribute XP tokens (called every 2-7 days)
    router.post('/api/distribute-xp', async (req) => {
      try {
        // Get pending XP distributions
        const { data: pendingXP } = await supabase
          .from('daily_distance_aggregates')
          .select('*')
          .eq('xp_distributed', false)
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (!pendingXP || pendingXP.length === 0) {
          return new Response(JSON.stringify({
            message: 'No pending XP to distribute'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Group by user
        const userXP = {};
        pendingXP.forEach(record => {
          if (!userXP[record.user_id]) {
            userXP[record.user_id] = 0;
          }
          userXP[record.user_id] += record.total_distance_meters;
        });

        // Prepare for ICP (when ready)
        const distributions = Object.entries(userXP).map(([userId, distance]) => ({
          userId,
          xpAmount: Math.floor(distance / 1000), // 1 XP per KM
          dataHash: generateHash({ userId, distance, timestamp: Date.now() })
        }));

        // For now, store in database (later will call ICP)
        for (const dist of distributions) {
          await supabase.from('user_xp_tracking').insert({
            user_id: dist.userId,
            period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            period_end: new Date(),
            distance_km: dist.xpAmount,
            xp_minted: dist.xpAmount,
            status: 'pending_icp', // Will be 'minted' after ICP call
            minted_at: new Date()
          });
        }

        // Mark aggregates as distributed
        await supabase
          .from('daily_distance_aggregates')
          .update({ xp_distributed: true })
          .in('id', pendingXP.map(p => p.id));

        return new Response(JSON.stringify({
          success: true,
          distributions: distributions.length,
          totalXP: distributions.reduce((sum, d) => sum + d.xpAmount, 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('XP distribution error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to distribute XP'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });


    //API status request for debugging

    router.get('/api/status', async (req) => {
      try {
        // Get aggregated stats
        const { data: userCount } = await supabase
          .from('users')
          .select('id', { count: 'exact' });
        
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('total_rewards');
        
        const totalRewards = statsData?.reduce((sum, user) => 
          sum + parseFloat(user.total_rewards || 0), 0) || 0;
        
        return new Response(JSON.stringify({
          totalRewards: totalRewards,
          minerCount: userCount?.length || 0,
          lastUpdate: new Date().toISOString(),
          networkHealth: 'Excellent',
          blockTime: '5 minutes',
          difficulty: 'Dynamic'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Status endpoint error:', error);
        return new Response(JSON.stringify({
          totalRewards: 0,
          minerCount: 0,
          lastUpdate: new Date().toISOString(),
          networkHealth: 'Unknown',
          blockTime: '5 minutes',
          difficulty: 'Dynamic'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });


    // Add to worker.js - Uses rewards_history table
    router.post('/api/mining/claim', async (req) => {
      const { userId } = await req.json();
      
      // Get user's wallet address
      const { data: userData } = await supabase
        .from('users')
        .select('id, solana_wallet')
        .eq('id', userId)
        .single();
      
      if (!userData) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User not found'
        }), {
          status: 404,
          headers: corsHeaders
        });
      }
      
      if (!userData.solana_wallet) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No wallet address configured. Please add a Solana wallet to claim rewards.'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Get unclaimed rewards
      const { data: unclaimed } = await supabase
        .from('rewards_history')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'distributed');
      
      if (!unclaimed || unclaimed.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No rewards to claim'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Calculate total
      const totalRewards = unclaimed.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      
      // Mark as claimed
      await supabase
        .from('rewards_history')
        .update({ status: 'claimed' })
        .eq('user_id', userId)
        .eq('status', 'distributed');
      
      // TODO: Initiate Solana transfer here
      // const txHash = await transferSolanaTokens(userData.solana_wallet, totalRewards);
      
      return new Response(JSON.stringify({
        success: true,
        amount: totalRewards,
        count: unclaimed.length,
        walletAddress: userData.solana_wallet
        // transactionHash: txHash // When Solana integration is ready
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    });


    // Get leaderboard
    router.get('/api/leaderboard/:period', async (req) => {
      try {
        const { period } = req.params; // daily, weekly, monthly, all-time
        
        let dateFilter = new Date();
        switch(period) {
          case 'daily':
            dateFilter.setDate(dateFilter.getDate() - 1);
            break;
          case 'weekly':
            dateFilter.setDate(dateFilter.getDate() - 7);
            break;
          case 'monthly':
            dateFilter.setMonth(dateFilter.getMonth() - 1);
            break;
          default: // all-time
            dateFilter = new Date(0);
        }

        const { data: leaderboard } = await supabase
          .from('user_stats')
          .select('user_id, username, total_distance_meters, total_rewards')
          .gte('last_activity', dateFilter.toISOString())
          .order('total_distance_meters', { ascending: false })
          .limit(100);

        return new Response(JSON.stringify({
          period,
          leaderboard: leaderboard.map((user, index) => ({
            rank: index + 1,
            ...user,
            distanceKm: (user.total_distance_meters / 1000).toFixed(2)
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Leaderboard error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to fetch leaderboard'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    // Handle all routes
    return router.handle(request).catch(err => {
      console.error('Router error:', err);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders
      });
    });
  },

  // Queue handler for batch processing
  async queue(batch, env) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    
    for (const message of batch.messages) {
      try {
        if (message.body.type === 'rewards') {
          // Process rewards distribution to ICP
          // This will be implemented when ICP integration is ready
          console.log('Processing rewards for interval:', message.body.intervalId);
        } else if (message.body.type === 'distance') {
          // Accumulate for interval processing
          console.log('Distance submission queued for interval:', message.body.intervalId);
        }
        
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },

  // Scheduled tasks
  async scheduled(event, env, ctx) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    
    // Process mining intervals every 5 minutes
    if (event.cron === '*/5 * * * *') {
      const intervalId = `interval_${Math.floor(Date.now() / 300000)}`;
      await fetch(`${env.WORKER_URL}/api/process-interval`, {
        method: 'POST',
        body: JSON.stringify({ intervalId })
      });
    }
    
    // Distribute XP every 3 days
    if (event.cron === '0 0 */3 * *') {
      await fetch(`${env.WORKER_URL}/api/distribute-xp`, {
        method: 'POST',
        body: JSON.stringify({ trigger: 'scheduled' })
      });
    }
  }
};

// Helper function to generate hash
function generateHash(data) {
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();
  const dataString = JSON.stringify(data);
  const buffer = encoder.encode(dataString);
  return crypto.subtle.digest('SHA-256', buffer).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}