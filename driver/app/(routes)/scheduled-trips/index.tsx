import React, { Suspense } from "react";
import LoadingOverlay from "@/components/common/LoadingOverlay";

// Lazy load scheduled trips screen
const ScheduledTripsScreen = React.lazy(() => import("@/screens/scheduled-trips/scheduled-trips.screen"));

export default function index() {
  return (
    <Suspense fallback={<LoadingOverlay visible={true} message="Loading scheduled trips..." fullScreen />}>
      <ScheduledTripsScreen />
    </Suspense>
  );
}

