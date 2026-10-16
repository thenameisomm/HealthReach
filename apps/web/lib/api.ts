const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(`${BASE}${path}`, {
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

export interface Brief {
  topic: string;
  location_text: string;
  audience_age_min: number;
  audience_age_max: number;
  audience_notes: string;
  budget_inr: number;
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
  geo_venues: GeoVenue[];
  qloo_status: "ok" | "thin" | "unavailable";
  qloo_note: string;
  geo_status: "ok" | "thin" | "unavailable";
  geo_note: string;
  created_at: string;
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
    cost_inr: number;
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
  budget: { label: string; amount_inr: number; provenance: Provenance }[];
  budget_total_inr: number;
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
}

export const api = {
  config: () =>
    req<{ qlooConfigured: boolean; llmConfigured: boolean }>("/api/config"),
  createCampaign: (brief: Brief, mode: "real" | "demo" = "real") =>
    req<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({ brief, mode }),
    }),
  listCampaigns: () => req<Campaign[]>("/api/campaigns"),
  getCampaign: (id: string) => req<CampaignDetail>(`/api/campaigns/${id}`),
  buildEvidence: (id: string) =>
    req<Evidence>(`/api/campaigns/${id}/evidence`, { method: "POST" }),
  buildPlan: (id: string, section?: string) =>
    req<Plan>(`/api/campaigns/${id}/plan`, {
      method: "POST",
      body: JSON.stringify({ section: section ?? null }),
    }),
  saveResults: (
    id: string,
    body: {
      registrations: number;
      attendance: number;
      spend_inr: number;
      engagement: number;
      notes: string;
    },
  ) =>
    req<{ ok: boolean }>(`/api/campaigns/${id}/results`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  analytics: (id: string) =>
    req<{
      hasResults: boolean;
      analytics?: Analytics;
      results?: unknown;
      planned_spend_inr?: number;
      planned_range?: string;
    }>(`/api/campaigns/${id}/analytics`),
  demoScenario: () => req<{ brief: Brief }>(`/api/demo/scenario`),
};

export interface Analytics {
  planned_registrations: string;
  actual_registrations: number;
  planned_attendance: string;
  actual_attendance: number;
  planned_spend_inr: number;
  actual_spend_inr: number;
  cost_per_registration: number | null;
  attendance_rate: number | null;
  note: string;
}

export const isIllustrative = (p?: Provenance) => p === "illustrative";
