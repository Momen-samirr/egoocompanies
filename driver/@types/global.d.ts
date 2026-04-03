type ButtonProps = {
  title?: string;
  onPress?: () => void;
  width?: DimensionValue;
  height?: DimensionValue;
  backgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
};

type DriverType = {
  completedScheduledTrips?: number;
  id: string;
  name: string;
  country: string;
  phone_number: string;
  email: string;
  vehicle_type: string;
  registration_number: string;
  registration_date: string;
  driving_license: string;
  vehicle_color: string;
  rate: string;
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
  documentsVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
