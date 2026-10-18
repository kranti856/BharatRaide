import { useEffect, useState, useRef } from 'react';

export interface GeoLocationState {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  error: string | null;
  isTracking: boolean;
}

// Benchmark fallback for Delhi/NCR metro hub
const BENCHMARK_COORDS = { lat: 28.6139, lng: 77.2090 };

export function useGeolocation(options: { enableTracking?: boolean; onLocationUpdate?: (lat: number, lng: number, heading?: number) => void } = {}) {
  const { enableTracking = true, onLocationUpdate } = options;
  const [geoState, setGeoState] = useState<GeoLocationState>({
    lat: BENCHMARK_COORDS.lat,
    lng: BENCHMARK_COORDS.lng,
    heading: 0,
    speed: 0,
    accuracy: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  useEffect(() => {
    if (!enableTracking || typeof window === 'undefined' || !navigator.geolocation) {
      setGeoState((prev) => ({ ...prev, error: 'Geolocation not supported in this environment' }));
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true, // As specified in the specification
      timeout: 15000,
      maximumAge: 5000,
    };

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, heading, speed, accuracy } = position.coords;
      setGeoState({
        lat: latitude,
        lng: longitude,
        heading: heading ?? 0,
        speed: speed ?? 0,
        accuracy: accuracy ?? null,
        error: null,
        isTracking: true,
      });

      if (onLocationUpdateRef.current) {
        onLocationUpdateRef.current(latitude, longitude, heading ?? undefined);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation warning/denied, retaining benchmark location:', err.message);
      setGeoState((prev) => ({
        ...prev,
        error: err.message,
        isTracking: false,
      }));
    };

    // First attempt quick get
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);

    // Continuous watchPosition for seamless high-accuracy mobile tracking
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    } catch (e) {
      console.warn('Failed to start watchPosition:', e);
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enableTracking]);

  return geoState;
}
