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
  driverHeading?: number;
  routePoints?: [number, number][] | null;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

// Custom DivIcon for Bike / Motorcycle with Live Heading Rotation & Glide Animation
const createBikeIcon = (heading = 0, isAssigned = false) => {
  const color = isAssigned ? '#10B981' : '#F59E0B';
  const pulseRing = isAssigned
    ? '<div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: rgba(16, 185, 129, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
    : '';

  return L.divIcon({
    className: 'custom-bike-marker',
    html: `
      <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
        ${pulseRing}
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: ${color}22;"></div>
        <div style="width: 34px; height: 34px; border-radius: 50%; background: #0F172A; border: 2.5px solid ${color}; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.6s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.65);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5" cy="18" r="3"/>
            <circle cx="19" cy="18" r="3"/>
            <path d="M12 19V9l3 3h4"/>
            <path d="M5 18l4-9h4l2 4"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
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
  driverHeading = 0,
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

  // Dynamic ref for latest onMapClick callback
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map Once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false, // We render custom mobile-first touch buttons
      attributionControl: false,
      tapHold: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      minZoom: 10, // Prevent zooming out to entire world map (locks to city/metro region)
      maxZoom: 18,
    });

    // 100% Free OpenStreetMap Tiles (No API Key Required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 10,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Subtle dark filter or custom tile styling layer
    const driversGroup = L.layerGroup().addTo(map);
    driversLayerRef.current = driversGroup;

    map.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

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

  // Update center when changed (only if pickup and drop are not actively bound)
  useEffect(() => {
    if (mapRef.current && center) {
      if (pickupPoint && dropPoint) return;
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center[0], center[1], pickupPoint, dropPoint]);

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

  // AUTOMATIC FITBOUNDS TRACKER FOR PICKUP & DROP LOCATIONS
  // Ensures pickup and drop points are always tracked and framed cleanly on screen
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isValidCoord = (pt?: LocationPoint | null) =>
      pt &&
      typeof pt.lat === 'number' &&
      typeof pt.lng === 'number' &&
      !isNaN(pt.lat) &&
      !isNaN(pt.lng) &&
      isFinite(pt.lat) &&
      isFinite(pt.lng) &&
      pt.lat !== 0 &&
      pt.lng !== 0;

    const hasPickup = isValidCoord(pickupPoint);
    const hasDrop = isValidCoord(dropPoint);

    if (hasPickup && hasDrop) {
      try {
        map.invalidateSize();
        const pLat = pickupPoint!.lat;
        const pLng = pickupPoint!.lng;
        const dLat = dropPoint!.lat;
        const dLng = dropPoint!.lng;

        // If both points are identical, center with high zoom
        if (Math.abs(pLat - dLat) < 0.0001 && Math.abs(pLng - dLng) < 0.0001) {
          map.setView([pLat, pLng], 15, { animate: true });
          return;
        }

        const bounds = L.latLngBounds([
          [pLat, pLng],
          [dLat, dLng],
        ]);

        if (bounds.isValid()) {
          // Fit both points with generous padding for top and bottom UI controls
          map.fitBounds(bounds, {
            paddingTopLeft: [50, 100],
            paddingBottomRight: [50, 180],
            maxZoom: 16,
            animate: true,
          });

          // Safeguard: Ensure zoom never drops below 11 (preventing whole world map)
          setTimeout(() => {
            if (mapRef.current) {
              const currentZoom = mapRef.current.getZoom();
              if (currentZoom < 11) {
                mapRef.current.setZoom(12);
              }
            }
          }, 250);
        }
      } catch (err) {
        console.warn('fitBounds error for pickup/drop:', err);
      }
    } else if (hasPickup && !hasDrop) {
      try {
        map.invalidateSize();
        map.setView([pickupPoint!.lat, pickupPoint!.lng], 15, { animate: true });
      } catch (err) {
        // ignore
      }
    }
  }, [pickupPoint?.lat, pickupPoint?.lng, dropPoint?.lat, dropPoint?.lng]);

  // Update Live Assigned Driver Marker (Animated Gliding & Real-time GPS Tracking)
  useEffect(() => {
    if (!mapRef.current) return;
    if (driverMarkerCoords) {
      if (!assignedDriverMarkerRef.current) {
        assignedDriverMarkerRef.current = L.marker(driverMarkerCoords, {
          icon: createBikeIcon(driverHeading, true),
          zIndexOffset: 300,
        }).addTo(mapRef.current);
      } else {
        assignedDriverMarkerRef.current.setLatLng(driverMarkerCoords);
        assignedDriverMarkerRef.current.setIcon(createBikeIcon(driverHeading, true));
      }
    } else if (assignedDriverMarkerRef.current) {
      assignedDriverMarkerRef.current.remove();
      assignedDriverMarkerRef.current = null;
    }
  }, [driverMarkerCoords, driverHeading]);

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

      // Fit bounds nicely without excessive zoom out
      try {
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, {
            paddingTopLeft: [50, 100],
            paddingBottomRight: [50, 180],
            maxZoom: 16,
            animate: true,
          });
          setTimeout(() => {
            if (mapRef.current && mapRef.current.getZoom() < 12) {
              mapRef.current.setZoom(12);
            }
          }, 250);
        }
      } catch (e) {
        // ignore bounds fit error
      }
    }
  }, [routePoints]);

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current && mapRef.current.getZoom() > 10) {
      mapRef.current.zoomOut();
    }
  };

  const handleRecenter = () => {
    if (mapRef.current) {
      if (pickupPoint && dropPoint) {
        const bounds = L.latLngBounds([
          [pickupPoint.lat, pickupPoint.lng],
          [dropPoint.lat, dropPoint.lng],
        ]);
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, {
            paddingTopLeft: [50, 100],
            paddingBottomRight: [50, 180],
            maxZoom: 16,
            animate: true,
          });
          return;
        }
      }
      const target = userCoords || center;
      mapRef.current.setView(target, 15);
    }
  };

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />

      {/* Mobile Touch Zoom Controls (+ / − / 🎯) */}
      <div className="absolute right-3 top-28 z-[999] flex flex-col gap-2.5 pointer-events-auto">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-11 h-11 rounded-2xl bg-slate-900/95 text-white border-2 border-slate-700 shadow-2xl flex items-center justify-center font-black text-2xl active:scale-90 hover:bg-slate-800 cursor-pointer"
          aria-label="Zoom In"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-11 h-11 rounded-2xl bg-slate-900/95 text-white border-2 border-slate-700 shadow-2xl flex items-center justify-center font-black text-2xl active:scale-90 hover:bg-slate-800 cursor-pointer"
          aria-label="Zoom Out"
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          className="w-11 h-11 rounded-2xl bg-slate-900/95 text-amber-400 border-2 border-slate-700 shadow-2xl flex items-center justify-center active:scale-90 hover:bg-slate-800 cursor-pointer text-lg font-bold"
          aria-label="Recenter GPS"
          title="वर्तमान स्थान"
        >
          🎯
        </button>
      </div>
    </div>
  );
};
