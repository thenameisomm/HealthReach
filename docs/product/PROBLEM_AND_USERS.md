# Problem & Users — HealthReach AI

## The Core Problem

Community health organizers run outreach campaigns (screening camps, vaccination drives, awareness events) with limited budgets and little evidence about what messaging, channels, and venues will actually work in a specific community.

### Why Existing Data Falls Short

| Data Type | What It Shows | What It Misses |
|---|---|---|
| Census / demographic data | Who lives there (age, income, language) | What cultural touchpoints resonate; how people make decisions |
| Footfall / mobility data | Where people physically go | Why they go there; what messaging would attract them to a health event |
| Claims / clinical data | Who is already sick / seeking care | Latent need; prevention-minded people who don't yet engage with healthcare |
| Generic campaign templates | One-size-fits-all structure | Local cultural context — language, timing, gathering formats, trusted messengers |

### The Consequence

- **Wasted budget**: Money spent on channels/formats the community ignores
- **Low attendance**: Camps that feel alien — wrong language, wrong timing, wrong format
- **Missed prevention**: Communities that need screening/vaccination don't show up
- **No learning**: No systematic way to compare plan vs. actual and improve next time

## User Personas

### 1. NGO Program Coordinator — "Maria"
- **Role**: Plans 5–10 outreach campaigns per year across multiple communities
- **Pain**: "I pick venues based on where we've gone before, not where people actually gather. I write flyers in English because that's what I know, but half the neighborhood speaks Spanish at home."
- **Needs**: Evidence about local cultural preferences; candidate venues she hasn't considered; budget that adds up exactly; a way to show funders what worked
- **Frequency**: Weekly planning, monthly campaign execution

### 2. Clinic Outreach Team Lead — "James"
- **Role**: Runs monthly free screening camps (diabetes, blood pressure, flu shots)
- **Pain**: "Last month we set up at the community center and 12 people showed up. The month before at the library we got 40. I don't know why."
- **Needs**: Venue comparison with verification reminders; cost-per-attendee tracking; simple planned-vs-actual after each camp
- **Frequency**: Monthly camp execution, quarterly review

### 3. Public Health Campaign Planner — "Dr. Patel"
- **Role**: Designs regional vaccination/awareness campaigns for a health department
- **Pain**: "We have $200K for flu outreach across 20 zip codes. The vendor gives us a media plan based on TV ratings, but the communities we need to reach don't watch those channels."
- **Needs**: Cultural affinity signals per neighborhood; channel recommendations grounded in local taste; aggregate results roll-up across sites
- **Frequency**: Annual planning cycle, quarterly adjustments

## User Problems Mapped to HealthReach Capabilities

| User Problem | HealthReach Capability |
|---|---|
| "I don't know what messaging will resonate" | Qloo cultural affinity signals (3-step chain) → plain-language familiarity hints |
| "I don't know where to hold the event" | OSM community venues (clinic, pharmacy, community_centre, library, school, park) + map + list |
| "My budget never adds up" | Deterministic planner forces exact budget total; line items editable |
| "I can't prove what worked" | Aggregate results entry → planned-vs-actual table (descriptive, not causal) |
| "I need to show funders evidence" | Every value has provenance (qloo/geo/ai/user/illustrative); exportable plan + results |
| "I'm not technical" | Plain-language copy, field-level "why", no jargon-first explanations |

## User Journey Summary

```
Landing → "Start a campaign"
    ↓
Brief form (guided, per-field why, US-biased autocomplete + map pick)
    ↓
Evidence loading (live Qloo call counter, 3-step chain progress)
    ↓
Evidence review (familiarity hints + venue map/list, all with provenance)
    ↓
Plan review (activities, venues, exact budget, draft materials, estimates, checklist)
    ↓
[Campaign runs in real world]
    ↓
Results entry (aggregate counts only)
    ↓
Analytics (planned vs actual, cost/registration, attendance rate, descriptive only)
```

## Accessibility & Inclusivity Requirements

- Plain language at ≤ 8th grade reading level
- Field-level "why" explanations (not tooltips — accessible popovers)
- Map always paired with text alternative (venue list)
- Provenance communicated via icon + text + border, never color alone
- Keyboard-operable all interactions
- `prefers-reduced-motion` respected
- No Hindi/Marathi localization yet — copy written short and plain to allow future i18n

---

*Related: [Product Brief](PRODUCT_BRIEF.md) · [User Flows](USER_FLOWS.md) · [Product Requirements](PRODUCT_REQUIREMENTS.md)*