import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DriverProfile, LocationPoint } from '../types';

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  userCoords?: [number, number];
  userRole?: 'customer' | 'driver';
  activeDrivers?: DriverProfile[];
  pickupPoint?: LocationPoint | null;
  dropPoint?: LocationPoint | null;
  driverMarkerCoords?: [number, number] | null;
  routePoints?: [number, number][] | null;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

// Custom DivIcon for Bike / Motorcycle
const createBikeIcon = (heading = 0, isAssigned = false) => {
  const color = isAssigned ? '#10B981' : '#F59E0B';
  const pulseClass = isAssigned ? 'animate-pulse' : '';
  
  return L.divIcon({
    className: 'custom-bike-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${color}33; ${pulseClass}"></div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #0F172A; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5" cy="18" r="3"/>
            <circle cx="19" cy="18" r="3"/>
            <path d="M12 19V9l3 3h4"/>
            <path d="M5 18l4-9h4l2 4"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Customer location pulse pin
const createCustomerPulseIcon = () => {
  return L.divIcon({
    className: 'customer-pulse-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 18px; height: 18px; border-radius: 50%; background: #3B82F6; border: 3px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.6);"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Pickup Marker Pin
const createPickupPin = (label = 'PICKUP') => {
  return L.divIcon({
    className: 'pickup-pin-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="background: #10B981; color: #064E3B; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 6px; border: 1px solid #34D399; box-shadow: 0 2px 6px rgba(0,0,0,0.4); white-space: nowrap;">
          ${label}
        </div>
        <div style="width: 24px; height: 24px; background: #10B981; border: 2px solid #FFFFFF; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); margin-top: 2px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Drop Marker Pin
const createDropPin = (label = 'DROP') => {
  return L.divIcon({
    className: 'drop-pin-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
        <div style="background: #EF4444; color: #FFFFFF; font-weight: 800; font-size: 10px; padding: 2px 6px; border-radius: 6px; border: 1px solid #F87171; box-shadow: 0 2px 6px rgba(0,0,0,0.4); white-space: nowrap;">
          ${label}
        </div>
        <div style="width: 24px; height: 24px; background: #EF4444; border: 2px solid #FFFFFF; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); margin-top: 2px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center,
  zoom = 15,
  userCoords,
  userRole = 'customer',
  activeDrivers = [],
  pickupPoint,
  dropPoint,
  driverMarkerCoords,
  routePoints,
  className = 'w-full h-full',
  onMapClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driversLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropMarkerRef = useRef<L.Marker | null>(null);
  const assignedDriverMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map Once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // 100% Free OpenStreetMap Tiles (No API Key Required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Subtle dark filter or custom tile styling layer
    const driversGroup = L.layerGroup().addTo(map);
    driversLayerRef.current = driversGroup;

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    // Trigger resize after small delay to fix container sizing
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when changed
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center[0], center[1]]);

  // Update user current position marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (userCoords) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userCoords, {
          icon: userRole === 'driver' ? createBikeIcon(0, true) : createCustomerPulseIcon(),
          zIndexOffset: 100,
        }).addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLatLng(userCoords);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userCoords, userRole]);

  // Update Active Drivers Grid (2-3 KM Radius on Customer Map)
  useEffect(() => {
    if (!driversLayerRef.current) return;
    driversLayerRef.current.clearLayers();

    // If driver is already assigned, only show that assigned driver
    if (driverMarkerCoords) return;

    activeDrivers.forEach((driver) => {
      if (driver.isDutyOn) {
        const marker = L.marker([driver.lat, driver.lng], {
          icon: createBikeIcon(driver.heading || 0, false),
        });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #0F172A; font-weight: bold;">
            <div style="color: #F59E0B; font-weight: 800;">${driver.vehicleModel}</div>
            <div>${driver.vehicleNumber}</div>
            <div style="font-size: 10px; color: #64748B;">Rating: ${driver.rating} ★</div>
          </div>
        `);
        driversLayerRef.current?.addLayer(marker);
      }
    });
  }, [activeDrivers, driverMarkerCoords]);

  // Update Pickup Point Pin
  useEffect(() => {
    if (!mapRef.current) return;
    if (pickupPoint) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickupPoint.lat, pickupPoint.lng], {
          icon: createPickupPin(pickupPoint.name || 'PICKUP'),
          zIndexOffset: 200,
        }).addTo(mapRef.current);
      } else {
        pickupMarkerRef.current.setLatLng([pickupPoint.lat, pickupPoint.lng]);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }
  }, [pickupPoint]);

  // Update Drop Point Pin
  useEffect(() => {
    if (!mapRef.current) return;
    if (dropPoint) {
      if (!dropMarkerRef.current) {
        dropMarkerRef.current = L.marker([dropPoint.lat, dropPoint.lng], {
          icon: createDropPin(dropPoint.name || 'DROP'),
          zIndexOffset: 200,
        }).addTo(mapRef.current);
      } else {
        dropMarkerRef.current.setLatLng([dropPoint.lat, dropPoint.lng]);
      }
    } else if (dropMarkerRef.current) {
      dropMarkerRef.current.remove();
      dropMarkerRef.current = null;
    }
  }, [dropPoint]);

  // Update Live Assigned Driver Marker (Animated)
  useEffect(() => {
    if (!mapRef.current) return;
    if (driverMarkerCoords) {
      if (!assignedDriverMarkerRef.current) {
        assignedDriverMarkerRef.current = L.marker(driverMarkerCoords, {
          icon: createBikeIcon(0, true),
          zIndexOffset: 300,
        }).addTo(mapRef.current);
      } else {
        assignedDriverMarkerRef.current.setLatLng(driverMarkerCoords);
      }
    } else if (assignedDriverMarkerRef.current) {
      assignedDriverMarkerRef.current.remove();
      assignedDriverMarkerRef.current = null;
    }
  }, [driverMarkerCoords]);

  // Draw Dynamic Routing Path
  useEffect(() => {
    if (!mapRef.current) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routePoints && routePoints.length >= 2) {
      const polyline = L.polyline(routePoints, {
        color: '#F59E0B',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '1, 8',
      }).addTo(mapRef.current);

      routeLayerRef.current = polyline;

      // Fit bounds nicely
      try {
        mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 16 });
      } catch (e) {
        // ignore bounds fit error
      }
    }
  }, [routePoints]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', minHeight: '300px' }} />;
};
