// mobile/shared/api-client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from 'react-native-background-geolocation';

export class MobileAPIClient {
  private baseURL: string;
  private batchQueue: MovementData[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.baseURL = 'https://api.bikera.org';
    this.setupBackgroundTracking();
  }

  private async setupBackgroundTracking() {
    BackgroundGeolocation.configure({
      desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
      stationaryRadius: 50,
      distanceFilter: 10,
      notificationTitle: 'Bikera Tracking',
      notificationText: 'Recording your ride',
      interval: 5000,
      fastestInterval: 2000,
      activitiesInterval: 10000,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    BackgroundGeolocation.on('location', (location) => {
      this.handleLocationUpdate(location);
    });
  }

  private handleLocationUpdate(location: any) {
    const movementData: MovementData = {
      user_id: this.getUserId(),
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      speed: location.speed,
      accuracy: location.accuracy,
      timestamp: location.time
    };

    this.addToBatch(movementData);
  }

  private addToBatch(data: MovementData) {
    this.batchQueue.push(data);

    // Send batch if it reaches threshold
    if (this.batchQueue.length >= 50) {
      this.sendBatch();
    } else if (!this.batchTimer) {
      // Set timer to send batch after 30 seconds
      this.batchTimer = setTimeout(() => this.sendBatch(), 30000);
    }
  }

  private async sendBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/movement/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ movements: batch })
      });

      if (!response.ok) {
        // Store failed batch for retry
        await this.storePendingBatch(batch);
      }
    } catch (error) {
      // Store for offline processing
      await this.storePendingBatch(batch);
    }
  }

  private async storePendingBatch(batch: MovementData[]) {
    const pending = await AsyncStorage.getItem('pending_batches');
    const batches = pending ? JSON.parse(pending) : [];
    batches.push({
      timestamp: Date.now(),
      data: batch
    });
    await AsyncStorage.setItem('pending_batches', JSON.stringify(batches));
  }

  private async getUserId(): Promise<string> {
    return await AsyncStorage.getItem('user_id') || '';
  }

  private async getAuthToken(): Promise<string> {
    return await AsyncStorage.getItem('auth_token') || '';
  }

  async startTracking() {
    BackgroundGeolocation.start();
  }

  async stopTracking() {
    BackgroundGeolocation.stop();
    await this.sendBatch(); // Send any remaining data
  }
}
