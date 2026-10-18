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
} from 'lucide-react';
import { DriverProfile, RideRequest } from '../types';
import { store } from '../services/store';
import { LeafletMap } from './LeafletMap';
import { RazorpayModal } from './RazorpayModal';

interface DriverViewProps {
  driver: DriverProfile;
  driverCoords: [number, number];
  onSwitchRole?: () => void;
  onOpenInstall?: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({
  driver: initialDriver,
  driverCoords,
  onSwitchRole,
  onOpenInstall,
}) => {
  const [driver, setDriver] = useState<DriverProfile>(initialDriver);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [incomingRide, setIncomingRide] = useState<RideRequest | null>(null);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);

  // OTP Input State for starting ride
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Trip completion summary modal
  const [completedSummary, setCompletedSummary] = useState<{
    fare: number;
    commission: number;
    net: number;
  } | null>(null);

  // Store synchronization
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
        } else if (ride.status === 'searching' && current.isDutyOn && !current.isRestricted) {
          setIncomingRide(ride);
        } else {
          setIncomingRide(null);
        }
      } else {
        setActiveRide(null);
        setIncomingRide(null);
      }
    };

    syncState();
    const unsub = store.subscribe(syncState);
    return unsub;
  }, [initialDriver.id]);

  // Keep driver position synced to store
  useEffect(() => {
    store.updateDriverLocation(driver.id, driverCoords[0], driverCoords[1]);
  }, [driverCoords[0], driverCoords[1], driver.id]);

  // Toggle Duty
  const handleToggleDuty = () => {
    const nextState = !driver.isDutyOn;
    try {
      store.toggleDriverDuty(driver.id, nextState);
    } catch (err: any) {
      alert(err.message || 'कमीशन बकाया होने के कारण ड्यूटी ऑन नहीं की जा सकती। कृपया वॉलेट रिचार्ज करें।');
    }
  };

  // Accept Ride
  const handleAcceptRide = () => {
    if (!incomingRide) return;
    const accepted = store.driverAcceptRide(driver.id);
    if (accepted) {
      setActiveRide(accepted);
      setIncomingRide(null);
    }
  };

  // Reject Incoming Ride
  const handleRejectRide = () => {
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
      {/* 1. TOP DRIVER CONTROL BAR (Duty ON/OFF Toggle + Wallet Balance) */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-3 pointer-events-none">
        <div className="max-w-md mx-auto space-y-2 pointer-events-auto">
          {/* Main Top Header Strip */}
          <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-750 shadow-2xl flex items-center justify-between">
            {/* Duty ON/OFF Switch */}
            <div className="flex items-center gap-2">
              <button
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

              <button
                onClick={onSwitchRole}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 text-[11px] font-semibold border border-slate-700 transition"
              >
                Switch
              </button>
            </div>

            {/* SECTION 3: Driver Wallet Balance in Bold Numeric Font & Recharge Button */}
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
                onClick={() => setIsRazorpayOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md shadow-orange-500/20 cursor-pointer active:scale-95 transition"
              >
                <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Recharge</span>
              </button>
            </div>
          </div>

          {/* Negative Balance Alert Warning Banner */}
          {driver.walletBalance < 0 && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>कमीशन बकाया: ₹{driver.walletBalance.toFixed(2)} (ड्यूटी बंद)</span>
              </div>
              <button
                onClick={() => setIsRazorpayOpen(true)}
                className="px-2 py-0.5 rounded bg-rose-500 text-white text-[11px] font-bold"
              >
                Recharge Now
              </button>
            </div>
          )}

          {/* Driver Vehicle Pill info */}
          <div className="flex items-center justify-between px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <span>
              पायलट: <strong className="text-white">{driver.name}</strong> • {driver.vehicleModel}
            </span>
            <span className="font-mono text-amber-400 font-bold">{driver.vehicleNumber}</span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC FULLSCREEN LEAFLET MAP VIEWPORT FOR DRIVER */}
      <div className="flex-1 w-full h-full relative">
        <LeafletMap
          center={driverCoords}
          userCoords={driverCoords}
          userRole="driver"
          pickupPoint={activeRide ? activeRide.pickup : null}
          dropPoint={activeRide ? activeRide.drop : null}
          routePoints={getDriverRoutePoints()}
        />

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
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20"
              >
                {driver.walletBalance < 0 ? 'पहले वॉलेट रिचार्ज करें' : 'Start Duty (ड्यूटी ऑन करें)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. INCOMING RIDE REQUEST POPUP (REAL-TIME NOTIFICATION) */}
      {incomingRide && !activeRide && (
        <div className="absolute bottom-4 left-3 right-3 z-40 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
          <div className="p-4 rounded-3xl bg-slate-900 border-2 border-amber-500 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                नई सवारी उपलब्ध (New Ride Request)
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono">₹{incomingRide.fare}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-850 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-semibold text-slate-200 truncate">
                  Pickup: {incomingRide.pickup.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="font-semibold text-slate-200 truncate">
                  Drop: {incomingRide.drop.name}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-750 flex items-center justify-between">
                <span>दूरी: ~{incomingRide.distanceKm} KM</span>
                <span className="text-amber-400 font-medium">प्लेटफॉर्म कमीशन: 12% + ₹3</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleRejectRide}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-bold border border-slate-750"
              >
                अस्वीकार (Reject)
              </button>
              <button
                onClick={handleAcceptRide}
                className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-98"
              >
                स्वीकार करें (Accept)
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
                    <span className="text-[10px] text-slate-400">नकद किराया</span>
                    <div className="text-lg font-black text-emerald-400 font-mono">₹{activeRide.fare}</div>
                  </div>
                </div>

                {/* SECTION 9: End Ride Button */}
                <button
                  onClick={handleEndRide}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-base shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
                >
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>End Ride (सवारी समाप्त करें - ₹{activeRide.fare})</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 5. SECTION 9 TRIP CONCLUSION MODAL (COMMISSION 12% + ₹3 DEDUCTED) */}
      {completedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-750 p-6 shadow-2xl text-white text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white">सवारी संपन्न! (Ride Completed)</h3>
            <p className="text-xs text-slate-300">
              ग्राहक से पूरा नकद किराया प्राप्त करें:
            </p>

            {/* Fare Breakdown & Silent Commission Display */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center text-sm font-bold text-white pb-2 border-b border-slate-750">
                <span>सवारी से नकद प्राप्त (Cash Fare):</span>
                <span className="text-emerald-400 font-mono text-base">₹{completedSummary.fare}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>प्लेटफॉर्म कमीशन (12%):</span>
                <span className="font-mono text-rose-400">-₹{(completedSummary.fare * 0.12).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>निश्चित प्लेटफॉर्म शुल्क (Fixed):</span>
                <span className="font-mono text-rose-400">-₹3.00</span>
              </div>
              <div className="flex justify-between items-center font-bold text-rose-400 pt-1 border-t border-slate-750">
                <span>वॉलेट से काटी गई कुल राशि:</span>
                <span className="font-mono">-₹{completedSummary.commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center font-bold text-amber-400 pt-1 border-t border-slate-750 text-sm">
                <span>आपकी शुद्ध कमाई (Net Earnings):</span>
                <span className="font-mono text-base">₹{completedSummary.net.toFixed(2)}</span>
              </div>
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
