"use client";
import { useEffect, useState } from "react";
import { api, type QlooProgress } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  in_progress: "Working",
  completed: "Done",
  skipped: "Skipped",
  failed: "Could not finish",
};

const OVERALL_LABEL: Record<string, string> = {
  pending: "Waiting to start",
  in_progress: "Working now",
  completed: "Finished",
  failed: "Finished with a problem",
};

export function QlooCallCounter({
  campaignId,
  active,
  initial,
}: {
  campaignId: string;
  active: boolean;
  initial?: QlooProgress | null;
}) {
  const [progress, setProgress] = useState<QlooProgress | null>(
    initial ?? null,
  );
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    async function poll() {
      try {
        const next = await api.evidenceProgress(campaignId);
        if (stopped) return;
        setProgress(next);
        setUnavailable(false);
        failures = 0;
      } catch {
        if (stopped) return;
        failures += 1;
        if (failures >= 3) setUnavailable(true);
      }
      if (!stopped) timer = setTimeout(poll, 1200);
    }

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, campaignId]);

  if (!progress) {
    return (
      <div className="card mt-3 p-4" role="status" aria-live="polite">
        <p className="text-[14px] font-medium">Starting the local lookups…</p>
        <p className="mt-1 text-[13px] text-secondary">
          The server will report each Qloo request it makes — not how often this
          page checks in.
        </p>
      </div>
    );
  }

  const total = progress.total_requests;
  return (
    <section
      className="qloo-counter card mt-3 p-4"
      aria-live="polite"
      aria-label="Qloo evidence lookup progress"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[17px] font-semibold">
          Local lookups: {Math.min(progress.current_step || 0, 3)} of 3
        </h3>
        <p className="text-[13px] text-secondary">
          {OVERALL_LABEL[progress.overall_status] ?? progress.overall_status}
        </p>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-secondary">
        <span className="qloo-request-count">
          <strong>{total}</strong> Qloo request{total === 1 ? "" : "s"}
        </span>
        {progress.retries > 0 && (
          <span className="rounded-full border border-line px-2 py-0.5">
            {progress.retries} retr{progress.retries === 1 ? "y" : "ies"}
          </span>
        )}
        {progress.cache_hits > 0 && (
          <span className="rounded-full border border-line px-2 py-0.5">
            {progress.cache_hits} from cache
          </span>
        )}
        <ProvenanceBadge kind="qloo" />
      </p>

      <ol className="mt-3 grid gap-2 md:grid-cols-3">
        {progress.steps.map((step) => (
          <li
            key={step.step}
            className={`qloo-step qloo-step-${step.status} rounded-input border border-line p-3`}
          >
            <p className="flex items-center justify-between gap-2 text-[13px] font-medium">
              <span>
                Step {step.step}: {step.title}
              </span>
              <span className={`qloo-status qloo-status-${step.status}`}>
                {STATUS_LABEL[step.status] ?? step.status}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-secondary">
              {step.requests_made} request
              {step.requests_made === 1 ? "" : "s"}
              {step.retries > 0 ? ` · ${step.retries} retried` : ""}
              {step.cache_hits > 0 ? ` · ${step.cache_hits} cached` : ""}
            </p>
            {(step.status === "skipped" || step.status === "failed") &&
              step.skip_reason && (
                <p className="mt-1 text-[12px] text-strong-warning">
                  {step.skip_reason}
                </p>
              )}
          </li>
        ))}
      </ol>

      {unavailable && (
        <p role="status" className="mt-2 text-[12px] text-secondary">
          Live counts paused. The lookups may still be finishing — this message
          does not mean they failed.
        </p>
      )}
      <p className="mt-2 text-[12px] text-secondary">
        These counts come from the server. A retry is one more attempt; cached
        answers are reused and do not call Qloo again.
      </p>
    </section>
  );
}
