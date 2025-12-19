"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TripFinanceSummary } from "@/types/trip";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/tripFinance";
import { Separator } from "@/components/ui/separator";

interface TripFinanceSummaryCardsProps {
  today?: TripFinanceSummary;
  lastTwoWeeks?: TripFinanceSummary;
  loading?: boolean;
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

const formatRange = (summary?: TripFinanceSummary) => {
  if (!summary) return "No data";
  const start = new Date(summary.range.start);
  const end = new Date(summary.range.end);
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
};

const SummaryCard = ({
  title,
  summary,
}: {
  title: string;
  summary?: TripFinanceSummary;
}) => {
  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-base text-muted-foreground/70 mt-1">
            No earnings recorded
          </p>
        </CardContent>
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
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground/70">
            {formatRange(summary)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Metric
            label="Net Amount"
            value={formatCurrency(summary.netAmount)}
          />
          <Metric label="Trips" value={summary.totalTrips.toString()} />
          <Metric label="Earnings" value={formatCurrency(summary.earnings)} />
          <Metric
            label="Deductions"
            value={formatCurrency(summary.deductions)}
          />
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-3 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">{completedTrips}</p>
            <p>Completed</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{failedTrips}</p>
            <p>Failed</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{emergencyTrips}</p>
            <p>Emergency</p>
          </div>
        </div>
      </CardContent>
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
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
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
