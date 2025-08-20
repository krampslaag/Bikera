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

  // Start location tracking
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
      // Start background geolocation
      await BackgroundGeolocation.start();
      
      // Start foreground tracking as well for better accuracy
      this.watchId = Geolocation.watchPosition(
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
          this.onLocationUpdate(location);
        },
        (error) => {
          console.error('Location error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
          distanceFilter: 5,
        }
      );

      this.isTracking = true;
      this.sessionStartTime = new Date();
      this.totalDistance = 0;
      this.locationHistory = [];
      
      // Store session start
      await AsyncStorage.setItem('miningSessionStart', this.sessionStartTime.toISOString());
      
      return true;
    } catch (error) {
      console.error('Failed to start tracking:', error);
      return false;
    }
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

  // Handle location update
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
    
    // Calculate distance if we have a previous location
    if (previousLocation) {
      const distance = this.calculateDistance(
        previousLocation.latitude,
        previousLocation.longitude,
        location.latitude,
        location.longitude
      );
      
      // Only add distance if movement is significant (to filter GPS drift)
      if (distance > 0.005 && location.accuracy < 20) { // 5 meters minimum, good accuracy
        this.totalDistance += distance;
        
        // Notify distance listeners
        this.distanceListeners.forEach(listener => listener(this.totalDistance));
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