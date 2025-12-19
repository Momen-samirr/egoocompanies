import api from "@/lib/api";

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  distanceFromRoute?: number;
  isRouteDeviation?: boolean;
}

/**
 * Export location history as CSV
 */
export async function exportLocationHistoryToCSV(
  tripId: string,
  filename?: string
) {
  try {
    const response = await api.get(
      `/admin/trips/${tripId}/location-history?limit=10000`
    );
    const locations = response.data.locationHistory;

    if (locations.length === 0) {
      alert("No location history available for this trip");
      return;
    }

    const headers = [
      "Timestamp",
      "Latitude",
      "Longitude",
      "Speed (km/h)",
      "Heading",
      "Accuracy",
      "Distance from Route (m)",
      "Distance to Next Checkpoint (m)",
      "Is Route Deviation",
      "Is Idle",
      "Is Checkpoint Reached",
      "Checkpoint Index",
    ];

    const rows = locations.map((loc: any) => [
      new Date(loc.timestamp).toISOString(),
      loc.latitude,
      loc.longitude,
      loc.speed || "",
      loc.heading || "",
      loc.accuracy || "",
      loc.distanceFromRoute || "",
      loc.distanceFromNextCheckpoint || "",
      loc.isRouteDeviation ? "Yes" : "No",
      loc.isIdle ? "Yes" : "No",
      loc.isCheckpointReached ? "Yes" : "No",
      loc.checkpointIndex !== null ? loc.checkpointIndex : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) =>
        row
          .map((cell) => {
            const cellValue = String(cell || "");
            if (cellValue.includes(",") || cellValue.includes('"')) {
              return `"${cellValue.replace(/"/g, '""')}"`;
            }
            return cellValue;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename ||
        `trip-${tripId}-location-history-${
          new Date().toISOString().split("T")[0]
        }.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting location history:", error);
    alert("Failed to export location history");
  }
}

/**
 * Export route analysis as JSON
 */
export async function exportRouteAnalysisToJSON(
  tripId: string,
  filename?: string
) {
  try {
    const response = await api.get(`/admin/trips/${tripId}/route-analysis`);
    const analysis = response.data;

    const jsonContent = JSON.stringify(analysis, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename ||
        `trip-${tripId}-route-analysis-${
          new Date().toISOString().split("T")[0]
        }.json`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting route analysis:", error);
    alert("Failed to export route analysis");
  }
}

/**
 * Export analytics as CSV
 */
export async function exportAnalyticsToCSV(tripId: string, filename?: string) {
  try {
    const response = await api.get(`/admin/trips/${tripId}/analytics`);
    const analytics = response.data.analytics;

    const headers = ["Metric", "Value", "Unit"];

    const rows = [
      ["Average Speed", analytics.averageSpeed.toFixed(2), "km/h"],
      ["Max Speed", analytics.maxSpeed.toFixed(2), "km/h"],
      ["Total Idle Time", analytics.totalIdleTime.toFixed(2), "minutes"],
      ["Route Adherence", analytics.routeAdherence.toFixed(2), "%"],
      ["Total Distance", (analytics.totalDistance / 1000).toFixed(2), "km"],
    ];

    // Add checkpoint timings
    analytics.checkpointTimings.forEach((timing: any) => {
      rows.push([
        `Checkpoint: ${timing.checkpointName} - Expected`,
        timing.expectedTime
          ? new Date(timing.expectedTime).toLocaleString()
          : "N/A",
        "",
      ]);
      rows.push([
        `Checkpoint: ${timing.checkpointName} - Actual`,
        timing.reachedAt
          ? new Date(timing.reachedAt).toLocaleString()
          : "Not reached",
        "",
      ]);
      if (timing.delayMinutes !== null) {
        rows.push([
          `Checkpoint: ${timing.checkpointName} - Delay`,
          timing.delayMinutes.toFixed(1),
          "minutes",
        ]);
      }
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const cellValue = String(cell || "");
            if (cellValue.includes(",") || cellValue.includes('"')) {
              return `"${cellValue.replace(/"/g, '""')}"`;
            }
            return cellValue;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename ||
        `trip-${tripId}-analytics-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting analytics:", error);
    alert("Failed to export analytics");
  }
}

/**
 * Export timeline data as JSON (for replay)
 */
export async function exportTimelineToJSON(tripId: string, filename?: string) {
  try {
    const [locationResponse, tripResponse] = await Promise.all([
      api.get(`/admin/trips/${tripId}/location-history?limit=10000`),
      api.get(`/admin/trips/${tripId}`),
    ]);

    const locations = locationResponse.data.locationHistory;
    const trip = tripResponse.data.trip;

    const timelineData = {
      trip: {
        id: trip.id,
        name: trip.name,
        status: trip.status,
        tripDate: trip.tripDate,
        scheduledTime: trip.scheduledTime,
      },
      plannedRoute: trip.points.map((p: any) => ({
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        order: p.order,
        expectedTime: p.expectedTime,
        reachedAt: p.reachedAt,
      })),
      locationHistory: locations.map((loc: any) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp,
        speed: loc.speed,
        heading: loc.heading,
        accuracy: loc.accuracy,
        distanceFromRoute: loc.distanceFromRoute,
        distanceFromNextCheckpoint: loc.distanceFromNextCheckpoint,
        isRouteDeviation: loc.isRouteDeviation,
        isIdle: loc.isIdle,
        isCheckpointReached: loc.isCheckpointReached,
        checkpointIndex: loc.checkpointIndex,
      })),
    };

    const jsonContent = JSON.stringify(timelineData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename ||
        `trip-${tripId}-timeline-${new Date().toISOString().split("T")[0]}.json`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting timeline:", error);
    alert("Failed to export timeline data");
  }
}

/**
 * Export route comparison as image (screenshot of map)
 * Note: This requires the map to be rendered and uses html2canvas or similar
 * For now, we'll export the data and let the user take a screenshot
 */
export async function exportRouteComparisonData(
  tripId: string,
  filename?: string
) {
  try {
    const response = await api.get(`/admin/trips/${tripId}/route-analysis`);
    const analysis = response.data;

    // Create a text summary
    const summary = `
Route Comparison Report
Trip ID: ${tripId}
Generated: ${new Date().toLocaleString()}

Planned Distance: ${(analysis.plannedDistance / 1000).toFixed(2)} km
Actual Distance: ${(analysis.actualDistance / 1000).toFixed(2)} km
Route Efficiency: ${analysis.routeEfficiency.toFixed(2)}%

Statistics:
- Total Deviation Distance: ${(
      analysis.statistics.totalDeviationDistance / 1000
    ).toFixed(2)} km
- Average Deviation: ${(analysis.statistics.averageDeviation / 1000).toFixed(
      2
    )} km
- Largest Deviation: ${(analysis.statistics.largestDeviation / 1000).toFixed(
      2
    )} km
- Deviation Count: ${analysis.statistics.deviationCount}

Deviation Segments: ${analysis.deviationSegments.length}
${analysis.deviationSegments
  .map(
    (seg: any, index: number) => `
Segment ${index + 1}:
  Start: ${new Date(seg.start.timestamp).toLocaleString()}
  End: ${new Date(seg.end.timestamp).toLocaleString()}
  Duration: ${seg.duration.toFixed(1)} minutes
  Max Deviation: ${(seg.maxDeviation / 1000).toFixed(2)} km
`
  )
  .join("")}
`;

    const blob = new Blob([summary], { type: "text/plain" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename ||
        `trip-${tripId}-route-comparison-${
          new Date().toISOString().split("T")[0]
        }.txt`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting route comparison:", error);
    alert("Failed to export route comparison");
  }
}
