import { ScheduledTrip } from "@/types/trip";
import { deriveTripFinance } from "./tripFinance";

export function exportTripsToCSV(trips: ScheduledTrip[], filename = "trips.csv") {
  if (trips.length === 0) {
    return;
  }

  // Define CSV headers
  const headers = [
    "Trip Name",
    "Date",
    "Time",
    "Status",
    "Finance Rule",
    "Captain",
    "Captain Phone",
    "Captain Email",
    "Company",
    "Price",
    "Applied Adjustment",
    "Net Amount",
    "Checkpoints",
    "Created At",
    "Status History",
    "Latest Note",
  ];

  // Convert trips to CSV rows
  const rows = trips.map((trip) => {
    const tripDate = new Date(trip.tripDate).toLocaleDateString();
    const tripTime = new Date(trip.scheduledTime).toLocaleTimeString();
    const createdAt = new Date(trip.createdAt).toLocaleString();
    const finance = deriveTripFinance(trip);

    // Safely format numbers, handling null/undefined/NaN
    const formatNumber = (value: number | null | undefined): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return "0.00";
      }
      return value.toFixed(2);
    };

    // Format status history
    const formatStatusHistory = (): string => {
      if (!trip.statusHistory || trip.statusHistory.length === 0) {
        return "No status changes";
      }
      // Sort by changedAt descending (most recent first) for display
      const sortedHistory = [...trip.statusHistory].sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
      );
      return sortedHistory
        .map((history) => {
          const date = new Date(history.changedAt).toLocaleString();
          let change = `Status changed from ${history.previousStatus} to ${history.newStatus} on ${date}`;
          
          // Add deduction if present
          if (history.deduction !== undefined && history.deduction !== null && history.deduction > 0) {
            change += ` - Deduction: $${formatNumber(history.deduction)}`;
          }
          
          // Add note if present
          const note = history.note ? ` - ${history.note}` : "";
          return change + note;
        })
        .join(" | ");
    };

    // Get latest note
    const getLatestNote = (): string => {
      if (!trip.statusHistory || trip.statusHistory.length === 0) {
        return "";
      }
      // Sort by changedAt descending to get most recent
      const sortedHistory = [...trip.statusHistory].sort(
        (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
      );
      return sortedHistory[0]?.note || "";
    };

    return [
      trip.name,
      tripDate,
      tripTime,
      trip.status,
      finance.ruleLabel,
      trip.assignedCaptain?.name || "Not assigned",
      trip.assignedCaptain?.phone_number || "",
      trip.assignedCaptain?.email || "",
      trip.company?.name || "",
      trip.price !== undefined && trip.price !== null ? formatNumber(trip.price) : "",
      formatNumber(finance.appliedAmount),
      formatNumber(finance.netAmount),
      trip.points?.length || 0,
      createdAt,
      formatStatusHistory(),
      getLatestNote(),
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape commas and quotes in cell values
          const cellValue = String(cell || "");
          if (cellValue.includes(",") || cellValue.includes('"')) {
            return `"${cellValue.replace(/"/g, '""')}"`;
          }
          return cellValue;
        })
        .join(",")
    ),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

