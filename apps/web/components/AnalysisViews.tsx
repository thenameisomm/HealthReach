"use client";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  downloadExport,
  friendlyError,
  type CampaignDetail,
  type PlanComparison,
} from "@/lib/api";
import {
  formatDistance,
  formatMoney,
  planBudget,
  planCurrency,
} from "@/lib/format";
import { ProvenanceBadge } from "@/components/Provenance";

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function EvidenceAtAGlance({ detail }: { detail: CampaignDetail }) {
  const evidence = detail.evidence;
  if (!evidence) return null;
  const categories = evidence.geo_venues.reduce<Record<string, number>>(
    (acc, v) => {
      acc[v.category] = (acc[v.category] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const distances = evidence.geo_venues
    .map((v) => v.distance_m)
    .filter((d): d is number => d != null);
  const steps = evidence.qloo_steps ?? [];
  const completed = steps.filter((s) => s.status === "ok").length;
  const skipped = steps.length - completed;

  return (
    <article className="card p-5" aria-labelledby="analysis-evidence-h">
      <h3
        id="analysis-evidence-h"
        className="font-display text-[18px] font-semibold"
      >
        Evidence at a glance
      </h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-medium">Qloo familiarity hints</p>
            <ProvenanceBadge kind={detail.campaign.mode === "demo" ? "illustrative" : "qloo"} />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <div>
              <dt className="text-secondary">Status</dt>
              <dd className="font-medium">{evidence.qloo_status}</dd>
            </div>
            <div>
              <dt className="text-secondary">Hints found</dt>
              <dd className="font-medium">{evidence.qloo_signals.length}</dd>
            </div>
            <div>
              <dt className="text-secondary">Chain steps done</dt>
              <dd className="font-medium">{completed}</dd>
            </div>
            <div>
              <dt className="text-secondary">Steps skipped</dt>
              <dd className="font-medium">{skipped}</dd>
            </div>
          </dl>
          {steps.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12px] text-secondary">
              {steps.map((s) => (
                <li key={s.step}>
                  Step {s.step}: {s.status === "ok" ? "done" : "skipped"}
                  {s.status !== "ok" && s.skip_reason
                    ? ` — ${s.skip_reason}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-secondary">
            Tone cues only. Qloo does not provide health, trust, footfall, or
            diagnosis data.
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-medium">Candidate places</p>
            <ProvenanceBadge kind={detail.campaign.mode === "demo" ? "illustrative" : "geo"} />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <div>
              <dt className="text-secondary">Status</dt>
              <dd className="font-medium">{evidence.geo_status}</dd>
            </div>
            <div>
              <dt className="text-secondary">Places</dt>
              <dd className="font-medium">{evidence.geo_venues.length}</dd>
            </div>
            <div>
              <dt className="text-secondary">Closest</dt>
              <dd className="font-medium">
                {distances.length
                  ? formatDistance(Math.min(...distances))
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-secondary">Average distance</dt>
              <dd className="font-medium">
                {distances.length
                  ? formatDistance(average(distances))
                  : "Not recorded"}
              </dd>
            </div>
          </dl>
          {Object.keys(categories).length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] text-secondary">By category</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(categories).map(([category, count]) => (
                  <li
                    key={category}
                    className="rounded-full border border-line px-2 py-0.5 text-[12px]"
                  >
                    {category}: {count}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-secondary">
              No mapped places in this area.
            </p>
          )}
          <p className="mt-2 text-[12px] text-secondary">
            Every place still needs an in-person visit and permission check.
          </p>
        </div>
      </div>
    </article>
  );
}

function sectionSummary(section: string, value: unknown, currency: string): string[] {
  if (value == null) return ["None"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (section === "budget") {
          const amount =
            currency === "USD" ? o.amount_usd : o.amount_inr;
          return `${String(o.label ?? "Line")}: ${formatMoney(Number(amount ?? 0), currency === "USD" ? "USD" : "INR")}`;
        }
        if (section === "activities") return String(o.title ?? "Activity");
        if (section === "venues") return String(o.name ?? "Place");
        if (section === "materials") return String(o.title ?? "Material");
        if (section === "metrics")
          return `${String(o.name ?? "Measure")}: ${String(o.target_range ?? "")}`;
      }
      return String(item);
    });
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return Object.entries(o)
      .slice(0, 8)
      .map(([k, v]) => `${k}: ${String(v)}`);
  }
  return [String(value)];
}

function VersionComparison({ detail }: { detail: CampaignDetail }) {
  const plans = detail.plans;
  const [fromVersion, setFromVersion] = useState(
    plans.length > 1 ? plans[plans.length - 2].version : plans[0]?.version,
  );
  const [toVersion, setToVersion] = useState(plans[plans.length - 1]?.version);
  const [comparison, setComparison] = useState<PlanComparison | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fromVersion == null || toVersion == null || fromVersion === toVersion) {
      setComparison(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError("");
    api
      .comparePlans(detail.campaign.id, fromVersion, toVersion)
      .then((result) => {
        if (!cancelled) setComparison(result);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyError(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail.campaign.id, fromVersion, toVersion]);

  const currentPlan = plans[plans.length - 1];
  const currency = planCurrency(currentPlan);

  return (
    <article className="card p-5" aria-labelledby="analysis-versions-h">
      <h3
        id="analysis-versions-h"
        className="font-display text-[18px] font-semibold"
      >
        Plan versions
      </h3>
      <p className="mt-1 text-[13px] text-secondary">
        Refreshing one section saves a new version. Compare any two to see what
        changed.
      </p>
      {plans.length === 0 ? (
        <p className="mt-2 text-[14px] text-secondary">No plan yet.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-secondary">
                  <th className="py-1 pr-3" scope="col">
                    Version
                  </th>
                  <th className="pr-3" scope="col">
                    Date
                  </th>
                  <th className="pr-3" scope="col">
                    How it was made
                  </th>
                  <th scope="col">Budget</th>
                </tr>
              </thead>
              <tbody>
                {[...plans].reverse().map((p) => (
                  <tr key={p.version} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-medium">v{p.version}</td>
                    <td className="pr-3">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString()
                        : "Not recorded"}
                    </td>
                    <td className="pr-3">
                      {p.planner === "ai-model"
                        ? "AI model"
                        : "Standard template"}
                    </td>
                    <td>
                      {formatMoney(planBudget(p), planCurrency(p))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plans.length > 1 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[13px] font-medium">
                  Compare
                  <select
                    value={fromVersion}
                    onChange={(e) => setFromVersion(Number(e.target.value))}
                    className="ml-2 rounded-input border border-line bg-surface px-2 py-1.5"
                  >
                    {plans.map((p) => (
                      <option key={p.version} value={p.version}>
                        v{p.version}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="pb-1 text-[13px] text-secondary">with</span>
                <select
                  aria-label="Compare to version"
                  value={toVersion}
                  onChange={(e) => setToVersion(Number(e.target.value))}
                  className="rounded-input border border-line bg-surface px-2 py-1.5"
                >
                  {plans.map((p) => (
                    <option key={p.version} value={p.version}>
                      v{p.version}
                    </option>
                  ))}
                </select>
              </div>

              {fromVersion === toVersion && (
                <p className="mt-2 text-[13px] text-secondary">
                  Pick two different versions.
                </p>
              )}
              {busy && (
                <p role="status" className="mt-2 text-[13px] text-secondary">
                  Comparing…
                </p>
              )}
              {error && (
                <p role="alert" className="mt-2 text-[13px] text-strong-error">
                  {error}
                </p>
              )}
              {comparison && !busy && (
                <div className="mt-3">
                  {comparison.changed_sections.length === 0 ? (
                    <p className="text-[13px] text-secondary">
                      These versions have the same content.
                    </p>
                  ) : (
                    <>
                      <p className="text-[13px] font-medium">
                        Changed: {comparison.changed_sections.join(", ")}
                      </p>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        {comparison.changed_sections.map((section) => {
                          const change = comparison.changes[section];
                          return (
                            <div
                              key={section}
                              className="rounded-input border border-line p-3"
                            >
                              <h4 className="text-[13px] font-medium capitalize">
                                {section}
                              </h4>
                              <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
                                <div>
                                  <p className="text-secondary">
                                    v{comparison.from_version}
                                  </p>
                                  <ul className="mt-1 list-disc space-y-1 pl-4">
                                    {sectionSummary(
                                      section,
                                      change.from,
                                      currency,
                                    ).map((line, i) => (
                                      <li key={i}>{line}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-secondary">
                                    v{comparison.to_version}
                                  </p>
                                  <ul className="mt-1 list-disc space-y-1 pl-4">
                                    {sectionSummary(
                                      section,
                                      change.to,
                                      currency,
                                    ).map((line, i) => (
                                      <li key={i}>{line}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function ExportPanel({ detail }: { detail: CampaignDetail }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(format: "csv" | "pdf" | "json") {
    setBusy(format);
    setError("");
    setMessage("");
    try {
      await downloadExport(detail.campaign.id, format);
      setMessage(
        `${format.toUpperCase()} downloaded. It contains aggregate information only.`,
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card p-5" aria-labelledby="export-h">
      <h3 id="export-h" className="font-display text-[18px] font-semibold">
        Download records
      </h3>
      <p className="mt-1 text-[13px] text-secondary">
        Useful for reports and funder updates. Every export is aggregate-only —
        no names, contact details, diagnoses, API keys, or raw provider
        responses.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("csv")}
          disabled={!detail.results || busy != null}
          className="btn-secondary disabled:opacity-50"
        >
          {busy === "csv" ? "Preparing CSV…" : "CSV — results"}
        </button>
        <button
          type="button"
          onClick={() => run("pdf")}
          disabled={detail.plans.length === 0 || busy != null}
          className="btn-secondary disabled:opacity-50"
        >
          {busy === "pdf" ? "Preparing PDF…" : "PDF — plan"}
        </button>
        <button
          type="button"
          onClick={() => run("json")}
          disabled={!detail.evidence || busy != null}
          className="btn-secondary disabled:opacity-50"
        >
          {busy === "json" ? "Preparing JSON…" : "JSON — evidence"}
        </button>
      </div>
      {!detail.results && (
        <p className="mt-2 text-[12px] text-secondary">
          Results CSV becomes available after you save results.
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-[13px]">
          ✓ {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-strong-error">
          {error}
        </p>
      )}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-secondary">
        <li>No patient names, phones, emails, or medical data.</li>
        <li>No API keys or secrets.</li>
        <li>Draft materials keep the professional-review notice.</li>
      </ul>
    </article>
  );
}

export function AnalysisViews({ detail }: { detail: CampaignDetail }) {
  const available = useMemo(
    () => detail.evidence || detail.plans.length > 0 || detail.results,
    [detail],
  );
  if (!available) return null;

  return (
    <section id="analysis" className="mt-10" aria-labelledby="analysis-h">
      <h2 id="analysis-h" className="font-display text-[24px] font-bold">
        Analysis and records
      </h2>
      <p className="mt-1 max-w-[60ch] text-[14px] text-secondary">
        A closer look at the information behind this plan, how versions changed,
        and privacy-safe downloads.
      </p>
      <div className="mt-4 space-y-4">
        <EvidenceAtAGlance detail={detail} />
        <div className="grid gap-4 lg:grid-cols-2">
          <VersionComparison detail={detail} />
          <ExportPanel detail={detail} />
        </div>
      </div>
    </section>
  );
}
