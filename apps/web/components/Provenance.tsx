"use client";
import { provenanceMeta, type ProvenanceKind } from "@healthreach/ui";

export function ProvenanceBadge({ kind }: { kind: string }) {
  const meta =
    provenanceMeta[(kind as ProvenanceKind) ?? "ai"] ?? provenanceMeta.ai;
  return (
    <span className={`prov ${meta.className}`}>
      <span aria-hidden="true" className="prov-icon">
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </span>
  );
}

/** Plain-language legend: what each source label on this page means. */
export function SourceLegend() {
  return (
    <details className="card mt-3 p-4 text-[13px]">
      <summary className="link cursor-pointer font-medium">
        What do the source labels mean?
      </summary>
      <ul className="mt-3 space-y-2 text-secondary">
        <li>
          <ProvenanceBadge kind="user" /> — information you typed in. It is
          shown exactly as you entered it.
        </li>
        <li>
          <ProvenanceBadge kind="qloo" /> — hints about which messages and
          gathering styles feel familiar to local audiences. These say nothing
          about anyone&apos;s health.
        </li>
        <li>
          <ProvenanceBadge kind="geo" /> — real places from the public
          OpenStreetMap directory. Listed places are <em>not</em> checked or
          approved — visit and confirm before using one.
        </li>
        <li>
          <ProvenanceBadge kind="ai" /> — suggestions and estimates written to
          help you plan. Review them before you act on them.
        </li>
        <li>
          <ProvenanceBadge kind="illustrative" /> — sample data for
          demonstration only, not real measurements.
        </li>
      </ul>
    </details>
  );
}

export function DemoBanner({
  scenario = "kothrud",
  currency = "INR",
  budget,
}: {
  scenario?: "kothrud" | "us";
  currency?: "USD" | "INR";
  budget?: number;
}) {
  const place = scenario === "us" ? "East Austin, TX (US)" : "Kothrud, Pune (India)";
  const money =
    budget == null
      ? ""
      : ` · ${new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(budget)}`;
  return (
    <div
      className="demo-banner"
      role="status"
      aria-label="Illustrative demo mode"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-2 text-[13px] font-medium">
        <span aria-hidden="true">◇ </span>
        Sample data — {place}
        {money} · these numbers and places are illustrations, not real
        measurements.
      </div>
    </div>
  );
}
