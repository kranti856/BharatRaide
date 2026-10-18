import React, { useState } from 'react';
import { User, Bike, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { CustomerProfile, DriverProfile } from '../types';

interface RoleSelectionProps {
  onRegisterSubmit: (formData: Partial<CustomerProfile | DriverProfile>, role: 'customer' | 'driver') => void;
  onSelectAdmin?: () => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onRegisterSubmit, onSelectAdmin }) => {
  const [selectedRole, setSelectedRole] = useState<'customer' | 'driver' | null>(null);

  // Customer Form State (2 fields only)
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Driver Form State (5 fields)
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dlNumber, setDlNumber] = useState('');

  const [formError, setFormError] = useState('');

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      setFormError('कृपया अपना नाम और 10-अंकों का मोबाइल नंबर भरें।');
      return;
    }
    const cleanPhone = custPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('कृपया सही 10-अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }

    onRegisterSubmit(
      {
        name: custName.trim(),
        phone: cleanPhone,
        role: 'customer',
      },
      'customer'
    );
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim() || !driverPhone.trim() || !vehicleModel.trim() || !vehicleNumber.trim() || !dlNumber.trim()) {
      setFormError('ड्राइवर रजिस्ट्रेशन के लिए सभी 5 फ़ील्ड भरना आवश्यक है।');
      return;
    }
    const cleanPhone = driverPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('कृपया सही 10-अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }

    onRegisterSubmit(
      {
        name: driverName.trim(),
        phone: cleanPhone,
        role: 'driver',
        vehicleModel: vehicleModel.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        dlNumber: dlNumber.trim().toUpperCase(),
      },
      'driver'
    );
  };

  // Quick autofill for quick testing
  const autofillCustomer = () => {
    setCustName('Aakash Sharma');
    setCustPhone('9876543210');
    setFormError('');
  };

  const autofillDriver = () => {
    setDriverName('Manoj Kumar');
    setDriverPhone('9812345678');
    setVehicleModel('Hero Splendor Plus');
    setVehicleNumber('UP32-AK-9876');
    setDlNumber('DL-0420220088991');
    setFormError('');
  };

  return (
    <div className="min-h-full flex flex-col justify-between p-4 max-w-md mx-auto relative select-none">
      {/* Top Brand Header */}
      <div className="pt-4 text-center">
        <div className="inline-flex items-center justify-center gap-2 mb-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-semibold text-amber-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>भारत का अपना बाइक टैक्सी नेटवर्क</span>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <img src="/icon.svg" alt="BharatRaide" className="w-12 h-12 rounded-2xl shadow-md shadow-orange-500/20" />
          <div className="text-left">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center">
              BHARAT<span className="text-amber-500">RAIDE</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">100% PWA • Direct WhatsApp / FB Link</p>
          </div>
        </div>
      </div>

      {/* Main Choice or Form Card */}
      <div className="my-auto py-6">
        {!selectedRole ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-white">आप BharatRaide का उपयोग किस प्रकार करना चाहते हैं?</h2>
              <p className="text-xs text-slate-400 mt-1">अपनी भूमिका चुनें और सीधे ऐप का आनंद लें</p>
            </div>

            {/* Customer Button */}
            <button
              onClick={() => {
                setSelectedRole('customer');
                setFormError('');
              }}
              className="w-full group p-5 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-2 border-slate-700 hover:border-amber-500 text-left transition-all duration-200 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">राइडर (सवारी)</span>
                    <h3 className="text-xl font-extrabold text-white">Customer</h3>
                    <p className="text-xs text-slate-400 mt-0.5">सस्ती व सुरक्षित बाइक राइड तुरंत बुक करें</p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            {/* Driver Button */}
            <button
              onClick={() => {
                setSelectedRole('driver');
                setFormError('');
              }}
              className="w-full group p-5 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-850 hover:from-slate-750 hover:to-slate-800 border-2 border-slate-700 hover:border-emerald-500 text-left transition-all duration-200 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <Bike className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">पायलट (चालक)</span>
                    <h3 className="text-xl font-extrabold text-white">Drive</h3>
                    <p className="text-xs text-slate-400 mt-0.5">अपनी बाइक चलाएं, सीधा कैश कमाएं (12% + ₹3)</p>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            {/* Quick Demo Pre-fills for Instant Testing */}
            <div className="pt-4 flex items-center justify-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('customer');
                  autofillCustomer();
                }}
                className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-750 text-slate-300 hover:text-white hover:border-amber-500/50 flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test as Customer</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('driver');
                  autofillDriver();
                }}
                className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-750 text-slate-300 hover:text-white hover:border-emerald-500/50 flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test as Driver</span>
              </button>
            </div>
          </div>
        ) : selectedRole === 'customer' ? (
          /* CUSTOMER FORM: 2 FIELDS ONLY */
          <div className="bg-slate-850/90 rounded-3xl p-6 border border-slate-750 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-slate-750 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Customer Registration</h3>
                  <p className="text-[11px] text-slate-400">केवल 2 फ़ील्ड्स भरें और राइड शुरू करें</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800"
              >
                Change Role
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. पूरा नाम (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white placeholder-slate-500 text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  2. मोबाइल नंबर (Mobile Number) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-sm font-semibold text-slate-400">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-14 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white placeholder-slate-500 text-sm font-medium tracking-wide outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 font-bold text-slate-950 text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
                >
                  <span>Continue to 6-Digit OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={autofillCustomer}
                className="w-full py-2 text-xs text-amber-400 hover:underline text-center"
              >
                Auto-fill Sample Customer Info
              </button>
            </form>
          </div>
        ) : (
          /* DRIVER FORM: 5 FIELDS */
          <div className="bg-slate-850/90 rounded-3xl p-6 border border-slate-750 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-4 border-b border-slate-750 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Drive Registration</h3>
                  <p className="text-[11px] text-slate-400">बाइक पार्टनर के लिए 5 विवरण भरें</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800"
              >
                Change Role
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleDriverSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. पूरा नाम (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 text-sm outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  2. मोबाइल नंबर (Mobile Number) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-14 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 text-sm font-medium tracking-wide outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  3. वाहन मॉडल (Vehicle Model) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hero Splendor Plus / Bajaj Platina"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 text-sm outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    4. गाड़ी नंबर (Vehicle No.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="UP32XX1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 text-xs font-mono uppercase outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    5. ड्राइविंग लाइसेंस (DL No.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DL-04202100..."
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 text-xs font-mono uppercase outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 font-bold text-slate-950 text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
                >
                  <span>Verify Driver & Get OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={autofillDriver}
                className="w-full py-2 text-xs text-emerald-400 hover:underline text-center"
              >
                Auto-fill Sample Driver Info
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Info & Admin Route Link */}
      <div className="pt-2 pb-3 border-t border-slate-800 text-center">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>Govt. ID & DL Secured</span>
          </div>
          <button
            onClick={onSelectAdmin}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline font-mono"
          >
            /admin-secret
          </button>
        </div>
      </div>
    </div>
  );
};
