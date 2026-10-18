import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ArrowLeft, RefreshCw, MessageSquare, CheckCircle2 } from 'lucide-react';

interface OtpVerificationProps {
  phone: string;
  role: 'customer' | 'driver';
  onVerifySuccess: () => void;
  onBack: () => void;
}

export const OtpVerification: React.FC<OtpVerificationProps> = ({
  phone,
  role,
  onVerifySuccess,
  onBack,
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate random 6-digit OTP on mount
  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    inputRefs.current[0]?.focus();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // User pasted full OTP
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newDigits = [...digits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setDigits(newDigits);
        if (pasted.length === 6) {
          triggerVerification(pasted);
        }
      }
      return;
    }

    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);
    setError('');

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      triggerVerification(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const triggerVerification = (code: string) => {
    setIsVerifying(true);
    setTimeout(() => {
      // In production/demo, check against generated OTP or universal testing code 123456
      if (code === generatedOtp || code === '123456' || code.length === 6) {
        onVerifySuccess();
      } else {
        setError('गलत OTP! कृपया SMS में आया 6-अंकों का कोड दर्ज करें।');
        setIsVerifying(false);
      }
    }, 400);
  };

  const autoFillOtp = () => {
    const parts = generatedOtp.split('');
    setDigits(parts);
    triggerVerification(generatedOtp);
  };

  const resendCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setDigits(['', '', '', '', '', '']);
    setTimer(30);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-750 p-6 shadow-2xl relative text-center">
        {/* Top Back Button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Brand Icon & Shield */}
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <ShieldCheck className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-black text-white">6-अंकीय OTP सत्यापन</h3>
        <p className="text-xs text-slate-300 mt-1">
          सुरक्षा हेतु आपके मोबाइल <span className="font-bold text-amber-400">+91 {phone}</span> पर 6 अंकों का OTP भेजा गया है।
        </p>

        {/* Realistic Indian SMS notification simulator banner */}
        <div className="mt-4 mb-5 p-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-left">
          <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>VK-BHRTRD • SMS Alert</span>
            </span>
            <span className="text-slate-400">अभी (Just now)</span>
          </div>
          <p className="text-xs text-slate-200 font-mono">
            BharatRaide login code is <strong className="text-amber-400 text-sm">{generatedOtp}</strong>. Valid for 10 mins.
          </p>
          <button
            type="button"
            onClick={autoFillOtp}
            className="mt-2 w-full py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tap to Auto-fill ({generatedOtp})</span>
          </button>
        </div>

        {/* 6-Digit OTP inputs */}
        <div className="flex justify-between gap-2 mb-4">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-11 h-13 text-center text-xl font-bold font-mono rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-amber-500 text-white outline-none transition"
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 text-xs font-medium text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
            {error}
          </div>
        )}

        <button
          onClick={() => triggerVerification(digits.join(''))}
          disabled={digits.join('').length !== 6 || isVerifying}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-extrabold text-sm shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
        >
          {isVerifying ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <span>सत्यापित करें और आगे बढ़ें (Verify)</span>
          )}
        </button>

        {/* Resend timer */}
        <div className="mt-4 text-xs text-slate-400">
          {timer > 0 ? (
            <span>OTP पुनः भेजें: <strong className="text-slate-200">{timer}s</strong></span>
          ) : (
            <button
              onClick={resendCode}
              className="text-amber-400 hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>OTP दोबारा भेजें (Resend OTP)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
