// Frontend Location Tracker Service - Privacy-First Implementation
// Located at: Frontend/services/LocationTracker.ts
// This service calculates distances locally and NEVER sends GPS coordinates to backend

import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from 'react-native-background-geolocation';
import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import CloudFlareAPI from './CloudFlareAPI';

// ============= TYPES =============

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}

interface DistanceSubmission {
  userId: string;
  sessionId: string;
  distanceMeters: number;
  durationSeconds: number;
  averageSpeed: number;
  maxSpeed?: number;
  timestamp: number;
  deviceId: string;
  // NO GPS coordinates!
}

interface SessionData {
  sessionId: string;
  startTime: Date;
  totalDistance: number;
  totalDuration: number;
  checkpointCount: number;
  status: 'active' | 'paused' | 'completed';
}

// ============= PRIVACY-FIRST LOCATION TRACKER =============

class PrivacyFirstLocationTracker {
  private isTracking: boolean = false;
  private watchId: number | null = null;
  private lastPosition: LocationPoint | null = null;
  private currentSession: SessionData | null = null;
  
  // Distance tracking (no GPS storage)
  private sessionDistance: number = 0;
  private distanceCheckpoints: number[] = [];
  private speedReadings: number[] = [];
  
  // Listeners
  private distanceListeners: Set<(distance: number) => void> = new Set();
  private sessionListeners: Set<(session: SessionData) => void> = new Set();
  
  // Configuration
  private readonly SUBMISSION_INTERVAL = 30000; // Submit every 30 seconds
  private readonly MIN_ACCURACY = 20; // Minimum GPS accuracy in meters
  private readonly MAX_SPEED_MS = 13.89; // 50 km/h max for bikes
  private readonly MIN_DISTANCE_FILTER = 5; // Minimum movement in meters
  
  private submissionTimer: NodeJS.Timeout | null = null;

  // ============= INITIALIZATION =============

  async initialize(): Promise<void> {
    // Configure background geolocation (but we won't send GPS to backend)
    await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: this.MIN_DISTANCE_FILTER,
      stopTimeout: 5,
      debug: false, // Set to true for development
      logLevel: BackgroundGeolocation.LOG_LEVEL_ERROR,
      stopOnTerminate: false,
      startOnBoot: true,
      batchSync: false, // We handle batching ourselves
      autoSync: false, // We handle syncing ourselves
    });

    // Set up location update handler
    BackgroundGeolocation.onLocation(this.onLocationUpdate.bind(this), this.onLocationError.bind(this));
  }

  // ============= PERMISSION HANDLING =============

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    } else {
      try {
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bikera needs location access to track your rides and calculate distances.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (fineLocationGranted === PermissionsAndroid.RESULTS.GRANTED) {
          // Try to get background permission (optional)
          const backgroundGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Background Location Permission',
              message: 'Allow Bikera to track rides in the background for continuous mining.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          if (backgroundGranted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              'Background Permission',
              'Background location allows continuous mining. Mining will pause when app is in background.',
              [{ text: 'OK' }]
            );
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error('Permission request error:', err);
        return false;
      }
    }
  }

  // ============= SESSION MANAGEMENT =============

  async startSession(userId: string): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Location permission is required to track rides.');
        return null;
      }

      // Start new session via API
      const response = await CloudFlareAPI.startMiningSession();
      if (!response.success) {
        throw new Error(response.error || 'Failed to start session');
      }

      // Initialize session data
      this.currentSession = {
        sessionId: response.sessionId,
        startTime: new Date(),
        totalDistance: 0,
        totalDuration: 0,
        checkpointCount: 0,
        status: 'active'
      };

      // Reset tracking variables
      this.sessionDistance = 0;
      this.distanceCheckpoints = [];
      this.speedReadings = [];
      this.lastPosition = null;

      // Start location tracking
      await BackgroundGeolocation.start();
      this.isTracking = true;

      // Start submission timer
      this.startSubmissionTimer();

      // Save session to storage
      await AsyncStorage.setItem('activeSession', JSON.stringify(this.currentSession));

      return response.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert('Error', 'Failed to start mining session');
      return null;
    }
  }

  async endSession(): Promise<SessionData | null> {
    if (!this.currentSession) {
      return null;
    }

    try {
      // Submit final distance if any
      if (this.sessionDistance > 0) {
        await this.submitDistance();
      }

      // End session via API
      await CloudFlareAPI.endMiningSession(this.currentSession.sessionId);

      // Stop tracking
      await BackgroundGeolocation.stop();
      this.isTracking = false;

      // Clear submission timer
      if (this.submissionTimer) {
        clearInterval(this.submissionTimer);
        this.submissionTimer = null;
      }

      // Save final session data
      const finalSession = { ...this.currentSession };
      finalSession.status = 'completed';

      // Clear session
      this.currentSession = null;
      await AsyncStorage.removeItem('activeSession');

      return finalSession;
    } catch (error) {
      console.error('Failed to end session:', error);
      return null;
    }
  }

  // ============= LOCATION HANDLING (PRIVACY-FIRST) =============

  private onLocationUpdate(location: any): void {
    if (!this.isTracking || !this.currentSession) return;

    const newPosition: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: new Date(location.timestamp).toISOString(),
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
    };

    // Only process if accuracy is good enough
    if (newPosition.accuracy && newPosition.accuracy > this.MIN_ACCURACY) {
      console.log('Skipping inaccurate location:', newPosition.accuracy);
      return;
    }

    // Calculate distance from last position (locally only!)
    if (this.lastPosition) {
      const distance = this.calculateDistance(
        this.lastPosition.latitude,
        this.lastPosition.longitude,
        newPosition.latitude,
        newPosition.longitude
      );

      // Validate movement
      const timeDelta = (new Date(newPosition.timestamp).getTime() - 
                        new Date(this.lastPosition.timestamp).getTime()) / 1000;
      
      if (timeDelta > 0) {
        const speed = distance / timeDelta;
        
        // Anti-spoofing: Check if speed is reasonable
        if (speed <= this.MAX_SPEED_MS) {
          // Valid movement - add to session distance
          this.sessionDistance += distance;
          this.distanceCheckpoints.push(distance);
          
          if (newPosition.speed) {
            this.speedReadings.push(newPosition.speed);
          }

          // Update session data
          if (this.currentSession) {
            this.currentSession.totalDistance = this.sessionDistance;
            this.currentSession.totalDuration = 
              (new Date().getTime() - this.currentSession.startTime.getTime()) / 1000;
            this.currentSession.checkpointCount++;
          }

          // Notify listeners (distance only, no GPS!)
          this.notifyDistanceListeners(this.sessionDistance);
        } else {
          console.warn('Movement rejected - speed too high:', speed, 'm/s');
        }
      }
    }

    // Update last position (kept locally only)
    this.lastPosition = newPosition;
  }

  private onLocationError(error: any): void {
    console.error('Location error:', error);
  }

  // ============= DISTANCE CALCULATION =============

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // ============= PRIVACY-FIRST SUBMISSION =============

  private startSubmissionTimer(): void {
    this.submissionTimer = setInterval(() => {
      this.submitDistance();
    }, this.SUBMISSION_INTERVAL);
  }

  private async submitDistance(): Promise<void> {
    if (!this.currentSession || this.sessionDistance === 0) {
      return;
    }

    try {
      // Calculate average speed
      const averageSpeed = this.speedReadings.length > 0
        ? this.speedReadings.reduce((a, b) => a + b, 0) / this.speedReadings.length
        : 0;

      const maxSpeed = this.speedReadings.length > 0
        ? Math.max(...this.speedReadings)
        : 0;

      // Prepare submission (NO GPS COORDINATES!)
      const submission: DistanceSubmission = {
        userId: await this.getUserId(),
        sessionId: this.currentSession.sessionId,
        distanceMeters: this.sessionDistance,
        durationSeconds: Math.floor(
          (new Date().getTime() - this.currentSession.startTime.getTime()) / 1000
        ),
        averageSpeed,
        maxSpeed,
        timestamp: Date.now(),
        deviceId: await this.getDeviceId(),
      };

      // Submit to backend (distance only!)
      const response = await CloudFlareAPI.submitDistance(submission);
      
      if (response.success) {
        // Reset incremental counters
        this.sessionDistance = 0;
        this.distanceCheckpoints = [];
        this.speedReadings = [];
        
        console.log('Distance submitted successfully:', response.cumulativeDistance);
      } else {
        console.error('Failed to submit distance:', response.error);
      }
    } catch (error) {
      console.error('Error submitting distance:', error);
    }
  }

  // ============= HELPER METHODS =============

  private async getUserId(): Promise<string> {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id;
    }
    throw new Error('User not authenticated');
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // ============= LISTENERS =============

  addDistanceListener(listener: (distance: number) => void): void {
    this.distanceListeners.add(listener);
  }

  removeDistanceListener(listener: (distance: number) => void): void {
    this.distanceListeners.delete(listener);
  }

  private notifyDistanceListeners(distance: number): void {
    this.distanceListeners.forEach(listener => listener(distance));
  }

  addSessionListener(listener: (session: SessionData) => void): void {
    this.sessionListeners.add(listener);
  }

  removeSessionListener(listener: (session: SessionData) => void): void {
    this.sessionListeners.delete(listener);
  }

  // ============= PUBLIC GETTERS =============

  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  getTotalDistance(): number {
    return this.currentSession?.totalDistance || 0;
  }

  getSessionDuration(): number {
    if (!this.currentSession) return 0;
    return (new Date().getTime() - this.currentSession.startTime.getTime()) / 1000;
  }

  // ============= RESUME SESSION =============

  async resumeSession(): Promise<boolean> {
    try {
      const savedSession = await AsyncStorage.getItem('activeSession');
      if (!savedSession) return false;

      this.currentSession = JSON.parse(savedSession);
      
      // Check if session is still valid (less than 24 hours old)
      const sessionAge = new Date().getTime() - new Date(this.currentSession!.startTime).getTime();
      if (sessionAge > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem('activeSession');
        return false;
      }

      // Resume tracking
      await BackgroundGeolocation.start();
      this.isTracking = true;
      this.startSubmissionTimer();

      return true;
    } catch (error) {
      console.error('Failed to resume session:', error);
      return false;
    }
  }

  // ============= PRIVACY NOTICE =============

  getPrivacyInfo(): object {
    return {
      dataCollected: [
        'Distance traveled (in meters)',
        'Duration of trips',
        'Average speed',
        'Maximum speed',
        'Number of checkpoints'
      ],
      dataNotCollected: [
        'GPS coordinates',
        'Specific locations',
        'Routes taken',
        'Start/end points',
        'Location history'
      ],
      dataUsage: [
        'Calculate XP rewards (1 XP = 1 KM)',
        'Distribute IMERA tokens',
        'Generate leaderboards',
        'Prevent cheating'
      ],
      privacyFeatures: [
        'All GPS processing done locally',
        'No location data sent to servers',
        'No route reconstruction possible',
        'Complete location privacy'
      ]
    };
  }
}

// Export singleton instance
const locationTracker = new PrivacyFirstLocationTracker();
export default locationTracker;
export { LocationPoint, DistanceSubmission, SessionData };