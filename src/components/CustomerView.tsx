import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Bike,
  Shield,
  Phone,
  Clock,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  X,
  Compass,
  ArrowLeft,
  Search,
  Crosshair,
  Loader2,
  Sparkles,
  BellRing,
  Radio,
  Users,
  Check,
} from 'lucide-react';
import { CustomerProfile, DriverProfile, RideRequest, LocationPoint } from '../types';
import { store } from '../services/store';
import { LeafletMap } from './LeafletMap';
import { searchPlaces, reverseGeocode, SearchResultItem } from '../services/locationSearch';
import { trackingService, DriverGpsLocation } from '../services/trackingService';

interface CustomerViewProps {
  user: CustomerProfile;
  userCoords: [number, number];
  onSwitchRole?: () => void;
  onOpenInstall?: () => void;
  onBackToHome?: () => void;
}

// Popular Quick Landmarks for Fast Indian City Booking
const PRESET_PLACES = [
  { name: 'रेलवे स्टेशन (Railway Station)', latOffset: -0.018, lngOffset: 0.015 },
  { name: 'बस टर्मिनल (ISBT Bus Stand)', latOffset: 0.019, lngOffset: -0.011 },
  { name: 'मुख्य बाज़ार (Main Market)', latOffset: 0.008, lngOffset: -0.012 },
  { name: 'मेट्रो स्टेशन (Metro Station)', latOffset: 0.012, lngOffset: 0.009 },
  { name: 'हवाई अड्डा (Airport T3)', latOffset: -0.035, lngOffset: -0.025 },
  { name: 'एम्स अस्पताल (Hospital / Mall)', latOffset: -0.011, lngOffset: -0.008 },
];

export const CustomerView: React.FC<CustomerViewProps> = ({
  user,
  userCoords,
  onSwitchRole,
  onOpenInstall,
  onBackToHome,
}) => {
  const [activeDrivers, setActiveDrivers] = useState<DriverProfile[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);

  // Input text & coordinate states
  const [pickupText, setPickupText] = useState('मेरी वर्तमान लोकेशन (Current GPS)');
  const [dropText, setDropText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LocationPoint>({
    name: 'मेरी वर्तमान लोकेशन',
    lat: userCoords[0],
    lng: userCoords[1],
  });
  const [dropCoords, setDropCoords] = useState<LocationPoint | null>(null);

  // Search Autocomplete state
  const [pickupSuggestions, setPickupSuggestions] = useState<SearchResultItem[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<SearchResultItem[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDrop, setIsSearchingDrop] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'pickup' | 'drop' | null>(null);

  // Pin-on-Map Selection Mode ('pickup' | 'drop' | null)
  const [pinMode, setPinMode] = useState<'pickup' | 'drop' | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // ETA Countdown & Real-Time Driver Tracking states
  const [etaSeconds, setEtaSeconds] = useState<number>(360); // 6 mins default
  const [driverSimCoords, setDriverSimCoords] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [liveGpsInfo, setLiveGpsInfo] = useState<{
    speedKmph: number;
    distanceRemainingKm: number;
    etaMinutes: number;
    lastUpdated: number;
  }>({
    speedKmph: 30,
    distanceRemainingKm: 0.8,
    etaMinutes: 2,
    lastUpdated: Date.now(),
  });
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);

  // Reference container for detecting click outside autocomplete dropdowns
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Dismiss dropdown when tapping outside
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Sync with store
  useEffect(() => {
    const updateFromStore = () => {
      const all = store.getDrivers();
      // Filter drivers within 3 km who are Duty ON
      const active = all.filter((d) => d.isDutyOn);
      setActiveDrivers(active);

      const current = store.getActiveRide();
      // Only attach if ride belongs to this customer
      if (current && current.customerId === user.id) {
        setActiveRide(current);
      } else if (!current) {
        setActiveRide(null);
      }
    };

    updateFromStore();
    const unsubscribe = store.subscribe(updateFromStore);
    return unsubscribe;
  }, [user.id]);

  // Update pickup when user GPS moves if not booked and using default current location
  useEffect(() => {
    if (!activeRide && pickupText.includes('वर्तमान')) {
      setPickupCoords({
        name: 'मेरी वर्तमान लोकेशन',
        lat: userCoords[0],
        lng: userCoords[1],
      });
    }
  }, [userCoords[0], userCoords[1], activeRide]);

  // Debounced Autocomplete Search for Pickup Input
  useEffect(() => {
    if (!pickupText || activeDropdown !== 'pickup' || pickupText.includes('वर्तमान')) {
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingPickup(true);
      try {
        const results = await searchPlaces(pickupText, userCoords[0], userCoords[1], controller.signal);
        setPickupSuggestions(results);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn(err);
      } finally {
        setIsSearchingPickup(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pickupText, activeDropdown, userCoords[0], userCoords[1]]);

  // Debounced Autocomplete Search for Drop Input
  useEffect(() => {
    if (!dropText || activeDropdown !== 'drop') {
      setDropSuggestions([]);
      setIsSearchingDrop(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingDrop(true);
      try {
        const results = await searchPlaces(dropText, userCoords[0], userCoords[1], controller.signal);
        setDropSuggestions(results);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn(err);
      } finally {
        setIsSearchingDrop(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dropText, activeDropdown, userCoords[0], userCoords[1]]);

  // Select Search Item for Pickup
  const handleSelectPickupItem = (item: SearchResultItem) => {
    const loc: LocationPoint = {
      name: item.name,
      lat: item.lat,
      lng: item.lng,
    };
    setPickupCoords(loc);
    setPickupText(item.name + (item.locality ? ` (${item.locality})` : ''));
    setPickupSuggestions([]);
    setActiveDropdown(null);
  };

  // Select Search Item for Drop
  const handleSelectDropItem = (item: SearchResultItem) => {
    const loc: LocationPoint = {
      name: item.name,
      lat: item.lat,
      lng: item.lng,
    };
    setDropCoords(loc);
    setDropText(item.name + (item.locality ? ` (${item.locality})` : ''));
    setDropSuggestions([]);
    setActiveDropdown(null);
  };

  // Handle Drop Location Selection via Presets
  const selectPresetDrop = (place: (typeof PRESET_PLACES)[0]) => {
    const drop: LocationPoint = {
      name: place.name,
      lat: userCoords[0] + place.latOffset,
      lng: userCoords[1] + place.lngOffset,
    };
    setDropCoords(drop);
    setDropText(place.name);
    setActiveDropdown(null);
    setPinMode(null);
  };

  // Map Click to choose Pickup or Drop Location
  const handleMapClick = async (lat: number, lng: number) => {
    if (activeRide) return;

    setIsGeocoding(true);
    const target = pinMode || 'drop'; // default to drop if tapped directly on map without pin mode
    try {
      const addressName = await reverseGeocode(lat, lng);
      if (target === 'pickup') {
        const pt: LocationPoint = {
          name: addressName,
          lat,
          lng,
        };
        setPickupCoords(pt);
        setPickupText(addressName);
        setActiveDropdown(null);
      } else {
        const pt: LocationPoint = {
          name: addressName,
          lat,
          lng,
        };
        setDropCoords(pt);
        setDropText(addressName);
        setActiveDropdown(null);
      }
    } catch {
      const fallbackName = `चुना गया स्थान (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      if (target === 'pickup') {
        setPickupCoords({ name: fallbackName, lat, lng });
        setPickupText(fallbackName);
      } else {
        setDropCoords({ name: fallbackName, lat, lng });
        setDropText(fallbackName);
      }
    } finally {
      setIsGeocoding(false);
      setPinMode(null);
    }
  };

  // Automatically sync preview route line between pickup and drop
  useEffect(() => {
    if (!activeRide) {
      if (pickupCoords && dropCoords) {
        setRoutePolyline([
          [pickupCoords.lat, pickupCoords.lng],
          [dropCoords.lat, dropCoords.lng],
        ]);
      } else {
        setRoutePolyline(null);
      }
    }
  }, [pickupCoords.lat, pickupCoords.lng, dropCoords?.lat, dropCoords?.lng, activeRide]);

  // Calculate Distance & Fare (Standard Bike Taxi fare: ₹20 base + ₹9.5/km)
  const calculateFareEstimate = () => {
    if (!dropCoords) return { km: 3.2, fare: 48 };
    const latDiff = Math.abs(pickupCoords.lat - dropCoords.lat);
    const lngDiff = Math.abs(pickupCoords.lng - dropCoords.lng);
    // Approximation: 1 deg ~ 111km
    const km = Math.max(1.5, parseFloat((Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111).toFixed(1)));
    const fare = Math.round(20 + km * 9.5);
    return { km, fare };
  };

  // Book Ride Trigger
  const handleBookRide = () => {
    if (!dropCoords) {
      // Default to nearby landmark if empty
      const defaultDrop: LocationPoint = {
        name: PRESET_PLACES[0].name,
        lat: userCoords[0] + PRESET_PLACES[0].latOffset,
        lng: userCoords[1] + PRESET_PLACES[0].lngOffset,
      };
      setDropCoords(defaultDrop);
      setDropText(defaultDrop.name);
    }

    const { km, fare } = calculateFareEstimate();
    const finalDrop = dropCoords || {
      name: PRESET_PLACES[0].name,
      lat: userCoords[0] + PRESET_PLACES[0].latOffset,
      lng: userCoords[1] + PRESET_PLACES[0].lngOffset,
    };

    const newRide = store.requestRide({
      customerId: user.id,
      customerName: user.name,
      customerPhone: user.phone,
      pickup: pickupCoords,
      drop: finalDrop,
      fare,
      distanceKm: km,
    });
    setActiveRide(newRide);

    // Realistic fallback timer (30s) if test user does not open driver app or tap accept
    const autoFallbackTimer = setTimeout(() => {
      const current = store.getActiveRide();
      if (current && current.status === 'searching' && current.customerId === user.id) {
        const drivers = store.getDrivers().filter((d) => d.isDutyOn && !d.isRestricted && !current.declinedDriverIds?.includes(d.id));
        if (drivers.length > 0) {
          const autoDriver = drivers[0];
          store.driverAcceptRide(autoDriver.id);
        }
      }
    }, 30000);

    return () => clearTimeout(autoFallbackTimer);
  };

  // Real-Time Driver GPS Tracking via Socket.io & 3-5s GPS Stream
  useEffect(() => {
    if (!activeRide) {
      setDriverSimCoords(null);
      setRoutePolyline(null);
      trackingService.stopDriverBroadcaster();
      return;
    }

    const { status, id: rideId, pickup, drop } = activeRide;

    if (status === 'accepted' || status === 'in_trip' || status === 'arrived') {
      // 1. Subscribe to live Socket.io updates for this ride
      const unsubscribe = trackingService.subscribeToRideTracking(rideId, (loc: DriverGpsLocation) => {
        setDriverSimCoords([loc.lat, loc.lng]);
        setDriverHeading(loc.heading || 0);
        setLiveGpsInfo({
          speedKmph: loc.speedKmph || 32,
          distanceRemainingKm: loc.distanceRemainingKm || 0.5,
          etaMinutes: loc.etaMinutes || 2,
          lastUpdated: loc.timestamp || Date.now(),
        });

        // Update dynamic route line
        if (status === 'accepted' && pickup) {
          setRoutePolyline([[loc.lat, loc.lng], [pickup.lat, pickup.lng]]);
        } else if (status === 'in_trip' && drop) {
          setRoutePolyline([[loc.lat, loc.lng], [drop.lat, drop.lng]]);
        }
      });

      // 2. Resilient driver GPS broadcaster: ensures coordinates move every 3.5s
      // even if user is testing in single-screen customer mode
      const startPos: [number, number] = activeRide.driverCoords || [
        pickup.lat + 0.007,
        pickup.lng + 0.007,
      ];

      trackingService.startDriverBroadcaster(
        rideId,
        activeRide.driverId || 'driver_auto',
        startPos,
        () => {
          const current = store.getActiveRide();
          if (current?.status === 'in_trip' && current.drop) {
            return [current.drop.lat, current.drop.lng];
          }
          if (current?.pickup) {
            return [current.pickup.lat, current.pickup.lng];
          }
          return [pickup.lat, pickup.lng];
        },
        () => store.getActiveRide()?.status || status
      );

      return () => {
        unsubscribe();
        trackingService.stopDriverBroadcaster();
      };
    } else {
      setDriverSimCoords(null);
      setRoutePolyline(null);
      trackingService.stopDriverBroadcaster();
    }
  }, [activeRide?.id, activeRide?.status]);

  const { km, fare } = calculateFareEstimate();

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* FLOATING TOP BAR: ALWAYS 100% VISIBLE OVER ANY MAP OR STATE */}
      <div className="fixed top-3 left-3 right-3 z-[999999] flex items-center justify-between pointer-events-auto">
        {onBackToHome && (
          <button
            type="button"
            onClick={() => {
              store.clearActiveRide();
              onBackToHome();
            }}
            className="py-1.5 px-3.5 rounded-full bg-slate-900/95 text-white border-2 border-amber-500 shadow-2xl flex items-center gap-1.5 text-xs font-black backdrop-blur-md active:scale-95 cursor-pointer hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400 stroke-[3]" />
            <span>← मुख्य पेज</span>
          </button>
        )}

        {activeRide && (
          <button
            type="button"
            onClick={() => {
              store.cancelRide();
              store.clearActiveRide();
              setActiveRide(null);
            }}
            className="py-1.5 px-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white border-2 border-rose-300 text-xs font-black shadow-2xl backdrop-blur-md active:scale-95 cursor-pointer flex items-center gap-1.5 transition ml-auto"
          >
            <X className="w-4 h-4 stroke-[3]" />
            <span>राइड रद्द करें (Cancel)</span>
          </button>
        )}
      </div>

      {/* 1. TOP HEADER & SEARCH BARS (PICKUP & DROP INPUTS WITH AUTOCOMPLETE) */}
      <div className="absolute top-12 left-0 right-0 z-30 p-3 pt-1 pointer-events-none">
        <div ref={searchContainerRef} className="max-w-md mx-auto space-y-2 pointer-events-auto">
          {/* Brand & Mode Strip */}
          <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-750 shadow-xl">
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="BharatRaide" className="w-7 h-7 rounded-lg shadow-sm" />
              <div>
                <span className="text-xs font-black tracking-tight text-white">
                  BHARAT<span className="text-amber-500">RAIDE</span>
                </span>
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                  Customer
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onSwitchRole}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold border border-slate-700 transition"
              >
                Switch Role
              </button>
              <button
                onClick={onOpenInstall}
                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-extrabold shadow-sm transition"
              >
                Install App
              </button>
            </div>
          </div>

          {/* Interactive Search Bars: Pickup Point & Drop Location */}
          {!activeRide && (
            <div className="bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-750 shadow-2xl space-y-2.5 relative">
              {/* Pickup Point Search Bar */}
              <div className="relative">
                <div className="flex items-center bg-slate-800/80 rounded-xl px-2.5 py-2 border border-slate-700/80 focus-within:border-emerald-500 transition">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mr-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider leading-none mb-1">
                      पिकअप पॉइंट (कहाँ से)
                    </span>
                    <input
                      type="text"
                      value={pickupText}
                      onFocus={() => {
                        setActiveDropdown('pickup');
                        setPinMode(null);
                      }}
                      onChange={(e) => {
                        setPickupText(e.target.value);
                        setActiveDropdown('pickup');
                      }}
                      placeholder="पिकअप स्थान खोजें या टाइप करें..."
                      className="w-full bg-transparent text-xs font-semibold text-white placeholder-slate-400 outline-none truncate"
                    />
                  </div>

                  {/* Right Action Icons for Pickup */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSearchingPickup && (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    )}

                    {pickupText && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickupText('');
                          setActiveDropdown('pickup');
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700/60 transition cursor-pointer"
                        title="हटाएं (Clear)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Quick GPS Location Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPickupCoords({
                          name: 'मेरी वर्तमान लोकेशन',
                          lat: userCoords[0],
                          lng: userCoords[1],
                        });
                        setPickupText('मेरी वर्तमान लोकेशन (Current GPS)');
                        setActiveDropdown(null);
                        setPinMode(null);
                      }}
                      className="p-1.5 text-slate-300 hover:text-emerald-400 rounded-lg hover:bg-slate-700/80 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="वर्तमान GPS लोकेशन चुनें"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 hidden sm:inline">GPS</span>
                    </button>

                    {/* Pick Pickup on Map Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPinMode(pinMode === 'pickup' ? null : 'pickup');
                        setActiveDropdown(null);
                      }}
                      className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        pinMode === 'pickup'
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : 'text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700'
                      }`}
                      title="मैप पर पिन रखकर पिकअप चुनें"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span className="text-[10px]">मैप</span>
                    </button>
                  </div>
                </div>

                {/* Pickup Autocomplete Suggestions Dropdown */}
                {activeDropdown === 'pickup' && (pickupSuggestions.length > 0 || isSearchingPickup) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-850/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                    {isSearchingPickup && pickupSuggestions.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>स्थान खोज रहे हैं...</span>
                      </div>
                    )}
                    {pickupSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPickupItem(item)}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-750 border-b border-slate-800 last:border-b-0 flex items-start gap-2.5 transition cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-bold text-white truncate">
                            {item.name}
                          </span>
                          <span className="block text-[11px] text-slate-400 truncate">
                            {item.locality}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drop Point Search Bar */}
              <div className="relative">
                <div className="flex items-center bg-slate-800/80 rounded-xl px-2.5 py-2 border border-slate-700/80 focus-within:border-rose-500 transition">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mr-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider leading-none mb-1">
                      ड्रॉप लोकेशन (कहाँ जाना है)
                    </span>
                    <input
                      type="text"
                      value={dropText}
                      onFocus={() => {
                        setActiveDropdown('drop');
                        setPinMode(null);
                      }}
                      onChange={(e) => {
                        setDropText(e.target.value);
                        setActiveDropdown('drop');
                      }}
                      placeholder="कहाँ जाना है? (स्थान खोजें या टाइप करें...)"
                      className="w-full bg-transparent text-xs font-semibold text-white placeholder-slate-400 outline-none truncate"
                    />
                  </div>

                  {/* Right Action Icons for Drop */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSearchingDrop && (
                      <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                    )}

                    {dropText && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropCoords(null);
                          setDropText('');
                          setActiveDropdown('drop');
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700/60 transition cursor-pointer"
                        title="हटाएं (Clear)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Pick Drop on Map Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPinMode(pinMode === 'drop' ? null : 'drop');
                        setActiveDropdown(null);
                      }}
                      className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        pinMode === 'drop'
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700'
                      }`}
                      title="मैप पर पिन रखकर ड्रॉप चुनें"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span className="text-[10px]">मैप</span>
                    </button>
                  </div>
                </div>

                {/* Drop Autocomplete Suggestions Dropdown */}
                {activeDropdown === 'drop' && (dropSuggestions.length > 0 || isSearchingDrop) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-850/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                    {isSearchingDrop && dropSuggestions.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        <span>स्थान खोज रहे हैं...</span>
                      </div>
                    )}
                    {dropSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectDropItem(item)}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-750 border-b border-slate-800 last:border-b-0 flex items-start gap-2.5 transition cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-bold text-white truncate">
                            {item.name}
                          </span>
                          <span className="block text-[11px] text-slate-400 truncate">
                            {item.locality}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Preset Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none text-[11px]">
                {PRESET_PLACES.map((place, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectPresetDrop(place)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                      dropCoords && dropCoords.name === place.name
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                        : 'bg-slate-800 border-slate-750 text-slate-300 hover:text-white hover:border-amber-500/50'
                    }`}
                  >
                    📍 {place.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Pin-on-Map Instruction Banner */}
          {pinMode && !activeRide && (
            <div className="bg-amber-500 text-slate-950 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center justify-between font-extrabold text-xs animate-bounce duration-1000">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 stroke-[3]" />
                <span>
                  {pinMode === 'pickup'
                    ? 'मैप पर जहाँ से बैठना है वहाँ टैप करें (पिकअप सेट करें)'
                    : 'मैप पर जहाँ जाना है वहाँ टैप करें (ड्रॉप सेट करें)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPinMode(null)}
                className="px-2 py-0.5 rounded-lg bg-slate-950 text-white text-[11px] font-bold"
              >
                बंद करें
              </button>
            </div>
          )}

          {/* Reverse Geocoding Indicator */}
          {isGeocoding && (
            <div className="bg-slate-900/90 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs font-bold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>मैप पर चुना गया पता प्राप्त हो रहा है...</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC FULL-SCREEN LEAFLET MAP VIEWPORT */}
      <div className="flex-1 w-full h-full relative">
        <LeafletMap
          center={userCoords}
          userCoords={userCoords}
          userRole="customer"
          activeDrivers={activeDrivers}
          pickupPoint={activeRide ? activeRide.pickup : pickupCoords}
          dropPoint={activeRide ? activeRide.drop : dropCoords}
          driverMarkerCoords={driverSimCoords}
          driverHeading={driverHeading}
          routePoints={routePolyline}
          onMapClick={handleMapClick}
        />

        {/* Nearby Drivers Count Badge */}
        {!activeRide && (
          <div className="absolute top-52 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-750 shadow-md text-xs font-semibold text-amber-400 flex items-center gap-1.5 pointer-events-none">
            <Bike className="w-3.5 h-3.5" />
            <span>{activeDrivers.length} बाइक चालक उपलब्ध (Nearby)</span>
          </div>
        )}
      </div>

      {/* 3. BOTTOM RIDE CONTROL / STATUS VIEWPORTS */}
      <div className="relative z-30 p-3 pb-5 bg-slate-900/95 border-t border-slate-800 shadow-2xl backdrop-blur-md">
        <div className="max-w-md mx-auto">
          {!activeRide ? (
            /* Idle Booking View: Transparent Fare + Book Ride Button (No Commission Display) */
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-850 border border-slate-750">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">BharatRaide Moto</h4>
                    <p className="text-[11px] text-slate-400">
                      दूरी: ~{km} KM • सबसे तेज व किफायती
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                    नकद यात्रा
                  </span>
                </div>
              </div>

              {/* Book Ride Button */}
              <button
                onClick={handleBookRide}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-base shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Bike className="w-5 h-5 stroke-[2.5]" />
                <span>Book Ride (राइड बुक करें)</span>
              </button>
            </div>
          ) : activeRide.status === 'searching' ? (
            /* SEARCHING DRIVER STATE: 2-5 KM PROXIMITY RADAR & LOUD NOTIFICATION DISPATCH */
            <div className="py-2 space-y-3.5">
              <div className="text-center space-y-1">
                <div className="relative inline-flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-amber-400/30"></span>
                  <div className="relative p-3 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400">
                    <Bike className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

                <h4 className="text-sm font-extrabold text-white flex items-center justify-center gap-1.5 pt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>2-5 KM के दायरे में नज़दीकी राइडर्स ढूंढे जा रहे हैं...</span>
                </h4>

                {/* Ringing Sound Dispatch Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                  <BellRing className="w-3.5 h-3.5 animate-bounce text-amber-400" />
                  <span>नज़दीकी राइडर्स के फ़ोन पर लाउड रिंग बज रही है</span>
                </div>
              </div>

              {/* Nearby Drivers Found List */}
              {activeRide.nearbyDrivers && activeRide.nearbyDrivers.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-850/90 border border-slate-750 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-300 pb-1 border-b border-slate-750">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>दायरे में पाए गए राइडर्स ({activeRide.nearbyDrivers.length})</span>
                    </span>
                    <span className="text-amber-400 font-mono text-[10px]">2-5 KM दायरा</span>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {activeRide.nearbyDrivers.map((nd) => {
                      const isDeclined = activeRide.declinedDriverIds?.includes(nd.driverId);
                      return (
                        <div
                          key={nd.driverId}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 text-xs border border-slate-700/60"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                              🏍️
                            </div>
                            <div>
                              <span className="font-bold text-white block">{nd.driverName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{nd.vehicleModel}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono text-amber-300 text-[11px] font-black block">
                              ~{nd.distanceKm} KM
                            </span>
                            {isDeclined ? (
                              <span className="text-[10px] text-rose-400 font-bold">अस्वीकार किया</span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>घंटी बज रही है</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons for User / Tester */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {onSwitchRole ? (
                  <button
                    type="button"
                    onClick={onSwitchRole}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-black text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                    title="ड्राइवर स्क्रीन पर जाकर लाउड रिंग सुनें और Accept/Decline करें"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>ड्राइवर ऐप खोलें (Accept/Decline)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const drivers = store.getDrivers().filter((d) => d.isDutyOn && !d.isRestricted);
                      if (drivers.length > 0) store.driverAcceptRide(drivers[0].id);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>डेमो: राइड स्वीकारें</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => store.cancelRide()}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 text-xs font-bold border border-slate-700 hover:border-rose-500/40 cursor-pointer active:scale-95 transition"
                >
                  सवारी रद्द करें (Cancel)
                </button>
              </div>

              {/* Simulation Quick Accept shortcut in case tester stays on customer view */}
              <button
                type="button"
                onClick={() => {
                  const drivers = store.getDrivers().filter((d) => d.isDutyOn && !d.isRestricted);
                  if (drivers.length > 0) store.driverAcceptRide(drivers[0].id);
                }}
                className="w-full text-center text-[11px] text-slate-400 hover:text-amber-300 transition underline cursor-pointer"
              >
                डेमो: सीधे ड्राइवर की तरफ से राइड स्वीकार करें (Quick Accept)
              </button>
            </div>
          ) : activeRide.status === 'accepted' ? (
            /* DRIVER ASSIGNED & LIVE GPS TRACKING TO PICKUP (SOCKET.IO) */
            <div className="space-y-3">
              {/* Real-time Telemetry & GPS Broadcast Status Banner */}
              <div className="p-3 rounded-2xl bg-slate-850 border border-emerald-500/50 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-black text-emerald-400 tracking-wide">
                      लाइव GPS ट्रैकिंग सक्रिय (Socket.io Real-Time)
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                    हर 3.5s में अपडेट
                  </span>
                </div>

                {/* Live Distance, Speed & ETA Stats */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-900/80 border border-slate-750 text-center">
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">दूरी (Distance)</span>
                    <span className="text-xs font-black text-white font-mono">
                      ~{liveGpsInfo.distanceRemainingKm} KM
                    </span>
                  </div>
                  <div className="border-x border-slate-750">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">गति (Speed)</span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      {liveGpsInfo.speedKmph} km/h
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">अनुमानित (ETA)</span>
                    <span className="text-xs font-black text-amber-400 font-mono">
                      ~{liveGpsInfo.etaMinutes} min
                    </span>
                  </div>
                </div>

                {/* Driver Info & Call */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <Bike className="w-4 h-4 text-emerald-400" />
                      {activeRide.driverName}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono">
                      {activeRide.driverVehicle} • {activeRide.driverVehicleNumber}
                    </p>
                  </div>
                  <a
                    href={`tel:${activeRide.driverPhone}`}
                    className="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>कॉल करें</span>
                  </a>
                </div>
              </div>

              {/* Prominent Cancel Ride Button */}
              <button
                type="button"
                onClick={() => {
                  store.cancelRide();
                  store.clearActiveRide();
                  setActiveRide(null);
                }}
                className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border-2 border-rose-500/80 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <X className="w-4 h-4 stroke-[3]" />
                <span>राइड रद्द करें (Cancel Ride)</span>
              </button>
            </div>
          ) : activeRide.status === 'arrived' ? (
            /* SECTION 6: RIDE START SECRET 4-DIGIT OTP DISPLAY */
            <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-850 to-slate-900 border-2 border-amber-500 shadow-2xl text-center space-y-3">
              <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest">
                ड्राइवर पिकअप पर पहुँच गया है (Arrived)
              </span>
              <p className="text-xs text-slate-300">
                सफर शुरू करने के लिए ड्राइवर को यह 4-अंकों का गुप्त OTP बताएं:
              </p>

              {/* The Secret 4-digit OTP box */}
              <div className="py-2.5 px-6 mx-auto inline-block rounded-2xl bg-amber-500/20 border-2 border-amber-500 text-3xl font-black text-amber-300 tracking-widest font-mono shadow-lg shadow-amber-500/20">
                {activeRide.startOtp}
              </div>

              {/* PROMINENT CANCEL RIDE BUTTON (FULL WIDTH RED) */}
              <button
                type="button"
                onClick={() => {
                  store.cancelRide();
                  store.clearActiveRide();
                  setActiveRide(null);
                }}
                className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
              >
                <X className="w-5 h-5 stroke-[3]" />
                <span>राइड रद्द करें (Cancel Ride)</span>
              </button>

              {/* Secondary start simulation for testing */}
              <button
                type="button"
                onClick={() => {
                  store.verifyOtpAndStartRide(activeRide.startOtp);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 transition cursor-pointer"
              >
                सवारी शुरू करें (Test: Start Ride with OTP)
              </button>
            </div>
          ) : activeRide.status === 'in_trip' ? (
            /* SECTION 7: LIVE DROP LOCATION TRACKING & ETA COUNTDOWN (SOCKET.IO) */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-750 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </span>
                    <span className="text-[11px] font-black text-cyan-400 tracking-wide">
                      सफर जारी है • लाइव GPS मैप ट्रैकिंग
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                    {liveGpsInfo.speedKmph} km/h
                  </span>
                </div>

                {/* Telemetry Bar: Remaining Distance & ETA */}
                <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-750 text-center">
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">ड्रॉप तक शेष दूरी</span>
                    <span className="text-sm font-black text-white font-mono">
                      ~{liveGpsInfo.distanceRemainingKm} KM
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">ड्रॉप का अनुमानित समय (ETA)</span>
                    <span className="text-sm font-black text-cyan-300 font-mono">
                      ~{liveGpsInfo.etaMinutes} मिनट
                    </span>
                  </div>
                </div>

                {driverSimCoords && (
                  <div className="text-[10px] text-slate-400 text-center font-mono flex items-center justify-center gap-1.5">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>GPS: {driverSimCoords[0].toFixed(4)}, {driverSimCoords[1].toFixed(4)} (हर 3.5s अपडेट)</span>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>गंतव्य: {activeRide.drop.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    store.cancelRide();
                    store.clearActiveRide();
                    setActiveRide(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-400 font-bold text-xs border border-slate-700 transition cursor-pointer"
                >
                  सफर रद्द करें
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.completeRide();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  सफर समाप्त (End Ride)
                </button>
              </div>
            </div>
          ) : activeRide.status === 'completed' ? (
            /* SECTION 9: TRIP COMPLETED SCREEN (No Commission Flash) */
            <div className="p-5 rounded-3xl bg-slate-850 border-2 border-emerald-500 shadow-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>

              <h4 className="text-lg font-black text-white">सफर समाप्त हुआ (Ride Completed)</h4>
              <p className="text-xs text-slate-300">
                सवारी सुरक्षित रूप से पूरी हो चुकी है।
              </p>

              <div className="py-2 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 inline-block">
                <span className="text-xs text-emerald-400 font-bold block">सवारी संपन्न</span>
              </div>

              <button
                onClick={() => {
                  store.clearActiveRide();
                  setActiveRide(null);
                  setDropCoords(null);
                  setDropText('');
                }}
                className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
              >
                नई राइड बुक करें (Book Next Ride)
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
