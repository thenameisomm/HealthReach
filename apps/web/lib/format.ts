import type { Brief, Currency, Plan } from "./api";

export function formatMoney(
  amount: number,
  currency: Currency = "USD",
  opts: { decimals?: boolean } = {},
): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(amount);
}

export function formatDistance(meters?: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return "Distance not recorded";
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function briefCurrency(brief: Brief): Currency {
  if (brief.currency) return brief.currency;
  if (brief.budget_usd != null) return "USD";
  return "INR";
}

export function briefBudget(brief: Brief): number {
  if (briefCurrency(brief) === "USD") return brief.budget_usd ?? 0;
  return brief.budget_inr ?? 0;
}

export function planCurrency(plan?: Plan | null): Currency {
  if (!plan) return "USD";
  if (plan.currency) return plan.currency;
  if (plan.budget_total_usd != null) return "USD";
  return "INR";
}

export function planBudget(plan?: Plan | null): number {
  if (!plan) return 0;
  return planCurrency(plan) === "USD"
    ? (plan.budget_total_usd ?? 0)
    : (plan.budget_total_inr ?? 0);
}

export function activityCost(
  activity: Plan["activities"][number],
  currency: Currency,
): number {
  return currency === "USD"
    ? (activity.cost_usd ?? 0)
    : (activity.cost_inr ?? 0);
}

export function budgetLineAmount(
  line: Plan["budget"][number],
  currency: Currency,
): number {
  return currency === "USD" ? (line.amount_usd ?? 0) : (line.amount_inr ?? 0);
}

/** Parse "120–300 people" or "$1,200–$2,000" into a numeric range. */
export function parseRange(text: string): { min: number; max: number } | null {
  const cleaned = text.replace(/,/g, "");
  const numbers = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;
  const values = numbers.map(Number).filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function rangeMidpoint(text: string): number | null {
  const r = parseRange(text);
  return r ? (r.min + r.max) / 2 : null;
}
