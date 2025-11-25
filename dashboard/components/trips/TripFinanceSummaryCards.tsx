"use client";

import Card, { CardBody, CardHeader } from "@/components/common/Card";
import { TripFinanceSummary } from "@/types/trip";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/tripFinance";

interface TripFinanceSummaryCardsProps {
  today?: TripFinanceSummary;
  lastTwoWeeks?: TripFinanceSummary;
  loading?: boolean;
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-900">{value}</p>
  </div>
);

const formatRange = (summary?: TripFinanceSummary) => {
  if (!summary) return "No data";
  const start = new Date(summary.range.start);
  const end = new Date(summary.range.end);
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
};

const SummaryCard = ({ title, summary }: { title: string; summary?: TripFinanceSummary }) => {
  if (!summary) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-base text-gray-400 mt-1">No earnings recorded</p>
        </CardBody>
      </Card>
    );
  }

  const completedTrips = summary.statusCounts.COMPLETED?.trips || 0;
  const failedTrips = summary.statusCounts.FAILED?.trips || 0;
  const emergencyTrips =
    (summary.statusCounts.EMERGENCY_ENDED?.trips || 0) +
    (summary.statusCounts.EMERGENCY_TERMINATED?.trips || 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xs text-gray-400">{formatRange(summary)}</p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Metric label="Net Amount" value={formatCurrency(summary.netAmount)} />
          <Metric label="Trips" value={summary.totalTrips.toString()} />
          <Metric label="Earnings" value={formatCurrency(summary.earnings)} />
          <Metric label="Deductions" value={formatCurrency(summary.deductions)} />
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-3 text-xs text-gray-600">
          <div>
            <p className="font-semibold text-gray-800">{completedTrips}</p>
            <p>Completed</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">{failedTrips}</p>
            <p>Failed</p>
          </div>
          <div>
            <p className="font-semibold text-gray-800">{emergencyTrips}</p>
            <p>Emergency</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default function TripFinanceSummaryCards({
  today,
  lastTwoWeeks,
  loading = false,
}: TripFinanceSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((key) => (
          <Card key={key}>
            <CardBody>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-6 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard title="Today's Earnings" summary={today} />
      <SummaryCard title="Last 14 Days" summary={lastTwoWeeks} />
    </div>
  );
}

