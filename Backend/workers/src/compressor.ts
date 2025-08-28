// backend/workers/src/compressor.ts
// Handles data compression to reduce storage and transmission costs

import * as crypto from 'crypto';

// ============= TYPE DEFINITIONS =============

export interface FullSubmission {
  user_id: string;      // UUID or string identifier
  lat: number;          // Latitude as float
  lon: number;          // Longitude as float
  timestamp: number;    // Timestamp in milliseconds
  speed?: number;       // Optional speed in m/s
  altitude?: number;    // Optional altitude in meters
}

export interface CompactSubmission {
  uid: number;          // User index (0-4294967295)
  lat: number;          // Latitude * 1000000 as integer
  lon: number;          // Longitude * 1000000 as integer
  t: number;            // Timestamp in seconds (not ms)
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  totalUsers: number;
}

// ============= DATA COMPRESSOR CLASS =============

export class DataCompressor {
  private userIdToIndex: Map<string, number> = new Map();
  private indexToUserId: Map<number, string> = new Map();
  private nextUserIndex: number = 0;
  private stats: CompressionStats;

  constructor() {
    this.stats = {
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      totalUsers: 0
    };
  }

  // ============= COMPRESSION METHODS =============

  /**
   * Compress a full submission to compact format
   * Reduces size by ~70%
   */
  compress(submission: FullSubmission): CompactSubmission {
    // Get or create user index
    const uid = this.getOrCreateUserIndex(submission.user_id);
    
    // Convert coordinates to integers (6 decimal precision)
    // This maintains ~0.11 meter precision
    const lat = Math.round(submission.lat * 1000000);
    const lon = Math.round(submission.lon * 1000000);
    
    // Convert timestamp from milliseconds to seconds
    const t = Math.floor(submission.timestamp / 1000);
    
    // Update compression stats
    this.updateStats(submission, { uid, lat, lon, t });
    
    return { uid, lat, lon, t };
  }

  /**
   * Compress multiple submissions at once
   */
  compressBatch(submissions: FullSubmission[]): CompactSubmission[] {
    return submissions.map(sub => this.compress(sub));
  }

  /**
   * Decompress a compact submission back to full format
   */
  decompress(compact: CompactSubmission): FullSubmission {
    // Get original user ID
    const user_id = this.indexToUserId.get(compact.uid) || `user_${compact.uid}`;
    
    // Convert coordinates back to floats
    const lat = compact.lat / 1000000;
    const lon = compact.lon / 1000000;
    
    // Convert timestamp back to milliseconds
    const timestamp = compact.t * 1000;
    
    return { user_id, lat, lon, timestamp };
  }

  /**
   * Decompress multiple submissions
   */
  decompressBatch(compactSubmissions: CompactSubmission[]): FullSubmission[] {
    return compactSubmissions.map(sub => this.decompress(sub));
  }

  // ============= USER ID MAPPING =============

  /**
   * Get or create a user index for compression
   */
  private getOrCreateUserIndex(userId: string): number {
    // Check if already mapped
    let index = this.userIdToIndex.get(userId);
    
    if (index === undefined) {
      // Create new mapping
      index = this.nextUserIndex++;
      this.userIdToIndex.set(userId, index);
      this.indexToUserId.set(index, userId);
      
      // Update stats
      this.stats.totalUsers++;
      
      // Check for overflow (32-bit unsigned integer max)
      if (this.nextUserIndex >= 4294967295) {
        console.warn('User index overflow - resetting mappings');
        this.resetMappings();
      }
    }
    
    return index;
  }

  /**
   * Get user ID from index
   */
  getUserId(index: number): string | undefined {
    return this.indexToUserId.get(index);
  }

  /**
   * Get all user mappings (for persistence or debugging)
   */
  getUserMapping(): Record<number, string> {
    return Object.fromEntries(this.indexToUserId);
  }

  /**
   * Get reverse mapping (userId -> index)
   */
  getReverseMapping(): Record<string, number> {
    return Object.fromEntries(this.userIdToIndex);
  }

  /**
   * Load user mappings (for restoration)
   */
  loadMappings(mappings: Record<number, string>): void {
    this.userIdToIndex.clear();
    this.indexToUserId.clear();
    
    for (const [indexStr, userId] of Object.entries(mappings)) {
      const index = parseInt(indexStr);
      this.userIdToIndex.set(userId, index);
      this.indexToUserId.set(index, userId);
      
      // Update next index
      if (index >= this.nextUserIndex) {
        this.nextUserIndex = index + 1;
      }
    }
    
    this.stats.totalUsers = this.userIdToIndex.size;
  }

  // ============= COORDINATE COMPRESSION =============

  /**
   * Compress coordinates with custom precision
   */
  compressCoordinates(
    lat: number, 
    lon: number, 
    precision: number = 1000000
  ): { latCompressed: number; lonCompressed: number } {
    return {
      latCompressed: Math.round(lat * precision),
      lonCompressed: Math.round(lon * precision)
    };
  }

  /**
   * Decompress coordinates
   */
  decompressCoordinates(
    latCompressed: number, 
    lonCompressed: number, 
    precision: number = 1000000
  ): { lat: number; lon: number } {
    return {
      lat: latCompressed / precision,
      lon: lonCompressed / precision
    };
  }

  /**
   * Calculate precision loss for coordinates
   */
  calculateCoordinatePrecisionLoss(original: number, precision: number = 1000000): number {
    const compressed = Math.round(original * precision);
    const decompressed = compressed / precision;
    return Math.abs(original - decompressed);
  }

  // ============= TIMESTAMP COMPRESSION =============

  /**
   * Compress timestamp with different strategies
   */
  compressTimestamp(
    timestamp: number, 
    strategy: 'seconds' | 'minutes' | 'relative' = 'seconds',
    baseTime?: number
  ): number {
    switch (strategy) {
      case 'seconds':
        // Convert ms to seconds (reduces by factor of 1000)
        return Math.floor(timestamp / 1000);
      
      case 'minutes':
        // Convert ms to minutes (reduces by factor of 60000)
        return Math.floor(timestamp / 60000);
      
      case 'relative':
        // Store as offset from base time (useful for batches)
        if (!baseTime) throw new Error('Base time required for relative compression');
        return Math.floor((timestamp - baseTime) / 1000);
      
      default:
        return timestamp;
    }
  }

  /**
   * Decompress timestamp
   */
  decompressTimestamp(
    compressed: number,
    strategy: 'seconds' | 'minutes' | 'relative' = 'seconds',
    baseTime?: number
  ): number {
    switch (strategy) {
      case 'seconds':
        return compressed * 1000;
      
      case 'minutes':
        return compressed * 60000;
      
      case 'relative':
        if (!baseTime) throw new Error('Base time required for relative decompression');
        return baseTime + (compressed * 1000);
      
      default:
        return compressed;
    }
  }

  // ============= ADVANCED COMPRESSION =============

  /**
   * Delta encoding for sequential data
   * Useful for time-series location data
   */
  deltaEncode(submissions: CompactSubmission[]): any[] {
    if (submissions.length === 0) return [];
    
    const encoded = [];
    
    // First submission stored as-is
    encoded.push(submissions[0]);
    
    // Subsequent submissions stored as deltas
    for (let i = 1; i < submissions.length; i++) {
      const prev = submissions[i - 1];
      const curr = submissions[i];
      
      encoded.push({
        uid: curr.uid === prev.uid ? 0 : curr.uid, // 0 means same user
        dlat: curr.lat - prev.lat,                  // Delta latitude
        dlon: curr.lon - prev.lon,                  // Delta longitude
        dt: curr.t - prev.t                         // Delta time
      });
    }
    
    return encoded;
  }

  /**
   * Decode delta-encoded data
   */
  deltaDecode(encoded: any[]): CompactSubmission[] {
    if (encoded.length === 0) return [];
    
    const decoded: CompactSubmission[] = [];
    
    // First submission
    decoded.push(encoded[0]);
    
    // Decode subsequent submissions
    for (let i = 1; i < encoded.length; i++) {
      const prev = decoded[i - 1];
      const delta = encoded[i];
      
      decoded.push({
        uid: delta.uid === 0 ? prev.uid : delta.uid,
        lat: prev.lat + delta.dlat,
        lon: prev.lon + delta.dlon,
        t: prev.t + delta.dt
      });
    }
    
    return decoded;
  }

  // ============= STATISTICS & MONITORING =============

  /**
   * Update compression statistics
   */
  private updateStats(original: FullSubmission, compressed: CompactSubmission): void {
    // Estimate original size (rough calculation)
    const originalSize = 
      original.user_id.length +  // String length
      8 + 8 +                     // Two floats (lat, lon)
      8 +                         // Timestamp (long)
      (original.speed ? 4 : 0) + // Optional speed
      (original.altitude ? 4 : 0); // Optional altitude
    
    // Compressed size
    const compressedSize = 
      4 +  // uid (uint32)
      4 +  // lat (int32)
      4 +  // lon (int32)
      4;   // t (uint32)
    
    this.stats.originalSize += originalSize;
    this.stats.compressedSize += compressedSize;
    
    // Update compression ratio
    if (this.stats.originalSize > 0) {
      this.stats.compressionRatio = 
        1 - (this.stats.compressedSize / this.stats.originalSize);
    }
  }

  /**
   * Get compression statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      totalUsers: this.userIdToIndex.size
    };
  }

  // ============= UTILITY METHODS =============

  /**
   * Reset all mappings (use with caution)
   */
  private resetMappings(): void {
    // Archive current mappings if needed
    const archived = this.getUserMapping();
    console.log('Archiving mappings:', Object.keys(archived).length, 'users');
    
    // Reset
    this.userIdToIndex.clear();
    this.indexToUserId.clear();
    this.nextUserIndex = 0;
  }

  /**
   * Serialize compressor state for persistence
   */
  serialize(): string {
    return JSON.stringify({
      userMappings: Object.fromEntries(this.indexToUserId),
      nextUserIndex: this.nextUserIndex,
      stats: this.stats
    });
  }

  /**
   * Restore compressor state from serialized data
   */
  restore(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.userMappings) {
        this.loadMappings(parsed.userMappings);
      }
      
      if (parsed.nextUserIndex !== undefined) {
        this.nextUserIndex = parsed.nextUserIndex;
      }
      
      if (parsed.stats) {
        this.stats = parsed.stats;
      }
    } catch (error) {
      console.error('Failed to restore compressor state:', error);
    }
  }

  /**
   * Generate deterministic user ID for testing
   */
  static generateTestUserId(index: number): string {
    const hash = crypto.createHash('sha256');
    hash.update(`test_user_${index}`);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Calculate size reduction percentage
   */
  calculateSizeReduction(): string {
    if (this.stats.originalSize === 0) return '0%';
    const reduction = this.stats.compressionRatio * 100;
    return `${reduction.toFixed(2)}%`;
  }
}