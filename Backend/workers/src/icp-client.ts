import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory as validatorIDL } from './idl/validator';
import { idlFactory as consensusIDL } from './idl/consensus';

export class ICPClient {
  private agent: HttpAgent;
  private validatorActor: any;
  private consensusActor: any;
  
  constructor(
    private validatorId: string,
    private consensusId: string,
    private rewardsId: string,
    private host: string
  ) {}
  
  async initialize() {
    this.agent = new HttpAgent({ host: this.host });
    
    // Remove in production
    if (this.host.includes('localhost')) {
      await this.agent.fetchRootKey();
    }
    
    // Create actors
    this.validatorActor = Actor.createActor(validatorIDL, {
      agent: this.agent,
      canisterId: Principal.fromText(this.validatorId)
    });
    
    this.consensusActor = Actor.createActor(consensusIDL, {
      agent: this.agent,
      canisterId: Principal.fromText(this.consensusId)
    });
  }
  
  async validateBatch(batch: any): Promise<any> {
    const request = {
      interval_ids: batch.intervals.map(i => BigInt(i.intervalId)),
      submissions_batch: batch.intervals.map(interval => interval.submissions),
      signature: await this.generateSignature(batch)
    };
    
    return await this.validatorActor.validate_batch(request);
  }
  
  async submitToConsensus(validationResult: any, edgeServerId: string): Promise<any> {
    return await this.consensusActor.submit_batch_consensus({
      batch_results: validationResult.results,
      batch_merkle_root: validationResult.batch_merkle_root,
      edge_server_id: edgeServerId,
      timestamp: BigInt(Date.now())
    });
  }
  
  private async generateSignature(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(process.env.SIGNING_KEY || 'default-key'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoded);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}