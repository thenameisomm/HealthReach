"use client";
import type { Analytics, Currency, Plan } from "@/lib/api";
import { formatMoney, parseRange, planCurrency } from "@/lib/format";
import { ProvenanceBadge } from "@/components/Provenance";

function DataTableAlternative({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="data-table-alternative mt-3">
      <summary className="link cursor-pointer text-[13px]">
        View {title} as an accessible table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[13px]">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-secondary">
              {columns.map((c) => (
                <th key={c} className="py-1 pr-3" scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => (
                  <td key={j} className="py-1.5 pr-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function BarRow({
  label,
  plannedRange,
  actual,
  actualText,
}: {
  label: string;
  plannedRange: string;
  actual: number;
  actualText: string;
}) {
  const range = parseRange(plannedRange);
  const mid = range ? (range.min + range.max) / 2 : 0;
  const max = Math.max(mid, actual, range?.max ?? 0, 1);
  return (
    <figure className="mini-chart">
      <figcaption className="text-[13px] font-medium">{label}</figcaption>
      <div className="mt-2 space-y-1.5">
        <div className="chart-row">
          <span className="chart-row-label">
            Planned <ProvenanceBadge kind="ai" />
          </span>
          <div className="chart-track">
            <div
              className="chart-bar chart-bar-planned"
              style={{ width: `${Math.max(2, (mid / max) * 100)}%` }}
            />
          </div>
          <span className="chart-row-value">{plannedRange}</span>
        </div>
        <div className="chart-row">
          <span className="chart-row-label">
            Actual <ProvenanceBadge kind="user" />
          </span>
          <div className="chart-track">
            <div
              className="chart-bar chart-bar-actual"
              style={{ width: `${Math.max(actual > 0 ? 2 : 0, (actual / max) * 100)}%` }}
            />
          </div>
          <span className="chart-row-value">{actualText}</span>
        </div>
      </div>
    </figure>
  );
}

function CostCard({
  label,
  value,
  nullMessage,
  currency,
  note,
}: {
  label: string;
  value: number | null | undefined;
  nullMessage: string;
  currency: Currency;
  note: string;
}) {
  return (
    <article className="metric-card card p-4">
      <h3 className="text-[14px] font-medium">{label}</h3>
      {value != null ? (
        <p className="metric-value mt-1">
          {formatMoney(value, currency, { decimals: true })}
        </p>
      ) : (
        <p role="status" className="metric-null mt-1">
          {nullMessage}
        </p>
      )}
      <p className="mt-1 text-[12px] text-secondary">{note}</p>
    </article>
  );
}

function AttendanceGauge({
  value,
  attendance,
  registrations,
}: {
  value: number | null | undefined;
  attendance: number;
  registrations: number;
}) {
  const pct = value == null ? null : Math.max(0, Math.min(1, value)) * 100;
  return (
    <article className="metric-card gauge-card card p-4">
      <h3 className="text-[14px] font-medium">Attendance rate</h3>
      {pct == null ? (
        <p role="status" className="metric-null mt-1">
          Not calculable — needs at least 1 registration
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 200 110"
            className="mt-1 w-full max-w-[220px]"
            role="img"
            aria-label={`Attendance rate ${pct.toFixed(1)} percent`}
          >
            <path
              d="M 15 95 A 85 85 0 0 1 185 95"
              fill="none"
              stroke="var(--hr-line)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M 15 95 A 85 85 0 0 1 185 95"
              fill="none"
              stroke="var(--hr-success)"
              strokeWidth="18"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${pct} 100`}
            />
            <text
              x="100"
              y="88"
              textAnchor="middle"
              className="gauge-text"
            >
              {pct.toFixed(1)}%
            </text>
          </svg>
          <p className="text-[12px] text-secondary">
            {attendance.toLocaleString()} attended of{" "}
            {registrations.toLocaleString()} registered.
          </p>
        </>
      )}
    </article>
  );
}

export function InteractiveCharts({
  analytics,
  plan,
  currency,
  illustrative,
}: {
  analytics: Analytics;
  plan?: Plan | null;
  currency?: Currency;
  illustrative?: boolean;
}) {
  const unit = currency ?? planCurrency(plan) ?? analytics.currency;
  const rows = [
    {
      label: "Registrations",
      plannedRange: analytics.planned_registrations,
      actual: analytics.actual_registrations,
      unit: "people",
    },
    {
      label: "Attendance",
      plannedRange: analytics.planned_attendance,
      actual: analytics.actual_attendance,
      unit: "people",
    },
    {
      label: "Engagement",
      plannedRange: analytics.planned_engagement,
      actual: analytics.actual_engagement,
      unit: "interactions",
    },
    {
      label: "Spend",
      plannedRange: formatMoney(analytics.planned_spend, unit),
      actual: analytics.actual_spend,
      unit: unit,
    },
  ].map((r) => ({
    ...r,
    actualText:
      r.label === "Spend"
        ? formatMoney(r.actual, unit)
        : `${r.actual.toLocaleString()} ${r.unit}`,
  }));
  const planMetrics = (plan?.metrics ?? []).filter((m) =>
    ["Registrations", "Attendance", "Engagement"].includes(m.name),
  );
  const globalMax = Math.max(
    ...planMetrics.map((m) => parseRange(m.target_range)?.max ?? 0),
    1,
  );

  return (
    <div className="space-y-4">
      <article className="card p-5" aria-labelledby="charts-h">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="charts-h" className="font-display text-[18px] font-semibold">
            Planned vs actual
          </h3>
          {illustrative ? (
            <ProvenanceBadge kind="illustrative" />
          ) : (
            <>
              <ProvenanceBadge kind="ai" />
              <ProvenanceBadge kind="user" />
            </>
          )}
        </div>
        <p className="mt-1 text-[13px] text-secondary">
          Blue bars are the plan&apos;s estimate range (midpoint shown). Green
          hatched bars are what you entered. Different units are scaled
          separately, so compare within each chart.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <BarRow
              key={r.label}
              label={r.label}
              plannedRange={r.plannedRange}
              actual={r.actual}
              actualText={r.actualText}
            />
          ))}
        </div>
        <DataTableAlternative
          title="planned vs actual"
          columns={["Measure", "Planned", "Actual"]}
          rows={rows.map((r) => [
            r.label,
            r.plannedRange,
            r.actualText,
          ])}
        />
      </article>

      <div className="grid gap-4 sm:grid-cols-3">
        <CostCard
          label="Cost per registration"
          value={analytics.cost_per_registration}
          nullMessage="Not calculable — needs at least 1 registration"
          currency={unit}
          note="Total spend ÷ registrations."
        />
        <CostCard
          label="Cost per attendee"
          value={analytics.cost_per_attendee}
          nullMessage="Not calculable — needs at least 1 attendee"
          currency={unit}
          note="Total spend ÷ people who attended."
        />
        <AttendanceGauge
          value={analytics.attendance_rate}
          attendance={analytics.actual_attendance}
          registrations={analytics.actual_registrations}
        />
      </div>

      <article className="card p-5" aria-labelledby="reach-h">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="reach-h" className="font-display text-[18px] font-semibold">
            Estimate ranges from the plan
          </h3>
          <ProvenanceBadge kind={illustrative ? "illustrative" : "ai"} />
        </div>
        <p className="mt-1 text-[13px] text-secondary">
          These are planning ranges, not measurements or promises. Each range
          shows where the plan expected turnout to land.
        </p>
        {planMetrics.length === 0 ? (
          <p role="status" className="mt-2 text-[14px] text-secondary">
            No plan ranges available yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {planMetrics.map((m) => {
              const range = parseRange(m.target_range);
              const min = range?.min ?? 0;
              const max = range?.max ?? 0;
              return (
                <div key={m.name}>
                  <div className="flex flex-wrap justify-between gap-2 text-[13px]">
                    <span className="font-medium">{m.name}</span>
                    <span>{m.target_range}</span>
                  </div>
                  <div
                    className="range-track mt-1"
                    role="img"
                    aria-label={`${m.name}: planning range ${m.target_range}. ${m.basis}`}
                  >
                    <div
                      className="range-fill"
                      style={{
                        left: `${(min / globalMax) * 100}%`,
                        width: `${Math.max(2, ((max - min) / globalMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[12px] text-secondary">Basis: {m.basis}</p>
                </div>
              );
            })}
          </div>
        )}
        {planMetrics.length > 0 && (
          <DataTableAlternative
            title="estimate ranges"
            columns={["Measure", "Planning range", "Basis"]}
            rows={planMetrics.map((m) => [m.name, m.target_range, m.basis])}
          />
        )}
      </article>
    </div>
  );
}
