import { CustomerProfile, DriverProfile, RideRequest, WalletTransaction, PlatformStats } from '../types';

const STORAGE_KEYS = {
  USER: 'bharatraide_user',
  DRIVERS: 'bharatraide_drivers',
  ACTIVE_RIDE: 'bharatraide_active_ride',
  TRANSACTIONS: 'bharatraide_transactions',
  STATS: 'bharatraide_stats',
  SAVED_LOCATIONS: 'bharatraide_saved_locations'
};

// Initial Mock Drivers in active duty
const DEFAULT_COORDS = { lat: 28.6139, lng: 77.2090 }; // Central Delhi / Connaught Place benchmark

const INITIAL_DRIVERS: DriverProfile[] = [
  {
    id: 'drv_101',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    role: 'driver',
    vehicleModel: 'Hero Splendor Plus',
    vehicleNumber: 'UP32-AK-4421',
    dlNumber: 'DL-0420190012345',
    isDutyOn: true,
    walletBalance: 185.00,
    lat: DEFAULT_COORDS.lat + 0.0042,
    lng: DEFAULT_COORDS.lng + 0.0031,
    heading: 45,
    totalTrips: 142,
    totalEarnings: 8940,
    isRestricted: false,
    rating: 4.8,
    createdAt: Date.now() - 86400000 * 15
  },
  {
    id: 'drv_102',
    name: 'Vikram Singh',
    phone: '9812345678',
    role: 'driver',
    vehicleModel: 'Bajaj Platina 110',
    vehicleNumber: 'DL01-BY-8832',
    dlNumber: 'DL-0120210098765',
    isDutyOn: true,
    walletBalance: 240.50,
    lat: DEFAULT_COORDS.lat - 0.0055,
    lng: DEFAULT_COORDS.lng + 0.0068,
    heading: 130,
    totalTrips: 98,
    totalEarnings: 6150,
    isRestricted: false,
    rating: 4.9,
    createdAt: Date.now() - 86400000 * 9
  },
  {
    id: 'drv_103',
    name: 'Deepak Yadav',
    phone: '9988776655',
    role: 'driver',
    vehicleModel: 'Honda Shine 125',
    vehicleNumber: 'UP16-CZ-2201',
    dlNumber: 'DL-1420180054321',
    isDutyOn: true,
    walletBalance: -14.60, // Negative balance alert test
    lat: DEFAULT_COORDS.lat + 0.0078,
    lng: DEFAULT_COORDS.lng - 0.0042,
    heading: 260,
    totalTrips: 64,
    totalEarnings: 4200,
    isRestricted: true,
    rating: 4.6,
    createdAt: Date.now() - 86400000 * 20
  },
  {
    id: 'drv_104',
    name: 'Sunil Verma',
    phone: '9765432109',
    role: 'driver',
    vehicleModel: 'TVS Apache RTR',
    vehicleNumber: 'DL08-MS-9944',
    dlNumber: 'DL-0820200088219',
    isDutyOn: true,
    walletBalance: 320.00,
    lat: DEFAULT_COORDS.lat - 0.0035,
    lng: DEFAULT_COORDS.lng - 0.0065,
    heading: 310,
    totalTrips: 210,
    totalEarnings: 14500,
    isRestricted: false,
    rating: 4.9,
    createdAt: Date.now() - 86400000 * 45
  }
];

class AppStore {
  private broadcast: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcast = new BroadcastChannel('bharatraide_realtime_bus');
        this.broadcast.onmessage = (event) => {
          this.notifyListeners();
        };
      } catch (e) {
        console.warn('BroadcastChannel fallback:', e);
      }
    }

    // Initialize mock data if not set
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(STORAGE_KEYS.DRIVERS)) {
        localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(INITIAL_DRIVERS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.STATS)) {
        const initialStats: PlatformStats = {
          todayRevenue: 284.80,
          activeDriversCount: 3,
          totalRidesCompleted: 24,
          totalPlatformCommission: 212.80,
          totalFixedPlatformFees: 72.00
        };
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(initialStats));
      }
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }

  private emitChange() {
    this.notifyListeners();
    if (this.broadcast) {
      this.broadcast.postMessage({ type: 'STATE_CHANGED', timestamp: Date.now() });
    }
  }

  // --- Auth / User Profile ---
  public getCurrentUser(): CustomerProfile | DriverProfile | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  }

  public setCurrentUser(user: CustomerProfile | DriverProfile | null) {
    if (typeof window === 'undefined') return;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      // If user is a driver, also update driver database
      if (user.role === 'driver') {
        this.saveOrUpdateDriver(user);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
    this.emitChange();
  }

  // --- Drivers List & Realtime Grid ---
  public getDrivers(): DriverProfile[] {
    if (typeof window === 'undefined') return INITIAL_DRIVERS;
    const raw = localStorage.getItem(STORAGE_KEYS.DRIVERS);
    return raw ? JSON.parse(raw) : INITIAL_DRIVERS;
  }

  public saveOrUpdateDriver(driver: DriverProfile) {
    const drivers = this.getDrivers();
    const idx = drivers.findIndex((d) => d.id === driver.id || d.phone === driver.phone);
    if (idx >= 0) {
      drivers[idx] = { ...drivers[idx], ...driver };
    } else {
      drivers.push(driver);
    }
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
    this.emitChange();
  }

  public updateDriverLocation(driverId: string, lat: number, lng: number, heading?: number) {
    const drivers = this.getDrivers();
    const d = drivers.find((x) => x.id === driverId);
    if (d) {
      d.lat = lat;
      d.lng = lng;
      if (heading !== undefined) d.heading = heading;
      localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));

      // Also update currentUser if it is the current driver
      const user = this.getCurrentUser();
      if (user && user.role === 'driver' && user.id === driverId) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ ...user, lat, lng, heading }));
      }
      this.emitChange();
    }
  }

  public toggleDriverDuty(driverId: string, dutyState: boolean) {
    const drivers = this.getDrivers();
    const d = drivers.find((x) => x.id === driverId);
    if (d) {
      // If wallet is negative, cannot turn Duty ON
      if (dutyState && d.walletBalance < 0) {
        throw new Error('Your wallet balance is negative (₹' + d.walletBalance.toFixed(2) + '). Please recharge to go ON DUTY.');
      }
      d.isDutyOn = dutyState;
      localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));

      const user = this.getCurrentUser();
      if (user && user.role === 'driver' && user.id === driverId) {
        const updated = { ...user, isDutyOn: dutyState };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      }
      this.updateStatsCounters();
      this.emitChange();
    }
  }

  // --- Active Ride System ---
  public getActiveRide(): RideRequest | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_RIDE);
    return raw ? JSON.parse(raw) : null;
  }

  public requestRide(ride: Omit<RideRequest, 'id' | 'status' | 'startOtp' | 'createdAt'>): RideRequest {
    // Generate unique 4-digit secret OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const newRide: RideRequest = {
      ...ride,
      id: 'ride_' + Math.floor(100000 + Math.random() * 900000),
      status: 'searching',
      startOtp: otp,
      createdAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(newRide));
    this.emitChange();
    return newRide;
  }

  public driverAcceptRide(driverId: string): RideRequest | null {
    const ride = this.getActiveRide();
    const drivers = this.getDrivers();
    const driver = drivers.find((d) => d.id === driverId);
    if (!ride || !driver) return null;

    // Place driver close to customer pickup (within 400-600 meters)
    const nearbyLat = ride.pickup.lat + (Math.random() - 0.5) * 0.006;
    const nearbyLng = ride.pickup.lng + (Math.random() - 0.5) * 0.006;

    ride.status = 'accepted';
    ride.driverId = driver.id;
    ride.driverName = driver.name;
    ride.driverPhone = driver.phone;
    ride.driverVehicle = driver.vehicleModel;
    ride.driverVehicleNumber = driver.vehicleNumber;
    ride.driverCoords = [nearbyLat, nearbyLng];
    ride.acceptedAt = Date.now();

    localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(ride));
    this.emitChange();
    return ride;
  }

  public driverArrivedAtPickup(): RideRequest | null {
    const ride = this.getActiveRide();
    if (!ride) return null;
    ride.status = 'arrived';
    ride.arrivedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(ride));
    this.emitChange();
    return ride;
  }

  public verifyOtpAndStartRide(enteredOtp: string): boolean {
    const ride = this.getActiveRide();
    if (!ride) return false;
    if (ride.startOtp === enteredOtp.trim()) {
      ride.status = 'in_trip';
      ride.startedAt = Date.now();
      localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(ride));
      this.emitChange();
      return true;
    }
    return false;
  }

  // --- End Ride: 12% + ₹3 Hidden Commission Logic ---
  public completeRide(): { ride: RideRequest; commission: number; fare: number } | null {
    const ride = this.getActiveRide();
    if (!ride) return null;

    const totalFare = ride.fare;
    // Hidden commission formula: (Total Fare * 0.12) + ₹3
    const commission = parseFloat(((totalFare * 0.12) + 3).toFixed(2));
    const netDriverEarnings = parseFloat((totalFare - commission).toFixed(2));

    ride.status = 'completed';
    ride.completedAt = Date.now();
    ride.platformCommission = commission;
    ride.driverNetEarning = netDriverEarnings;

    // Deduct silently from driver wallet
    if (ride.driverId) {
      this.deductDriverCommission(ride.driverId, commission, ride.id);
    }

    // Update Platform Stats
    this.recordCompletedRideStats(commission);

    localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(ride));
    this.emitChange();

    return { ride, commission, fare: totalFare };
  }

  public cancelRide() {
    const ride = this.getActiveRide();
    if (ride) {
      ride.status = 'cancelled';
      localStorage.setItem(STORAGE_KEYS.ACTIVE_RIDE, JSON.stringify(ride));
      this.emitChange();
    }
  }

  public clearActiveRide() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_RIDE);
    this.emitChange();
  }

  // --- Razorpay & Driver Wallet ---
  public rechargeDriverWallet(driverId: string, amount: number, razorpayPaymentId: string): DriverProfile | null {
    const drivers = this.getDrivers();
    const d = drivers.find((x) => x.id === driverId);
    if (!d) return null;

    d.walletBalance = parseFloat((d.walletBalance + amount).toFixed(2));
    if (d.walletBalance >= 0) {
      d.isRestricted = false;
    }

    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));

    // Update currentUser if matched
    const user = this.getCurrentUser();
    if (user && user.role === 'driver' && user.id === driverId) {
      const updated = { ...user, walletBalance: d.walletBalance, isRestricted: d.isRestricted };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
    }

    // Log transaction
    this.recordTransaction({
      id: 'tx_' + Date.now(),
      driverId,
      amount,
      type: 'credit',
      reason: 'razorpay_recharge',
      referenceId: razorpayPaymentId,
      timestamp: Date.now(),
      balanceAfter: d.walletBalance
    });

    this.emitChange();
    return d;
  }

  private deductDriverCommission(driverId: string, commissionAmount: number, rideId: string) {
    const drivers = this.getDrivers();
    const d = drivers.find((x) => x.id === driverId);
    if (!d) return;

    d.walletBalance = parseFloat((d.walletBalance - commissionAmount).toFixed(2));
    d.totalTrips = (d.totalTrips || 0) + 1;

    // Check negative wallet balance
    if (d.walletBalance < 0) {
      d.isRestricted = true;
      d.isDutyOn = false; // Auto turn off duty when restricted
    }

    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));

    const user = this.getCurrentUser();
    if (user && user.role === 'driver' && user.id === driverId) {
      const updated = {
        ...user,
        walletBalance: d.walletBalance,
        totalTrips: d.totalTrips,
        isRestricted: d.isRestricted,
        isDutyOn: d.isDutyOn
      };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
    }

    // Log debit transaction
    this.recordTransaction({
      id: 'tx_' + Date.now(),
      driverId,
      amount: commissionAmount,
      type: 'debit',
      reason: 'platform_commission',
      referenceId: rideId,
      timestamp: Date.now(),
      balanceAfter: d.walletBalance
    });
  }

  // --- Transactions ---
  public getTransactions(): WalletTransaction[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  }

  private recordTransaction(tx: WalletTransaction) {
    const list = this.getTransactions();
    list.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
  }

  // --- Platform Stats for Admin Secret ---
  public getPlatformStats(): PlatformStats {
    if (typeof window === 'undefined') {
      return {
        todayRevenue: 284.80,
        activeDriversCount: 3,
        totalRidesCompleted: 24,
        totalPlatformCommission: 212.80,
        totalFixedPlatformFees: 72.00
      };
    }
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    const stats: PlatformStats = raw ? JSON.parse(raw) : {
      todayRevenue: 0,
      activeDriversCount: 0,
      totalRidesCompleted: 0,
      totalPlatformCommission: 0,
      totalFixedPlatformFees: 0
    };

    // Calculate actual active count
    const drivers = this.getDrivers();
    stats.activeDriversCount = drivers.filter((d) => d.isDutyOn).length;
    return stats;
  }

  private updateStatsCounters() {
    const stats = this.getPlatformStats();
    const drivers = this.getDrivers();
    stats.activeDriversCount = drivers.filter((d) => d.isDutyOn).length;
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  private recordCompletedRideStats(commission: number) {
    const stats = this.getPlatformStats();
    stats.todayRevenue = parseFloat((stats.todayRevenue + commission).toFixed(2));
    stats.totalPlatformCommission = parseFloat((stats.totalPlatformCommission + (commission - 3)).toFixed(2));
    stats.totalFixedPlatformFees = parseFloat((stats.totalFixedPlatformFees + 3).toFixed(2));
    stats.totalRidesCompleted = (stats.totalRidesCompleted || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }

  // Admin wallet reset or top-up for testing
  public adminAdjustDriverWallet(driverId: string, amount: number) {
    const drivers = this.getDrivers();
    const d = drivers.find((x) => x.id === driverId);
    if (!d) return;
    d.walletBalance = parseFloat((d.walletBalance + amount).toFixed(2));
    if (d.walletBalance >= 0) d.isRestricted = false;
    else d.isRestricted = true;
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
    this.emitChange();
  }

  public resetDemoData() {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(INITIAL_DRIVERS));
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_RIDE);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    const initialStats: PlatformStats = {
      todayRevenue: 284.80,
      activeDriversCount: 3,
      totalRidesCompleted: 24,
      totalPlatformCommission: 212.80,
      totalFixedPlatformFees: 72.00
    };
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(initialStats));
    this.emitChange();
  }
}

export const store = new AppStore();
