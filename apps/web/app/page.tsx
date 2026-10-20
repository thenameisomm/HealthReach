"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, friendlyError } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";

export default function Landing() {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState<"us" | "kothrud" | null>(
    null,
  );
  const [demoError, setDemoError] = useState("");

  async function startDemo(scenarioName: "us" | "kothrud") {
    setDemoLoading(scenarioName);
    setDemoError("");
    try {
      const scenario = await api.demoScenario(scenarioName);
      const camp = await api.createCampaign(
        scenario.brief,
        "demo",
        scenarioName,
      );
      await api.buildEvidence(camp.id);
      await api.buildPlan(camp.id);
      router.push(`/campaigns/${camp.id}`);
    } catch (e) {
      setDemoError(friendlyError(e));
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <div>
      {/* Hero: what it does, who it's for, what you get, how to begin */}
      <section
        className="dot-grid relative overflow-hidden"
        aria-labelledby="hero"
      >
        <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-16 sm:pt-20">
          <p className="text-[11px] font-medium uppercase tracking-widest text-secondary">
            For US community health teams · NGOs · clinics
          </p>
          <h1
            id="hero"
            className="font-display mt-3 max-w-[18ch] text-[44px] font-bold leading-[1.02] sm:text-[72px]"
          >
            Plan a health camp people will actually attend.
          </h1>
          <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-secondary sm:text-[17px]">
            Tell us about your camp. We find nearby places, hints on what feels
            familiar locally, and draft a plan you review. Afterwards, compare
            plan vs actual. Built for US organizers, with a global fallback.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/new" className="btn-primary">
              Start a campaign
            </Link>
            <button
              type="button"
              onClick={() => startDemo("us")}
              disabled={demoLoading != null}
              className="btn-secondary disabled:opacity-60"
            >
              {demoLoading === "us"
                ? "Opening the US example…"
                : "US example — East Austin, $5,000"}
            </button>
            <button
              type="button"
              onClick={() => startDemo("kothrud")}
              disabled={demoLoading != null}
              className="btn-secondary disabled:opacity-60"
            >
              {demoLoading === "kothrud"
                ? "Opening the India example…"
                : "India example — Kothrud, ₹10,000"}
            </button>
          </div>
          <p className="mt-3 flex max-w-[70ch] flex-wrap items-center gap-2 text-[13px] text-secondary">
            <ProvenanceBadge kind="illustrative" />
            The example is a sample plan. Every number in it is marked as sample
            data.
          </p>
          {demoError && (
            <p role="alert" className="mt-3 text-[14px] text-strong-error">
              {demoError}
            </p>
          )}
        </div>
      </section>

      {/* What the application produces */}
      <section
        aria-labelledby="outputs"
        className="mx-auto max-w-[1280px] px-6 py-12"
      >
        <h2 id="outputs" className="font-display text-[32px] font-bold">
          What you get
        </h2>
        <p className="mt-2 max-w-[52ch] text-[15px] text-secondary">
          A printed-and-ready plan. Plus, after the camp, a simple
          planned-vs-actual comparison.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "🗓️",
              t: "Day-by-day activities",
              d: "A screening desk in the morning, poster rounds, reminder messages.",
            },
            {
              icon: "📍",
              t: "Places to visit",
              d: "Nearby halls, parks and clinics. You go and check before using any.",
            },
            {
              icon: "💰",
              t: "A budget that adds up",
              d: "Your budget split across activities. The parts always total exactly the amount you set — dollars or rupees.",
            },
            {
              icon: "📄",
              t: "Draft posters & messages",
              d: "Editable wording you can hand to a health professional to review.",
            },
          ].map((c) => (
            <li key={c.t} className="card card-hover p-5">
              <span aria-hidden="true" className="text-[28px]">
                {c.icon}
              </span>
              <h3 className="font-display mt-2 text-[18px] font-semibold">
                {c.t}
              </h3>
              <p className="mt-2 text-[14px] text-secondary">{c.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* The workflow in plain language */}
      <section
        aria-labelledby="how"
        className="border-t border-line bg-surface"
      >
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <h2 id="how" className="font-display text-[32px] font-bold">
            How it works — four steps
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              {
                t: "Describe the camp",
                d: "Topic, area, ages, budget, days.",
              },
              {
                t: "See local information",
                d: "Nearby places + familiar-tone hints. Every fact shows its source.",
              },
              {
                t: "Review the draft plan",
                d: "Each part links to the info behind it. You approve before use.",
              },
              {
                t: "Add results after the camp",
                d: "Totals in, comparison out. Simple.",
              },
            ].map((s, i) => (
              <li key={s.t} className="card p-5">
                <span aria-hidden="true" className="step-dot">
                  {i + 1}
                </span>
                <h3 className="font-display mt-3 text-[18px] font-semibold">
                  {s.t}
                </h3>
                <p className="mt-2 text-[14px] text-secondary">{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/new" className="btn-primary">
              Start a campaign
            </Link>
            <Link href="/campaigns" className="btn-secondary">
              View saved campaigns
            </Link>
          </div>
        </div>
      </section>

      {/* Where suggestions come from, in plain language */}
      <section
        aria-labelledby="sources"
        className="mx-auto max-w-[1280px] px-6 py-12"
      >
        <h2 id="sources" className="font-display text-[32px] font-bold">
          Where suggestions come from
        </h2>
        <p className="mt-2 max-w-[48ch] text-[15px] text-secondary">
          Three ingredients. Clear labels, so you always know which is which.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[28px]">
                🧭
              </span>
              <ProvenanceBadge kind="qloo" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              What feels familiar locally
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              Built by a chain of linked lookups: find popular culture spots,
              then what their fans like, then double-check. Tone cues only —
              never health facts.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              Provided by Qloo (“cultural affinity”).
            </p>
          </article>
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[28px]">
                🗺️
              </span>
              <ProvenanceBadge kind="geo" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              Real nearby places
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              Halls, parks and clinics from a public map directory. Every place
              is a candidate to visit — never a trusted venue.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              Source: OpenStreetMap contributors.
            </p>
          </article>
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[28px]">
                ✍️
              </span>
              <ProvenanceBadge kind="ai" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              A draft you approve
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              Every suggestion links to its info. Thin info is said out loud.
              Estimates come as ranges, never promises. Health drafts need a
              professional review before use.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              You review everything before anything is used.
            </p>
          </article>
        </div>
      </section>

      {/* Ground rules, plainly */}
      <section
        aria-labelledby="rules"
        className="border-t border-line bg-surface"
      >
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <h2 id="rules" className="font-display text-[32px] font-bold">
            Our ground rules
          </h2>
          <ul className="mt-6 grid gap-3 text-[14px] md:grid-cols-2">
            {[
              "Suggestions are a starting point. Review before using.",
              "Listed places are candidates. Visit and confirm each one.",
              "Number estimates are guesses with a basis — not promises.",
              "We ask for totals only. Never names or patient details.",
            ].map((t) => (
              <li key={t} className="card p-4 text-secondary">
                <span className="text-ink">✓ </span>
                {t}
              </li>
            ))}
          </ul>
          <Link
            href="/new"
            className="link mt-6 inline-block text-[15px] font-medium"
          >
            Start with your campaign details →
          </Link>
        </div>
      </section>
    </div>
  );
}
