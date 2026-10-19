import React, { useState, useEffect } from 'react';
import {
  Power,
  Wallet,
  PlusCircle,
  Navigation,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  ShieldAlert,
  ArrowLeft,
  BellRing,
  Volume2,
  VolumeX,
  Check,
  X,
  Radio,
  Award,
  Sparkles,
} from 'lucide-react';
import { DriverProfile, RideRequest } from '../types';
import { store, calculateDistanceKm } from '../services/store';
import { soundService } from '../services/soundService';
import { trackingService, DriverGpsLocation } from '../services/trackingService';
import { LeafletMap } from './LeafletMap';
import { RazorpayModal } from './RazorpayModal';

interface DriverViewProps {
  driver: DriverProfile;
  driverCoords: [number, number];
  onOpenInstall?: () => void;
  onBackToHome?: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({
  driver: initialDriver,
  driverCoords,
  onOpenInstall,
  onBackToHome,
}) => {
  const [driver, setDriver] = useState<DriverProfile>(initialDriver);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [incomingRide, setIncomingRide] = useState<RideRequest | null>(null);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(soundService.getIsMuted());
  const [riderTab, setRiderTab] = useState<'dashboard' | 'map'>('dashboard');

  // OTP Input State for starting ride
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Trip completion summary modal
  const [completedSummary, setCompletedSummary] = useState<{
    fare: number;
    commission: number;
    net: number;
  } | null>(null);

  // Store synchronization & Loud Notification Ringtone trigger
  useEffect(() => {
    const syncState = () => {
      const drivers = store.getDrivers();
      const current = drivers.find((d) => d.id === initialDriver.id) || initialDriver;
      setDriver(current);

      const ride = store.getActiveRide();
      if (ride) {
        if (ride.driverId === current.id) {
          setActiveRide(ride);
          setIncomingRide(null);
          soundService.stopNotificationRing();
        } else if (
          ride.status === 'searching' &&
          current.isDutyOn &&
          !current.isRestricted &&
          !ride.declinedDriverIds?.includes(current.id)
        ) {
          // Check proximity to customer pickup: within 2-5 KM or in nearby list
          const distToPickup = calculateDistanceKm(
            driverCoords[0],
            driverCoords[1],
            ride.pickup.lat,
            ride.pickup.lng
          );
          const isNearby =
            (ride.nearbyDrivers && ride.nearbyDrivers.some((n) => n.driverId === current.id)) ||
            distToPickup <= 5.5;

          if (isNearby) {
            setIncomingRide(ride);
            // Trigger loud notification sound/ring if not already ringing
            soundService.startLoudNotificationRing();
          } else {
            setIncomingRide(null);
            soundService.stopNotificationRing();
          }
        } else {
          setIncomingRide(null);
          soundService.stopNotificationRing();
        }
      } else {
        setActiveRide(null);
        setIncomingRide(null);
        soundService.stopNotificationRing();
      }
    };

    syncState();
    const unsub = store.subscribe(syncState);
    return () => {
      unsub();
      soundService.stopNotificationRing();
    };
  }, [initialDriver.id, driverCoords[0], driverCoords[1]]);

  // Live GPS broadcast state (Socket.io)
  const [liveBroadcastLocation, setLiveBroadcastLocation] = useState<DriverGpsLocation | null>(null);

  // Keep driver position synced to store
  useEffect(() => {
    store.updateDriverLocation(driver.id, driverCoords[0], driverCoords[1]);
  }, [driverCoords[0], driverCoords[1], driver.id]);

  // Live Driver GPS Broadcaster via Socket.io every 3-5 seconds
  useEffect(() => {
    if (!activeRide || (activeRide.status !== 'accepted' && activeRide.status !== 'in_trip')) {
      trackingService.stopDriverBroadcaster();
      setLiveBroadcastLocation(null);
      return;
    }

    const currentPos = activeRide.driverCoords || driverCoords;

    trackingService.startDriverBroadcaster(
      activeRide.id,
      driver.id,
      currentPos,
      () => {
        const r = store.getActiveRide();
        if (r && r.status === 'in_trip' && r.drop) {
          return [r.drop.lat, r.drop.lng];
        }
        if (r && r.pickup) {
          return [r.pickup.lat, r.pickup.lng];
        }
        return [driverCoords[0], driverCoords[1]];
      },
      () => store.getActiveRide()?.status || activeRide.status,
      (loc) => {
        setLiveBroadcastLocation(loc);
      }
    );

    return () => {
      trackingService.stopDriverBroadcaster();
    };
  }, [activeRide?.id, activeRide?.status, driver.id]);

  // Toggle Duty
  const handleToggleDuty = () => {
    const nextState = !driver.isDutyOn;
    try {
      store.toggleDriverDuty(driver.id, nextState);
    } catch (err: any) {
      alert('ड्यूटी ऑन करने के लिए कृपया पहले वॉलेट रिचार्ज करें।');
    }
  };

  // Accept Ride (स्वीकार करें)
  const handleAcceptRide = () => {
    soundService.stopNotificationRing();
    if (!incomingRide) return;
    const accepted = store.driverAcceptRide(driver.id);
    if (accepted) {
      setActiveRide(accepted);
      setIncomingRide(null);
    }
  };

  // Decline Ride (अस्वीकार करें)
  const handleDeclineRide = () => {
    soundService.stopNotificationRing();
    if (incomingRide) {
      store.driverDeclineRide(driver.id);
    }
    setIncomingRide(null);
  };

  // Driver arrives at pickup
  const handleArriveAtPickup = () => {
    store.driverArrivedAtPickup();
  };

  // Verify Customer 4-digit OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) {
      setOtpError('कृपया ग्राहक का 4-अंकों का OTP दर्ज करें');
      return;
    }
    const success = store.verifyOtpAndStartRide(otpInput.trim());
    if (success) {
      setOtpError('');
      setOtpInput('');
    } else {
      setOtpError('अमान्य OTP! ग्राहक की स्क्रीन पर दिखा 4-अंकीय कोड दर्ज करें।');
    }
  };

  // Section 9: End Ride & Silently deduct (Fare * 0.12) + ₹3
  const handleEndRide = () => {
    const result = store.completeRide();
    if (result) {
      const net = parseFloat((result.fare - result.commission).toFixed(2));
      setCompletedSummary({
        fare: result.fare,
        commission: result.commission,
        net,
      });
      setActiveRide(null);
    }
  };

  // Razorpay Recharge Callback
  const handleRechargeSuccess = (amount: number, paymentId: string) => {
    store.rechargeDriverWallet(driver.id, amount, paymentId);
  };

  // Calculate dynamic routing points
  const getDriverRoutePoints = (): [number, number][] | null => {
    if (!activeRide) return null;
    if (activeRide.status === 'accepted') {
      return [driverCoords, [activeRide.pickup.lat, activeRide.pickup.lng]];
    }
    if (activeRide.status === 'in_trip') {
      return [[activeRide.pickup.lat, activeRide.pickup.lng], [activeRide.drop.lat, activeRide.drop.lng]];
    }
    return null;
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* FLOATING TOP BAR FOR DRIVER */}
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
            className="py-1.5 px-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white border-2 border-rose-300 text-xs font-black shadow-2xl backdrop-blur-md active:scale-95 cursor-pointer flex items-center gap-1.5 transition"
          >
            <span>राइड रद्द करें (Cancel)</span>
          </button>
        )}
      </div>

      {/* 1. TOP DRIVER CONTROL BAR (Duty ON/OFF Toggle + Wallet Balance) */}
      <div className="absolute top-12 left-0 right-0 z-30 p-3 pt-1 pointer-events-none">
        <div className="max-w-md mx-auto space-y-2 pointer-events-auto">
          {/* Main Top Header Strip */}
          <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-750 shadow-2xl flex items-center justify-between">
            {/* Duty ON/OFF Switch & Logout Button */}
            <div className="flex items-center gap-1.5">
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
                  title="लॉगआउट करें (Logout)"
                  aria-label="Logout"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>लॉगआउट</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleDuty}
                disabled={driver.walletBalance < 0 && !driver.isDutyOn}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shadow-md ${
                  driver.isDutyOn
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <Power className={`w-3.5 h-3.5 stroke-[3] ${driver.isDutyOn ? 'animate-pulse' : ''}`} />
                <span>{driver.isDutyOn ? 'DUTY ON' : 'DUTY OFF'}</span>
              </button>
            </div>

            {/* Driver Wallet Balance in Bold Numeric Font & Recharge Button */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">वॉलेट (Wallet)</span>
                <span
                  className={`text-base font-black font-mono tracking-tight ${
                    driver.walletBalance < 0 ? 'text-rose-400 font-extrabold' : 'text-emerald-400'
                  }`}
                >
                  ₹{driver.walletBalance.toFixed(2)}
                </span>
              </div>

              {/* Dedicated "Recharge Wallet" button tied to Razorpay */}
              <button
                type="button"
                onClick={() => setIsRazorpayOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md shadow-orange-500/20 cursor-pointer active:scale-95 transition"
              >
                <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Recharge</span>
              </button>
            </div>
          </div>

          {/* Balance Alert Banner without showing commission or charges */}
          {driver.walletBalance < 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>ड्यूटी शुरू करने के लिए वॉलेट रिचार्ज करें</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRazorpayOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold"
              >
                Recharge
              </button>
            </div>
          )}

          {/* Driver Vehicle Pill info & Test Loud Ring button */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <span className="truncate mr-2">
              राइडर: <strong className="text-white">{driver.name}</strong> • {driver.vehicleModel}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-amber-400 font-bold">{driver.vehicleNumber}</span>
              <button
                type="button"
                onClick={() => soundService.playSingleChime(1.0)}
                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                title="लाउड नोटिफिकेशन घंटी बजाकर चेक करें"
              >
                <BellRing className="w-3 h-3 text-amber-400" />
                <span>टेस्ट रिंग</span>
              </button>
            </div>
          </div>

          {/* Tab Switcher: Earning Dashboard vs Live Map (when not in active trip) */}
          {!activeRide && (
            <div className="flex items-center p-1 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl pointer-events-auto">
              <button
                type="button"
                onClick={() => setRiderTab('dashboard')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  riderTab === 'dashboard'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>कमाई डैशबोर्ड (Earnings)</span>
              </button>
              <button
                type="button"
                onClick={() => setRiderTab('map')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  riderTab === 'map'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>लाइव मैप (Map)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN VIEWPORT: ACTIVE RIDE / EARNING DASHBOARD / LEAFLET MAP */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {!activeRide && riderTab === 'dashboard' ? (
          /* SECTION: RIDER EARNING DASHBOARD */
          <div className="flex-1 w-full overflow-y-auto pt-48 pb-12 px-3.5 max-w-md mx-auto space-y-3.5">
            {/* Duty Status Hero Card */}
            <div
              className={`p-4 rounded-3xl border-2 transition shadow-xl ${
                driver.isDutyOn
                  ? 'bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/50 shadow-emerald-500/10'
                  : 'bg-slate-850/90 border-slate-750'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      driver.isDutyOn
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Power className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      ड्यूटी स्थिति (Duty Status)
                    </span>
                    <h3 className={`text-base font-black ${driver.isDutyOn ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {driver.isDutyOn ? '🟢 ड्यूटी ऑन (Duty ON)' : '⚪ ड्यूटी ऑफ़ (Duty OFF)'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleDuty}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-md transition cursor-pointer active:scale-95 ${
                    driver.isDutyOn
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {driver.isDutyOn ? 'ड्यूटी बंद करें' : 'ड्यूटी शुरू करें'}
                </button>
              </div>

              {driver.isDutyOn ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-200">
                  <div className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </div>
                  <span className="font-semibold">
                    आप ऑनलाइन हैं • 2-5 KM के दायरे में आने वाली नई सवारी रिक्वेस्ट की घंटी बजेगी!
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
                  आप अभी ऑफ़लाइन हैं। नई राइड्स प्राप्त करने के लिए ऊपर से "ड्यूटी ऑन" करें।
                </div>
              )}
            </div>

            {/* Main Earnings Card */}
            {(() => {
              const summary = store.getDriverEarningsSummary(driver.id);
              return (
                <>
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-850 to-slate-900 border border-amber-500/30 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        <span>आज की कुल कमाई (Today's Earnings)</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        नेट पेआउट
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-4xl font-black font-mono tracking-tight text-emerald-400">
                        ₹{summary.todayNetEarnings.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        ({summary.todayRidesCount} राइड्स पूरी)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      कमीशन कटने के बाद आपके पास सीधा नकद टेक-होम पेआउट
                    </p>
                  </div>

                  {/* 4-Stat Quick Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Today's Rides */}
                    <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-750">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                        <Navigation className="w-3.5 h-3.5 text-amber-400" />
                        <span>आज की राइड्स</span>
                      </div>
                      <div className="text-2xl font-black text-white font-mono">
                        {summary.todayRidesCount}
                        <span className="text-xs font-normal text-slate-400 ml-1">ट्रिप</span>
                      </div>
                    </div>

                    {/* Direct Cash in Hand */}
                    <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-750">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>कैश कलेक्शन</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        ₹{summary.todayGrossFare}
                      </div>
                    </div>

                    {/* Wallet Balance with Recharge Button */}
                    <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-750">
                      <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                        <span>वॉलेट बैलेंस</span>
                        <button
                          type="button"
                          onClick={() => setIsRazorpayOpen(true)}
                          className="text-[10px] text-amber-400 underline font-bold cursor-pointer"
                        >
                          + रिचार्ज
                        </button>
                      </div>
                      <div className="text-xl font-black text-white font-mono">
                        ₹{driver.walletBalance.toFixed(2)}
                      </div>
                    </div>

                    {/* Driver Rating */}
                    <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-750">
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                        <Award className="w-3.5 h-3.5 text-yellow-400" />
                        <span>राइडर रेटिंग</span>
                      </div>
                      <div className="text-xl font-black text-white font-mono flex items-center gap-1">
                        <span>{driver.rating}</span>
                        <span className="text-xs text-yellow-400">★★★★★</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Target Incentive Bonus Card */}
                  <div className="p-4 rounded-3xl bg-slate-850/90 border border-slate-750 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>दैनिक इंसेंटिव (Daily Target Bonus)</span>
                      </span>
                      <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        ₹{summary.dailyIncentiveBonus} बोनस
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                      <span>लक्ष्य: {summary.dailyIncentiveTarget} राइड्स पूरी करें</span>
                      <span className="font-bold font-mono">
                        {summary.dailyIncentiveCompleted} / {summary.dailyIncentiveTarget} पूरी
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${(summary.dailyIncentiveCompleted / summary.dailyIncentiveTarget) * 100}%`,
                        }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {summary.dailyIncentiveTarget - summary.dailyIncentiveCompleted > 0
                        ? `सिर्फ ${summary.dailyIncentiveTarget - summary.dailyIncentiveCompleted} और राइड पूरी करें और ₹${summary.dailyIncentiveBonus} अतिरिक्त बोनस पाएं!`
                        : '🎉 बधाई हो! आज का दैनिक इंसेंटिव बोनस हासिल हो चुका है!'}
                    </p>
                  </div>

                  {/* Today's Completed Rides History */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                        आज की पूरी की गई राइड्स ({summary.todayRidesList.length})
                      </h4>
                      <span className="text-[11px] text-slate-400">इतिहास</span>
                    </div>

                    {summary.todayRidesList.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-850/60 border border-slate-800 text-center text-xs text-slate-400">
                        आज अभी तक कोई राइड पूरी नहीं हुई है। ड्यूटी ऑन रखें और नई सवारी स्वीकार करें!
                      </div>
                    ) : (
                      summary.todayRidesList.map((r) => (
                        <div
                          key={r.id}
                          className="p-3.5 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white truncate">{r.customerName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({r.distanceKm} KM)</span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {r.pickup.name.slice(0, 22)} → {r.drop.name.slice(0, 22)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-black text-emerald-400 font-mono block">
                              +₹{(r.driverNetEarning || r.fare * 0.88 - 3).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">किराया ₹{r.fare}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          /* SECTION: FULLSCREEN LEAFLET MAP VIEWPORT */
          <div className="flex-1 w-full h-full relative">
            <LeafletMap
              center={liveBroadcastLocation ? [liveBroadcastLocation.lat, liveBroadcastLocation.lng] : driverCoords}
              userCoords={liveBroadcastLocation ? [liveBroadcastLocation.lat, liveBroadcastLocation.lng] : driverCoords}
              userRole="driver"
              pickupPoint={activeRide ? activeRide.pickup : null}
              dropPoint={activeRide ? activeRide.drop : null}
              driverMarkerCoords={liveBroadcastLocation ? [liveBroadcastLocation.lat, liveBroadcastLocation.lng] : null}
              driverHeading={liveBroadcastLocation ? liveBroadcastLocation.heading : 0}
              routePoints={getDriverRoutePoints()}
            />

            {/* Real-time GPS Broadcasting Indicator */}
            {activeRide && liveBroadcastLocation && (
              <div className="absolute top-28 left-3 z-30 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/50 shadow-lg text-[11px] font-semibold text-emerald-400 flex items-center gap-2 pointer-events-none">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>
                  GPS ब्रॉडकास्ट सक्रिय (3.5s • {liveBroadcastLocation.speedKmph} km/h • ~{liveBroadcastLocation.distanceRemainingKm} KM)
                </span>
              </div>
            )}

            {/* Status Overlay when Duty is OFF */}
            {!driver.isDutyOn && !activeRide && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] z-20 flex items-center justify-center p-4">
                <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-750 text-center max-w-xs shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto mb-3 flex items-center justify-center">
                    <Power className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-white">आप अभी ऑफ़लाइन हैं (Duty OFF)</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    सवारी अनुरोध प्राप्त करने के लिए ऊपर दिए गए स्विच से "DUTY ON" करें।
                  </p>
                  <button
                    onClick={handleToggleDuty}
                    disabled={driver.walletBalance < 0}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    {driver.walletBalance < 0 ? 'पहले वॉलेट रिचार्ज करें' : 'Start Duty (ड्यूटी ऑन करें)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. INCOMING RIDE REQUEST POPUP (REAL-TIME NOTIFICATION WITH LOUD RING) */}
      {incomingRide && !activeRide && (
        <div className="absolute bottom-4 left-3 right-3 z-40 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
          <div className="p-4 rounded-3xl bg-slate-900/98 border-2 border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.35)] backdrop-blur-md space-y-3">
            {/* Header with pulsing alert & sound indicator */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>नई राइड रिक्वेस्ट (New Ride Request)</span>
              </span>

              {/* Sound Ringing Status / Mute Toggle */}
              <button
                type="button"
                onClick={() => {
                  const m = soundService.toggleMute();
                  setIsMuted(m);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 border transition cursor-pointer ${
                  isMuted
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                }`}
                title={isMuted ? 'रिंग अनम्यूट करें' : 'रिंग म्यूट करें'}
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-amber-400" />}
                <span>{isMuted ? 'Muted' : 'Loud Ring'}</span>
              </button>
            </div>

            {/* Proximity Distance & Customer Detail */}
            <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-750 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ग्राहक का नाम:</span>
                  <span className="text-sm font-extrabold text-white">{incomingRide.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">पिकअप दूरी (Proximity):</span>
                  <span className="text-xs font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md font-mono inline-block">
                    ~{calculateDistanceKm(driverCoords[0], driverCoords[1], incomingRide.pickup.lat, incomingRide.pickup.lng)} KM पास
                  </span>
                </div>
              </div>

              {/* Pickup & Drop Points */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-750">
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">पिकअप स्थान (Pickup):</span>
                    <span className="font-bold text-slate-100 truncate block">{incomingRide.pickup.name}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">ड्रॉप स्थान (Drop):</span>
                    <span className="font-bold text-slate-100 truncate block">{incomingRide.drop.name}</span>
                  </div>
                </div>
              </div>

              {/* Fare & Trip Distance */}
              <div className="text-[11px] text-slate-300 pt-2 border-t border-slate-750 flex items-center justify-between">
                <span>ट्रिप दूरी: ~{incomingRide.distanceKm} KM</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-black text-sm font-mono">₹{incomingRide.fare}</span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">सीधा नकद</span>
                </div>
              </div>
            </div>

            {/* Accept & Decline Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDeclineRide}
                className="py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 text-xs font-black border-2 border-slate-700 hover:border-rose-500/60 shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <X className="w-4 h-4 text-rose-400 stroke-[3]" />
                <span>Decline (अस्वीकार करें)</span>
              </button>
              <button
                type="button"
                onClick={handleAcceptRide}
                className="py-3.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Accept (स्वीकार करें)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVE RIDE BOTTOM DASHBOARD (PICKUP ROUTING / 4-DIGIT OTP / END RIDE) */}
      {activeRide && (
        <div className="relative z-30 p-3 pb-5 bg-slate-900/95 border-t border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="max-w-md mx-auto space-y-3">
            {activeRide.status === 'accepted' ? (
              /* SECTION 5: LIVE PICKUP POINT TRACKING & "ARRIVED" ACTION */
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      पिकअप की ओर बढ़ें (Driving to Pickup)
                    </span>
                    <h4 className="text-base font-black text-white">{activeRide.customerName}</h4>
                    <p className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                      {activeRide.pickup.name}
                    </p>
                  </div>
                  <a
                    href={`tel:${activeRide.customerPhone}`}
                    className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                <button
                  onClick={handleArriveAtPickup}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-black text-sm shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
                >
                  <MapPin className="w-4 h-4" />
                  <span>पिकअप पर पहुँच गया (Arrived at Pickup)</span>
                </button>
              </div>
            ) : activeRide.status === 'arrived' ? (
              /* SECTION 6: RIDE START SECRET 4-DIGIT OTP VALIDATION */
              <div className="p-4 rounded-3xl bg-slate-850 border-2 border-amber-500 space-y-3">
                <div className="text-center">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    <span>सवारी शुरू करने के लिए OTP दर्ज करें</span>
                  </span>
                  <p className="text-xs text-slate-300 mt-1">
                    ग्राहक के फोन पर 4-अंकों का गुप्त कोड प्रदर्शित है:
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={4}
                      inputMode="numeric"
                      placeholder="4-अंकीय OTP (e.g. 8492)"
                      value={otpInput}
                      onChange={(e) => {
                        setOtpInput(e.target.value.replace(/\D/g, ''));
                        setOtpError('');
                      }}
                      className="w-full py-3 px-4 text-center text-2xl font-black font-mono tracking-widest rounded-xl bg-slate-900 border-2 border-slate-700 focus:border-amber-500 text-white outline-none"
                    />
                  </div>

                  {otpError && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg text-center font-medium">
                      {otpError}
                    </div>
                  )}

                  {/* Testing quick assist button */}
                  <button
                    type="button"
                    onClick={() => setOtpInput(activeRide.startOtp)}
                    className="w-full text-[11px] text-amber-400 underline text-center"
                  >
                    Quick Auto-fill OTP ({activeRide.startOtp})
                  </button>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>सवारी प्रारंभ करें (Start Ride)</span>
                  </button>
                </form>
              </div>
            ) : activeRide.status === 'in_trip' ? (
              /* SECTION 7 & 9: IN-TRIP & "END RIDE" ACTION */
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      राइड जारी है (In Progress)
                    </span>
                    <h4 className="text-base font-black text-white">{activeRide.customerName}</h4>
                    <p className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                      ड्रॉप: {activeRide.drop.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                      राइड सक्रिय
                    </span>
                  </div>
                </div>

                {/* SECTION 9: End Ride Button */}
                <button
                  onClick={handleEndRide}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-base shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
                >
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>End Ride (सवारी समाप्त करें)</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 5. SECTION 9 TRIP CONCLUSION MODAL */}
      {completedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-750 p-6 shadow-2xl text-white text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white">सवारी संपन्न! (Ride Completed)</h3>
            <p className="text-xs text-slate-300">
              सवारी सफलतापूर्वक पूरी हो चुकी है।
            </p>

            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 text-center space-y-2 text-xs">
              <div className="text-sm font-bold text-emerald-400">
                सवारी संपन्न हो चुकी है
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                अगली सवारी लेने के लिए तैयार रहें।
              </p>
            </div>

            <button
              onClick={() => setCompletedSummary(null)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm shadow-lg shadow-orange-500/20"
            >
              ठीक है (Next Ride)
            </button>
          </div>
        </div>
      )}

      {/* 6. RAZORPAY RECHARGE MODAL */}
      <RazorpayModal
        isOpen={isRazorpayOpen}
        onClose={() => setIsRazorpayOpen(false)}
        driverId={driver.id}
        driverName={driver.name}
        driverPhone={driver.phone}
        currentBalance={driver.walletBalance}
        onRechargeSuccess={handleRechargeSuccess}
      />
    </div>
  );
};
