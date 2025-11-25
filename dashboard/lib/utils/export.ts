import { ScheduledTrip } from "@/types/trip";

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
    "Captain",
    "Captain Phone",
    "Captain Email",
    "Company",
    "Price",
    "Checkpoints",
    "Created At",
  ];

  // Convert trips to CSV rows
  const rows = trips.map((trip) => {
    const tripDate = new Date(trip.tripDate).toLocaleDateString();
    const tripTime = new Date(trip.scheduledTime).toLocaleTimeString();
    const createdAt = new Date(trip.createdAt).toLocaleString();

    return [
      trip.name,
      tripDate,
      tripTime,
      trip.status,
      trip.assignedCaptain?.name || "Not assigned",
      trip.assignedCaptain?.phone_number || "",
      trip.assignedCaptain?.email || "",
      trip.company?.name || "",
      trip.price !== undefined ? trip.price.toFixed(2) : "",
      trip.points?.length || 0,
      createdAt,
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

