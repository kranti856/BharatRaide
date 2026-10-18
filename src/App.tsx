/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { CustomerProfile, DriverProfile, UserRole } from './types';
import { store } from './services/store';
import { useGeolocation } from './hooks/useGeolocation';
import { usePWAInstall } from './hooks/usePWAInstall';
import { InstallModal } from './components/InstallModal';
import { RoleSelection } from './components/RoleSelection';
import { OtpVerification } from './components/OtpVerification';
import { CustomerView } from './components/CustomerView';
import { DriverView } from './components/DriverView';
import { AdminSecretDashboard } from './components/AdminSecretDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<CustomerProfile | DriverProfile | null>(
    store.getCurrentUser()
  );
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  // Pending Registration & 6-Digit OTP State
  const [pendingRegistration, setPendingRegistration] = useState<{
    data: Partial<CustomerProfile | DriverProfile>;
    role: 'customer' | 'driver';
  } | null>(null);

  // High-accuracy background Geolocation with watchPosition
  const geo = useGeolocation({
    enableTracking: true,
    onLocationUpdate: (lat, lng, heading) => {
      if (currentUser && currentUser.role === 'driver') {
        store.updateDriverLocation(currentUser.id, lat, lng, heading);
      }
    },
  });

  // PWA Universal Install Hook & Prompt
  const pwa = usePWAInstall();

  // Handle URL route for /admin-secret or #admin-secret
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;

      if (hash.includes('reset') || search.includes('reset')) {
        store.clearActiveRide();
        store.setCurrentUser(null);
        setCurrentUser(null);
        window.history.replaceState(null, '', window.location.pathname);
      }

      if (path.includes('/admin-secret') || hash === '#admin-secret') {
        setIsAdminView(true);
      } else {
        setIsAdminView(false);
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);

    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });

    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
      unsub();
    };
  }, []);

  // Handle Registration Form Submission -> Triggers 6-Digit OTP Lock Screen
  const handleRegisterSubmit = (
    data: Partial<CustomerProfile | DriverProfile>,
    role: 'customer' | 'driver'
  ) => {
    setPendingRegistration({ data, role });
  };

  // 6-Digit OTP Verified -> Saves to localStorage and enters role view
  const handleOtpVerified = () => {
    if (!pendingRegistration) return;
    const { data, role } = pendingRegistration;

    if (role === 'customer') {
      const newCustomer: CustomerProfile = {
        id: 'cust_' + (data.phone || Date.now().toString().slice(-6)),
        name: data.name || 'Bharat Rider',
        phone: data.phone || '9876543210',
        role: 'customer',
        createdAt: Date.now(),
      };
      store.setCurrentUser(newCustomer);
      setCurrentUser(newCustomer);
    } else {
      const newDriver: DriverProfile = {
        id: 'drv_' + (data.phone || Date.now().toString().slice(-6)),
        name: data.name || 'Bharat Pilot',
        phone: data.phone || '9812345678',
        role: 'driver',
        vehicleModel: (data as any).vehicleModel || 'Hero Splendor Plus',
        vehicleNumber: (data as any).vehicleNumber || 'UP32-AK-9999',
        dlNumber: (data as any).dlNumber || 'DL-0420220011223',
        isDutyOn: true,
        walletBalance: 150.0, // Initial welcome bonus balance
        lat: geo.lat,
        lng: geo.lng,
        heading: 0,
        totalTrips: 0,
        totalEarnings: 0,
        isRestricted: false,
        rating: 5.0,
        createdAt: Date.now(),
      };
      store.setCurrentUser(newDriver);
      setCurrentUser(newDriver);
    }

    setPendingRegistration(null);
  };

  // Switch role handler (allows jumping between customer & driver seamlessly)
  const handleSwitchRole = () => {
    if (!currentUser) return;
    if (currentUser.role === 'customer') {
      // Find or switch to test driver
      const drivers = store.getDrivers();
      const testDriver = drivers[0];
      store.setCurrentUser(testDriver);
      setCurrentUser(testDriver);
    } else {
      const testCust: CustomerProfile = {
        id: 'cust_switch_1',
        name: 'Aakash Verma',
        phone: '9876543210',
        role: 'customer',
        createdAt: Date.now(),
      };
      store.setCurrentUser(testCust);
      setCurrentUser(testCust);
    }
  };

  const handleBackToHome = () => {
    store.setCurrentUser(null);
    setCurrentUser(null);
  };

  const currentCoords: [number, number] = [geo.lat, geo.lng];

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden relative">
      {/* FLOATING PERMANENT HOME / RESET BUTTON (ALWAYS VISIBLE OVER ALL MAPS & VIEWS) */}
      {!isAdminView && (
        <div className="fixed top-3 left-3 z-[99999] flex items-center gap-2 pointer-events-auto">
          {currentUser && (
            <button
              onClick={() => {
                store.clearActiveRide();
                store.setCurrentUser(null);
                setCurrentUser(null);
              }}
              className="py-1.5 px-3 rounded-full bg-slate-900/95 text-white border-2 border-amber-500 shadow-2xl flex items-center gap-1.5 text-xs font-black backdrop-blur-md active:scale-95 cursor-pointer hover:bg-slate-800 transition"
              title="मुख्य पेज पर जाएं (Back to Home)"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400 stroke-[3]" />
              <span>← मुख्य पेज (Home)</span>
            </button>
          )}

          <button
            onClick={() => {
              store.clearActiveRide();
              window.location.reload();
            }}
            className="py-1.5 px-2.5 rounded-full bg-slate-900/90 text-rose-300 border border-rose-500/40 text-[11px] font-bold shadow-lg backdrop-blur-md hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1"
            title="राइड रीसेट करें (Clear stuck ride)"
          >
            <RefreshCw className="w-3 h-3 text-rose-400" />
            <span>राइड हटाएं (Reset)</span>
          </button>
        </div>
      )}

      {/* 1. SECRET ADMIN DASHBOARD VIEW */}
      {isAdminView ? (
        <AdminSecretDashboard
          onBackToApp={() => {
            window.location.hash = '';
            setIsAdminView(false);
          }}
        />
      ) : !currentUser ? (
        /* 2. REGISTRATION & ROLE SELECTION SCREEN */
        <RoleSelection
          onRegisterSubmit={handleRegisterSubmit}
          onSelectAdmin={() => {
            window.location.hash = '#admin-secret';
            setIsAdminView(true);
          }}
        />
      ) : currentUser.role === 'customer' ? (
        /* 3. CUSTOMER DUAL INTERFACE */
        <CustomerView
          user={currentUser}
          userCoords={currentCoords}
          onSwitchRole={handleSwitchRole}
          onOpenInstall={() => pwa.setShowInstallModal(true)}
          onBackToHome={handleBackToHome}
        />
      ) : (
        /* 4. DRIVER DUAL INTERFACE */
        <DriverView
          driver={currentUser}
          driverCoords={currentCoords}
          onSwitchRole={handleSwitchRole}
          onOpenInstall={() => pwa.setShowInstallModal(true)}
          onBackToHome={handleBackToHome}
        />
      )}

      {/* 5. 6-DIGIT OTP VERIFICATION VIEWPORT (LOCKS SCREEN UNTIL VALID) */}
      {pendingRegistration && (
        <OtpVerification
          phone={pendingRegistration.data.phone || '9876543210'}
          role={pendingRegistration.role}
          onVerifySuccess={handleOtpVerified}
          onBack={() => setPendingRegistration(null)}
        />
      )}

      {/* 6. UNIVERSAL MOBILE INSTALL MODAL (Section 0) */}
      <InstallModal
        isOpen={pwa.showInstallModal}
        onClose={() => pwa.setShowInstallModal(false)}
        onInstall={pwa.triggerInstall}
        isIOS={pwa.isIOS}
        isInstallable={pwa.isInstallable}
      />
    </div>
  );
}
