import api from "@/lib/api";

export interface ParentStudent {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  selfiePhoto?: string;
  school: {
    id: string;
    name: string;
  };
  stop?: {
    id: string;
    name: string;
  };
  relationship?: string;
  isPrimary?: boolean;
}

export interface DashboardTrip {
  id: string;
  name: string;
  status: string;
  route?: {
    name?: string;
  };
  studentPoint?: {
    stopId?: string;
    reachedAt?: string | null;
  };
  progress?: {
    startedAt?: string | null;
  };
  estimatedArrival?: string;
  eta?: string;
  etaToStudent?: string;
  scheduledTime?: string;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  icon: "school" | "bus";
}

export const fetchParentStudents = async (): Promise<ParentStudent[]> => {
  const response = await api.get("/parent/students");
  if (!response.data?.success) {
    return [];
  }
  return response.data.students || [];
};

export const fetchStudentTrip = async (
  studentId: string
): Promise<DashboardTrip | null> => {
  try {
    const response = await api.get(`/parent/students/${studentId}/trip`);
    if (response.data?.success && response.data?.trip) {
      return response.data.trip as DashboardTrip;
    }
    return null;
  } catch {
    return null;
  }
};

const formatRelativeTime = (value?: string | null): string => {
  if (!value) return "JUST NOW";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "JUST NOW";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} MINS AGO`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} HRS AGO`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} DAYS AGO`;
};

export const buildRecentActivities = (
  students: ParentStudent[],
  tripsByStudent: Map<string, DashboardTrip>
): DashboardActivityItem[] => {
  const items: DashboardActivityItem[] = [];

  students.forEach((student) => {
    const trip = tripsByStudent.get(student.id);
    if (!trip) return;

    if (trip.status === "ACTIVE") {
      items.push({
        id: `${student.id}-started`,
        title: "Trip Started",
        subtitle: `${student.firstName}'s commute has begun.`,
        timeLabel: formatRelativeTime(trip.progress?.startedAt),
        icon: "bus",
      });
    }

    if (trip.studentPoint?.reachedAt) {
      items.push({
        id: `${student.id}-arrived`,
        title: "Arrived at School",
        subtitle: `${student.firstName} reached school safely.`,
        timeLabel: formatRelativeTime(trip.studentPoint.reachedAt),
        icon: "school",
      });
    }
  });

  return items.slice(0, 4);
};
