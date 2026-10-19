export type UserRole = 'customer' | 'driver' | 'admin';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  role: 'customer';
  createdAt: number;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  role: 'driver';
  vehicleModel: string;
  vehicleNumber: string;
  dlNumber: string;
  isDutyOn: boolean;
  walletBalance: number;
  lat: number;
  lng: number;
  heading?: number;
  totalTrips: number;
  totalEarnings: number;
  isRestricted: boolean;
  rating: number;
  createdAt: number;
}

export type RideStatus =
  | 'idle'
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

export interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface NearbyDriverInfo {
  driverId: string;
  driverName: string;
  vehicleModel: string;
  vehicleNumber: string;
  distanceKm: number;
  phone?: string;
}

export interface RideRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  pickup: LocationPoint;
  drop: LocationPoint;
  fare: number;
  distanceKm: number;
  status: RideStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  driverVehicleNumber?: string;
  driverCoords?: [number, number];
  driverHeading?: number;
  driverSpeedKmph?: number;
  driverLastUpdated?: number;
  driverDistanceToTargetKm?: number;
  startOtp: string; // 4-digit secret OTP
  createdAt: number;
  acceptedAt?: number;
  arrivedAt?: number;
  startedAt?: number;
  completedAt?: number;
  platformCommission?: number; // (Fare * 0.12) + 3
  driverNetEarning?: number;
  nearbyDrivers?: NearbyDriverInfo[];
  declinedDriverIds?: string[];
  searchRadiusKm?: number;
}

export interface WalletTransaction {
  id: string;
  driverId: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: 'razorpay_recharge' | 'platform_commission' | 'admin_adjustment';
  referenceId?: string;
  timestamp: number;
  balanceAfter: number;
}

export interface PlatformStats {
  todayRevenue: number;
  activeDriversCount: number;
  totalRidesCompleted: number;
  totalPlatformCommission: number;
  totalFixedPlatformFees: number;
}
