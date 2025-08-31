// src/services/LocationService.ts
import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundGeolocation from 'react-native-background-geolocation';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}

interface LocationServiceConfig {
  desiredAccuracy: number;
  distanceFilter: number;
  stopOnTerminate: boolean;
  startOnBoot: boolean;
  debug: boolean;
  logLevel: number;
}

class LocationService {
  private isTracking: boolean = false;
  private locationHistory: LocationPoint[] = [];
  private currentLocation: LocationPoint | null = null;
  private watchId: number | null = null;
  private locationListeners: Set<(location: LocationPoint) => void> = new Set();
  private distanceListeners: Set<(distance: number) => void> = new Set();
  private totalDistance: number = 0;
  private sessionStartTime: Date | null = null;

  constructor() {
    this.initializeBackgroundGeolocation();
  }

  // Initialize background geolocation
  private async initializeBackgroundGeolocation() {
    const config: LocationServiceConfig = {
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10, // meters
      stopOnTerminate: false,
      startOnBoot: true,
      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    };

    BackgroundGeolocation.configure(config);

    // Set up event listeners
    BackgroundGeolocation.on('location', this.onLocationUpdate.bind(this));
    BackgroundGeolocation.on('motionchange', this.onMotionChange.bind(this));
    BackgroundGeolocation.on('geofence', this.onGeofence.bind(this));
    BackgroundGeolocation.on('http', this.onHttp.bind(this));
    BackgroundGeolocation.on('heartbeat', this.onHeartbeat.bind(this));
  }

  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // iOS permissions are handled in Info.plist
      return true;
    } else if (Platform.OS === 'android') {
      try {
        const fineLocationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'BlockchainVectorMiner needs access to your location for mining.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (fineLocationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Denied',
            'Location permission is required for mining. Please enable it in settings.',
            [{ text: 'OK' }]
          );
          return false;
        }

        // For Android 10+ request background location
        if (Platform.Version >= 29) {
          const backgroundGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: 'Background Location Permission',
              message: 'Allow BlockchainVectorMiner to access location in the background for continuous mining.',
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
        }

        return true;
      } catch (err) {
        console.error('Permission request error:', err);
        return false;
      }
    }
    return false;
  }

  // Configure tracking intervals based on mode
  private readonly TRACKING_MODES = {
    HIGH_ACCURACY: {
      interval: 5000,      // 5 seconds
      distanceFilter: 5,   // 5 meters
      description: 'Maximum accuracy, high battery usage'
    },
    BALANCED: {
      interval: 10000,     // 10 seconds (RECOMMENDED)
      distanceFilter: 10,  // 10 meters
      description: 'Good accuracy, moderate battery usage'
    },
    BATTERY_SAVER: {
      interval: 20000,     // 20 seconds
      distanceFilter: 20,  // 20 meters
      description: 'Lower accuracy, minimal battery usage'
    },
    ADAPTIVE: {
      interval: 'dynamic', // Adjusts based on speed
      distanceFilter: 10,
      description: 'Smart mode - adjusts to your movement'
    }
  };

  private currentMode = this.TRACKING_MODES.BALANCED; // Default to 10 seconds
  private adaptiveInterval: number = 10000;

  // Set tracking mode
  async setTrackingMode(mode: 'HIGH_ACCURACY' | 'BALANCED' | 'BATTERY_SAVER' | 'ADAPTIVE') {
    this.currentMode = this.TRACKING_MODES[mode];
    
    if (this.isTracking) {
      // Restart tracking with new settings
      await this.stopTracking();
      await this.startTracking();
    }
    
    // Save preference
    await AsyncStorage.setItem('tracking_mode', mode);
  }

  // Adaptive interval calculation based on speed
  private calculateAdaptiveInterval(speed: number): number {
    // Speed in km/h
    if (speed < 5) {
      // Walking - less frequent updates
      return 20000; // 20 seconds
    } else if (speed < 15) {
      // Jogging/cycling - moderate updates
      return 10000; // 10 seconds  
    } else if (speed < 50) {
      // Driving in city - frequent updates
      return 5000; // 5 seconds
    } else {
      // Highway driving - very frequent updates
      return 3000; // 3 seconds
    }
  }

  // Start location tracking with optimized settings
  async startTracking(): Promise<boolean> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return false;
    }

    if (this.isTracking) {
      console.log('Already tracking location');
      return true;
    }

    try {
      // Configure background geolocation with battery optimization
      const config = {
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: this.currentMode.distanceFilter,
        stopOnTerminate: false,
        startOnBoot: true,
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
        
        // Battery optimization settings
        stopTimeout: 5,                    // Stop after 5 min stationary
        motionTriggerDelay: 10000,        // 10 sec before motion trigger
        preventSuspend: false,             // Allow OS suspension
        heartbeatInterval: 60,             // Heartbeat every 60 seconds
        
        // iOS specific battery optimizations
        activityType: BackgroundGeolocation.ACTIVITY_TYPE_FITNESS,
        pausesLocationUpdatesAutomatically: true,
        saveBatteryOnBackground: true,
        
        // Android specific battery optimizations  
        enableHeadless: true,
        foregroundService: true,
        notificationTitle: 'Mining Active',
        notificationText: 'Tracking your movement for rewards',
      };

      await BackgroundGeolocation.configure(config);
      await BackgroundGeolocation.start();
      
      // Set up interval-based tracking
      const trackingInterval = this.currentMode.interval === 'dynamic' 
        ? this.adaptiveInterval 
        : this.currentMode.interval;
      
      // Use interval-based location updates for better battery life
      this.watchId = setInterval(async () => {
        try {
          const location = await this.getCurrentLocationOptimized();
          if (location) {
            this.onLocationUpdate(location);
          }
        } catch (error) {
          console.error('Failed to get location:', error);
        }
      }, trackingInterval);

      this.isTracking = true;
      this.sessionStartTime = new Date();
      this.totalDistance = 0;
      this.locationHistory = [];
      
      await AsyncStorage.setItem('miningSessionStart', this.sessionStartTime.toISOString());
      
      return true;
    } catch (error) {
      console.error('Failed to start tracking:', error);
      return false;
    }
  }

  // Optimized location fetch
  private async getCurrentLocationOptimized(): Promise<LocationPoint | null> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: LocationPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date(position.timestamp).toISOString(),
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };
          
          // Update adaptive interval if in adaptive mode
          if (this.currentMode === this.TRACKING_MODES.ADAPTIVE && location.speed) {
            const speedKmh = (location.speed || 0) * 3.6; // m/s to km/h
            this.adaptiveInterval = this.calculateAdaptiveInterval(speedKmh);
          }
          
          resolve(location);
        },
        (error) => {
          console.error('Location error:', error);
          resolve(null); // Don't reject, just return null
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,        // Reduced from 20000
          maximumAge: 5000,     // Allow 5-second old locations
        }
      );
    });
  }

  // Stop location tracking
  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    try {
      // Stop background geolocation
      await BackgroundGeolocation.stop();
      
      // Clear foreground watch
      if (this.watchId !== null) {
        Geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }

      this.isTracking = false;
      
      // Save session data
      await this.saveSessionData();
      
      // Clear session start
      await AsyncStorage.removeItem('miningSessionStart');
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  }

  // Handle location update with vector distance accumulation
  private onLocationUpdate(location: LocationPoint) {
    // Update current location
    const previousLocation = this.currentLocation;
    this.currentLocation = location;
    
    // Add to history
    this.locationHistory.push(location);
    
    // Limit history size to last 1000 points
    if (this.locationHistory.length > 1000) {
      this.locationHistory.shift();
    }
    
    // Calculate distance vector if we have a previous location
    if (previousLocation) {
      // Calculate distance between last point and current point
      const segmentDistance = this.calculateDistance(
        previousLocation.latitude,
        previousLocation.longitude,
        location.latitude,
        location.longitude
      );
      
      // Validate the segment (anti-spoofing)
      const timeDiff = (new Date(location.timestamp).getTime() - 
                       new Date(previousLocation.timestamp).getTime()) / 1000; // seconds
      const speed = (segmentDistance / timeDiff) * 3600; // km/h
      
      // Only add distance if movement is valid
      if (segmentDistance > 0.005 && // Minimum 5 meters (GPS drift filter)
          segmentDistance < 0.5 &&    // Maximum 500m in 5 seconds (360 km/h limit)
          location.accuracy < 20 &&    // Good GPS accuracy required
          speed < 120) {              // Reasonable speed limit (120 km/h)
        
        // Add this segment to total distance (vector accumulation)
        this.totalDistance += segmentDistance;
        
        console.log(`Vector segment added: ${segmentDistance.toFixed(3)} km, Total: ${this.totalDistance.toFixed(3)} km`);
        
        // Notify distance listeners with accumulated total
        this.distanceListeners.forEach(listener => listener(this.totalDistance));
      } else {
        console.log(`Segment rejected - Distance: ${segmentDistance.toFixed(3)} km, Speed: ${speed.toFixed(1)} km/h, Accuracy: ${location.accuracy}m`);
      }
    }
    
    // Notify location listeners
    this.locationListeners.forEach(listener => listener(location));
  }

  // Handle motion change events
  private onMotionChange(event: any) {
    console.log('Motion change:', event);
    if (event.isMoving) {
      BackgroundGeolocation.changePace(true); // Enable aggressive tracking
    } else {
      BackgroundGeolocation.changePace(false); // Stationary mode
    }
  }

  // Handle geofence events
  private onGeofence(event: any) {
    console.log('Geofence event:', event);
  }

  // Handle HTTP events (for syncing with server)
  private onHttp(event: any) {
    console.log('HTTP event:', event);
  }

  // Handle heartbeat events
  private onHeartbeat(event: any) {
    console.log('Heartbeat:', event);
    // Can perform periodic tasks here
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Get current location
  async getCurrentLocation(): Promise<LocationPoint | null> {
    if (this.currentLocation) {
      return this.currentLocation;
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: LocationPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date(position.timestamp).toISOString(),
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
          };
          this.currentLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Failed to get current location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
        }
      );
    });
  }

  // Get location history
  getLocationHistory(): LocationPoint[] {
    return [...this.locationHistory];
  }

  // Get total distance traveled
  getTotalDistance(): number {
    return this.totalDistance;
  }

  // Get session duration
  getSessionDuration(): number {
    if (!this.sessionStartTime) {
      return 0;
    }
    return Date.now() - this.sessionStartTime.getTime();
  }

  // Save session data
  private async saveSessionData() {
    try {
      const sessionData = {
        startTime: this.sessionStartTime?.toISOString(),
        endTime: new Date().toISOString(),
        totalDistance: this.totalDistance,
        locationHistory: this.locationHistory.slice(-100), // Save last 100 points
      };
      
      await AsyncStorage.setItem('lastMiningSession', JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  // Load last session data
  async loadLastSession(): Promise<any> {
    try {
      const data = await AsyncStorage.getItem('lastMiningSession');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load last session:', error);
      return null;
    }
  }

  // Add location listener
  addLocationListener(listener: (location: LocationPoint) => void) {
    this.locationListeners.add(listener);
  }

  // Remove location listener
  removeLocationListener(listener: (location: LocationPoint) => void) {
    this.locationListeners.delete(listener);
  }

  // Add distance listener
  addDistanceListener(listener: (distance: number) => void) {
    this.distanceListeners.add(listener);
  }

  // Remove distance listener
  removeDistanceListener(listener: (distance: number) => void) {
    this.distanceListeners.delete(listener);
  }

  // Check if currently tracking
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  // Set up geofence
  async addGeofence(
    identifier: string,
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<void> {
    await BackgroundGeolocation.addGeofence({
      identifier,
      latitude,
      longitude,
      radius,
      notifyOnEntry: true,
      notifyOnExit: true,
      notifyOnDwell: true,
      loiteringDelay: 30000, // 30 seconds
    });
  }

  // Remove geofence
  async removeGeofence(identifier: string): Promise<void> {
    await BackgroundGeolocation.removeGeofence(identifier);
  }

  // Clear all geofences
  async clearGeofences(): Promise<void> {
    await BackgroundGeolocation.removeGeofences();
  }

  // Get logs for debugging
  async getLogs(): Promise<string> {
    return await BackgroundGeolocation.getLog();
  }

  // Clear logs
  async clearLogs(): Promise<void> {
    await BackgroundGeolocation.destroyLog();
  }
}

export default new LocationService();
export { LocationService, LocationPoint };