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
  selfiePhoto?: string;
  driversLicensePhoto?: string;
  driversLicensePhotos?: Array<{ side: "front" | "back"; url: string }>;
  criminalRecordPhoto?: string;
  drugTestPhoto?: string;
  documentStatuses?: {
    [key: string]: {
      status: "pending" | "approved" | "rejected";
      reviewedBy?: string;
      reviewedAt?: string;
      rejectionReason?: string;
      rejectedAt?: string;
    };
  };
  documentsVerified?: boolean;
  documentsVerifiedAt?: string;
  documentsVerifiedBy?: string;
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

export enum NotificationType {
  DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD",
  DOCUMENT_UPDATE = "DOCUMENT_UPDATE",
}

export enum NotificationStatus {
  UNREAD = "UNREAD",
  READ = "READ",
}

export interface AdminNotification {
  id: string;
  adminId?: string | null;
  driverId: string;
  driver?: {
    id: string;
    name: string;
    email: string;
  };
  type: NotificationType;
  documentType: string;
  status: NotificationStatus;
  readAt?: string | null;
  readBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationFilters {
  driverId?: string;
  documentType?: string;
  status?: NotificationStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface NotificationResponse {
  notifications: AdminNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
