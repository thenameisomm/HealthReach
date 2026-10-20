export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 45000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new ApiError(r.status, detailFrom(body) || r.statusText, body);
    }
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function detailFrom(body: string): string {
  try {
    const j = JSON.parse(body);
    if (typeof j?.detail === "string") return j.detail;
  } catch {
    /* not JSON — fall through */
  }
  return body.length < 160 ? body : "";
}

/** Plain-language error messages for non-technical users. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404)
      return "That campaign couldn't be found. It may have been deleted, or the link is wrong.";
    if (err.status === 429)
      return "Too many requests at once. Wait a minute, then try again — nothing you saved is lost.";
    if (err.status === 400 && err.message) {
      if (err.message.includes("Build evidence first"))
        return "Look up local information first (step 2 above), then create the plan.";
      return err.message;
    }
    if (err.status === 422)
      return "Some of those details weren't accepted. Check the values and try again — nothing was saved.";
    if (err.status >= 500)
      return "The server ran into a problem. What you already saved is safe — try again in a moment.";
    return err.message || "Something went wrong. Try again.";
  }
  if (err instanceof DOMException && err.name === "AbortError")
    return "That took too long, so it was stopped. Try again — what you saved is safe.";
  if (err instanceof TypeError)
    return "Couldn't reach the server. Make sure it is running (`pnpm dev`) and you're online, then try again.";
  return err instanceof Error && err.message
    ? err.message
    : "Something went wrong. Try again.";
}

export type Provenance = "qloo" | "geo" | "ai" | "user" | "illustrative";
export type Currency = "USD" | "INR";

export interface Brief {
  topic: string;
  location_text: string;
  audience_age_min: number;
  audience_age_max: number;
  audience_notes: string;
  /** USD is the product default. One of the two budget fields is required. */
  budget_usd?: number | null;
  budget_inr?: number | null;
  currency?: Currency | null;
  duration_days: number;
  objective: string;
}

export interface Campaign {
  id: string;
  brief: Brief;
  geocode: {
    display_name: string;
    lat: number;
    lon: number;
    provenance: Provenance;
  } | null;
  mode: "real" | "demo";
  /** Which illustrative scenario a demo campaign uses. */
  demo_scenario?: "kothrud" | "us" | null;
  created_at: string;
  /** Workflow stage, added by GET /api/campaigns. */
  stage?: "brief" | "info" | "plan" | "results";
}

export interface CampaignDetail {
  campaign: Campaign;
  plans: Plan[];
  evidence: Evidence | null;
  results: Record<string, unknown> | null;
}

export interface QlooSignal {
  kind: string;
  label: string;
  detail: string;
  affinity: number | null;
  popularity: number | null;
  entity_id?: string | null;
  provenance: Provenance;
}

/** One linked Qloo lookup in the chain that built the evidence snapshot. */
export interface QlooChainStep {
  step: number;
  title: string;
  asked: string;
  found: string;
  next: string;
  top_names: string[];
  status: "ok" | "skip";
  skip_reason: string;
  provenance: Provenance;
}

export interface GeoVenue {
  name: string;
  category: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  distance_m?: number | null;
  provenance: Provenance;
  needs_verification: boolean;
}

export interface Evidence {
  campaign_id: string;
  qloo_signals: QlooSignal[];
  qloo_steps?: QlooChainStep[];
  geo_venues: GeoVenue[];
  qloo_status: "ok" | "thin" | "unavailable";
  qloo_note: string;
  geo_status: "ok" | "thin" | "unavailable";
  geo_note: string;
  created_at: string;
}

export interface GeoSuggestion {
  label: string;
  lat: number;
  lon: number;
  kind: string;
}

export interface GeoSuggestResponse {
  status: "ok" | "unavailable";
  suggestions: GeoSuggestion[];
  note: string;
  attribution: string;
}

export interface GeoReverseResponse {
  status: "ok" | "thin" | "unavailable";
  label: string;
  lat: number;
  lon: number;
  note: string;
  attribution: string;
}

export interface Plan {
  campaign_id: string;
  version: number;
  summary: string;
  activities: {
    title: string;
    channel: string;
    why: string;
    evidence_refs: string[];
    cost_usd?: number | null;
    cost_inr?: number | null;
    provenance: Provenance;
  }[];
  venues: {
    name: string;
    reason: string;
    evidence_refs: string[];
    status: string;
    needs_verification: boolean;
    provenance: Provenance;
  }[];
  budget: {
    label: string;
    amount_usd?: number | null;
    amount_inr?: number | null;
    provenance: Provenance;
  }[];
  budget_total_usd?: number | null;
  budget_total_inr?: number | null;
  currency?: Currency | null;
  materials: {
    kind: string;
    title: string;
    body: string;
    review_notice: string;
    provenance: Provenance;
  }[];
  metrics: {
    name: string;
    target_range: string;
    basis: string;
    provenance: Provenance;
  }[];
  assumptions: string[];
  limitations: string[];
  has_cultural_signals: boolean;
  /** "ai-model" when an external model drafted this version, else the fixed template. */
  planner?: "ai-model" | "standard-template";
  created_at?: string;
}

export interface QlooStepProgress {
  step: number;
  title: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "failed";
  requests_made: number;
  retries: number;
  cache_hits: number;
  started_at?: string | null;
  completed_at?: string | null;
  skip_reason: string;
}

export interface QlooProgress {
  campaign_id: string;
  total_requests: number;
  requests_by_step: Record<string, number>;
  retries: number;
  cache_hits: number;
  steps: QlooStepProgress[];
  overall_status: "pending" | "in_progress" | "completed" | "failed";
  current_step: number;
  attribution?: string;
}

export interface ResultsBody {
  registrations: number;
  attendance: number;
  spend_usd?: number;
  spend_inr?: number;
  engagement: number;
  notes: string;
}

export interface PlanComparison {
  campaign_id: string;
  from_version: number;
  to_version: number;
  changed_sections: string[];
  changes: Record<string, { from: unknown; to: unknown }>;
}

export const api = {
  config: () =>
    req<{ qlooConfigured: boolean; llmConfigured: boolean }>("/api/config"),
  createCampaign: (
    brief: Brief,
    mode: "real" | "demo" = "real",
    scenario: "kothrud" | "us" = "kothrud",
  ) =>
    req<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({ brief, mode, scenario }),
    }),
  listCampaigns: () => req<Campaign[]>("/api/campaigns"),
  getCampaign: (id: string) => req<CampaignDetail>(`/api/campaigns/${id}`),
  buildEvidence: (id: string) =>
    req<Evidence>(`/api/campaigns/${id}/evidence`, { method: "POST" }),
  evidenceProgress: (id: string) =>
    req<QlooProgress>(`/api/campaigns/${id}/evidence/progress`, undefined, 10000),
  buildPlan: (id: string, section?: string) =>
    req<Plan>(`/api/campaigns/${id}/plan`, {
      method: "POST",
      body: JSON.stringify({ section: section ?? null }),
    }),
  saveResults: (id: string, body: ResultsBody) =>
    req<{ ok: boolean }>(`/api/campaigns/${id}/results`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  analytics: (id: string) =>
    req<{
      hasResults: boolean;
      currency?: Currency;
      analytics?: Analytics;
      results?: unknown;
      planned_spend?: number;
      planned_range?: string;
    }>(`/api/campaigns/${id}/analytics`),
  comparePlans: (id: string, fromVersion: number, toVersion: number) =>
    req<PlanComparison>(
      `/api/campaigns/${id}/plans/compare?from_version=${fromVersion}&to_version=${toVersion}`,
    ),
  demoScenario: (scenario: "kothrud" | "us" = "kothrud") =>
    req<{
      scenario: string;
      brief: Brief;
      geocode: {
        display_name: string;
        lat: number;
        lon: number;
        provenance: Provenance;
      };
      label: string;
      provenance: Provenance;
    }>(`/api/demo/scenario?scenario=${scenario}`),
  /** Location autocomplete (OpenStreetMap). Short timeout: typing UX. */
  geoSuggest: (q: string) =>
    req<GeoSuggestResponse>(
      `/api/geo/suggest?q=${encodeURIComponent(q)}`,
      undefined,
      12000,
    ),
  /** Name a picked map point (OpenStreetMap reverse geocode). */
  geoReverse: (lat: number, lon: number) =>
    req<GeoReverseResponse>(
      `/api/geo/reverse?lat=${lat}&lon=${lon}`,
      undefined,
      12000,
    ),
};

/** Download an export without exposing API internals to the caller. */
export async function downloadExport(
  id: string,
  format: "csv" | "pdf" | "json",
): Promise<void> {
  const r = await fetch(`${API_BASE}/api/campaigns/${id}/export/${format}`);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new ApiError(r.status, detailFrom(body) || r.statusText, body);
  }
  const blob = await r.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `healthreach-${format}-${id}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface Analytics {
  currency: Currency;
  planned_registrations: string;
  actual_registrations: number;
  planned_attendance: string;
  actual_attendance: number;
  planned_engagement: string;
  actual_engagement: number;
  planned_spend: number;
  actual_spend: number;
  planned_spend_usd?: number | null;
  planned_spend_inr?: number | null;
  actual_spend_usd?: number | null;
  actual_spend_inr?: number | null;
  cost_per_registration: number | null;
  cost_per_attendee?: number | null;
  attendance_rate: number | null;
  note: string;
}

export const isIllustrative = (p?: Provenance) => p === "illustrative";
