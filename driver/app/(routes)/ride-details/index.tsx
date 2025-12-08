import React, { Suspense } from "react";
import LoadingOverlay from "@/components/common/LoadingOverlay";

// Lazy load ride details screen
const RideDetailsScreen = React.lazy(() => import("@/screens/ride-details/ride-details.screen"));

export default function index() {
  return (
    <Suspense fallback={<LoadingOverlay visible={true} message="Loading ride details..." fullScreen />}>
      <RideDetailsScreen />
    </Suspense>
  );
}
