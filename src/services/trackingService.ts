/**
 * Real-Time Driver GPS Tracking Service for BharatRaide
 * Powered by Socket.io with HTTP Polling & BroadcastChannel Fallback.
 * Updates driver GPS coordinates every 3-5 seconds on customer map.
 */

import { io, Socket } from 'socket.io-client';
import { store, calculateDistanceKm } from './store';

export interface DriverGpsLocation {
  rideId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmph: number;
  distanceRemainingKm: number;
  etaMinutes: number;
  timestamp: number;
}

export type LocationCallback = (location: DriverGpsLocation) => void;

class TrackingService {
  private socket: Socket | null = null;
  private channel: BroadcastChannel | null = null;
  private driverInterval: any = null;
  private activeBroadcastingRideId: string | null = null;
  private isSocketConnected = false;

  constructor() {
    this.initSocket();
    this.initBroadcastChannel();
  }

  private initSocket() {
    if (typeof window === 'undefined') return;

    try {
      // Connect to the same origin server on port 3000
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.isSocketConnected = true;
        console.log('[TrackingService] Socket connected to live GPS server:', this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        this.isSocketConnected = false;
        console.log('[TrackingService] Socket disconnected, fallback active');
      });
    } catch (err) {
      console.warn('[TrackingService] Socket.io init warning:', err);
    }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('bharatraide_gps_tracking');
      } catch (e) {
        // BroadcastChannel fallback if blocked
      }
    }
  }

  /**
   * Calculate bearing angle in degrees between two GPS points
   */
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  }

  /**
   * Start broadcasting driver GPS updates every 3-4 seconds.
   * Steps towards destination (pickup or drop) based on active ride state.
   */
  public startDriverBroadcaster(
    rideId: string,
    driverId: string,
    initialCoords: [number, number],
    getTargetCoords: () => [number, number],
    getRideStatus: () => string,
    onStepUpdate?: (location: DriverGpsLocation) => void
  ) {
    this.stopDriverBroadcaster();
    this.activeBroadcastingRideId = rideId;

    let currentLat = initialCoords[0];
    let currentLng = initialCoords[1];

    // Emit initial position immediately
    const target = getTargetCoords();
    const initDist = calculateDistanceKm(currentLat, currentLng, target[0], target[1]);
    const initHeading = this.calculateBearing(currentLat, currentLng, target[0], target[1]);
    const initEta = Math.max(1, Math.round((initDist / 30) * 60));

    const initialPayload: DriverGpsLocation = {
      rideId,
      driverId,
      lat: currentLat,
      lng: currentLng,
      heading: initHeading,
      speedKmph: 32,
      distanceRemainingKm: initDist,
      etaMinutes: initEta,
      timestamp: Date.now(),
    };

    this.sendLocationUpdate(initialPayload);
    if (onStepUpdate) onStepUpdate(initialPayload);

    // Broadcast update every 3.5 seconds (3500ms) as requested
    this.driverInterval = setInterval(() => {
      const status = getRideStatus();
      if (status !== 'accepted' && status !== 'in_trip') {
        return;
      }

      const [targetLat, targetLng] = getTargetCoords();
      const distToTarget = calculateDistanceKm(currentLat, currentLng, targetLat, targetLng);

      // If already within 40 meters, auto arrive or stay parked
      if (distToTarget <= 0.04) {
        if (status === 'accepted') {
          store.driverArrivedAtPickup();
        }
        return;
      }

      // Step towards destination by ~12% - 18% per tick + small natural road wobble
      const stepFraction = 0.15;
      const wobbleLat = (Math.random() - 0.5) * 0.00015;
      const wobbleLng = (Math.random() - 0.5) * 0.00015;

      const nextLat = currentLat + (targetLat - currentLat) * stepFraction + wobbleLat;
      const nextLng = currentLng + (targetLng - currentLng) * stepFraction + wobbleLng;

      const heading = this.calculateBearing(currentLat, currentLng, targetLat, targetLng);
      const remainingKm = parseFloat(calculateDistanceKm(nextLat, nextLng, targetLat, targetLng).toFixed(2));
      const speed = Math.round(28 + Math.random() * 8); // 28-36 km/h realistic city bike speed
      const etaMinutes = Math.max(1, Math.round((remainingKm / speed) * 60));

      currentLat = nextLat;
      currentLng = nextLng;

      const payload: DriverGpsLocation = {
        rideId,
        driverId,
        lat: currentLat,
        lng: currentLng,
        heading,
        speedKmph: speed,
        distanceRemainingKm: remainingKm,
        etaMinutes,
        timestamp: Date.now(),
      };

      this.sendLocationUpdate(payload);
      if (onStepUpdate) onStepUpdate(payload);
    }, 3500);
  }

  /**
   * Stop active GPS broadcasting
   */
  public stopDriverBroadcaster() {
    if (this.driverInterval) {
      clearInterval(this.driverInterval);
      this.driverInterval = null;
    }
    this.activeBroadcastingRideId = null;
  }

  /**
   * Transmit location update through Socket.io + REST fallback + Local Broadcast
   */
  private sendLocationUpdate(payload: DriverGpsLocation) {
    // 1. Update local AppStore
    store.updateRideDriverCoords(
      payload.rideId,
      [payload.lat, payload.lng],
      payload.heading,
      payload.speedKmph,
      payload.distanceRemainingKm
    );

    // 2. Transmit via Socket.io
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_driver_location', payload);
    }

    // 3. BroadcastChannel for instant same-browser cross-tab syncing
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'DRIVER_LOCATION_UPDATE', payload });
      } catch (e) {
        // ignore
      }
    }

    // 4. Resilient REST API HTTP Fallback
    if (typeof fetch !== 'undefined') {
      fetch(`/api/ride/${payload.rideId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Non-blocking fallback failure
      });
    }
  }

  /**
   * Customer Map: Subscribe to real-time driver GPS updates every 3-5 seconds
   */
  public subscribeToRideTracking(rideId: string, callback: LocationCallback): () => void {
    // 1. Join ride room on Socket.io
    if (this.socket) {
      this.socket.emit('join_ride', rideId);
    }

    // Handler for incoming Socket updates
    const handleSocketUpdate = (data: DriverGpsLocation) => {
      if (data && data.rideId === rideId) {
        callback(data);
      }
    };

    if (this.socket) {
      this.socket.on('driver_location_updated', handleSocketUpdate);
    }

    // 2. BroadcastChannel listener for tab-to-tab sync
    const handleChannelMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'DRIVER_LOCATION_UPDATE' && ev.data?.payload?.rideId === rideId) {
        callback(ev.data.payload);
      }
    };

    if (this.channel) {
      this.channel.addEventListener('message', handleChannelMessage);
    }

    // 3. Immediate check from store if ride already has driverCoords
    const currentRide = store.getActiveRide();
    if (currentRide && currentRide.id === rideId && currentRide.driverCoords) {
      callback({
        rideId,
        driverId: currentRide.driverId || 'driver',
        lat: currentRide.driverCoords[0],
        lng: currentRide.driverCoords[1],
        heading: currentRide.driverHeading || 0,
        speedKmph: currentRide.driverSpeedKmph || 30,
        distanceRemainingKm: currentRide.driverDistanceToTargetKm || 0.8,
        etaMinutes: 2,
        timestamp: currentRide.driverLastUpdated || Date.now(),
      });
    }

    // 4. Polling fallback check every 3.5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ride/${rideId}/location`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.location) {
            callback(json.location);
          }
        }
      } catch (err) {
        // Fallback to store
        const ride = store.getActiveRide();
        if (ride && ride.id === rideId && ride.driverCoords) {
          callback({
            rideId,
            driverId: ride.driverId || 'driver',
            lat: ride.driverCoords[0],
            lng: ride.driverCoords[1],
            heading: ride.driverHeading || 0,
            speedKmph: ride.driverSpeedKmph || 30,
            distanceRemainingKm: ride.driverDistanceToTargetKm || 0.8,
            etaMinutes: 2,
            timestamp: ride.driverLastUpdated || Date.now(),
          });
        }
      }
    }, 3500);

    // Return cleanup unsubscribe function
    return () => {
      if (this.socket) {
        this.socket.off('driver_location_updated', handleSocketUpdate);
        this.socket.emit('leave_ride', rideId);
      }
      if (this.channel) {
        this.channel.removeEventListener('message', handleChannelMessage);
      }
      clearInterval(pollInterval);
    };
  }
}

export const trackingService = new TrackingService();
