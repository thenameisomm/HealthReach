"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, friendlyError } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";

export default function Landing() {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  async function startDemo() {
    setDemoLoading(true);
    setDemoError("");
    try {
      const scenario = await api.demoScenario();
      const camp = await api.createCampaign(scenario.brief, "demo");
      await api.buildEvidence(camp.id);
      await api.buildPlan(camp.id);
      router.push(`/campaigns/${camp.id}`);
    } catch (e) {
      setDemoError(friendlyError(e));
    } finally {
      setDemoLoading(false);
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
            For NGOs · clinics · community health teams
          </p>
          <h1
            id="hero"
            className="font-display mt-3 max-w-[18ch] text-[44px] font-bold leading-[1.02] sm:text-[72px]"
          >
            Plan a health camp people will actually attend.
          </h1>
          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-secondary sm:text-[17px]">
            Tell us about your campaign — what it&apos;s about, where it is, who
            it&apos;s for, and what you can spend. We&apos;ll gather nearby
            places you could use and hints about what kinds of messages feel
            familiar, then draft an outreach plan for you to review. After the
            camp, compare your plan with what really happened.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/new" className="btn-primary px-5 py-2.5 text-[15px]">
              Start a campaign
            </Link>
            <button
              type="button"
              onClick={startDemo}
              disabled={demoLoading}
              className="rounded-input border border-line bg-surface px-5 py-2.5 text-[15px] font-medium disabled:opacity-60"
            >
              {demoLoading ? "Opening the example…" : "See a working example"}
            </button>
          </div>
          <p className="mt-3 flex max-w-[70ch] flex-wrap items-center gap-2 text-[13px] text-secondary">
            <ProvenanceBadge kind="illustrative" />
            The example opens a sample diabetes-camp plan for Kothrud, Pune.
            Every number in it is marked as sample data.
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
          What you walk away with
        </h2>
        <p className="mt-2 max-w-[64ch] text-[15px] text-secondary">
          A finished plan you can print and discuss with your team — plus, after
          the camp, a side-by-side comparison of what you planned and what
          happened.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Suggested activities",
              d: "What to do each day — for example a morning screening desk, poster rounds, and reminder messages.",
            },
            {
              t: "Places to check in person",
              d: "Nearby halls, parks and clinics from a public map directory, each flagged for an on-foot visit.",
            },
            {
              t: "A budget split that adds up",
              d: "Your money divided across activities, always totalling exactly what you said you have.",
            },
            {
              t: "Draft posters and messages",
              d: "Ready-to-edit wording in a familiar tone, marked for review by a health professional.",
            },
          ].map((c) => (
            <li key={c.t} className="card card-hover p-5">
              <h3 className="font-display text-[18px] font-semibold">{c.t}</h3>
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
            How it works, in four steps
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              {
                t: "1 · Describe your campaign",
                d: "Two minutes: topic, area, age group, budget in rupees, duration, and your main goal.",
              },
              {
                t: "2 · Review local information",
                d: "We look up nearby places and hints about familiar message styles. You see where each fact came from.",
              },
              {
                t: "3 · Review your draft plan",
                d: "Activities, places, budget and drafts — each linked to the information behind it. Nothing is final until you say so.",
              },
              {
                t: "4 · Enter results after the camp",
                d: "Add simple totals — registrations, attendance, spend. See planned vs actual, side by side.",
              },
            ].map((s) => (
              <li key={s.t} className="card p-5">
                <h3 className="font-display text-[18px] font-semibold">
                  {s.t}
                </h3>
                <p className="mt-2 text-[14px] text-secondary">{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/new" className="btn-primary px-5 py-2.5 text-[15px]">
              Start a campaign
            </Link>
            <Link
              href="/campaigns"
              className="rounded-input border border-line px-5 py-2.5 text-[15px] font-medium"
            >
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
          Where do the suggestions come from?
        </h2>
        <p className="mt-2 max-w-[64ch] text-[15px] text-secondary">
          Three ingredients — and clear labels on everything, so you always know
          which is which.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <ProvenanceBadge kind="qloo" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              What feels familiar locally
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              Hints about which gathering styles and message tones an audience
              tends to respond to — for example, family-oriented messages in
              Marathi. These say nothing about anyone&apos;s health, and are
              never shown as medical facts.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              Technical name: cultural-affinity signals (Qloo).
            </p>
          </article>
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <ProvenanceBadge kind="geo" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              Real nearby places
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              Community halls, parks and clinics from a public map directory. A
              listed place is a candidate to visit and check — never an approved
              or trusted venue.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              Source: OpenStreetMap contributors.
            </p>
          </article>
          <article className="card card-hover p-6">
            <div className="flex items-center gap-2">
              <ProvenanceBadge kind="ai" />
            </div>
            <h3 className="font-display mt-3 text-[20px] font-semibold">
              A draft you approve
            </h3>
            <p className="mt-2 text-[14px] text-secondary">
              The plan connects each suggestion to the information behind it and
              says plainly when information is thin. Estimated numbers are shown
              as ranges with their basis — never as promises. You review
              everything before use.
            </p>
            <p className="mt-2 text-[13px] text-secondary">
              Draft health messages need a health professional&apos;s review.
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
              "Suggestions are a starting point, not instructions. Review every activity, place and message before using them.",
              "Familiar does not mean trusted. Visit each suggested place and confirm permission, space and access.",
              "Estimated numbers are educated guesses with a stated basis — not guarantees of turnout.",
              "We only ever ask for overall totals (registrations, attendance, spend). Never names, phone numbers, or patient details.",
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
