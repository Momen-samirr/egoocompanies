"use client";

import { TripInvoice } from "@/types/trip";
import Card, { CardBody, CardHeader } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/tripFinance";

interface TripInvoiceGeneratorProps {
  range: {
    start: string;
    end: string;
  };
  onRangeChange: (range: { start: string; end: string }) => void;
  onGenerate: () => void;
  loading?: boolean;
  invoice?: TripInvoice | null;
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
  </div>
);

const prettify = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function TripInvoiceGenerator({
  range,
  onRangeChange,
  onGenerate,
  loading = false,
  invoice,
}: TripInvoiceGeneratorProps) {
  const handleInputChange = (key: "start" | "end", value: string) => {
    onRangeChange({
      ...range,
      [key]: value,
    });
  };

  const formattedRange =
    invoice && `${format(new Date(invoice.range.start), "MMM d, yyyy")} → ${format(new Date(invoice.range.end), "MMM d, yyyy")}`;

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-lg font-semibold text-gray-900">Invoice Generator</p>
          <p className="text-sm text-gray-500">
            Select a date range to calculate deductions and payouts across all captains.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={range.start}
              onChange={(event) => handleInputChange("start", event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={range.end}
              onChange={(event) => handleInputChange("end", event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={onGenerate} disabled={!range.start || !range.end || loading} className="w-full">
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" text="Calculating invoice..." />
          </div>
        )}

        {!loading && invoice && (
          <div className="mt-6 space-y-6">
            <div>
              <p className="text-sm font-semibold text-gray-700">Invoice Summary</p>
              <p className="text-xs text-gray-500">{formattedRange}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric label="Net Amount" value={formatCurrency(invoice.totals.netAmount)} />
              <Metric label="Total Trips" value={invoice.totals.totalTrips.toString()} />
              <Metric label="Completed" value={invoice.completedTrips.toString()} />
              <Metric label="Failed" value={invoice.failedTrips.toString()} />
              <Metric label="Emergency" value={invoice.emergencyTrips.toString()} />
              <Metric label="Earnings" value={formatCurrency(invoice.totals.earnings)} />
              <Metric label="Deductions" value={formatCurrency(invoice.totals.deductions)} />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Line Items</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Trip</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Rule</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Price</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Net</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {invoice.lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          No trips in this range
                        </td>
                      </tr>
                    ) : (
                      invoice.lineItems.map((item) => (
                        <tr key={item.ledgerId}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{item.tripName || "Unnamed Trip"}</p>
                            <p className="text-xs text-gray-500">
                              {item.captain?.name || "Unassigned"} • {item.company?.name || "No company"}
                            </p>
                          </td>
                          <td className="px-4 py-3">{prettify(item.status)}</td>
                          <td className="px-4 py-3">{prettify(item.rule)}</td>
                          <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                          <td
                            className={`px-4 py-3 font-semibold ${
                              item.netAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {formatCurrency(item.netAmount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {format(new Date(item.calculatedAt), "MMM d, yyyy")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

