// src/services/VectorCalculator.ts
import CryptoJS from 'crypto-js';
import { LocationPoint } from './LocationService';

interface VectorProof {
  distance: number;
  vectorHash: string;
  trajectory: TrajectoryData;
  timestamp: string;
  nonce: number;
  difficulty: number;
}

interface TrajectoryData {
  startPoint: LocationPoint;
  endPoint: LocationPoint;
  waypoints: LocationPoint[];
  totalDistance: number;
  averageSpeed: number;
  duration: number;
  bearing: number;
}

interface MiningDifficulty {
  target: string;
  difficulty: number;
  blockHeight: number;
}

class VectorCalculator {
  private readonly EARTH_RADIUS_KM = 6371;
  private readonly MIN_SPEED_KMH = 0.5; // Minimum speed to be considered moving
  private readonly MAX_SPEED_KMH = 200; // Maximum reasonable speed
  private currentDifficulty: MiningDifficulty | null = null;

  // Calculate distance between two points using Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  // Calculate bearing between two points
  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x =
      Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
      Math.sin(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.cos(dLon);
    const bearing = Math.atan2(y, x);
    return ((this.toDeg(bearing) + 360) % 360);
  }

  // Calculate trajectory from location history
  calculateTrajectory(locations: LocationPoint[]): TrajectoryData | null {
    if (locations.length < 2) {
      return null;
    }

    const startPoint = locations[0];
    const endPoint = locations[locations.length - 1];
    let totalDistance = 0;
    let validSegments = 0;

    // Calculate total distance with validation
    for (let i = 1; i < locations.length; i++) {
      const distance = this.calculateDistance(
        locations[i - 1].latitude,
        locations[i - 1].longitude,
        locations[i].latitude,
        locations[i].longitude
      );

      // Validate segment
      const timeDiff = this.getTimeDifference(
        locations[i - 1].timestamp,
        locations[i].timestamp
      );
      const speed = (distance / timeDiff) * 3600; // km/h

      // Only count valid segments (reasonable speed)
      if (speed >= this.MIN_SPEED_KMH && speed <= this.MAX_SPEED_KMH) {
        totalDistance += distance;
        validSegments++;
      }
    }

    // Calculate duration
    const duration = this.getTimeDifference(
      startPoint.timestamp,
      endPoint.timestamp
    );

    // Calculate average speed
    const averageSpeed = duration > 0 ? (totalDistance / duration) * 3600 : 0;

    // Calculate overall bearing
    const bearing = this.calculateBearing(
      startPoint.latitude,
      startPoint.longitude,
      endPoint.latitude,
      endPoint.longitude
    );

    // Sample waypoints (every nth point to limit size)
    const sampleRate = Math.max(1, Math.floor(locations.length / 20));
    const waypoints = locations.filter((_, index) => index % sampleRate === 0);

    return {
      startPoint,
      endPoint,
      waypoints,
      totalDistance,
      averageSpeed,
      duration,
      bearing,
    };
  }

  // Generate vector proof for mining
  generateVectorProof(
    trajectory: TrajectoryData,
    difficulty: number = 4
  ): VectorProof {
    const timestamp = new Date().toISOString();
    let nonce = 0;
    let vectorHash = '';
    const target = '0'.repeat(difficulty);

    // Create base data for hashing
    const baseData = {
      start: `${trajectory.startPoint.latitude},${trajectory.startPoint.longitude}`,
      end: `${trajectory.endPoint.latitude},${trajectory.endPoint.longitude}`,
      distance: trajectory.totalDistance,
      duration: trajectory.duration,
      bearing: trajectory.bearing,
      timestamp,
    };

    // Mine for valid proof
    while (true) {
      const dataToHash = JSON.stringify({ ...baseData, nonce });
      vectorHash = CryptoJS.SHA256(dataToHash).toString();
      
      if (vectorHash.startsWith(target)) {
        break;
      }
      nonce++;
      
      // Prevent infinite loop
      if (nonce > 1000000) {
        throw new Error('Failed to generate valid proof');
      }
    }

    return {
      distance: trajectory.totalDistance,
      vectorHash,
      trajectory,
      timestamp,
      nonce,
      difficulty,
    };
  }

  // Verify vector proof
  verifyVectorProof(proof: VectorProof): boolean {
    const target = '0'.repeat(proof.difficulty);
    
    // Recreate the hash
    const baseData = {
      start: `${proof.trajectory.startPoint.latitude},${proof.trajectory.startPoint.longitude}`,
      end: `${proof.trajectory.endPoint.latitude},${proof.trajectory.endPoint.longitude}`,
      distance: proof.trajectory.totalDistance,
      duration: proof.trajectory.duration,
      bearing: proof.trajectory.bearing,
      timestamp: proof.timestamp,
      nonce: proof.nonce,
    };
    
    const recreatedHash = CryptoJS.SHA256(JSON.stringify(baseData)).toString();
    
    // Verify hash matches and meets difficulty
    return recreatedHash === proof.vectorHash && proof.vectorHash.startsWith(target);
  }

  // Calculate mining reward based on distance and difficulty
  calculateReward(
    distance: number,
    difficulty: number,
    baseReward: number = 10
  ): number {
    // Reward formula: base * distance * difficulty_multiplier
    const difficultyMultiplier = Math.pow(1.5, difficulty - 1);
    const distanceMultiplier = Math.log10(distance * 10 + 1); // Logarithmic scaling
    
    return baseReward * distanceMultiplier * difficultyMultiplier;
  }

  // Validate location sequence for anti-spoofing
  validateLocationSequence(locations: LocationPoint[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    if (locations.length < 2) {
      return { valid: false, issues: ['Insufficient location data'] };
    }

    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
      // Check time sequence
      if (new Date(curr.timestamp) <= new Date(prev.timestamp)) {
        issues.push(`Invalid time sequence at index ${i}`);
      }
      
      // Check speed
      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      const timeDiff = this.getTimeDifference(prev.timestamp, curr.timestamp);
      const speed = (distance / timeDiff) * 3600; // km/h
      
      if (speed > this.MAX_SPEED_KMH) {
        issues.push(`Impossible speed detected: ${speed.toFixed(2)} km/h at index ${i}`);
      }
      
      // Check accuracy
      if (curr.accuracy > 50) {
        issues.push(`Poor GPS accuracy at index ${i}: ${curr.accuracy}m`);
      }
      
      // Check for teleportation (sudden large jumps)
      if (distance > 1 && timeDiff < 0.001) { // 1km in less than 3.6 seconds
        issues.push(`Possible teleportation detected at index ${i}`);
      }
    }
    
    // Check for stationary mining (not moving enough)
    const trajectory = this.calculateTrajectory(locations);
    if (trajectory && trajectory.totalDistance < 0.01) { // Less than 10 meters
      issues.push('Insufficient movement detected');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // Calculate vector similarity for competition
  calculateVectorSimilarity(
    vector1: TrajectoryData,
    vector2: TrajectoryData
  ): number {
    // Compare distances (normalized)
    const distanceSimilarity = 1 - Math.abs(vector1.totalDistance - vector2.totalDistance) / 
      Math.max(vector1.totalDistance, vector2.totalDistance);
    
    // Compare bearings (normalized to 0-1)
    const bearingDiff = Math.abs(vector1.bearing - vector2.bearing);
    const bearingSimilarity = 1 - Math.min(bearingDiff, 360 - bearingDiff) / 180;
    
    // Compare average speeds (normalized)
    const speedSimilarity = 1 - Math.abs(vector1.averageSpeed - vector2.averageSpeed) / 
      Math.max(vector1.averageSpeed, vector2.averageSpeed);
    
    // Weighted average
    return (distanceSimilarity * 0.5 + bearingSimilarity * 0.3 + speedSimilarity * 0.2);
  }

  // Generate competition target
  generateCompetitionTarget(
    centerLat: number,
    centerLon: number,
    radius: number
  ): {
    targetDistance: number;
    targetBearing: number;
    targetLocation: { latitude: number; longitude: number };
  } {
    // Random distance within radius
    const targetDistance = Math.random() * radius;
    
    // Random bearing
    const targetBearing = Math.random() * 360;
    
    // Calculate target location
    const targetLocation = this.calculateDestination(
      centerLat,
      centerLon,
      targetDistance,
      targetBearing
    );
    
    return {
      targetDistance,
      targetBearing,
      targetLocation,
    };
  }

  // Calculate destination point given distance and bearing
  private calculateDestination(
    lat: number,
    lon: number,
    distance: number,
    bearing: number
  ): { latitude: number; longitude: number } {
    const R = this.EARTH_RADIUS_KM;
    const d = distance / R;
    const brng = this.toRad(bearing);
    const lat1 = this.toRad(lat);
    const lon1 = this.toRad(lon);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      latitude: this.toDeg(lat2),
      longitude: this.toDeg(lon2),
    };
  }

  // Get time difference in hours
  private getTimeDifference(timestamp1: string, timestamp2: string): number {
    const time1 = new Date(timestamp1).getTime();
    const time2 = new Date(timestamp2).getTime();
    return Math.abs(time2 - time1) / (1000 * 3600); // Convert to hours
  }

  // Convert degrees to radians
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Convert radians to degrees
  private toDeg(rad: number): number {
    return rad * (180 / Math.PI);
  }

  // Set current mining difficulty
  setDifficulty(difficulty: MiningDifficulty): void {
    this.currentDifficulty = difficulty;
  }

  // Get current mining difficulty
  getDifficulty(): MiningDifficulty | null {
    return this.currentDifficulty;
  }

  // Calculate estimated time to mine based on current conditions
  estimateMiningTime(
    currentSpeed: number,
    targetDistance: number
  ): number {
    if (currentSpeed <= 0) return Infinity;
    return targetDistance / currentSpeed; // Hours
  }

  // Calculate mining efficiency score
  calculateEfficiencyScore(
    trajectory: TrajectoryData,
    optimalPath: TrajectoryData
  ): number {
    // Compare actual vs optimal path
    const distanceEfficiency = trajectory.totalDistance / optimalPath.totalDistance;
    const timeEfficiency = optimalPath.duration / trajectory.duration;
    
    // Penalize for being too far from optimal
    const efficiency = Math.min(1, (distanceEfficiency + timeEfficiency) / 2);
    
    return Math.max(0, efficiency * 100); // Return as percentage
  }
}

export default new VectorCalculator();
export { VectorCalculator, VectorProof, TrajectoryData, MiningDifficulty };