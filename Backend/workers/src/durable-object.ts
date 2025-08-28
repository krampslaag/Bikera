import { DurableObject } from 'cloudflare:workers';
import { DataCompressor } from './compressor';
import { IntervalBatcher } from './batcher';

export class MovementProcessor extends DurableObject {
  private compressor: DataCompressor;
  private batcher: IntervalBatcher;
  
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.compressor = new DataCompressor();
    this.batcher = new IntervalBatcher(this.compressor);
    
    // Restore state if exists
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get('batcher');
      if (stored) {
        this.batcher.restore(stored);
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/add':
        return this.handleAdd(request);
      case '/batch':
        return this.handleGetBatch();
      case '/status':
        return this.handleStatus();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
  
  private async handleAdd(request: Request): Promise<Response> {
    const submission = await request.json();
    this.batcher.addSubmission(submission);
    
    // Persist state
    await this.ctx.storage.put('batcher', this.batcher.serialize());
    
    return new Response('OK');
  }
  
  private async handleGetBatch(): Promise<Response> {
    const batch = this.batcher.getBatch();
    
    if (batch) {
      // Process locally
      const processed = this.batcher.processLocally(batch);
      
      // Update state
      await this.ctx.storage.put('last_batch', Date.now());
      await this.ctx.storage.put('batcher', this.batcher.serialize());
      
      return new Response(JSON.stringify(processed), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('null', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleStatus(): Promise<Response> {
    const lastBatch = await this.ctx.storage.get('last_batch') || 0;
    const stats = this.batcher.getStats();
    
    return new Response(JSON.stringify({
      ...stats,
      lastBatch,
      userMappings: this.compressor.getUserMapping()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}