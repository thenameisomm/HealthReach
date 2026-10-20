"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  friendlyError,
  type Analytics,
  type CampaignDetail,
  type Currency,
  type Plan,
  type QlooProgress,
} from "@/lib/api";
import {
  activityCost,
  briefBudget,
  briefCurrency,
  budgetLineAmount,
  formatDistance,
  formatMoney,
  planBudget,
  planCurrency,
} from "@/lib/format";
import {
  ProvenanceBadge,
  DemoBanner,
  SourceLegend,
} from "@/components/Provenance";
import { InfoTip } from "@/components/InfoTip";
import { MapView } from "@/components/MapView";
import { QlooCallCounter } from "@/components/QlooCallCounter";
import { ResultsMap } from "@/components/ResultsMap";
import { InteractiveCharts } from "@/components/charts/InteractiveCharts";
import { AnalysisViews } from "@/components/AnalysisViews";
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
  spend: number;
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
    key: "spend",
    label: "Spend",
    help: "Total actually spent, in the same currency as the brief.",
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
 * technical phrasing (missing-key setups or older stored notes that include
 * exception class names); translation happens here at display time.
 */
function plainServiceNote(note: string): string {
  if (/API_KEY/i.test(note))
    return "This source isn't set up on this server yet (a setup step for whoever runs the server — nothing you did wrong).";
  if (/key was rejected/i.test(note))
    return "The configured key was rejected by this source, so it could not be asked (a setup step for whoever owns the key — nothing you did wrong).";
  return note
    .replace(/place lookup issue:\s*/gi, "")
    .replace(
      /\b(?:HTTPStatusError|ConnectError|ConnectTimeout|ReadTimeout|ReadError|TimeoutException|RemoteProtocolError)\b/g,
      "one lookup step had trouble",
    );
}

function isSetupIssue(note: string): boolean {
  // Missing keys and rejected keys both call for a setup fix, not a retry.
  return /API_KEY|key was rejected/i.test(note);
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
    spend: 0,
    engagement: 0,
    notes: "",
  });
  const [qlooProgress, setQlooProgress] = useState<QlooProgress | null>(null);
  const [evidenceActive, setEvidenceActive] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savingResults, setSavingResults] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [analytics, setAnalytics] = useState<{
    hasResults: boolean;
    analytics?: Analytics;
  } | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const prefilledResults = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const d = await api.getCampaign(id);
      setDetail(d);
      setError("");
      if (d.results && !prefilledResults.current) {
        const r = d.results as Record<string, unknown>;
        setResultsForm({
          registrations: Number(r.registrations ?? 0),
          attendance: Number(r.attendance ?? 0),
          spend: Number(r.spend ?? r.spend_usd ?? r.spend_inr ?? 0),
          engagement: Number(r.engagement ?? 0),
          notes: String(r.notes ?? ""),
        });
        prefilledResults.current = true;
      }
      const a = await api
        .analytics(id)
        .then((data) => {
          setAnalyticsError(false);
          return data;
        })
        .catch(() => {
          setAnalyticsError(true);
          return null;
        });
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
    setQlooProgress(null);
    setEvidenceActive(true);
    try {
      await api.buildEvidence(id);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
      setPhase("brief");
    } finally {
      setEvidenceActive(false);
    }
  }

  async function generatePlan(section?: string) {
    setPlanBusy(section ?? "full");
    if (!section) {
      setPhase("plan-loading");
      setPlanMsg("");
    }
    setError("");
    try {
      const built = await api.buildPlan(id, section);
      if (section)
        setPlanMsg(
          `Section refreshed — saved as version ${built.version}. Refreshes are rebuilt from the standard template, so wording may look familiar.`,
        );
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
    if (savingResults) return;
    setSavedMsg("");
    setError("");
    setSavingResults(true);
    const resultsCurrency = detail
      ? briefCurrency(detail.campaign.brief)
      : "USD";
    try {
      await api.saveResults(id, {
        registrations: resultsForm.registrations,
        attendance: resultsForm.attendance,
        engagement: resultsForm.engagement,
        notes: resultsForm.notes,
        ...(resultsCurrency === "USD"
          ? { spend_usd: resultsForm.spend }
          : { spend_inr: resultsForm.spend }),
      });
      setSavedMsg("Results saved. The comparison below is now up to date.");
      prefilledResults.current = true;
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSavingResults(false);
    }
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-10">
        {error ? (
          <EmptyState
            title="We couldn't open this campaign"
            body={error}
            action={
              <span className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={refresh}
                  className="btn-primary px-5 py-2.5"
                >
                  Try again
                </button>
                <Link
                  href="/campaigns"
                  className="rounded-input border border-line px-5 py-2.5 font-medium"
                >
                  Back to campaigns
                </Link>
              </span>
            }
          />
        ) : (
          <div aria-label="Loading campaign">
            <Skeleton className="h-10 w-2/3" />
            <div className="mt-4 grid gap-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const { campaign, evidence, plans } = detail;
  const plan: Plan | undefined = plans[plans.length - 1];
  const isDemo = campaign.mode === "demo";
  const currency = briefCurrency(campaign.brief);
  const budget = briefBudget(campaign.brief);
  const hasResults = analytics?.hasResults === true;
  const steps = ["Your brief", "Local information", "Outreach plan", "Results"];
  const currentStep = !evidence ? 1 : !plan ? 2 : !hasResults ? 3 : 4;
  const attendanceLooksOff =
    resultsForm.attendance > 0 &&
    resultsForm.registrations > 0 &&
    resultsForm.attendance > resultsForm.registrations;

  return (
    <div>
      {isDemo && (
        <DemoBanner
          scenario={campaign.demo_scenario ?? "kothrud"}
          currency={currency}
          budget={budget}
        />
      )}
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
              {formatMoney(budget, currency)}
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
          <p className="mt-1 max-w-[60ch] text-[14px] text-secondary">
            What we found about your area — and where each fact came from.
            Read before the plan.
          </p>
          {!evidence && phase !== "evidence-loading" && (
            <div className="mt-3">
              <EmptyState
                title="No local information yet"
                body="We'll look up nearby places and hints about familiar message styles. If a source is unavailable, we'll say so — never invent."
                action={
                  <button
                    type="button"
                    onClick={gatherEvidence}
                    className="btn-primary"
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
                Looking things up… up to half a minute. What you saved is safe.
              </p>
            </div>
          )}
          {(phase === "evidence-loading" || evidenceActive) && (
            <QlooCallCounter
              campaignId={id}
              active={evidenceActive}
              initial={qlooProgress}
            />
          )}
          {evidence && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="card p-5" aria-labelledby="qloo-h">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="qloo-h"
                    className="font-display text-[18px] font-semibold"
                  >
                    🧭 What feels familiar locally
                  </h3>
                  <ProvenanceBadge kind={isDemo ? "illustrative" : "qloo"} />
                  <InfoTip label="familiarity hints">
                    These hints describe which message styles and gathering
                    formats an audience tends to respond to. They say nothing
                    about anyone&apos;s health, and are never medical facts.
                  </InfoTip>
                </div>
                <p className="mt-2 text-[13px] text-secondary">
                  For phrasing posters and messages in a familiar way only.
                </p>
                {(evidence.qloo_steps ?? []).length > 0 && (
                  <div
                    className="mt-3 rounded-[12px] border border-line p-3"
                    aria-label="How these hints were built: a chain of linked Qloo lookups"
                  >
                    <p className="text-[13px] font-medium">
                      Built from{" "}
                      {(evidence.qloo_steps ?? []).filter((s) => s.status === "ok").length}{" "}
                      linked Qloo lookups — each one asks the next question:
                    </p>
                    <ol className="mt-2 space-y-2">
                      {(evidence.qloo_steps ?? []).map((st) => (
                        <li key={st.step} className="flex items-start gap-2">
                          <span
                            aria-hidden="true"
                            className="step-dot mt-0.5"
                          >
                            {st.step}
                          </span>
                          <span className="text-[13px]">
                            {st.status === "ok" ? (
                              <>
                                <span className="font-medium">{st.title}</span>
                                <span className="block text-[12px] text-secondary">
                                  {st.found}
                                  {st.next ? ` → ${st.next}` : ""}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {st.title} — skipped
                                </span>
                                <span className="block text-[12px] text-secondary">
                                  {st.skip_reason}
                                </span>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
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
                    📍 Places you could check in person
                  </h3>
                  <ProvenanceBadge kind={isDemo ? "illustrative" : "geo"} />
                </div>
                <p className="mt-2 text-[13px] text-secondary">
                  Real places from a public map. Each is a candidate — visit
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
                {evidence.geo_note && evidence.geo_status === "unavailable" && (
                  <p
                    role="status"
                    className="mt-2 rounded-input border border-warning p-3 text-[13px]"
                  >
                    This source is currently unavailable:{" "}
                    {evidence.geo_note}{" "}
                    <button
                      type="button"
                      onClick={gatherEvidence}
                      className="link"
                    >
                      Try again
                    </button>
                  </p>
                )}
                {evidence.geo_note && evidence.geo_status !== "unavailable" && (
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
                        <span className="block text-[12px] text-secondary">
                          {formatDistance(v.distance_m)} away
                        </span>
                      </span>
                      <span className="prov prov-geo">
                        <span aria-hidden="true">⚑</span> Visit and verify
                        before use
                      </span>
                    </li>
                  ))}
                  {evidence.geo_venues.length === 0 &&
                    evidence.geo_status !== "unavailable" && (
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
          <p className="mt-1 max-w-[60ch] text-[14px] text-secondary">
            Every part links to the info behind it. Nothing is final — review
            with your team first.
          </p>
          {!plan && phase !== "plan-loading" && evidence && (
            <div className="mt-3">
              <EmptyState
                title="Ready when you are"
                body="What to do, where, how the money splits, and what to say — with the basis shown for every estimate."
                action={
                  <button
                    type="button"
                    onClick={() => generatePlan()}
                    className="btn-primary"
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
                Drafting and checking the budget adds up…
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
              {planMsg && (
                <p role="status" className="text-[14px] text-secondary">
                  {planMsg}
                </p>
              )}

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
                  <li>Visit each place: confirm permission, space, access.</li>
                  <li>
                    A health professional reviews every poster, message, script.
                  </li>
                  <li>Numbers are guesses — not promises of turnout.</li>
                  <li>Confirm the money split with whoever controls it.</li>
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
                          · Costs{" "}
                          {formatMoney(
                            activityCost(a, planCurrency(plan)),
                            planCurrency(plan),
                          )}
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
                    Budget — {formatMoney(planBudget(plan), planCurrency(plan))}
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
                    const amount = budgetLineAmount(b, planCurrency(plan));
                    const pct = Math.round(
                      (amount / Math.max(1, planBudget(plan))) * 100,
                    );
                    return (
                      <li key={i}>
                        <div className="flex justify-between text-[14px]">
                          <span>{b.label}</span>
                          <span className="font-mono">
                            {formatMoney(amount, planCurrency(plan))} · {pct}%
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
                  Total of the parts:{" "}
                  {formatMoney(
                    plan.budget.reduce(
                      (sum, b) => sum + budgetLineAmount(b, planCurrency(plan)),
                      0,
                    ),
                    planCurrency(plan),
                  )}{" "}
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
                    className="btn-secondary mt-3"
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
          <p className="mt-1 max-w-[60ch] text-[14px] text-secondary">
            Overall totals only — never names or patient details. You&apos;ll
            see plan vs actual side by side.
          </p>
          {analyticsError && (
            <p
              role="status"
              className="mt-3 rounded-input border border-warning p-3 text-[13px]"
            >
              The planned-vs-actual comparison couldn&apos;t be loaded just
              now.
              {detail.results ? " Your saved results are safe." : ""}{" "}
              <button type="button" onClick={refresh} className="link">
                Reload
              </button>
            </p>
          )}
          {!hasResults && !analyticsError && (
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
                  {key === "spend" ? ` (${currency === "USD" ? "$" : "₹"})` : ""}
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
                  className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
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
                maxLength={1000}
                onChange={(e) =>
                  setResultsForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="e.g. weekend turnout was strong"
                className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
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
              <button
                type="submit"
                disabled={savingResults}
                className="btn-primary disabled:opacity-60"
              >
                {savingResults ? "Saving…" : "Save results"}
              </button>
            </div>
          </form>
          {hasResults && analytics?.analytics && (
            <div className="mt-4 space-y-4">
              <InteractiveCharts
                analytics={analytics.analytics}
                plan={plan}
                currency={currency}
                illustrative={isDemo}
              />
              {campaign.geocode && evidence && (
                <div className="card p-5">
                  <ResultsMap
                    lat={campaign.geocode.lat}
                    lon={campaign.geocode.lon}
                    venues={evidence.geo_venues}
                    demonstration={isDemo}
                  />
                </div>
              )}
              <p className="text-[13px] text-secondary">
                {analytics.analytics.note}
              </p>
            </div>
          )}
        </section>

        <AnalysisViews detail={detail} />
      </div>
    </div>
  );
}
