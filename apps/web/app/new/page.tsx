"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, friendlyError, type Currency } from "@/lib/api";
import { ProvenanceBadge } from "@/components/Provenance";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { ClickMap } from "@/components/ClickMap";

const OBJECTIVES = [
  {
    value: "awareness",
    label: "Raise awareness",
    hint: "Spread the word so more people hear about the health topic.",
  },
  {
    value: "attendance",
    label: "Bring people to a camp or event",
    hint: "Fill seats — for example at a free screening camp.",
  },
  {
    value: "screening",
    label: "Screen as many people as possible",
    hint: "Focus the camp on screening every eligible visitor.",
  },
  {
    value: "vaccination",
    label: "Vaccinate as many people as possible",
    hint: "Focus the drive on vaccinating every eligible visitor.",
  },
];

const EMPTY = {
  topic: "",
  location_text: "",
  audience_age_min: 30,
  audience_age_max: 60,
  audience_notes: "",
  budget: 5000,
  currency: "USD" as Currency,
  duration_days: 7,
  objective: "attendance",
};

function NewCampaignInner() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [prefillNote, setPrefillNote] = useState("");
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLon, setPickedLon] = useState<number | null>(null);

  useEffect(() => {
    if (!fromId) return;
    api
      .getCampaign(fromId)
      .then((d) => {
        setForm({
          topic: d.campaign.brief.topic,
          location_text: d.campaign.brief.location_text,
          audience_age_min: d.campaign.brief.audience_age_min,
          audience_age_max: d.campaign.brief.audience_age_max,
          audience_notes: d.campaign.brief.audience_notes,
          budget:
            d.campaign.brief.currency === "INR"
              ? (d.campaign.brief.budget_inr ?? 10000)
              : (d.campaign.brief.budget_usd ?? 5000),
          currency:
            d.campaign.brief.currency ??
            (d.campaign.brief.budget_usd != null ? "USD" : "INR"),
          duration_days: d.campaign.brief.duration_days,
          objective: d.campaign.brief.objective,
        });
        setPrefillNote("Copied from your earlier campaign — change anything.");
      })
      .catch(() => {
        /* prefill is a convenience; a blank form is a fine fallback */
      });
  }, [fromId]);

  // Clear a field's error as soon as the user edits it, so fixed
  // problems don't linger on screen. Values are never cleared.
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      if (k === "topic") delete next.topic;
      if (k === "location_text") delete next.location_text;
      if (k === "audience_age_min" || k === "audience_age_max")
        delete next.audience_age;
      if (k === "budget" || k === "currency") delete next.budget;
      if (k === "duration_days") delete next.duration_days;
      return next;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (form.topic.trim().length < 3)
      e.topic =
        "Tell us the topic — at least 3 characters, e.g. “Free diabetes screening camp”.";
    if (form.location_text.trim().length < 2)
      e.location_text =
        "Enter a neighbourhood and city — for example “East Austin, TX” or “Kothrud, Pune” — so we can find nearby places.";
    if (
      !Number.isFinite(form.audience_age_min) ||
      !Number.isFinite(form.audience_age_max) ||
      form.audience_age_min < 0 ||
      form.audience_age_max > 120 ||
      form.audience_age_min > form.audience_age_max
    )
      e.audience_age =
        "Enter a valid age range: the lower age must not be higher than the upper age (0–120).";
    if (
      !Number.isFinite(form.budget) ||
      form.budget < 500 ||
      form.budget > 10_000_000
    )
      e.budget = `Enter a budget from ${form.currency === "USD" ? "$500" : "₹500"} to ${form.currency === "USD" ? "$10,000,000" : "₹1,00,00,000"} — the whole plan is built around this amount.`;
    if (
      !Number.isFinite(form.duration_days) ||
      form.duration_days < 1 ||
      form.duration_days > 90
    )
      e.duration_days = "Enter 1 to 90 days.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const camp = await api.createCampaign(
        {
          topic: form.topic.trim(),
          location_text: form.location_text.trim(),
          audience_age_min: Number(form.audience_age_min),
          audience_age_max: Number(form.audience_age_max),
          audience_notes: form.audience_notes.trim(),
          ...(form.currency === "USD"
            ? { budget_usd: Number(form.budget), currency: "USD" as Currency }
            : { budget_inr: Number(form.budget), currency: "INR" as Currency }),
          duration_days: Number(form.duration_days),
          objective: form.objective,
        },
        "real",
      );
      router.push(`/campaigns/${camp.id}`);
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedObjective = OBJECTIVES.find((o) => o.value === form.objective);

  return (
    <div className="mx-auto max-w-[760px] px-6 py-10">
      <h1 className="font-display text-[32px] font-bold sm:text-[40px]">
        Describe your campaign
      </h1>
      <p className="mt-2 text-[15px] text-secondary">
        Six short answers — about two minutes. US locations are searched first,
        with a global fallback. Everything you type is marked{" "}
        <ProvenanceBadge kind="user" /> and shown exactly as entered. We never
        ask for names, phone numbers, or patient details.
      </p>
      {prefillNote && (
        <p role="status" className="card mt-4 p-3 text-[14px]">
          {prefillNote}
        </p>
      )}
      <form
        onSubmit={submit}
        noValidate
        className="card mt-6 space-y-5 p-6 sm:p-8"
        aria-label="Campaign brief"
      >
        <div>
          <label htmlFor="topic" className="mb-1 block text-[14px] font-medium">
            What is the campaign about?
          </label>
          <input
            id="topic"
            value={form.topic}
            maxLength={120}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="e.g. Free diabetes screening camp"
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
            aria-invalid={!!errors.topic}
            aria-describedby={errors.topic ? "err-topic" : "help-topic"}
          />
          <p id="help-topic" className="mt-1 text-[13px] text-secondary">
            The topic decides what kind of activities and messages we suggest.
          </p>
          {errors.topic && (
            <p
              id="err-topic"
              role="alert"
              className="mt-1 text-[13px] text-strong-error"
            >
              {errors.topic}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="loc" className="mb-1 block text-[14px] font-medium">
            Where will it run? (neighbourhood, city)
          </label>
          <LocationAutocomplete
            value={form.location_text}
            onChange={(label) => set("location_text", label)}
            onSelect={(s) => {
              setPickedLat(s.lat);
              setPickedLon(s.lon);
            }}
            hasError={!!errors.location_text}
            describedBy={errors.location_text ? "err-loc" : "help-loc"}
          />
          <p id="help-loc" className="mt-1 text-[13px] text-secondary">
            Start typing — real place suggestions appear. Or tap a spot on the
            map below. The map&apos;s names come from{" "}
            <ProvenanceBadge kind="geo" />.
          </p>
          {errors.location_text && (
            <p
              id="err-loc"
              role="alert"
              className="mt-1 text-[13px] text-strong-error"
            >
              {errors.location_text}
            </p>
          )}
          <div className="mt-3">
            <span className="mb-1 block text-[14px] font-medium">
              Or pick a spot on the map
            </span>
            <ClickMap
              lat={pickedLat}
              lon={pickedLon}
              onPick={(label, lat, lon) => {
                setPickedLat(lat);
                setPickedLon(lon);
                set("location_text", label);
              }}
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 text-[14px] font-medium">
            Who is it for? (age group)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amin"
                className="mb-1 block text-[13px] text-secondary"
              >
                Youngest age
              </label>
              <input
                id="amin"
                type="number"
                min={0}
                max={120}
                value={
                  Number.isFinite(form.audience_age_min)
                    ? form.audience_age_min
                    : ""
                }
                onChange={(e) =>
                  set(
                    "audience_age_min",
                    e.target.value === "" ? NaN : Number(e.target.value),
                  )
                }
                className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
                aria-invalid={!!errors.audience_age}
                aria-describedby={errors.audience_age ? "err-age" : "help-age"}
              />
            </div>
            <div>
              <label
                htmlFor="amax"
                className="mb-1 block text-[13px] text-secondary"
              >
                Oldest age
              </label>
              <input
                id="amax"
                type="number"
                min={0}
                max={120}
                value={
                  Number.isFinite(form.audience_age_max)
                    ? form.audience_age_max
                    : ""
                }
                onChange={(e) =>
                  set(
                    "audience_age_max",
                    e.target.value === "" ? NaN : Number(e.target.value),
                  )
                }
                className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
                aria-invalid={!!errors.audience_age}
                aria-describedby={errors.audience_age ? "err-age" : "help-age"}
              />
            </div>
          </div>
          <p id="help-age" className="mt-1 text-[13px] text-secondary">
            You&apos;re describing the intended audience (for example, adults
            30–60) — not naming any individual.
          </p>
          {errors.audience_age && (
            <p
              id="err-age"
              role="alert"
              className="mt-1 text-[13px] text-strong-error"
            >
              {errors.audience_age}
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="notes" className="mb-1 block text-[14px] font-medium">
            Anything about the audience?{" "}
            <span className="font-normal text-secondary">(optional)</span>
          </label>
          <input
            id="notes"
            value={form.audience_notes}
            maxLength={500}
            onChange={(e) => set("audience_notes", e.target.value)}
            placeholder="e.g. Spanish-speaking families in East Austin"
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
            aria-describedby="help-notes"
          />
          <p id="help-notes" className="mt-1 text-[13px] text-secondary">
            Languages, family patterns, or anything that helps pitch messages in
            a familiar way.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="budget"
              className="mb-1 block text-[14px] font-medium"
            >
              Total budget ({form.currency === "USD" ? "$" : "₹"})
            </label>
            <div className="flex gap-2">
              <input
                id="budget"
                type="number"
                min={500}
                step={500}
                value={Number.isFinite(form.budget) ? form.budget : ""}
                onChange={(e) =>
                  set(
                    "budget",
                    e.target.value === "" ? NaN : Number(e.target.value),
                  )
                }
                className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
                aria-invalid={!!errors.budget}
                aria-describedby={errors.budget ? "err-budget" : "help-budget"}
              />
              <select
                aria-label="Budget currency"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value as Currency)}
                className="rounded-input border border-line bg-surface px-2 py-2.5"
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <p id="help-budget" className="mt-1 text-[13px] text-secondary">
              US campaigns use dollars. The plan divides exactly this amount —
              nothing more.
            </p>
            {errors.budget && (
              <p
                id="err-budget"
                role="alert"
                className="mt-1 text-[13px] text-strong-error"
              >
                {errors.budget}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="dur" className="mb-1 block text-[14px] font-medium">
              Duration (days)
            </label>
            <input
              id="dur"
              type="number"
              min={1}
              max={90}
              value={
                Number.isFinite(form.duration_days) ? form.duration_days : ""
              }
              onChange={(e) =>
                set(
                  "duration_days",
                  e.target.value === "" ? NaN : Number(e.target.value),
                )
              }
              className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
              aria-invalid={!!errors.duration_days}
              aria-describedby={errors.duration_days ? "err-dur" : "help-dur"}
            />
            <p id="help-dur" className="mt-1 text-[13px] text-secondary">
              How many days the campaign will run (1–90).
            </p>
            {errors.duration_days && (
              <p
                id="err-dur"
                role="alert"
                className="mt-1 text-[13px] text-strong-error"
              >
                {errors.duration_days}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="obj" className="mb-1 block text-[14px] font-medium">
            What is the campaign mainly trying to achieve?
          </label>
          <select
            id="obj"
            value={form.objective}
            onChange={(e) => set("objective", e.target.value)}
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5"
            aria-describedby="help-obj"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="help-obj" className="mt-1 text-[13px] text-secondary">
            {selectedObjective?.hint} This shapes what the plan aims at.
          </p>
        </div>

        {submitError && (
          <p role="alert" className="text-[14px] text-strong-error">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Create campaign brief"}
        </button>
        <p className="text-[13px] text-secondary">
          This saves your brief and takes you to the next step: looking up local
          information for your area. You can return to saved campaigns anytime
          from the Campaigns page.
        </p>
      </form>
    </div>
  );
}

export default function NewCampaign() {
  return (
    <Suspense>
      <NewCampaignInner />
    </Suspense>
  );
}
