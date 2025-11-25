export interface User {
  id: string;
  name?: string;
  phone_number: string;
  email?: string;
  notificationToken?: string;
  ratings: number;
  totalRides: number;
  cratedAt: string;
  updatedAt: string;
  rides?: Ride[];
}

export interface Driver {
  id: string;
  name: string;
  country: string;
  phone_number: string;
  email: string;
  vehicle_type: "Car" | "Motorcycle" | "CNG";
  registration_number: string;
  registration_date: string;
  driving_license: string;
  vehicle_color?: string;
  rate: string;
  notificationToken?: string;
  ratings: number;
  totalEarning: number;
  totalRides: number;
  pendingRides: number;
  cancelRides: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  rides?: Ride[];
}

export interface Ride {
  id: string;
  userId: string;
  driverId: string;
  charge: number;
  currentLocationName: string;
  destinationLocationName: string;
  distance: string;
  status: string;
  rating?: number;
  cratedAt: string;
  updatedAt: string;
  user?: User;
  driver?: Driver;
}

export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  activeDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  todayRides: number;
  recentRides: Ride[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Company {
  id: string;
  name: string;
  defaultScheduledTripPrice: number;
  createdAt: string;
  updatedAt: string;
}

