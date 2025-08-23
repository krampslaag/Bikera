import { Router } from 'itty-router';
import { createClient } from '@supabase/supabase-js';
import { verify } from '@tsndr/cloudflare-worker-jwt';

// Configuration constants (can be overridden by environment variables)
const CONFIG = {
  RATE_LIMIT: {
    USER_WINDOW_MS: 150000,    // 2.5 minutes
    IP_WINDOW_MS: 60000,       // 1 minute
    USER_LIMIT: 1,              // 1 request per window
    IP_LIMIT: 1000,             // 1000 requests per window
  },
  BATCH: {
    MIN_SIZE: 100,              // Minimum batch size
    MAX_WAIT_MS: 300000,        // 5 minutes max wait
    MAX_BATCH_SIZE: 1000,       // Maximum batch size
  },
  REWARDS: {
    TOTAL_POOL: 500,            // Total $IMERA per interval
    WINNER_PERCENTAGE: 0.1,     // Top 10%
    MIN_TOKEN_BALANCE: 1000000, // 1M $IMERA requirement
  },
  VALIDATION: {
    MIN_SCORE: 40,              // Minimum validation score
    MAX_SPEED_MS: 13.89,        // 50 km/h in m/s
    MAX_ACCURACY: 1000,         // Maximum accuracy in meters
    MAX_TIME_DIFF_MS: 300000,   // 5 minutes
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
  }
};

const router = Router();

// Initialize Supabase client with environment variables
function initSupabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      fetch: fetch.bind(globalThis),
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );
}

// Retry wrapper for external calls
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || CONFIG.RETRY.MAX_ATTEMPTS;
  const initialDelay = options.initialDelay || CONFIG.RETRY.INITIAL_DELAY_MS;
  const maxDelay = options.maxDelay || CONFIG.RETRY.MAX_DELAY_MS;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// CORS headers helper
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Rate limiting using CloudFlare Durable Objects
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    try {
      const { userId, ip } = await request.json();
      const now = Date.now();
      
      // Get configuration from environment or use defaults
      const isUserCheck = !!userId;
      const windowMs = isUserCheck 
        ? (this.env.USER_RATE_LIMIT_WINDOW || CONFIG.RATE_LIMIT.USER_WINDOW_MS)
        : (this.env.IP_RATE_LIMIT_WINDOW || CONFIG.RATE_LIMIT.IP_WINDOW_MS);
      const limit = isUserCheck 
        ? (this.env.USER_RATE_LIMIT || CONFIG.RATE_LIMIT.USER_LIMIT)
        : (this.env.IP_RATE_LIMIT || CONFIG.RATE_LIMIT.IP_LIMIT);
      
      const key = isUserCheck ? `user:${userId}` : `ip:${ip}`;
      
      // Get submission history
      const submissions = (await this.state.storage.get(key)) || [];
      
      // Remove old submissions
      const recentSubmissions = submissions.filter(time => now - time < windowMs);
      
      // Check rate limit
      if (recentSubmissions.length >= limit) {
        const oldestSubmission = recentSubmissions[0];
        const nextAllowedTime = oldestSubmission + windowMs;
        const waitTime = Math.max(0, nextAllowedTime - now);
        
        return new Response(JSON.stringify({
          allowed: false,
          waitTime,
          message: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds`,
          retryAfter: new Date(nextAllowedTime).toISOString()
        }), { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(waitTime / 1000).toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': nextAllowedTime.toString()
          }
        });
      }
      
      // Add new submission timestamp
      recentSubmissions.push(now);
      
      // Keep only necessary history
      const maxHistory = isUserCheck ? 5 : 1000;
      while (recentSubmissions.length > maxHistory) {
        recentSubmissions.shift();
      }
      
      await this.state.storage.put(key, recentSubmissions);
      
      const remaining = limit - recentSubmissions.length;
      
      return new Response(JSON.stringify({ 
        allowed: true,
        remaining,
        resetTime: now + windowMs
      }), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': (now + windowMs).toString()
        }
      });
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open on error (allow request)
      return new Response(JSON.stringify({ allowed: true }), { status: 200 });
    }
  }
}

// OPTIONS handler for CORS preflight
router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
});

// Global IP rate limiting for DDoS protection
router.all('*', async (request, env) => {
  // Skip rate limiting for health checks
  if (request.url.includes('/health')) {
    return;
  }
  
  try {
    const ip = request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for') || 
               'unknown';
    
    const rateLimiterId = env.RATE_LIMITER.idFromName(`ip:${ip}`);
    const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);
    
    const response = await rateLimiter.fetch(
      new Request('http://rate-limiter', {
        method: 'POST',
        body: JSON.stringify({ ip })
      })
    );
    
    const result = await response.json();
    if (!result.allowed) {
      return new Response('Too many requests', { 
        status: 429,
        headers: {
          ...corsHeaders(),
          'Retry-After': Math.ceil(result.waitTime / 1000).toString()
        }
      });
    }
  } catch (error) {
    console.error('Global rate limiting error:', error);
    // Fail open - continue processing
  }
  
  return; // Proceed to next handler
});

// Main location submission endpoint
router.post('/api/submit-location', async ({ request, env }) => {
  const requestId = crypto.randomUUID();
  
  try {
    // Initialize Supabase with env variables
    const supabase = initSupabase(env);
    
    const { 
      userId, 
      latitude, 
      longitude, 
      accuracy, 
      altitude,
      speed,
      heading,
      timestamp,
      deviceInfo,
      signature 
    } = await request.json();
    
    // Step 1: Verify JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        requestId 
      }), { 
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const isValid = await verify(token, env.JWT_SECRET);
    
    if (!isValid) {
      return new Response(JSON.stringify({ 
        error: 'Invalid token',
        requestId 
      }), { 
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
    
    // Step 2: Rate limiting check (per user)
    const rateLimiterId = env.RATE_LIMITER.idFromName(userId);
    const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);
    
    const rateLimitResponse = await rateLimiter.fetch(
      new Request('http://rate-limiter', {
        method: 'POST',
        body: JSON.stringify({ userId })
      })
    );
    
    const { allowed, waitTime, message } = await rateLimitResponse.json();
    
    if (!allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded', 
        waitTime,
        message,
        requestId 
      }), { 
        status: 429,
        headers: { 
          ...corsHeaders(),
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(waitTime / 1000).toString()
        }
      });
    }
    
    // Step 3: Determine edge path: Cloudflare or Raspberry Pi
    const region = await getRegion(latitude, longitude, env, supabase);
    let validationResult;
    
    if (env.PI_ENDPOINTS) {
      try {
        const piEndpoints = JSON.parse(env.PI_ENDPOINTS);
        if (piEndpoints[region]) {
          // Forward to regional Pi for validation with retry
          validationResult = await withRetry(async () => {
            const piResponse = await fetch(`${piEndpoints[region]}/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                userId, latitude, longitude, accuracy, speed, timestamp, deviceInfo 
              }),
              signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!piResponse.ok) {
              throw new Error(`Pi node error: ${piResponse.status}`);
            }
            
            return await piResponse.json();
          });
          
          // Verify Pi-node signature and token balance
          const { nodePubkey, signature: piSignature, ...result } = validationResult;
          
          if (!nodePubkey || !piSignature || 
              !(await verifyPiNodeSignature(result, nodePubkey, piSignature, env, supabase))) {
            await supabase.from('suspicious_activities').insert({
              user_id: userId,
              reason: 'Invalid pi-node signature or insufficient token balance',
              location: { latitude, longitude },
              timestamp: new Date().toISOString(),
              device_info: { nodePubkey }
            });
            
            return new Response(JSON.stringify({
              error: 'Invalid pi-node',
              reason: 'Unregistered, unverified, or insufficient $IMERA balance',
              requestId
            }), { 
              status: 403,
              headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
            });
          }
          
          validationResult = result;
        } else {
          // No Pi endpoint for this region, validate locally
          validationResult = await validateLocation(
            { latitude, longitude, accuracy, speed, timestamp, deviceInfo }, 
            env, 
            supabase
          );
        }
      } catch (error) {
        console.error('Pi endpoint error, falling back to local validation:', error);
        // Fallback to local validation
        validationResult = await validateLocation(
          { latitude, longitude, accuracy, speed, timestamp, deviceInfo }, 
          env, 
          supabase
        );
      }
    } else {
      // Validate locally in Cloudflare
      validationResult = await validateLocation(
        { latitude, longitude, accuracy, speed, timestamp, deviceInfo }, 
        env, 
        supabase
      );
    }
    
    if (!validationResult.valid) {
      // Log suspicious activity
      await supabase.from('suspicious_activities').insert({
        user_id: userId,
        reason: validationResult.reason,
        location: { latitude, longitude },
        timestamp: new Date().toISOString(),
        device_info: deviceInfo
      });
      
      return new Response(JSON.stringify({
        error: 'Location validation failed',
        reason: validationResult.reason,
        requestId
      }), { 
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
    
    // Step 4: Store in PostgreSQL (via Supabase)
    const { data: submission, error: dbError } = await supabase
      .from('location_submissions')
      .insert({
        user_id: userId,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        timestamp: new Date(timestamp).toISOString(),
        device_fingerprint: deviceInfo?.deviceId,
        validation_score: validationResult.score,
        status: 'pending'
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        requestId 
      }), { 
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }
    
    // Step 5: Add to processing queue
    if (env.LOCATION_QUEUE) {
      await env.LOCATION_QUEUE.put({
        submissionId: submission.id,
        userId,
        timestamp,
        requestId
      });
    }
    
    // Step 6: Check if batch processing should trigger
    const shouldProcess = await checkBatchTrigger(env, supabase);
    
    if (shouldProcess) {
      // Trigger async batch processing (don't await)
      triggerBatchProcessing(env, supabase).catch(error => {
        console.error('Batch processing error:', error);
      });
    }
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      submissionId: submission.id,
      nextSubmissionTime: Date.now() + CONFIG.RATE_LIMIT.USER_WINDOW_MS,
      currentInterval: await getCurrentInterval(env, supabase),
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error processing submission:', error, { requestId });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: env.DEBUG === 'true' ? error.message : undefined,
      requestId 
    }), { 
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
});

// Get region for routing to Raspberry Pi
async function getRegion(latitude, longitude, env, supabase) {
  try {
    const { data } = await supabase
      .from('custom_zones')
      .select('id')
      .filter('center_location', 'st_dwithin', `(${longitude},${latitude},5000)`) // 5km radius
      .eq('is_active', true)
      .single();
    
    return data ? data.id : 'default';
  } catch (error) {
    console.error('Error getting region:', error);
    return 'default';
  }
}

// Verify pi-node signature and token balance
async function verifyPiNodeSignature(validationResult, nodePubkey, signature, env, supabase) {
  try {
    const { PublicKey, verify } = await import('@solana/web3.js');
    
    const { data } = await supabase
      .from('pi_nodes')
      .select('is_verified, token_balance')
      .eq('node_id', nodePubkey)
      .eq('is_verified', true)
      .gte('token_balance', CONFIG.REWARDS.MIN_TOKEN_BALANCE)
      .single();
    
    if (!data) return false;
    
    const message = Buffer.from(JSON.stringify(validationResult));
    return verify(Buffer.from(signature, 'base64'), message, new PublicKey(nodePubkey));
  } catch (error) {
    console.error('Error verifying pi-node signature:', error);
    return false;
  }
}

// Location validation function
async function validateLocation(location, env, supabase) {
  const checks = [];
  let score = 100;
  
  try {
    // Check 1: Accuracy validation
    if (location.accuracy <= 0 || location.accuracy > CONFIG.VALIDATION.MAX_ACCURACY) {
      checks.push('invalid_accuracy');
      score -= 30;
    }
    
    // Check 2: Speed validation (bicycle-specific)
    if (location.speed !== null && location.speed !== undefined) {
      if (location.speed > CONFIG.VALIDATION.MAX_SPEED_MS) {
        checks.push('impossible_speed');
        score -= 50;
      }
    }
    
    // Check 3: Coordinate validation
    if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
      checks.push('invalid_coordinates');
      score -= 100;
    }
    
    // Check 4: Timestamp validation
    const now = Date.now();
    const submissionTime = new Date(location.timestamp).getTime();
    const timeDiff = Math.abs(now - submissionTime);
    
    if (timeDiff > CONFIG.VALIDATION.MAX_TIME_DIFF_MS) {
      checks.push('timestamp_mismatch');
      score -= 20;
    }
    
    // Check 5: Device fingerprint validation
    if (location.deviceInfo) {
      const { deviceId, model, platform } = location.deviceInfo;
      
      if (!deviceId || deviceId.includes('emulator') || deviceId.includes('simulator')) {
        checks.push('suspicious_device');
        score -= 40;
      }
      
      try {
        const { data: blacklisted } = await supabase
          .from('blacklisted_devices')
          .select('device_id')
          .eq('device_id', deviceId)
          .single();
        
        if (blacklisted) {
          checks.push('blacklisted_device');
          score = 0;
        }
      } catch (error) {
        // Device not blacklisted (expected case)
      }
    }
    
    // Check 6: Geographic fence (optional)
    if (env.GEO_FENCE_ENABLED === 'true') {
      const inFence = await checkGeofence(location.latitude, location.longitude, env);
      if (!inFence) {
        checks.push('outside_geofence');
        score -= 20;
      }
    }
    
    return {
      valid: score >= CONFIG.VALIDATION.MIN_SCORE,
      score,
      reason: checks.join(', '),
      checks
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      valid: false,
      score: 0,
      reason: 'validation_error',
      checks: ['error']
    };
  }
}

// Check geofence (placeholder - implement based on your requirements)
async function checkGeofence(latitude, longitude, env) {
  // Implement your geofence logic here
  return true;
}

// Batch processing trigger
async function checkBatchTrigger(env, supabase) {
  try {
    const { count } = await supabase
      .from('location_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const lastProcessed = await env.BikeraWorkerClaude.get('last_batch_processed');
    const timeSinceLastBatch = Date.now() - (parseInt(lastProcessed) || 0);
    
    const minBatchSize = env.MIN_BATCH_SIZE || CONFIG.BATCH.MIN_SIZE;
    const maxWaitTime = env.MAX_BATCH_WAIT || CONFIG.BATCH.MAX_WAIT_MS;
    
    return count >= minBatchSize || timeSinceLastBatch > maxWaitTime;
  } catch (error) {
    console.error('Error checking batch trigger:', error);
    return false;
  }
}

// Group submissions by interval
function groupByInterval(submissions) {
  const intervals = {};
  const intervalDuration = CONFIG.BATCH.MAX_WAIT_MS; // 5 minutes
  
  submissions.forEach(sub => {
    const subTime = new Date(sub.timestamp).getTime();
    const intervalId = Math.floor(subTime / intervalDuration) * intervalDuration;
    
    if (!intervals[intervalId]) {
      intervals[intervalId] = [];
    }
    intervals[intervalId].push(sub);
  });
  
  return intervals;
}

// Calculate Merkle root (placeholder - implement proper Merkle tree)
function calculateMerkleRoot(submissions) {
  // Simple hash of all submission IDs for now
  const ids = submissions.map(s => s.id).sort().join('');
  return btoa(ids).substring(0, 64);
}

// Get next submission time for user
async function getNextSubmissionTime(userId, env) {
  try {
    const rateLimiterId = env.RATE_LIMITER.idFromName(userId);
    const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);
    
    // Check current rate limit status
    const response = await rateLimiter.fetch(
      new Request('http://rate-limiter', {
        method: 'POST',
        body: JSON.stringify({ userId, checkOnly: true })
      })
    );
    
    const result = await response.json();
    if (!result.allowed) {
      return Date.now() + result.waitTime;
    }
    
    return Date.now() + CONFIG.RATE_LIMIT.USER_WINDOW_MS;
  } catch (error) {
    console.error('Error getting next submission time:', error);
    return Date.now() + CONFIG.RATE_LIMIT.USER_WINDOW_MS;
  }
}

// Get current interval
async function getCurrentInterval(env, supabase) {
  const now = Date.now();
  const intervalDuration = CONFIG.BATCH.MAX_WAIT_MS;
  const intervalStart = Math.floor(now / intervalDuration) * intervalDuration;
  const intervalEnd = intervalStart + intervalDuration;
  
  try {
    const { count } = await supabase
      .from('location_submissions')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(intervalStart).toISOString())
      .lte('timestamp', new Date(intervalEnd).toISOString());
    
    return {
      intervalId: intervalStart,
      startTime: intervalStart,
      endTime: intervalEnd,
      currentTime: now,
      timeRemaining: intervalEnd - now,
      submissions: count || 0,
      targetDistance: generateTargetDistance(intervalStart)
    };
  } catch (error) {
    console.error('Error getting current interval:', error);
    return {
      intervalId: intervalStart,
      startTime: intervalStart,
      endTime: intervalEnd,
      currentTime: now,
      timeRemaining: intervalEnd - now,
      submissions: 0,
      targetDistance: generateTargetDistance(intervalStart)
    };
  }
}

// Trigger batch processing to ICP
async function triggerBatchProcessing(env, supabase) {
  const batchId = crypto.randomUUID();
  
  try {
    console.log(`Starting batch processing: ${batchId}`);
    
    const maxBatchSize = env.MAX_BATCH_SIZE || CONFIG.BATCH.MAX_BATCH_SIZE;
    
    const { data: submissions } = await supabase
      .from('location_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('timestamp', { ascending: true })
      .limit(maxBatchSize);
    
    if (!submissions || submissions.length === 0) {
      console.log(`No pending submissions for batch ${batchId}`);
      return;
    }
    
    console.log(`Processing ${submissions.length} submissions in batch ${batchId}`);
    
    const intervals = groupByInterval(submissions);
    
    // Process intervals in parallel for better performance
    const processingPromises = Object.entries(intervals).map(async ([intervalId, intervalSubmissions]) => {
      try {
        const winners = calculateWinners(intervalSubmissions, parseInt(intervalId));
        
        const batch = {
          batchId,
          intervalId,
          submissions: intervalSubmissions.map(s => ({
            userId: s.user_id,
            latitude: s.latitude,
            longitude: s.longitude,
            timestamp: s.timestamp
          })),
          winners: winners.map(w => ({
            userId: w.userId,
            reward: w.reward,
            rank: w.rank
          })),
          merkleRoot: calculateMerkleRoot(intervalSubmissions),
          timestamp: Date.now()
        };
        
        // Send to ICP with retry
        await withRetry(async () => {
          await sendToICP(batch, env);
        });
        
        // Update submissions status
        const submissionIds = intervalSubmissions.map(s => s.id);
        await supabase
          .from('location_submissions')
          .update({ 
            status: 'processed',
            interval_id: intervalId,
            processed_at: new Date().toISOString()
          })
          .in('id', submissionIds);
        
        // Insert rewards
        const rewardInserts = winners.map(winner => ({
          user_id: winner.userId,
          interval_id: intervalId,
          reward_amount: winner.reward,
          rank: winner.rank,
          created_at: new Date().toISOString()
        }));
        
        if (rewardInserts.length > 0) {
          await supabase
            .from('mining_rewards')
            .insert(rewardInserts);
        }
        
        console.log(`Interval ${intervalId} processed successfully in batch ${batchId}`);
      } catch (error) {
        console.error(`Error processing interval ${intervalId} in batch ${batchId}:`, error);
        // Don't throw - allow other intervals to process
      }
    });
    
    await Promise.allSettled(processingPromises);
    
    await env.BikeraWorkerClaude.put('last_batch_processed', Date.now().toString());
    console.log(`Batch ${batchId} processing completed`);
    
  } catch (error) {
    console.error(`Batch processing error for ${batchId}:`, error);
    throw error;
  }
}

// Calculate winners based on proximity to target traveled distance
function calculateWinners(submissions, intervalId) {
  if (!submissions || submissions.length === 0) {
    return [];
  }
  
  const targetDistance = generateTargetDistance(intervalId);
  
  // Group submissions by user
  const userSubmissions = {};
  submissions.forEach(sub => {
    if (!userSubmissions[sub.user_id]) {
      userSubmissions[sub.user_id] = [];
    }
    userSubmissions[sub.user_id].push(sub);
  });
  
  // Calculate travel distance for each user
  const userTravel = {};
  for (const [userId, subs] of Object.entries(userSubmissions)) {
    subs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let travel = 0;
    if (subs.length >= 2) {
      for (let i = 1; i < subs.length; i++) {
        travel += calculateDistance(
          subs[i-1].latitude,
          subs[i-1].longitude,
          subs[i].latitude,
          subs[i].longitude
        );
      }
    }
    userTravel[userId] = travel;
  }
  
  // Calculate differences from target
  const differences = Object.entries(userTravel).map(([userId, travel]) => ({
    userId,
    difference: Math.abs(travel - targetDistance),
    travel
  }));
  
  // Sort by closest to target
  differences.sort((a, b) => a.difference - b.difference);
  
  // Determine winners (top 10%)
  const totalUsers = differences.length;
  const numWinners = Math.max(1, Math.ceil(totalUsers * CONFIG.REWARDS.WINNER_PERCENTAGE));
  const rewardPerWinner = CONFIG.REWARDS.TOTAL_POOL / numWinners;
  
  const winners = [];
  for (let i = 0; i < Math.min(numWinners, totalUsers); i++) {
    winners.push({
      userId: differences[i].userId,
      reward: rewardPerWinner,
      rank: i + 1,
      travel: differences[i].travel,
      difference: differences[i].difference
    });
  }
  
  return winners;
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Generate deterministic random target distance (0-5 km)
function generateTargetDistance(seed) {
  const hash = cyrb53(seed.toString());
  return (hash % 5001) / 1000; // 0 to 5.000 km
}

// Simple hash function for deterministic randomness
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1>>>0);
}

// Send batch to ICP canister
async function sendToICP(batch, env) {
  if (!env.ICP_CANISTER_URL) {
    console.warn('ICP_CANISTER_URL not configured, skipping ICP submission');
    return;
  }
  
  try {
    const response = await fetch(`${env.ICP_CANISTER_URL}/process_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.ICP_API_KEY || '',
        'X-Batch-Id': batch.batchId
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ICP submission failed: ${response.status} - ${errorText}`);
    }
    
    console.log(`Batch ${batch.batchId} sent to ICP successfully`);
  } catch (error) {
    console.error('Error sending to ICP:', error);
    
    // Store failed batch for retry
    if (env.BikeraWorkerClaude) {
      await env.BikeraWorkerClaude.put(
        `failed_batch:${batch.intervalId}`,
        JSON.stringify(batch),
        { expirationTtl: 86400 } // Keep for 24 hours
      );
    }
    
    throw error;
  }
}

// API endpoint to get user stats
router.get('/api/user/:userId/stats', async (request, env) => {
  try {
    const { userId } = request.params;
    const supabase = initSupabase(env);
    
    // Fetch all data in parallel for better performance
    const [statsResult, submissionsResult, rewardsResult] = await Promise.allSettled([
      supabase
        .from('user_mining_stats')
        .select('*')
        .eq('user_id', userId)
        .single(),
      
      supabase
        .from('location_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10),
      
      supabase
        .from('mining_rewards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);
    
    const stats = statsResult.status === 'fulfilled' ? statsResult.value.data : null;
    const recentSubmissions = submissionsResult.status === 'fulfilled' ? submissionsResult.value.data : [];
    const rewards = rewardsResult.status === 'fulfilled' ? rewardsResult.value.data : [];
    
    return new Response(JSON.stringify({
      stats: stats || { total_rewards: 0, total_submissions: 0 },
      recentSubmissions: recentSubmissions || [],
      rewards: rewards || [],
      nextSubmissionTime: await getNextSubmissionTime(userId, env)
    }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch user stats' 
    }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
});

// Get current mining interval
router.get('/api/current-interval', async (request, env) => {
  try {
    const supabase = initSupabase(env);
    return new Response(JSON.stringify(
      await getCurrentInterval(env, supabase)
    ), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting current interval:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get current interval' 
    }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
});

// Health check endpoint
router.get('/health', () => {
  return new Response(JSON.stringify({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), { 
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
});

// 404 handler
router.all('*', () => {
  return new Response(JSON.stringify({ 
    error: 'Not Found' 
  }), { 
    status: 404,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
});

// Main handler
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};

// Export Durable Objects
export { RateLimiter };