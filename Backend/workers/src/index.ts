import { DurableObject } from 'cloudflare:workers';
import { ICPClient } from './icp-client';
import { DataCompressor } from './compressor';
import { IntervalBatcher } from './batcher';
import { SupabaseClient } from './supabase-client';

export interface Env {
  MOVEMENT_PROCESSOR: DurableObjectNamespace;
  RESULTS: KVNamespace;
  ICP_VALIDATOR_CANISTER: string;
  ICP_CONSENSUS_CANISTER: string;
  ICP_REWARDS_CANISTER: string;
  ICP_HOST: string;
  EDGE_SERVER_ID: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Route to appropriate handler
    switch (url.pathname) {
      case '/api/submit':
        return handleSubmission(request, env);
      case '/api/process':
        return handleProcess(env);
      case '/api/status':
        return handleStatus(env);
      case '/health':
        return new Response('OK');
      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  // Scheduled processing every 30 minutes
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processScheduledBatch(env));
  }
};

async function handleSubmission(request: Request, env: Env): Promise<Response> {
  try {
    const data = await request.json();
    
    // Get durable object instance
    const id = env.MOVEMENT_PROCESSOR.idFromName('main');
    const stub = env.MOVEMENT_PROCESSOR.get(id);
    
    // Add submission to batch
    const response = await stub.fetch('https://internal/add', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    return new Response(JSON.stringify({ 
      status: 'accepted',
      message: 'Movement data queued for processing' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Invalid submission' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleProcess(env: Env): Promise<Response> {
  const result = await processBatch(env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function processBatch(env: Env): Promise<any> {
  // Get batch from durable object
  const id = env.MOVEMENT_PROCESSOR.idFromName('main');
  const stub = env.MOVEMENT_PROCESSOR.get(id);
  
  const batchResponse = await stub.fetch('https://internal/batch');
  const batch = await batchResponse.json();
  
  if (!batch || batch === 'null') {
    return { status: 'no_batch_ready' };
  }
  
  // Initialize ICP client
  const icpClient = new ICPClient(
    env.ICP_VALIDATOR_CANISTER,
    env.ICP_CONSENSUS_CANISTER,
    env.ICP_REWARDS_CANISTER,
    env.ICP_HOST
  );
  await icpClient.initialize();
  
  // Process with ICP
  const validationResult = await icpClient.validateBatch(batch);
  
  if (validationResult.results.every(r => r.valid)) {
    // Submit to consensus
    const consensusResult = await icpClient.submitToConsensus(
      validationResult,
      env.EDGE_SERVER_ID
    );
    
    // Store in Supabase
    const supabase = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    await supabase.storeBatchResults(batch, validationResult, consensusResult);
    
    // Cache in KV
    await env.RESULTS.put(
      `batch_${batch.batchId}`,
      JSON.stringify({ validationResult, consensusResult }),
      { expirationTtl: 86400 } // 24 hours
    );
    
    return {
      success: true,
      batchId: batch.batchId,
      intervalsProcessed: batch.intervals.length,
      validationResult,
      consensusResult
    };
  }
  
  return { success: false, error: 'Validation failed' };
}

async function handleStatus(env: Env): Promise<Response> {
  const id = env.MOVEMENT_PROCESSOR.idFromName('main');
  const stub = env.MOVEMENT_PROCESSOR.get(id);
  
  const response = await stub.fetch('https://internal/status');
  return response;
}

async function processScheduledBatch(env: Env): Promise<void> {
  const result = await processBatch(env);
  console.log('Scheduled batch processing:', result);
}

// Export Durable Object class
export { MovementProcessor } from './durable-object';