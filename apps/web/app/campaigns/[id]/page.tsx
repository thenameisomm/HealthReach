"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  friendlyError,
  type Analytics,
  type CampaignDetail,
  type Plan,
} from "@/lib/api";
import {
  ProvenanceBadge,
  DemoBanner,
  SourceLegend,
} from "@/components/Provenance";
import { InfoTip } from "@/components/InfoTip";
import { MapView } from "@/components/MapView";
import { EmptyState, ProgressStatus, Skeleton } from "@/components/States";

type Phase =
  | "loading"
  | "brief"
  | "evidence-loading"
  | "evidence"
  | "plan-loading"
  | "ready";

interface ResultsForm {
  registrations: number;
  attendance: number;
  spend_inr: number;
  engagement: number;
  notes: string;
}

const RESULT_FIELDS: {
  key: keyof Omit<ResultsForm, "notes">;
  label: string;
  help: string;
}[] = [
  {
    key: "registrations",
    label: "Registrations",
    help: "How many people signed up in total.",
  },
  {
    key: "attendance",
    label: "Attendance",
    help: "How many people actually showed up.",
  },
  {
    key: "spend_inr",
    label: "Spend (₹)",
    help: "Total rupees actually spent.",
  },
  {
    key: "engagement",
    label: "Engagement",
    help: "Other interactions you counted — e.g. flyers taken or calls received.",
  },
];

/** Turn backend evidence references into plain words. */
function readableRef(ref: string): string {
  if (ref.startsWith("qloo:")) return `Community hint: ${ref.slice(5)}`;
  if (ref.startsWith("geo:")) return `Mapped place: ${ref.slice(4)}`;
  if (ref === "user:brief" || ref === "organizer brief") return "Your brief";
  if (ref === "mapped venues") return "Mapped places";
  return ref;
}

function affinityWords(affinity: number): string {
  if (affinity >= 0.6) return "strong match";
  if (affinity >= 0.3) return "moderate match";
  if (affinity > 0) return "slight match";
  return "weak or no match";
}

const REGEN_EXPLAIN =
  "Replace only this section with a fresh suggestion based on the same information. Everything else stays as it is. A refreshed suggestion is not independently checked.";

/** Plain goal labels matching the brief form's options. */
const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: "Raise awareness",
  attendance: "Bring people to a camp or event",
  screening: "Screen as many people as possible",
  vaccination: "Vaccinate as many people as possible",
};

/**
 * Translate backend service notes into plain words. Backend notes may contain
 * technical phrasing (e.g. missing-key messages); stored snapshots keep the
 * original, so translation happens here at display time.
 */
function plainServiceNote(note: string): string {
  if (/API_KEY/i.test(note))
    return "This source isn't set up on this server yet (a setup step for whoever runs the server — nothing you did wrong).";
  return note;
}

function isSetupIssue(note: string): boolean {
  return /API_KEY/i.test(note);
}

export default function CampaignPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [resultsForm, setResultsForm] = useState<ResultsForm>({
    registrations: 0,
    attendance: 0,
    spend_inr: 0,
    engagement: 0,
    notes: "",
  });
  const [savedMsg, setSavedMsg] = useState("");
  const [analytics, setAnalytics] = useState<{
    hasResults: boolean;
    analytics?: Analytics;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api.getCampaign(id);
      setDetail(d);
      const a = await api.analytics(id).catch(() => null);
      if (a) setAnalytics(a);
      if (!d.evidence) setPhase("brief");
      else if (!d.plans.length) setPhase("evidence");
      else setPhase("ready");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("brief");
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function gatherEvidence() {
    setPhase("evidence-loading");
    setError("");
    try {
      await api.buildEvidence(id);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
      setPhase("brief");
    }
  }

  async function generatePlan(section?: string) {
    setPlanBusy(section ?? "full");
    if (!section) setPhase("plan-loading");
    setError("");
    try {
      await api.buildPlan(id, section);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
      setPhase("evidence");
    } finally {
      setPlanBusy(null);
    }
  }

  async function saveResults(ev: React.FormEvent) {
    ev.preventDefault();
    setSavedMsg("");
    try {
      await api.saveResults(id, resultsForm);
      setSavedMsg("Results saved. The comparison below is now up to date.");
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (phase === "loading" || !detail) {
    return (
      <div
        className="mx-auto max-w-[1280px] px-6 py-10"
        aria-label="Loading campaign"
      >
        <Skeleton className="h-10 w-2/3" />
        <div className="mt-4 grid gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const { campaign, evidence, plans } = detail;
  const plan: Plan | undefined = plans[plans.length - 1];
  const isDemo = campaign.mode === "demo";
  const hasResults = analytics?.hasResults === true;
  const steps = ["Your brief", "Local information", "Outreach plan", "Results"];
  const currentStep = !evidence ? 1 : !plan ? 2 : !hasResults ? 3 : 4;
  const attendanceLooksOff =
    resultsForm.attendance > 0 &&
    resultsForm.registrations > 0 &&
    resultsForm.attendance > resultsForm.registrations;

  return (
    <div>
      {isDemo && <DemoBanner />}
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <ProgressStatus steps={steps} current={currentStep} />

        {/* Brief summary */}
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="font-display text-[32px] font-bold leading-tight sm:text-[40px]">
              {campaign.brief.topic}
            </h1>
          </div>
          <ProvenanceBadge kind={isDemo ? "illustrative" : "user"} />
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-secondary">Where:</dt>
            <dd className="font-medium">{campaign.brief.location_text}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-secondary">Who:</dt>
            <dd className="font-medium">
              Ages {campaign.brief.audience_age_min}–
              {campaign.brief.audience_age_max}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-secondary">Budget:</dt>
            <dd className="font-medium">
              ₹{campaign.brief.budget_inr.toLocaleString("en-IN")}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-secondary">Duration:</dt>
            <dd className="font-medium">{campaign.brief.duration_days} days</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-secondary">Main goal:</dt>
            <dd className="font-medium">
              {OBJECTIVE_LABELS[campaign.brief.objective] ??
                campaign.brief.objective}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[13px] text-secondary">
          <Link href={`/new?from=${campaign.id}`} className="link">
            Use these details for a new campaign
          </Link>{" "}
          · Briefs can&apos;t be edited after saving, so changes start as a new
          campaign.
        </p>
        <SourceLegend />

        {campaign.geocode ? (
          <p className="mt-3 text-[13px] text-secondary">
            <ProvenanceBadge kind={isDemo ? "illustrative" : "geo"} /> Map
            match: {campaign.geocode.display_name}{" "}
            <span className="font-mono">
              ({campaign.geocode.lat.toFixed(4)},{" "}
              {campaign.geocode.lon.toFixed(4)})
            </span>
          </p>
        ) : (
          <p
            role="status"
            className="card mt-3 border border-warning p-4 text-[14px]"
          >
            We couldn&apos;t find this place on the map, so nearby places
            can&apos;t be shown.{" "}
            <Link href="/new" className="link">
              Start a new campaign
            </Link>{" "}
            with a more specific “neighbourhood, city”.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[14px] text-strong-error">
            {error}
          </p>
        )}

        {/* LOCAL INFORMATION */}
        <section aria-labelledby="evidence" className="mt-8">
          <h2 id="evidence" className="font-display text-[24px] font-bold">
            Local information
          </h2>
          <p className="mt-1 max-w-[72ch] text-[14px] text-secondary">
            What we found about your area, and where each fact came from. Read
            this before the plan — it explains what the suggestions are built
            on.
          </p>
          {!evidence && phase !== "evidence-loading" && (
            <div className="mt-3">
              <EmptyState
                title="No local information yet"
                body="We'll look up two things: nearby places you could use (from a public map directory), and hints about message styles that feel familiar locally. If a source is unavailable, we'll say so and continue without inventing anything."
                action={
                  <button
                    type="button"
                    onClick={gatherEvidence}
                    className="btn-primary px-5 py-2.5"
                  >
                    Look up local information
                  </button>
                }
              />
            </div>
          )}
          {phase === "evidence-loading" && (
            <div
              className="mt-3 grid gap-3"
              aria-live="polite"
              aria-label="Looking up local information"
            >
              <Skeleton className="h-24" />
              <Skeleton className="h-40" />
              <p className="text-[14px] text-secondary">
                Looking up nearby places and familiar message styles for your
                area… this can take up to half a minute. What you saved is safe.
              </p>
            </div>
          )}
          {evidence && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="card p-5" aria-labelledby="qloo-h">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="qloo-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    What feels familiar locally
                  </h3>
                  <ProvenanceBadge kind={isDemo ? "illustrative" : "qloo"} />
                  <InfoTip label="familiarity hints">
                    These hints describe which message styles and gathering
                    formats an audience tends to respond to. They say nothing
                    about anyone&apos;s health, and are never medical facts.
                  </InfoTip>
                </div>
                <p className="mt-2 text-[13px] text-secondary">
                  Use these to phrase posters and messages in a familiar way —
                  not to decide who needs care.
                </p>
                {evidence.qloo_status !== "ok" && (
                  <p
                    role="status"
                    className="mt-2 rounded-input border border-warning p-3 text-[13px]"
                  >
                    {evidence.qloo_status === "thin"
                      ? "Little was available for this area: "
                      : "This source is currently unavailable: "}
                    {evidence.qloo_note
                      ? plainServiceNote(evidence.qloo_note)
                      : "The plan below is marked as missing these hints."}{" "}
                    {!isSetupIssue(evidence.qloo_note) && (
                      <>
                        <button
                          type="button"
                          onClick={gatherEvidence}
                          className="link"
                        >
                          Try again
                        </button>{" "}
                      </>
                    )}
                    or continue — the plan will work from places and your brief
                    instead.
                  </p>
                )}
                {evidence.qloo_signals.length === 0 &&
                  evidence.qloo_status === "ok" && (
                    <p className="mt-2 text-[14px] text-secondary">
                      Nothing relevant came back for this area — the plan will
                      say so.
                    </p>
                  )}
                <ul className="mt-3 space-y-3">
                  {evidence.qloo_signals.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-input border border-line p-3"
                    >
                      <p className="text-[14px] font-medium">
                        {s.label}
                        {s.affinity != null && (
                          <span className="ml-2 text-[12px] font-normal text-secondary">
                            ({affinityWords(s.affinity)})
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[13px] text-secondary">
                        {s.detail}
                      </p>
                    </li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="link cursor-pointer text-[13px]">
                    Technical details
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-input bg-canvas p-3 font-mono text-[12px]">
                    {JSON.stringify(evidence.qloo_signals, null, 2)}
                  </pre>
                </details>
              </article>

              <article className="card p-5" aria-labelledby="geo-h">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="geo-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    Places you could check in person
                  </h3>
                  <ProvenanceBadge kind={isDemo ? "illustrative" : "geo"} />
                </div>
                <p className="mt-2 text-[13px] text-secondary">
                  Real places from a public map directory. A listed place is a
                  candidate — visit it and confirm permission, space and access
                  before planning around it.
                </p>
                {campaign.geocode && (
                  <div className="mt-3">
                    <MapView
                      lat={campaign.geocode.lat}
                      lon={campaign.geocode.lon}
                      venues={evidence.geo_venues}
                    />
                  </div>
                )}
                {evidence.geo_note && (
                  <p className="mt-2 text-[13px] text-secondary">
                    {evidence.geo_note}{" "}
                    {evidence.geo_venues.length === 0 && (
                      <button
                        type="button"
                        onClick={gatherEvidence}
                        className="link"
                      >
                        Try again
                      </button>
                    )}
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {evidence.geo_venues.map((v, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded-input border border-line p-3"
                    >
                      <span className="flex-1">
                        <span className="text-[14px] font-medium">
                          {v.name}
                        </span>
                        <span className="block text-[13px] text-secondary">
                          {v.category}
                          {v.address ? ` · ${v.address}` : ""}
                        </span>
                      </span>
                      <span className="prov prov-geo">
                        <span aria-hidden="true">⚑</span> Visit and verify
                        before use
                      </span>
                    </li>
                  ))}
                  {evidence.geo_venues.length === 0 && (
                    <li className="text-[14px] text-secondary">
                      No mapped places in this radius — consider the
                      organizer&apos;s own site, after checking access.
                    </li>
                  )}
                </ul>
              </article>
            </div>
          )}
        </section>

        {/* PLAN */}
        <section aria-labelledby="plan" className="mt-10">
          <h2 id="plan" className="font-display text-[24px] font-bold">
            Your outreach plan (draft to review)
          </h2>
          <p className="mt-1 max-w-[72ch] text-[14px] text-secondary">
            Suggested activities, places, a budget split and draft messages —
            each linked to the information behind it. Nothing here is final:
            review everything with your team before using it.
          </p>
          {!plan && phase !== "plan-loading" && evidence && (
            <div className="mt-3">
              <EmptyState
                title="Ready when you are"
                body="The draft lists what to do, where to consider doing it, how your budget is divided, and what to say — with the basis shown for every estimate."
                action={
                  <button
                    type="button"
                    onClick={() => generatePlan()}
                    className="btn-primary px-5 py-2.5"
                  >
                    Create outreach plan
                  </button>
                }
              />
            </div>
          )}
          {phase === "plan-loading" && (
            <div
              className="mt-3"
              aria-live="polite"
              aria-label="Creating outreach plan"
            >
              <Skeleton className="h-16" />
              <div className="mt-2 grid gap-2">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <p className="mt-2 text-[14px] text-secondary">
                Drafting activities, checking the budget adds up, and linking
                each suggestion to its source…
              </p>
            </div>
          )}
          {plan && (
            <div className="mt-4 space-y-4">
              <div className="card p-5">
                <p className="text-[15px]">{plan.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProvenanceBadge kind={isDemo ? "illustrative" : "ai"} />
                  {!plan.has_cultural_signals && (
                    <span className="prov prov-ai">
                      <span aria-hidden="true">!</span> Built without
                      familiarity hints — from places + your brief
                    </span>
                  )}
                  <span className="font-mono text-[12px] text-secondary">
                    v{plan.version}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-secondary">
                  How this draft was made:{" "}
                  {plan.planner === "ai-model"
                    ? "written by an AI model using the information above."
                    : "put together from a standard planning template using the information above — no AI model was involved."}
                </p>
              </div>

              <div
                className="card border-warning p-5"
                aria-labelledby="review-h"
              >
                <h3
                  id="review-h"
                  className="font-display text-[18px] font-semibold"
                >
                  Before you use this plan, check these
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-secondary">
                  <li>
                    Visit each suggested place and confirm permission, space,
                    accessibility and facilities.
                  </li>
                  <li>
                    Have a qualified health professional review every poster,
                    message and script.
                  </li>
                  <li>
                    Treat estimated numbers as planning guesses, not promises of
                    turnout.
                  </li>
                  <li>
                    Confirm the budget split with whoever controls the money.
                  </li>
                </ul>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="card p-5" aria-labelledby="act-h">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="act-h"
                      className="font-display text-[18px] font-semibold"
                    >
                      Suggested activities
                    </h3>
                    <button
                      type="button"
                      disabled={!!planBusy}
                      onClick={() => generatePlan("activities")}
                      title={REGEN_EXPLAIN}
                      aria-label={`Get fresh activity ideas. ${REGEN_EXPLAIN}`}
                      className="link shrink-0 text-[13px] disabled:opacity-50"
                    >
                      {planBusy === "activities"
                        ? "Refreshing…"
                        : "Get fresh ideas"}
                    </button>
                  </div>
                  <ul className="mt-3 space-y-3">
                    {plan.activities.map((a, i) => (
                      <li
                        key={i}
                        className="rounded-input border border-line p-3"
                      >
                        <p className="text-[14px] font-medium">
                          {a.title}{" "}
                          <span className="font-normal text-secondary">
                            · {a.channel}
                          </span>
                        </p>
                        <p className="mt-1 text-[13px] text-secondary">
                          {a.why}
                        </p>
                        <p className="mt-1 text-[12px] text-secondary">
                          Based on:{" "}
                          {a.evidence_refs.map(readableRef).join(" · ") ||
                            "your brief"}{" "}
                          · Costs ₹{a.cost_inr.toLocaleString("en-IN")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="card p-5" aria-labelledby="ven-h">
                  <h3
                    id="ven-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    Places to evaluate
                  </h3>
                  <p className="mt-1 text-[13px] text-secondary">
                    Worth a visit — not approved. Confirm space, permission and
                    access on site.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {plan.venues.map((v, i) => (
                      <li
                        key={i}
                        className="rounded-input border border-line p-3"
                      >
                        <p className="text-[14px] font-medium">{v.name}</p>
                        <p className="mt-1 text-[13px] text-secondary">
                          {v.reason}
                        </p>
                        <p className="mt-1">
                          <span className="prov prov-geo">
                            <span aria-hidden="true">⚑</span>{" "}
                            {v.needs_verification
                              ? "Visit and verify before use"
                              : v.status}
                          </span>
                        </p>
                        <p className="mt-1 text-[12px] text-secondary">
                          Based on:{" "}
                          {v.evidence_refs.map(readableRef).join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>

              <article className="card p-5" aria-labelledby="budget-h">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="budget-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    Budget — ₹{plan.budget_total_inr.toLocaleString("en-IN")}
                  </h3>
                  <button
                    type="button"
                    disabled={!!planBusy}
                    onClick={() => generatePlan("budget")}
                    title={REGEN_EXPLAIN}
                    aria-label={`Re-split the budget. ${REGEN_EXPLAIN}`}
                    className="link shrink-0 text-[13px] disabled:opacity-50"
                  >
                    {planBusy === "budget" ? "Refreshing…" : "Re-split budget"}
                  </button>
                </div>
                <ul className="mt-3 space-y-2" aria-label="Budget allocation">
                  {plan.budget.map((b, i) => {
                    const pct = Math.round(
                      (b.amount_inr / Math.max(1, plan.budget_total_inr)) * 100,
                    );
                    return (
                      <li key={i}>
                        <div className="flex justify-between text-[14px]">
                          <span>{b.label}</span>
                          <span className="font-mono">
                            ₹{b.amount_inr.toLocaleString("en-IN")} · {pct}%
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2 rounded-full border border-line bg-canvas"
                          role="img"
                          aria-label={`${b.label}: ${pct} percent`}
                        >
                          <div
                            className="h-full rounded-full bg-secondary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[13px] text-secondary">
                  Total of the parts: ₹
                  {plan.budget
                    .reduce((s, b) => s + b.amount_inr, 0)
                    .toLocaleString("en-IN")}{" "}
                  — exactly matches the budget you set.
                </p>
              </article>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="card p-5" aria-labelledby="mat-h">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="mat-h"
                      className="font-display text-[18px] font-semibold"
                    >
                      Draft posters and messages
                    </h3>
                    <button
                      type="button"
                      disabled={!!planBusy}
                      onClick={() => generatePlan("materials")}
                      title={REGEN_EXPLAIN}
                      aria-label={`Get fresh draft wording. ${REGEN_EXPLAIN}`}
                      className="link shrink-0 text-[13px] disabled:opacity-50"
                    >
                      {planBusy === "materials"
                        ? "Refreshing…"
                        : "Get fresh wording"}
                    </button>
                  </div>
                  {plan.materials.map((m, i) => (
                    <div
                      key={i}
                      className="mt-3 rounded-input border border-line p-3"
                    >
                      <p className="text-[13px] font-medium uppercase tracking-wide text-secondary">
                        {m.kind} · {m.title}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[14px]">
                        {m.body}
                      </p>
                      <p className="mt-2 text-[13px] text-strong-warning">
                        <span aria-hidden="true">⚠ </span>
                        {m.review_notice}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mt-3 rounded-input border border-line px-4 py-2 text-[14px] font-medium"
                  >
                    Print / save PDF (keeps source labels)
                  </button>
                </article>

                <article className="card p-5" aria-labelledby="met-h">
                  <h3
                    id="met-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    What to aim for (estimates, not promises)
                  </h3>
                  <p className="mt-1 text-[13px] text-secondary">
                    Educated guesses to plan against. Each shows what it is
                    based on.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {plan.metrics.map((m, i) => (
                      <li
                        key={i}
                        className="rounded-input border border-line p-3"
                      >
                        <p className="text-[14px] font-medium">
                          {m.name}: {m.target_range}
                        </p>
                        <p className="text-[13px] text-secondary">
                          Basis: {m.basis}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3">
                    <summary className="link cursor-pointer text-[13px]">
                      Assumptions &amp; limitations
                    </summary>
                    <ul className="mt-2 list-disc pl-5 text-[13px] text-secondary">
                      {[...plan.assumptions, ...plan.limitations].map(
                        (a, i) => (
                          <li key={i}>{a}</li>
                        ),
                      )}
                    </ul>
                  </details>
                </article>
              </div>
              <p className="text-[14px] text-secondary">
                After your campaign runs, come back to this page and enter your
                totals below — that&apos;s how you learn what worked.
              </p>
            </div>
          )}
        </section>

        {/* RESULTS */}
        <section aria-labelledby="results" className="mt-10">
          <h2 id="results" className="font-display text-[24px] font-bold">
            After the camp: enter your results
          </h2>
          <p className="mt-1 max-w-[72ch] text-[14px] text-secondary">
            Overall totals only — never names or patient details. We&apos;ll
            show your plan next to what happened, as a straightforward
            comparison. Doing better (or worse) than planned doesn&apos;t prove
            any single suggestion caused it.
          </p>
          {!hasResults && (
            <div className="mt-3">
              <EmptyState
                title="No results yet — that is expected"
                body="Fill in the totals once the camp is over. Until then, this section waits for you."
              />
            </div>
          )}
          <form
            onSubmit={saveResults}
            className="card mt-3 grid gap-4 p-5 sm:grid-cols-2"
            aria-label="Enter overall campaign results"
          >
            {RESULT_FIELDS.map(({ key, label, help }) => (
              <div key={key}>
                <label
                  htmlFor={`r-${key}`}
                  className="mb-1 block text-[14px] font-medium"
                >
                  {label}
                </label>
                <input
                  id={`r-${key}`}
                  type="number"
                  min={0}
                  value={resultsForm[key]}
                  onChange={(e) =>
                    setResultsForm((f) => ({
                      ...f,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-input border border-line bg-surface px-3 py-2"
                  aria-describedby={`r-${key}-help`}
                />
                <p
                  id={`r-${key}-help`}
                  className="mt-1 text-[13px] text-secondary"
                >
                  {help}
                </p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <label
                htmlFor="r-notes"
                className="mb-1 block text-[14px] font-medium"
              >
                Notes{" "}
                <span className="font-normal text-secondary">
                  (optional, overall only)
                </span>
              </label>
              <input
                id="r-notes"
                value={resultsForm.notes}
                onChange={(e) =>
                  setResultsForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="e.g. weekend turnout was strong"
                className="w-full rounded-input border border-line bg-surface px-3 py-2"
              />
            </div>
            {attendanceLooksOff && (
              <p
                role="status"
                className="text-[13px] text-strong-warning sm:col-span-2"
              >
                Attendance is higher than registrations — that&apos;s unusual.
                Check the numbers, or ignore this if walk-ins explain it.
              </p>
            )}
            {savedMsg && (
              <p role="status" className="text-[14px] sm:col-span-2">
                ✓ {savedMsg}
              </p>
            )}
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary px-5 py-2.5">
                Save results
              </button>
            </div>
          </form>
          {hasResults && analytics?.analytics && (
            <div className="card mt-4 p-5" aria-labelledby="comp-h">
              <h3
                id="comp-h"
                className="font-display text-[18px] font-semibold"
              >
                Planned vs actual
              </h3>
              <table className="mt-3 w-full text-[14px]">
                <thead>
                  <tr className="text-left text-secondary">
                    <th className="py-1" scope="col">
                      Measure
                    </th>
                    <th scope="col">Planned</th>
                    <th scope="col">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="py-2">Registrations</td>
                    <td>{analytics.analytics.planned_registrations}</td>
                    <td className="font-medium">
                      {analytics.analytics.actual_registrations}
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2">Attendance</td>
                    <td>{analytics.analytics.planned_attendance}</td>
                    <td className="font-medium">
                      {analytics.analytics.actual_attendance}
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2">Spend</td>
                    <td>
                      ₹
                      {analytics.analytics.planned_spend_inr.toLocaleString(
                        "en-IN",
                      )}
                    </td>
                    <td className="font-medium">
                      ₹
                      {analytics.analytics.actual_spend_inr.toLocaleString(
                        "en-IN",
                      )}
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2">Cost per registration</td>
                    <td>—</td>
                    <td>
                      {analytics.analytics.cost_per_registration != null
                        ? `₹${analytics.analytics.cost_per_registration}`
                        : "Not calculable — needs at least 1 registration"}
                    </td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2">Attendance rate</td>
                    <td>—</td>
                    <td>
                      {analytics.analytics.attendance_rate != null
                        ? `${Math.round(analytics.analytics.attendance_rate * 100)}%`
                        : "Not calculable — needs at least 1 registration"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <details className="mt-3">
                <summary className="link cursor-pointer text-[13px]">
                  What do these numbers mean?
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-secondary">
                  <li>
                    Cost per registration = total spend ÷ registrations. Lower
                    means each sign-up cost less.
                  </li>
                  <li>
                    Attendance rate = attendance ÷ registrations. It shows what
                    share of registered people showed up.
                  </li>
                  <li>
                    A blank (“not calculable”) simply means the totals needed
                    for the maths weren&apos;t entered yet.
                  </li>
                </ul>
              </details>
              <p className="mt-2 text-[13px] text-secondary">
                {analytics.analytics.note}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
