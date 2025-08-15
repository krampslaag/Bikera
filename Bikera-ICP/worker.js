import { Router } from 'itty-router';
import { createClient } from '@supabase/supabase-js';
import { verify } from '@tsndr/cloudflare-worker-jwt';

// Environment variables (set in CloudFlare dashboard)
// SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET, ICP_CANISTER_URL, PI_ENDPOINTS

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    fetch: fetch.bind(globalThis)
  }
);

// Rate limiting using CloudFlare Durable Objects
class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { userId, ip } = await request.json();
    const now = Date.now();
    const RATE_LIMIT_WINDOW = userId ? 150000 : 60000; // 2.5 min for users, 1 min for IPs
    const key = userId ? `user:${userId}` : `ip:${ip}`;
    const limit = userId ? 1 : 1000; // 1 req/2.5min per user, 1000 req/min per IP

    // Get submission history
    const submissions = (await this.state.storage.get(key)) || [];

    // Remove old submissions
    const recentSubmissions = submissions.filter(time => now - time < RATE_LIMIT_WINDOW);

    // Check rate limit
    if (recentSubmissions.length >= limit) {
      const lastSubmission = recentSubmissions[recentSubmissions.length - 1];
      const timeSinceLast = now - lastSubmission;
      return new Response(JSON.stringify({
        allowed: false,
        waitTime: RATE_LIMIT_WINDOW - timeSinceLast,
        message: `Please wait ${Math.ceil((RATE_LIMIT_WINDOW - timeSinceLast) / 1000)} seconds`
      }), { status: 429 });
    }

    // Add new submission timestamp
    recentSubmissions.push(now);
    if (recentSubmissions.length > (userId ? 5 : 1000)) {
      recentSubmissions.shift();
    }
    await this.state.storage.put(key, recentSubmissions);

    return new Response(JSON.stringify({ allowed: true }), { status: 200 });
  }
}

// Global IP rate limiting for DDoS protection
router.all('*', async (request, env) => {
  const ip = request.headers.get('cf-connecting-ip');
  const rateLimiterId = env.RATE_LIMITER.idFromName(`ip:${ip}`);
  const rateLimiter = env.RATE_LIMITER.get(rateLimiterId);
  const response = await rateLimiter.fetch(
    new Request('http://rate-limiter', {
      method: 'POST',
      body: JSON.stringify({ ip })
    })
  );
  if (!(await response.json()).allowed) {
    return new Response('Too many requests', { status: 429 });
  }
  return; // Proceed to next handler
});

// Main location submission endpoint
router.post('/api/submit-location', async ({ request, env }) => {
  try {
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
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const isValid = await verify(token, env.JWT_SECRET);
    
    if (!isValid) {
      return new Response('Invalid token', { status: 401 });
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
        message 
      }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Determine edge path: Cloudflare or Raspberry Pi
    const region = await getRegion(latitude, longitude, env);
    let validationResult;
    if (env.PI_ENDPOINTS && env.PI_ENDPOINTS[region]) {
      // Forward to regional Pi for validation
      const piResponse = await fetch(`${env.PI_ENDPOINTS[region]}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, latitude, longitude, accuracy, speed, timestamp, deviceInfo })
      });
      if (!piResponse.ok) {
        return new Response('Edge node error', { status: 500 });
      }
      validationResult = await piResponse.json();
      // Verify Pi-node signature and token balance
      const { nodePubkey, signature: piSignature, ...result } = validationResult;
      if (!nodePubkey || !piSignature || !(await verifyPiNodeSignature(result, nodePubkey, piSignature, env))) {
        await supabase.from('suspicious_activities').insert({
          user_id: userId,
          reason: 'Invalid pi-node signature or insufficient token balance',
          location: { latitude, longitude },
          timestamp: new Date().toISOString(),
          device_info: { nodePubkey }
        });
        return new Response(JSON.stringify({
          error: 'Invalid pi-node',
          reason: 'Unregistered, unverified, or insufficient $IMERA balance'
        }), { status: 403 });
      }
    } else {
      // Validate locally in Cloudflare
      validationResult = await validateLocation({ latitude, longitude, accuracy, speed, timestamp, deviceInfo }, env);
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
        reason: validationResult.reason
      }), { status: 400 });
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
      return new Response('Internal server error', { status: 500 });
    }

    // Step 5: Add to processing queue
    await env.LOCATION_QUEUE.put({
      submissionId: submission.id,
      userId,
      timestamp
    });

    // Step 6: Check if batch processing should trigger
    const shouldProcess = await checkBatchTrigger(env);
    
    if (shouldProcess) {
      // Trigger async batch processing
      await triggerBatchProcessing(env);
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      submissionId: submission.id,
      nextSubmissionTime: Date.now() + 150000, // 2.5 minutes from now
      currentInterval: await getCurrentInterval(env)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing submission:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

// Get region for routing to Raspberry Pi
async function getRegion(latitude, longitude, env) {
  const { data } = await supabase
    .from('custom_zones')
    .select('id')
    .filter('center_location', 'st_dwithin', `(${longitude},${latitude},5000)`) // 5km radius
    .eq('is_active', true)
    .single();

  return data ? data.id : 'default';
}

// Verify pi-node signature and token balance
async function verifyPiNodeSignature(validationResult, nodePubkey, signature, env) {
  const { PublicKey, verify } = await import('@solana/web3.js');
  const { data } = await supabase
    .from('pi_nodes')
    .select('is_verified, token_balance')
    .eq('node_id', nodePubkey)
    .eq('is_verified', true)
    .gte('token_balance', 1000000)
    .single();
  if (!data) return false;
  const message = Buffer.from(JSON.stringify(validationResult));
  return verify(Buffer.from(signature, 'base64'), message, new PublicKey(nodePubkey));
}

// Location validation function
async function validateLocation(location, env) {
  const checks = [];
  let score = 100;

  // Check 1: Accuracy validation
  if (location.accuracy <= 0 || location.accuracy > 1000) {
    checks.push('invalid_accuracy');
    score -= 30;
  }

  // Check 2: Speed validation (bicycle-specific)
  if (location.speed !== null && location.speed !== undefined) {
    if (location.speed > 13.89) { // 50 km/h max (13.89 m/s)
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
  
  if (timeDiff > 300000) { // More than 5 minutes off
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

    const { data: blacklisted } = await supabase
      .from('blacklisted_devices')
      .select('device_id')
      .eq('device_id', deviceId)
      .single();

    if (blacklisted) {
      checks.push('blacklisted_device');
      score = 0;
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
    valid: score >= 40,
    score,
    reason: checks.join(', '),
    checks
  };
}

// Batch processing trigger
async function checkBatchTrigger(env) {
  const { count } = await supabase
    .from('location_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const lastProcessed = await env.KV.get('last_batch_processed');
  const timeSinceLastBatch = Date.now() - (parseInt(lastProcessed) || 0);

  return count >= 100 || timeSinceLastBatch > 300000; // 100 submissions or 5 minutes
}

// Trigger batch processing to ICP
async function triggerBatchProcessing(env) {
  const { data: submissions } = await supabase
    .from('location_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('timestamp', { ascending: true })
    .limit(1000);

  if (!submissions || submissions.length === 0) {
    return;
  }

  const intervals = groupByInterval(submissions);

  for (const [intervalId, intervalSubmissions] of Object.entries(intervals)) {
    const winners = calculateWinners(intervalSubmissions, parseInt(intervalId));

    const batch = {
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

    await sendToICP(batch, env);

    const submissionIds = intervalSubmissions.map(s => s.id);
    await supabase
      .from('location_submissions')
      .update({ 
        status: 'processed',
        interval_id: intervalId,
        processed_at: new Date().toISOString()
      })
      .in('id', submissionIds);

    for (const winner of winners) {
      await supabase
        .from('mining_rewards')
        .insert({
          user_id: winner.userId,
          interval_id: intervalId,
          reward_amount: winner.reward,
          rank: winner.rank,
          created_at: new Date().toISOString()
        });
    }
  }

  await env.KV.put('last_batch_processed', Date.now().toString());
}

// Calculate winners based on proximity to target traveled distance (top 10% of users, equal share of 500 $IMERA)
function calculateWinners(submissions, intervalId) {
  const targetDistance = generateTargetDistance(intervalId);

  const userSubmissions = {};
  submissions.forEach(sub => {
    if (!userSubmissions[sub.user_id]) {
      userSubmissions[sub.user_id] = [];
    }
    userSubmissions[sub.user_id].push(sub);
  });

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

  const differences = Object.entries(userTravel).map(([userId, travel]) => ({
    userId,
    difference: Math.abs(travel - targetDistance),
    travel
  }));

  differences.sort((a, b) => a.difference - b.difference);

  const totalUsers = differences.length;
  const numWinners = Math.max(1, Math.ceil(totalUsers * 0.1));
  const rewardPerWinner = 500 / numWinners;

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

// Helper function to calculate distance
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
  try {
    const response = await fetch(`${env.ICP_CANISTER_URL}/process_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.ICP_API_KEY
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      console.error('ICP submission failed:', await response.text());
    }
  } catch (error) {
    console.error('Error sending to ICP:', error);
    await env.KV.put(`failed_batch:${batch.intervalId}`, JSON.stringify(batch));
  }
}

// API endpoint to get user stats
router.get('/api/user/:userId/stats', async (request, env) => {
  const { userId } = request.params;

  const { data: stats } = await supabase
    .from('user_mining_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: recentSubmissions } = await supabase
    .from('location_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(10);

  const { data: rewards } = await supabase
    .from('mining_rewards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return new Response(JSON.stringify({
    stats: stats || { total_rewards: 0, total_submissions: 0 },
    recentSubmissions,
    rewards,
    nextSubmissionTime: await getNextSubmissionTime(userId, env)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Get current mining interval
router.get('/api/current-interval', async (request, env) => {
  const now = Date.now();
  const intervalStart = Math.floor(now / 300000) * 300000; // 5-minute intervals
  const intervalEnd = intervalStart + 300000;

  const { count } = await supabase
    .from('location_submissions')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', new Date(intervalStart).toISOString())
    .lte('timestamp', new Date(intervalEnd).toISOString());

  return new Response(JSON.stringify({
    intervalId: intervalStart,
    startTime: intervalStart,
    endTime: intervalEnd,
    currentTime: now,
    timeRemaining: intervalEnd - now,
    submissions: count || 0,
    targetDistance: generateTargetDistance(intervalStart)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Health check endpoint
router.get('/health', () => {
  return new Response('OK', { status: 200 });
});

// Handle all requests
export default {
  fetch: router.handle,
};

// Export Durable Objects
export { RateLimiter };