// src/services/StorageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys - centralized to avoid typos and conflicts
const STORAGE_KEYS = {
  // Authentication
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
  USER_PROFILE: 'user_profile',
  WALLET_ADDRESS: 'wallet_address',
  
  // Session management
  CURRENT_SESSION: 'current_session',
  SESSION_HISTORY: 'session_history',
  LAST_SESSION_DATA: 'last_session_data',
  
  // Mining data
  MINING_STATS: 'mining_stats',
  UNCLAIMED_REWARDS: 'unclaimed_rewards',
  LAST_CLAIM_TIME: 'last_claim_time',
  DAILY_DISTANCE: 'daily_distance',
  
  // Location tracking
  LOCATION_HISTORY: 'location_history',
  LAST_KNOWN_LOCATION: 'last_known_location',
  TRACKING_MODE: 'tracking_mode',
  
  // App preferences
  APP_SETTINGS: 'app_settings',
  NOTIFICATION_PREFS: 'notification_prefs',
  THEME_PREFERENCE: 'theme_preference',
  LANGUAGE: 'language',
  
  // Cache management
  LEADERBOARD_CACHE: 'leaderboard_cache',
  NETWORK_STATUS_CACHE: 'network_status_cache',
  COMPETITION_CACHE: 'competition_cache',
  
  // Offline queue
  PENDING_SUBMISSIONS: 'pending_submissions',
  SYNC_QUEUE: 'sync_queue',
  
  // Device info
  DEVICE_ID: 'device_id',
  FIRST_LAUNCH: 'first_launch',
  APP_VERSION: 'app_version',
} as const;

// Type definitions
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt?: number;
}

interface StorageOptions {
  encrypt?: boolean;
  expires?: number; // milliseconds
}

class StorageService {
  private memoryCache: Map<string, any> = new Map();
  private cacheExpirations: Map<string, number> = new Map();

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    // Clean expired cache on startup
    await this.cleanExpiredCache();
    
    // Set up periodic cache cleanup (every hour)
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60 * 60 * 1000);
  }

  // ============= Core Storage Methods =============

  /**
   * Store data with optional expiration
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        expiresAt: options?.expires ? Date.now() + options.expires : undefined,
      };

      const stringValue = JSON.stringify(cacheEntry);
      
      // Store in AsyncStorage
      await AsyncStorage.setItem(key, stringValue);
      
      // Also store in memory cache for faster access
      this.memoryCache.set(key, value);
      
      if (cacheEntry.expiresAt) {
        this.cacheExpirations.set(key, cacheEntry.expiresAt);
      }
    } catch (error) {
      console.error(`Storage error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get data with cache validation
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        const expiration = this.cacheExpirations.get(key);
        if (!expiration || expiration > Date.now()) {
          return this.memoryCache.get(key) as T;
        }
      }

      // Fall back to AsyncStorage
      const stringValue = await AsyncStorage.getItem(key);
      if (!stringValue) return null;

      const cacheEntry: CacheEntry<T> = JSON.parse(stringValue);
      
      // Check if expired
      if (cacheEntry.expiresAt && cacheEntry.expiresAt < Date.now()) {
        await this.remove(key);
        return null;
      }

      // Update memory cache
      this.memoryCache.set(key, cacheEntry.data);
      
      return cacheEntry.data;
    } catch (error) {
      console.error(`Storage get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove specific key
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      this.memoryCache.delete(key);
      this.cacheExpirations.delete(key);
    } catch (error) {
      console.error(`Storage remove error for key ${key}:`, error);
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
      this.memoryCache.clear();
      this.cacheExpirations.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }

  /**
   * Get multiple items at once
   */
  async multiGet<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    try {
      const items = await AsyncStorage.multiGet(keys);
      
      for (const [key, value] of items) {
        if (value) {
          const cacheEntry: CacheEntry<T> = JSON.parse(value);
          if (!cacheEntry.expiresAt || cacheEntry.expiresAt > Date.now()) {
            results.set(key, cacheEntry.data);
          }
        }
      }
    } catch (error) {
      console.error('Storage multiGet error:', error);
    }
    
    return results;
  }

  /**
   * Set multiple items at once
   */
  async multiSet(items: Array<[string, any, StorageOptions?]>): Promise<void> {
    try {
      const storageItems: Array<[string, string]> = [];
      
      for (const [key, value, options] of items) {
        const cacheEntry: CacheEntry<any> = {
          data: value,
          timestamp: Date.now(),
          expiresAt: options?.expires ? Date.now() + options.expires : undefined,
        };
        
        storageItems.push([key, JSON.stringify(cacheEntry)]);
        
        // Update memory cache
        this.memoryCache.set(key, value);
        if (cacheEntry.expiresAt) {
          this.cacheExpirations.set(key, cacheEntry.expiresAt);
        }
      }
      
      await AsyncStorage.multiSet(storageItems);
    } catch (error) {
      console.error('Storage multiSet error:', error);
    }
  }

  // ============= Specialized Methods =============

  /**
   * Store authentication data
   */
  async saveAuthData(token: string, refreshToken: string, userId: string, walletAddress?: string): Promise<void> {
    await this.multiSet([
      [STORAGE_KEYS.AUTH_TOKEN, token],
      [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
      [STORAGE_KEYS.USER_ID, userId],
      ...(walletAddress ? [[STORAGE_KEYS.WALLET_ADDRESS, walletAddress] as [string, string]] : [])
    ]);
  }

  /**
   * Get authentication data
   */
  async getAuthData(): Promise<{
    token: string | null;
    refreshToken: string | null;
    userId: string | null;
    walletAddress: string | null;
  }> {
    const keys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.WALLET_ADDRESS
    ];
    
    const results = await this.multiGet<string>(keys);
    
    return {
      token: results.get(STORAGE_KEYS.AUTH_TOKEN) || null,
      refreshToken: results.get(STORAGE_KEYS.REFRESH_TOKEN) || null,
      userId: results.get(STORAGE_KEYS.USER_ID) || null,
      walletAddress: results.get(STORAGE_KEYS.WALLET_ADDRESS) || null,
    };
  }

  /**
   * Clear authentication data
   */
  async clearAuthData(): Promise<void> {
    const authKeys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.WALLET_ADDRESS
    ];
    
    await AsyncStorage.multiRemove(authKeys);
    authKeys.forEach(key => {
      this.memoryCache.delete(key);
      this.cacheExpirations.delete(key);
    });
  }

  /**
   * Store mining session data
   */
  async saveMiningSession(session: any): Promise<void> {
    await this.set(STORAGE_KEYS.CURRENT_SESSION, session);
    
    // Also append to history
    const history = await this.get<any[]>(STORAGE_KEYS.SESSION_HISTORY) || [];
    history.push(session);
    
    // Keep only last 50 sessions
    if (history.length > 50) {
      history.shift();
    }
    
    await this.set(STORAGE_KEYS.SESSION_HISTORY, history);
  }

  /**
   * Get current mining session
   */
  async getCurrentSession(): Promise<any | null> {
    return this.get(STORAGE_KEYS.CURRENT_SESSION);
  }

  /**
   * Queue data for offline sync
   */
  async queueForSync(data: any): Promise<void> {
    const queue = await this.get<any[]>(STORAGE_KEYS.SYNC_QUEUE) || [];
    queue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data,
      timestamp: Date.now(),
      retries: 0
    });
    
    await this.set(STORAGE_KEYS.SYNC_QUEUE, queue);
  }

  /**
   * Get and clear sync queue
   */
  async getSyncQueue(): Promise<any[]> {
    const queue = await this.get<any[]>(STORAGE_KEYS.SYNC_QUEUE) || [];
    await this.remove(STORAGE_KEYS.SYNC_QUEUE);
    return queue;
  }

  /**
   * Store leaderboard with expiration
   */
  async cacheLeaderboard(period: string, data: any): Promise<void> {
    const key = `${STORAGE_KEYS.LEADERBOARD_CACHE}_${period}`;
    // Cache for 5 minutes
    await this.set(key, data, { expires: 5 * 60 * 1000 });
  }

  /**
   * Get cached leaderboard
   */
  async getCachedLeaderboard(period: string): Promise<any | null> {
    const key = `${STORAGE_KEYS.LEADERBOARD_CACHE}_${period}`;
    return this.get(key);
  }

  /**
   * Store app settings
   */
  async saveSettings(settings: any): Promise<void> {
    await this.set(STORAGE_KEYS.APP_SETTINGS, settings);
  }

  /**
   * Get app settings
   */
  async getSettings(): Promise<any> {
    const defaultSettings = {
      trackingMode: 'BALANCED',
      notifications: true,
      soundEnabled: true,
      autoStartMining: false,
      theme: 'dark',
      language: 'en'
    };
    
    const saved = await this.get(STORAGE_KEYS.APP_SETTINGS);
    return { ...defaultSettings, ...saved };
  }

  /**
   * Generate or get device ID
   */
  async getDeviceId(): Promise<string> {
    let deviceId = await this.get<string>(STORAGE_KEYS.DEVICE_ID);
    
    if (!deviceId) {
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.set(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Check if first launch
   */
  async isFirstLaunch(): Promise<boolean> {
    const firstLaunch = await this.get<boolean>(STORAGE_KEYS.FIRST_LAUNCH);
    
    if (firstLaunch === null) {
      await this.set(STORAGE_KEYS.FIRST_LAUNCH, false);
      return true;
    }
    
    return false;
  }

  /**
   * Clean expired cache entries
   */
  private async cleanExpiredCache(): Promise<void> {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      
      for (const [key, expiration] of this.cacheExpirations.entries()) {
        if (expiration < now) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        keysToRemove.forEach(key => {
          this.memoryCache.delete(key);
          this.cacheExpirations.delete(key);
        });
        
        console.log(`Cleaned ${keysToRemove.length} expired cache entries`);
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Get storage info (size, keys count)
   */
  async getStorageInfo(): Promise<{
    keys: number;
    sizeEstimate: number;
    memCacheSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      // Estimate size (this is approximate)
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return {
        keys: keys.length,
        sizeEstimate: totalSize,
        memCacheSize: this.memoryCache.size
      };
    } catch (error) {
      console.error('Storage info error:', error);
      return { keys: 0, sizeEstimate: 0, memCacheSize: 0 };
    }
  }

  /**
   * Export all data (for debugging or backup)
   */
  async exportAllData(): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      const data: Record<string, any> = {};
      
      for (const [key, value] of items) {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            data[key] = parsed;
          } catch {
            data[key] = value;
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Export error:', error);
      return {};
    }
  }
}

// Export singleton instance
export default new StorageService();

// Export keys for direct access if needed
export { STORAGE_KEYS };

// Export types
export type { CacheEntry, StorageOptions };