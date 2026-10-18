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
} from 'lucide-react';
import { CustomerProfile, DriverProfile, RideRequest, LocationPoint } from '../types';
import { store } from '../services/store';
import { LeafletMap } from './LeafletMap';

interface CustomerViewProps {
  user: CustomerProfile;
  userCoords: [number, number];
  onSwitchRole?: () => void;
  onOpenInstall?: () => void;
  onBackToHome?: () => void;
}

// Popular Quick Landmarks for Fast Indian City Booking
const PRESET_PLACES = [
  { name: 'Metro Station Gate 2', latOffset: 0.012, lngOffset: 0.009 },
  { name: 'Central Railway Station', latOffset: -0.018, lngOffset: 0.015 },
  { name: 'Sector 18 Market', latOffset: 0.008, lngOffset: -0.012 },
  { name: 'District Hospital / Mall', latOffset: -0.011, lngOffset: -0.008 },
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

  // Input states
  const [pickupText, setPickupText] = useState('मेरी वर्तमान लोकेशन (Current GPS)');
  const [dropText, setDropText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<LocationPoint>({
    name: 'Current Location',
    lat: userCoords[0],
    lng: userCoords[1],
  });
  const [dropCoords, setDropCoords] = useState<LocationPoint | null>(null);

  // ETA Countdown state
  const [etaSeconds, setEtaSeconds] = useState<number>(360); // 6 mins default
  const [driverSimCoords, setDriverSimCoords] = useState<[number, number] | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);

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

  // Update pickup when user GPS moves if not booked
  useEffect(() => {
    if (!activeRide) {
      setPickupCoords({
        name: 'My GPS Location',
        lat: userCoords[0],
        lng: userCoords[1],
      });
    }
  }, [userCoords[0], userCoords[1], activeRide]);

  // Handle Drop Location Selection
  const selectPresetDrop = (place: (typeof PRESET_PLACES)[0]) => {
    const drop: LocationPoint = {
      name: place.name,
      lat: userCoords[0] + place.latOffset,
      lng: userCoords[1] + place.lngOffset,
    };
    setDropCoords(drop);
    setDropText(place.name);
  };

  // Calculate Distance & Fare (Standard Bike Taxi fare: ₹20 base + ₹9/km)
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
      selectPresetDrop(PRESET_PLACES[0]);
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

    // If no driver accepts in 4 seconds in simulator, auto-assign first available mock driver for preview demo
    setTimeout(() => {
      const current = store.getActiveRide();
      if (current && current.status === 'searching') {
        const drivers = store.getDrivers().filter((d) => d.isDutyOn && !d.isRestricted);
        if (drivers.length > 0) {
          const autoDriver = drivers[0];
          store.driverAcceptRide(autoDriver.id);
        }
      }
    }, 3500);
  };

  // Automated Movement Simulation when In-Trip or Arrived
  useEffect(() => {
    if (!activeRide) {
      setDriverSimCoords(null);
      setRoutePolyline(null);
      return;
    }

    if (activeRide.status === 'accepted') {
      // Route from driver coords to pickup coords
      const dCoords = activeRide.driverCoords || [pickupCoords.lat + 0.008, pickupCoords.lng + 0.006];
      setDriverSimCoords(dCoords);
      setRoutePolyline([dCoords, [pickupCoords.lat, pickupCoords.lng]]);

      // Simulate driver driving to pickup
      const timer = setTimeout(() => {
        store.driverArrivedAtPickup();
      }, 5000);
      return () => clearTimeout(timer);
    }

    if (activeRide.status === 'arrived') {
      setDriverSimCoords([pickupCoords.lat, pickupCoords.lng]);
      if (activeRide.drop) {
        setRoutePolyline([[pickupCoords.lat, pickupCoords.lng], [activeRide.drop.lat, activeRide.drop.lng]]);
      }
    }

    if (activeRide.status === 'in_trip') {
      // Countdown clock ticking down ETA
      const interval = setInterval(() => {
        setEtaSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });

        // Gently step the motorcycle icon along the path towards drop location
        if (activeRide.drop) {
          setDriverSimCoords((curr) => {
            const targetLat = activeRide.drop.lat;
            const targetLng = activeRide.drop.lng;
            const curLat = curr ? curr[0] : pickupCoords.lat;
            const curLng = curr ? curr[1] : pickupCoords.lng;
            const nextLat = curLat + (targetLat - curLat) * 0.04;
            const nextLng = curLng + (targetLng - curLng) * 0.04;
            return [nextLat, nextLng];
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeRide?.status]);

  const { km, fare } = calculateFareEstimate();

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* 1. TOP HEADER & SEARCH / PICKUP-DROP INPUTS */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-3 pointer-events-none">
        <div className="max-w-md mx-auto space-y-2 pointer-events-auto">
          {/* Brand & Mode Strip */}
          <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-750 shadow-xl">
            <div className="flex items-center gap-2">
              {onBackToHome && (
                <button
                  onClick={onBackToHome}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition flex items-center justify-center cursor-pointer"
                  title="मुख्य पेज पर वापस जाएं (Back to Home)"
                  aria-label="Back to Home"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
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
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition"
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

          {/* Pickup Point & Drop Point Fields (Top section as requested) */}
          {!activeRide && (
            <div className="bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-750 shadow-2xl space-y-2.5">
              {/* Pickup Field */}
              <div className="relative flex items-center">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mr-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    पिकअप लोकेशन (Pickup Point)
                  </span>
                  <input
                    type="text"
                    value={pickupText}
                    onChange={(e) => setPickupText(e.target.value)}
                    placeholder="Enter pickup point"
                    className="w-full bg-transparent text-xs font-semibold text-white placeholder-slate-400 outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    setPickupCoords({
                      name: 'Current Location',
                      lat: userCoords[0],
                      lng: userCoords[1],
                    });
                    setPickupText('मेरी वर्तमान लोकेशन (Current GPS)');
                  }}
                  className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800"
                  title="Current GPS"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              </div>

              <div className="h-px bg-slate-800 ml-9 mr-2" />

              {/* Drop Field */}
              <div className="relative flex items-center">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mr-2.5">
                  <MapPin className="w-4 h-4 text-rose-400" />
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    ड्रॉप लोकेशन (Drop Point)
                  </span>
                  <input
                    type="text"
                    value={dropText}
                    onChange={(e) => {
                      setDropText(e.target.value);
                      if (!dropCoords) {
                        selectPresetDrop(PRESET_PLACES[0]);
                      }
                    }}
                    placeholder="कहाँ जाना है? (Where to drop?)"
                    className="w-full bg-transparent text-xs font-semibold text-white placeholder-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* Quick Preset Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-[11px]">
                {PRESET_PLACES.map((place, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectPresetDrop(place)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 hover:text-white hover:border-amber-500/50 transition cursor-pointer"
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC FULL-SCREEN LEAFLET MAP VIEWPORT (Section 4 Free OSM Tiles) */}
      <div className="flex-1 w-full h-full relative">
        <LeafletMap
          center={userCoords}
          userCoords={userCoords}
          userRole="customer"
          activeDrivers={activeDrivers}
          pickupPoint={activeRide ? activeRide.pickup : pickupCoords}
          dropPoint={activeRide ? activeRide.drop : dropCoords}
          driverMarkerCoords={driverSimCoords}
          routePoints={routePolyline}
        />

        {/* Nearby Drivers Count Badge */}
        {!activeRide && (
          <div className="absolute top-48 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-750 shadow-md text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5" />
            <span>{activeDrivers.length} बाइक चालक उपलब्ध (Nearby)</span>
          </div>
        )}
      </div>

      {/* 3. BOTTOM RIDE CONTROL / STATUS VIEWPORTS */}
      <div className="relative z-30 p-3 pb-5 bg-slate-900/95 border-t border-slate-800 shadow-2xl backdrop-blur-md">
        <div className="max-w-md mx-auto">
          {!activeRide ? (
            /* Idle Booking View: Fare Preview + Book Ride Button */
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-850 border border-slate-750">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">BharatRaide Moto</h4>
                    <p className="text-[11px] text-slate-400">
                      दूरी: ~{km} KM • 12% + ₹3 कम कमीशन
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-black text-amber-400 font-mono">₹{fare}</div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    CASH DIRECT
                  </span>
                </div>
              </div>

              {/* SECTION 3: Large "Book Ride" Button */}
              <button
                onClick={handleBookRide}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-base shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Bike className="w-5 h-5 stroke-[2.5]" />
                <span>Book Ride (राइड बुक करें - ₹{fare})</span>
              </button>
            </div>
          ) : activeRide.status === 'searching' ? (
            /* SEARCHING DRIVER STATE */
            <div className="text-center py-3 space-y-3">
              <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 animate-bounce">
                <Bike className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">नजदीकी ड्राइवर खोज रहे हैं...</h4>
              <p className="text-xs text-slate-400">2-3 KM दायरे में मौजूद राइडर्स को रिक्वेस्ट भेजी जा रही है</p>
              <button
                onClick={() => store.cancelRide()}
                className="py-2 px-4 rounded-xl bg-slate-800 text-xs font-semibold text-rose-400 border border-slate-700"
              >
                राइड रद्द करें (Cancel)
              </button>
            </div>
          ) : activeRide.status === 'accepted' ? (
            /* DRIVER ASSIGNED & COMING TO PICKUP */
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-850 border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    चालक आ रहा है (Driver on the way)
                  </span>
                  <h4 className="text-base font-black text-white">{activeRide.driverName}</h4>
                  <p className="text-xs text-slate-300 font-mono">
                    {activeRide.driverVehicle} • {activeRide.driverVehicleNumber}
                  </p>
                </div>
                <a
                  href={`tel:${activeRide.driverPhone}`}
                  className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center"
                >
                  <Phone className="w-5 h-5" />
                </a>
              </div>

              {/* Prominent Cancel Ride Button */}
              <button
                type="button"
                onClick={() => {
                  store.cancelRide();
                  store.clearActiveRide();
                  setActiveRide(null);
                }}
                className="w-full py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border-2 border-rose-500 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
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
                className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 transition"
              >
                सवारी शुरू करें (Test: Start Ride with OTP)
              </button>
            </div>
          ) : activeRide.status === 'in_trip' ? (
            /* SECTION 7: LIVE DROP LOCATION TRACKING & ETA COUNTDOWN */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">
                      ड्रॉप का अनुमानित समय (ETA)
                    </span>
                    <div className="text-lg font-black text-white font-mono">
                      {Math.floor(etaSeconds / 60)}m {etaSeconds % 60}s
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-medium">कुल किराया (Fare)</span>
                  <div className="text-lg font-black text-amber-400 font-mono">₹{activeRide.fare}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>सफर जारी है: {activeRide.drop.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    store.cancelRide();
                    store.clearActiveRide();
                    setActiveRide(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-400 font-bold text-xs border border-slate-700 transition"
                >
                  सफर रद्द करें
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.completeRide();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition"
                >
                  सफर समाप्त (End Ride)
                </button>
              </div>
            </div>
          ) : activeRide.status === 'completed' ? (
            /* SECTION 9: CASH FARE FLASH ON CUSTOMER SCREEN */
            <div className="p-5 rounded-3xl bg-slate-850 border-2 border-emerald-500 shadow-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>

              <h4 className="text-lg font-black text-white">सफर समाप्त हुआ (Ride Completed)</h4>
              <p className="text-xs text-slate-300">
                कृपया ड्राइवर को पूरा किराया नकद (CASH) में दें:
              </p>

              {/* Total Cash Fare Flash */}
              <div className="py-3 px-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 inline-block">
                <span className="text-xs text-emerald-400 font-bold block">देय नकद राशि (Cash to Pay)</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">₹{activeRide.fare}</span>
              </div>

              <button
                onClick={() => {
                  store.clearActiveRide();
                  setActiveRide(null);
                  setDropCoords(null);
                  setDropText('');
                }}
                className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
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
