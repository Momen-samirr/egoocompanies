import {
  ScheduledTrip,
  ScheduledTripFinancialRule,
  ScheduledTripStatus,
} from "@/types/trip";

const RULE_MULTIPLIERS: Record<ScheduledTripFinancialRule, number> = {
  NONE: 0,
  COMPLETED_FULL: 1,
  FAILED_DOUBLE: -2,
  EMERGENCY_DEDUCTION: -1,
};

const STATUS_RULE_MAP: Partial<Record<ScheduledTripStatus, ScheduledTripFinancialRule>> = {
  COMPLETED: "COMPLETED_FULL",
  FAILED: "FAILED_DOUBLE",
  EMERGENCY_ENDED: "EMERGENCY_DEDUCTION",
  EMERGENCY_TERMINATED: "EMERGENCY_DEDUCTION",
};

const RULE_LABELS: Record<ScheduledTripFinancialRule, string> = {
  NONE: "No Adjustment",
  COMPLETED_FULL: "Full Payout",
  FAILED_DOUBLE: "Double Price Deduction",
  EMERGENCY_DEDUCTION: "Emergency Deduction",
};

export const formatCurrency = (value: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

export const deriveTripFinance = (trip: ScheduledTrip) => {
  const baseAmount = trip.price ?? 0;

  let resolvedRule: ScheduledTripFinancialRule = trip.financialRule || "NONE";
  if (resolvedRule === "NONE") {
    const fallbackRule = STATUS_RULE_MAP[trip.status];
    if (fallbackRule) {
      resolvedRule = fallbackRule;
    }
  }

  const multiplier = RULE_MULTIPLIERS[resolvedRule] ?? 0;
  const computedNet = baseAmount * multiplier;

  const netAmount =
    typeof trip.netAmount === "number" ? trip.netAmount : computedNet;
  const appliedAmount =
    typeof trip.financialAdjustment === "number"
      ? trip.financialAdjustment
      : netAmount;

  return {
    baseAmount,
    appliedAmount,
    netAmount,
    rule: resolvedRule,
    ruleLabel: RULE_LABELS[resolvedRule],
    hasFinanceApplied: Boolean(trip.financialAppliedAt),
  };
};

