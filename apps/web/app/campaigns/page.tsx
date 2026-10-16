"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, friendlyError, type Campaign } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";
import { EmptyState, Skeleton } from "@/components/States";

const STAGE_LABEL: Record<string, string> = {
  brief: "Step 2 of 4 · look up local information",
  info: "Step 3 of 4 · create the outreach plan",
  plan: "Step 4 of 4 · enter results after the camp",
  results: "Complete · plan compared with results",
};

export default function Campaigns() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listCampaigns()
      .then(setItems)
      .catch((e) => setError(friendlyError(e)));
  }, []);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 className="font-display text-[32px] font-bold">Your campaigns</h1>
      <p className="mt-1 max-w-[72ch] text-[15px] text-secondary">
        Every campaign keeps its details, the information found about the area,
        the draft plan, and the results — so you can revisit the full story.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-strong-error">
          {error}{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="link"
          >
            Try again
          </button>
        </p>
      )}
      {!items && !error && (
        <div className="mt-6 grid gap-3" aria-label="Loading campaigns">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {items && items.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No campaigns yet"
            body="Describe your first campaign in about two minutes — or open the marked sample to see a finished example."
            action={
              <span className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/new"
                  className="btn-primary inline-block px-5 py-2.5"
                >
                  Start a campaign
                </Link>
                <Link
                  href="/"
                  className="inline-block rounded-input border border-line px-5 py-2.5 font-medium"
                >
                  See a working example
                </Link>
              </span>
            }
          />
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="mt-6 grid gap-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campaigns/${c.id}`}
                className="card card-hover flex flex-wrap items-center gap-3 p-5"
              >
                <span className="min-w-[200px] flex-1">
                  <span className="font-display text-[18px] font-semibold">
                    {c.brief.topic}
                  </span>
                  <span className="mt-1 block text-[13px] text-secondary">
                    {c.brief.location_text} · ₹
                    {c.brief.budget_inr.toLocaleString("en-IN")} ·{" "}
                    {c.brief.duration_days} days
                  </span>
                  {c.stage && STAGE_LABEL[c.stage] && (
                    <span className="mt-1 block text-[13px] font-medium">
                      {c.stage === "results" ? "✓ " : ""}
                      {STAGE_LABEL[c.stage]}
                    </span>
                  )}
                </span>
                <ProvenanceBadge
                  kind={c.mode === "demo" ? "illustrative" : "user"}
                />
                <span className="link text-[14px]" aria-hidden="true">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
