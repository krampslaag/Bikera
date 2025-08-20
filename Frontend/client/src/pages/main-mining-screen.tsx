// src/screens/MainMiningScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CloudFlareAPI from '../services/CloudFlareAPI';
import LocationService from '../services/LocationService';
import VectorCalculator from '../services/VectorCalculator';
import AuthService from '../services/AuthService';
import VectorMap from '../components/VectorMap';
import StatsDisplay from '../components/StatsDisplay';
import MiningControls from '../components/MiningControls';
import ParticleEffect from '../components/ParticleEffect';

const { width, height } = Dimensions.get('window');

interface MiningScreenState {
  isMining: boolean;
  currentSession: any | null;
  currentLocation: any | null;
  totalDistance: number;
  currentReward: number;
  miningDuration: number;
  networkStatus: any | null;
  competitionStatus: any | null;
  userStats: any | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

const MainMiningScreen: React.FC = () => {
  const [state, setState] = useState<MiningScreenState>({
    isMining: false,
    currentSession: null,
    currentLocation: null,
    totalDistance: 0,
    currentReward: 0,
    miningDuration: 0,
    networkStatus: null,
    competitionStatus: null,
    userStats: null,
    isLoading: true,
    isRefreshing: false,
  });

  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const locationListener = useRef<((location: any) => void) | null>(null);
  const distanceListener = useRef<((distance: number) => void) | null>(null);

  useEffect(() => {
    initializeScreen();
    checkActiveMiningSession();
    
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (locationListener.current) {
        LocationService.removeLocationListener(locationListener.current);
      }
      if (distanceListener.current) {
        LocationService.removeDistanceListener(distanceListener.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.isMining) {
      startPulseAnimation();
      startDurationTimer();
    } else {
      stopPulseAnimation();
      stopDurationTimer();
    }
  }, [state.isMining]);

  const initializeScreen = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Check authentication
      if (!AuthService.isAuthenticated()) {
        Alert.alert('Not Authenticated', 'Please login to start mining');
        return;
      }

      // Load initial data in parallel
      const [networkStatus, competitionStatus, userStats] = await Promise.all([
        CloudFlareAPI.getNetworkStatus(),
        CloudFlareAPI.getCompetitionStatus(),
        CloudFlareAPI.getUserStats(),
      ]);

      setState(prev => ({
        ...prev,
        networkStatus,
        competitionStatus,
        userStats,
        isLoading: false,
      }));

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (location) {
        setState(prev => ({ ...prev, currentLocation: location }));
      }
    } catch (error) {
      console.error('Failed to initialize screen:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      Alert.alert('Error', 'Failed to load mining data. Please try again.');
    }
  };

  const checkActiveMiningSession = async () => {
    try {
      const session = await CloudFlareAPI.getActiveMiningSession();
      if (session) {
        // Resume existing session
        setState(prev => ({
          ...prev,
          currentSession: session,
          isMining: true,
          totalDistance: session.distance,
          miningDuration: Date.now() - new Date(session.startTime).getTime(),
        }));

        // Resume location tracking
        await LocationService.startTracking();
        setupLocationListeners();
      }
    } catch (error) {
      console.error('Failed to check active session:', error);
    }
  };

  const startMining = async () => {
    try {
      // Request location permissions
      const hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required for mining.',
          [{ text: 'OK' }]
        );
        return;
      }

      setState(prev => ({ ...prev, isLoading: true }));

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Unable to get your current location');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Start location tracking
      const trackingStarted = await LocationService.startTracking();
      if (!trackingStarted) {
        Alert.alert('Error', 'Failed to start location tracking');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Start mining session on server
      const session = await CloudFlareAPI.startMiningSession({
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp,
        accuracy: location.accuracy,
      });

      setState(prev => ({
        ...prev,
        isMining: true,
        currentSession: session,
        currentLocation: location,
        totalDistance: 0,
        currentReward: 0,
        miningDuration: 0,
        isLoading: false,
      }));

      setupLocationListeners();
      
      Alert.alert('Mining Started', 'Start moving to earn rewards!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Failed to start mining:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      Alert.alert('Error', 'Failed to start mining. Please try again.');
    }
  };

  const stopMining = async () => {
    if (!state.currentSession) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Get final location
      const location = await LocationService.getCurrentLocation();
      
      // Stop location tracking
      await LocationService.stopTracking();

      // Get location history for proof
      const locationHistory = LocationService.getLocationHistory();
      
      // Calculate trajectory
      const trajectory = VectorCalculator.calculateTrajectory(locationHistory);
      
      if (trajectory) {
        // Generate proof
        const proof = VectorCalculator.generateVectorProof(trajectory);
        
        // Submit proof to server
        const result = await CloudFlareAPI.submitMiningProof(
          state.currentSession.id,
          {
            distance: trajectory.totalDistance,
            locations: locationHistory,
            duration: trajectory.duration,
          }
        );

        if (result.valid) {
          // End session with reward
          await CloudFlareAPI.endMiningSession(
            state.currentSession.id,
            {
              latitude: location!.latitude,
              longitude: location!.longitude,
              timestamp: new Date().toISOString(),
            }
          );

          Alert.alert(
            'Mining Complete!',
            `Distance: ${trajectory.totalDistance.toFixed(2)} km\nReward: ${result.reward} iMERA\nBlock: #${result.blockNumber}`,
            [{ text: 'Awesome!' }]
          );
        } else {
          Alert.alert('Invalid Proof', 'Your mining session could not be verified.');
        }
      }

      // Reset state
      setState(prev => ({
        ...prev,
        isMining: false,
        currentSession: null,
        totalDistance: 0,
        currentReward: 0,
        miningDuration: 0,
        isLoading: false,
      }));

      // Refresh stats
      await refreshData();
    } catch (error) {
      console.error('Failed to stop mining:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      Alert.alert('Error', 'Failed to complete mining session.');
    }
  };

  const setupLocationListeners = () => {
    // Location update listener
    locationListener.current = (location: any) => {
      setState(prev => ({ ...prev, currentLocation: location }));
      
      // Update server with new location
      if (state.currentSession) {
        CloudFlareAPI.updateMiningLocation(state.currentSession.id, location)
          .then(result => {
            setState(prev => ({
              ...prev,
              currentReward: result.currentReward,
            }));
          })
          .catch(console.error);
      }
    };
    LocationService.addLocationListener(locationListener.current);

    // Distance update listener
    distanceListener.current = (distance: number) => {
      setState(prev => ({ ...prev, totalDistance: distance }));
    };
    LocationService.addDistanceListener(distanceListener.current);
  };

  const startPulseAnimation = () => {
    pulseAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.current.start();
  };

  const stopPulseAnimation = () => {
    if (pulseAnimation.current) {
      pulseAnimation.current.stop();
      animatedValue.setValue(0);
    }
  };

  const startDurationTimer = () => {
    const startTime = state.currentSession?.startTime 
      ? new Date(state.currentSession.startTime).getTime()
      : Date.now();
    
    durationInterval.current = setInterval(() => {
      const duration = Date.now() - startTime;
      setState(prev => ({ ...prev, miningDuration: duration }));
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  const refreshData = async () => {
    setState(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      const [networkStatus, competitionStatus, userStats] = await Promise.all([
        CloudFlareAPI.getNetworkStatus(),
        CloudFlareAPI.getCompetitionStatus(),
        CloudFlareAPI.getUserStats(),
      ]);

      setState(prev => ({
        ...prev,
        networkStatus,
        competitionStatus,
        userStats,
        isRefreshing: false,
      }));
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setState(prev => ({ ...prev, isRefreshing: false }));
    }
  };

  const joinCompetition = async () => {
    try {
      const result = await CloudFlareAPI.joinCompetition();
      if (result.success) {
        Alert.alert('Joined Competition', result.message);
        await refreshData();
      }
    } catch (error) {
      console.error('Failed to join competition:', error);
      Alert.alert('Error', 'Failed to join competition');
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (state.isLoading && !state.isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#41BEEE" />
        <Text style={styles.loadingText}>Loading Mining Data...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#09060e', '#1a0f1f', '#09060e']}
      style={styles.container}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={state.isRefreshing}
            onRefresh={refreshData}
            tintColor="#41BEEE"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Map Section */}
        <View style={styles.mapContainer}>
          <VectorMap
            currentLocation={state.currentLocation}
            isMining={state.isMining}
            trajectory={LocationService.getLocationHistory()}
          />
          {state.isMining && <ParticleEffect />}
        </View>

        {/* Stats Display */}
        <StatsDisplay
          distance={state.totalDistance}
          reward={state.currentReward}
          duration={formatDuration(state.miningDuration)}
          speed={state.currentLocation?.speed || 0}
          accuracy={state.currentLocation?.accuracy || 0}
          blockHeight={state.networkStatus?.currentBlockHeight || 0}
        />

        {/* Mining Controls */}
        <MiningControls
          isMining={state.isMining}
          onStartMining={startMining}
          onStopMining={stopMining}
          isLoading={state.isLoading}
        />

        {/* Competition Section */}
        {state.competitionStatus?.isActive && (
          <View style={styles.competitionCard}>
            <LinearGradient
              colors={['#FF3EFF', '#41BEEE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.competitionGradient}
            >
              <View style={styles.competitionContent}>
                <Text style={styles.competitionTitle}>Active Competition</Text>
                <Text style={styles.competitionTarget}>
                  Target: {state.competitionStatus.targetDistance} km
                </Text>
                <Text style={styles.competitionParticipants}>
                  {state.competitionStatus.participants} participants
                </Text>
                {state.competitionStatus.currentLeader && (
                  <Text style={styles.competitionLeader}>
                    Leader: {state.competitionStatus.currentLeader.username}
                    {' - '}
                    {state.competitionStatus.currentLeader.distance.toFixed(2)} km
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={joinCompetition}
                >
                  <Text style={styles.joinButtonText}>Join Competition</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Network Status */}
        <View style={styles.networkCard}>
          <Text style={styles.networkTitle}>Network Status</Text>
          <View style={styles.networkGrid}>
            <View style={styles.networkStat}>
              <Icon name="account-group" size={24} color="#41BEEE" />
              <Text style={styles.networkValue}>
                {state.networkStatus?.activeMiners || 0}
              </Text>
              <Text style={styles.networkLabel}>Active Miners</Text>
            </View>
            <View style={styles.networkStat}>
              <Icon name="road-variant" size={24} color="#FF3EFF" />
              <Text style={styles.networkValue}>
                {(state.networkStatus?.totalDistance || 0).toFixed(0)} km
              </Text>
              <Text style={styles.networkLabel}>Total Distance</Text>
            </View>
            <View style={styles.networkStat}>
              <Icon name="trophy" size={24} color="#FFD700" />
              <Text style={styles.networkValue}>
                {(state.networkStatus?.totalRewards || 0).toFixed(0)}
              </Text>
              <Text style={styles.networkLabel}>Total Rewards</Text>
            </View>
          </View>
        </View>

        {/* User Stats */}
        {state.userStats && (
          <View style={styles.userStatsCard}>
            <Text style={styles.userStatsTitle}>Your Stats</Text>
            <View style={styles.userStatsGrid}>
              <View style={styles.userStat}>
                <Text style={styles.userStatValue}>
                  {state.userStats.totalDistance.toFixed(2)} km
                </Text>
                <Text style={styles.userStatLabel}>Total Distance</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatValue}>
                  {state.userStats.totalRewards.toFixed(2)}
                </Text>
                <Text style={styles.userStatLabel}>iMERA Earned</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatValue}>
                  {state.userStats.blocksMined}
                </Text>
                <Text style={styles.userStatLabel}>Blocks Mined</Text>
              </View>
              <View style={styles.userStat}>
                <Text style={styles.userStatValue}>
                  #{state.userStats.rank || '-'}
                </Text>
                <Text style={styles.userStatLabel}>Global Rank</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09060e',
  },
  loadingText: {
    color: '#c0cae1',
    fontSize: 16,
    marginTop: 10,
  },
  mapContainer: {
    height: height * 0.4,
    position: 'relative',
  },
  competitionCard: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  competitionGradient: {
    padding: 2,
  },
  competitionContent: {
    backgroundColor: '#1a2641',
    borderRadius: 10,
    padding: 16,
  },
  competitionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  competitionTarget: {
    color: '#c0cae1',
    fontSize: 16,
    marginBottom: 4,
  },
  competitionParticipants: {
    color: '#848da2',
    fontSize: 14,
    marginBottom: 4,
  },
  competitionLeader: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 12,
  },
  joinButton: {
    backgroundColor: '#41BEEE',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
  },
  joinButtonText: {
    color: '#09060e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  networkCard: {
    backgroundColor: '#1a2641',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  networkTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  networkGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  networkStat: {
    alignItems: 'center',
  },
  networkValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  networkLabel: {
    color: '#848da2',
    fontSize: 12,
    marginTop: 2,
  },
  userStatsCard: {
    backgroundColor: '#1a2641',
    margin: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  userStatsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  userStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  userStat: {
    width: '48%',
    marginBottom: 12,
  },
  userStatValue: {
    color: '#41BEEE',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userStatLabel: {
    color: '#848da2',
    fontSize: 12,
    marginTop: 2,
  },
});

export default MainMiningScreen;