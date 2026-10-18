import React from 'react';
import { Download, Share2, Smartphone, ShieldCheck, X, Zap } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => Promise<boolean>;
  isIOS: boolean;
  isInstallable: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isIOS,
  isInstallable,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-center text-white overflow-hidden">
        {/* Background Tricolor Radial Accents */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand App Icon Badge */}
        <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-emerald-600 p-1 shadow-lg shadow-orange-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <img src="/icon.svg" alt="BharatRaide Icon" className="w-14 h-14 object-contain" />
          </div>
        </div>

        {/* Hindi Title & Subheading as requested */}
        <h3 className="text-xl font-bold tracking-tight text-white mb-1">
          BharatRaide ऐप को फोन में इंस्टॉल करें
        </h3>
        <p className="text-xs text-slate-300 font-medium mb-4">
          बिना प्ले स्टोर के सीधे अपने फोन में 1-क्लिक में चलाएं। कभी एक्सपायर नहीं होगा!
        </p>

        {/* Feature Highlights */}
        <div className="mb-5 space-y-2 text-left bg-slate-800/60 p-3 rounded-2xl border border-slate-750 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>लाइव GPS ट्रैकिंग व सबसे तेज बाइक राइड्स</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>सफर खत्म होने पर ड्राइवर को सीधा कैश भुगतान</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>व्हाट्सएप या फेसबुक ग्रुप से सीधा कनेक्टेड</span>
          </div>
        </div>

        {/* Dynamic Action: Android / Standard Chrome vs iOS Safari Guide */}
        {isIOS ? (
          <div className="bg-slate-800 p-3.5 rounded-2xl border border-amber-500/30 text-left">
            <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              iPhone / Safari में इंस्टॉल करने का तरीका:
            </p>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4">
              <li>सफारी के नीचे <strong className="text-white">Share (साझा करें)</strong> आइकन दबाएं।</li>
              <li>नीचे स्क्रॉल करके <strong className="text-white">'Add to Home Screen'</strong> चुनें।</li>
              <li>ऊपर <strong className="text-white">'Add'</strong> दबाएं, BharatRaide ऐप तैयार!</li>
            </ol>
            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold text-xs text-white transition"
            >
              समझ गया (Close)
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              onClick={async () => {
                const res = await onInstall();
                if (!res && !isInstallable) {
                  // Fallback for browsers that already installed or disabled prompt
                  alert('BharatRaide को होम स्क्रीन पर जोड़ने के लिए ब्राउज़र मेनू (⋮) में "Install App" या "Add to Home Screen" पर टैप करें।');
                  onClose();
                }
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold text-base shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer"
            >
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>Install Now (अभी इंस्टॉल करें)</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              ब्राउज़र में ही जारी रखें (Continue in Browser)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
