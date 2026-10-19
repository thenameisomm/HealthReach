# MongoDB Collections — HealthReach AI

## Collections Overview

| Collection | Document Count (est.) | Purpose |
|---|---|---|
| `campaigns` | 1 per campaign | Campaign brief + geocode + mode |
| `evidence_snapshots` | 1 per campaign | Qloo signals + steps + OSM venues |
| `plans` | 1+ per campaign (versioned) | Plan versions |
| `results` | 0-1 per campaign | Aggregate results |
| `ext_cache` | Variable | External API response cache (TTL) |

---

## Collection Schemas

### campaigns

```javascript
{
  _id: ObjectId,
  id: "cam_abc123",                    // String, unique index
  brief: {
    topic: "Free diabetes screening",
    location_text: "East Austin, TX",
    audience_age_min: 30,
    audience_age_max: 60,
    audience_notes: "Spanish-speaking community",
    budget_inr: 5000,                  // Planned: budget_usd
    duration_days: 7,
    objective: "screening"
  },
  geocode: {
    display_name: "East Austin, Austin, Travis County, Texas, USA",
    lat: 30.2500,
    lon: -97.7167,
    provenance: "geo",
    attribution: "© OpenStreetMap contributors (Nominatim, ODbL)"
  },
  mode: "real",                        // "real" | "demo"
  created_at: ISODate("2026-10-20T15:30:00Z"),
  updated_at: ISODate("2026-10-20T15:30:00Z")
}
```

**Indexes:**
```javascript
db.campaigns.createIndex({ id: 1 }, { unique: true });
db.campaigns.createIndex({ created_at: -1 });
db.campaigns.createIndex({ mode: 1 });
```

---

### evidence_snapshots

```javascript
{
  _id: ObjectId,
  campaign_id: "cam_abc123",           // Ref to campaigns.id
  qloo_signals: [
    {
      kind: "place-affinity",
      label: "East Austin Community Center",
      detail: "Cultural venue near East Austin, TX tagged: community gathering, family activities. Taste affinity, not a health or trust signal.",
      affinity: 0.72,
      popularity: 0.65,
      entity_id: "ent_12345",
      provenance: "qloo"
    },
    {
      kind: "tag-affinity",
      label: "community gathering",
      detail: "Fans of East Austin Community Center also tend to enjoy this. Tone/framing cue only — not health targeting.",
      affinity: 0.68,
      provenance: "qloo"
    }
  ],
  qloo_steps: [
    {
      step: 1,
      title: "Looked at culture spots near here",
      asked: "Which places near East Austin, TX match the local crowd's taste?",
      found: "3 places — for example: East Austin Community Center, East Austin Library, Walgreens Pharmacy.",
      next: "Now asking: what else do fans of East Austin Community Center also like?",
      top_names: ["East Austin Community Center", "East Austin Library", "Walgreens Pharmacy"],
      status: "ok",
      provenance: "qloo"
    },
    {
      step: 2,
      title: "Checked what fans of East Austin Community Center also like",
      asked: "Shared taste tags of people who like East Austin Community Center.",
      found: "4 tags — for example: community gathering, family activities, local food, outdoor recreation.",
      next: "Now double-checking the same question with East Austin Library.",
      top_names: ["community gathering", "family activities", "local food", "outdoor recreation"],
      status: "ok",
      provenance: "qloo"
    },
    {
      step: 3,
      title: "Double-checked with East Austin Library",
      asked: "Same taste question, asked about East Austin Library.",
      found: "2 of the same tags appeared — for example: community gathering, family activities. The pattern holds for two different places.",
      top_names: ["community gathering", "family activities", "local history"],
      status: "ok",
      provenance: "qloo"
    }
  ],
  geo_venues: [
    {
      name: "East Austin Community Center",
      category: "community_centre",
      address: "123 Main St, Austin, TX",
      lat: 30.2510,
      lon: -97.7150,
      distance_m: 300,
      provenance: "geo",
      needs_verification: true
    }
  ],
  qloo_status: "ok",                   // "ok" | "thin" | "unavailable"
  qloo_note: "Taste affinity, not a health or trust signal.",
  geo_status: "ok",                    // "ok" | "thin" | "unavailable"
  geo_note: "",
  created_at: ISODate("2026-10-20T15:30:05Z")
}
```

**Indexes:**
```javascript
db.evidence_snapshots.createIndex({ campaign_id: 1 }, { unique: true });
db.evidence_snapshots.createIndex({ created_at: -1 });
```

---

### plans

```javascript
{
  _id: ObjectId,
  campaign_id: "cam_abc123",
  version: 2,                          // 1, 2, 3... increments on regen
  summary: "A 7-day diabetes screening camp in East Austin...",
  activities: [
    {
      title: "Set up screening stations",
      channel: "in-person",
      why: "Community gathering affinity suggests in-person events resonate",
      evidence_refs: ["ent_12345", "tag_community_gathering"],
      cost_inr: 1500,
      provenance: "ai"
    },
    {
      title: "Volunteer training session",
      channel: "in-person",
      why: "Family activities tag indicates need for family-friendly approach",
      evidence_refs: ["tag_family_activities"],
      cost_inr: 800,
      provenance: "ai"
    }
  ],
  venues: [
    {
      name: "East Austin Community Center",
      reason: "High foot traffic, community trust, community_centre relevance",
      evidence_refs: ["geo_venue_0"],
      status: "worth-evaluating",
      needs_verification: true,
      provenance: "ai"
    }
  ],
  budget: [
    { label: "Venue & setup", amount_inr: 1500, provenance: "ai" },
    { label: "Materials & printing", amount_inr: 1200, provenance: "ai" },
    { label: "Staff & volunteers", amount_inr: 1500, provenance: "ai" },
    { label: "Refreshments", amount_inr: 500, provenance: "ai" },
    { label: "Contingency", amount_inr: 300, provenance: "ai" }
  ],
  budget_total_inr: 5000,              // MUST equal brief.budget_inr
  materials: [
    {
      kind: "poster",
      title: "Free Diabetes Screening — This Saturday!",
      body: "Join us at East Austin Community Center...",
      review_notice: "Draft — requires review by a qualified health professional before use.",
      provenance: "ai"
    }
  ],
  metrics: [
    {
      name: "Registrations",
      target_range: "150-200",
      basis: "Template estimate based on similar campaigns",
      provenance: "ai"
    },
    {
      name: "Attendance",
      target_range: "100-150",
      basis: "Grounded on Qloo affinity + venue capacity",
      provenance: "ai"
    }
  ],
  assumptions: [
    "Venue available for all 7 days",
    "Volunteers available for screening days"
  ],
  limitations: [
    "Qloo coverage may be limited in this area",
    "OSM venues not verified for health event suitability"
  ],
  has_cultural_signals: true,
  planner: "ai-model",                 // "ai-model" | "standard-template"
  created_at: ISODate("2026-10-20T15:31:00Z")
}
```

**Indexes:**
```javascript
db.plans.createIndex({ campaign_id: 1, version: -1 });
db.plans.createIndex({ campaign_id: 1, created_at: -1 });
```

---

### results

```javascript
{
  _id: ObjectId,
  campaign_id: "cam_abc123",
  registrations: 180,
  attendance: 135,
  spend_inr: 4850,
  engagement: 320,
  notes: "Rain on day 2 reduced turnout",
  created_at: ISODate("2026-10-27T10:00:00Z")
}
```

**Indexes:**
```javascript
db.results.createIndex({ campaign_id: 1 }, { unique: true });
db.results.createIndex({ created_at: -1 });
```

---

### ext_cache (TTL Cache for External Responses)

```javascript
{
  _id: ObjectId,
  key: "sha256:GET:/v2/insights:filter.type=urn:entity:place&filter.location.query=East+Austin...",
  response: {
    // Full Qloo/Nominatim/Overpass response
    "results": { "entities": [...] }
  },
  created_at: ISODate("2026-10-20T15:30:00Z")
}
```

**TTL Index:**
```javascript
db.ext_cache.createIndex(
  { created_at: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours
);
```

**Key Format:** SHA-256 of `METHOD:PATH:SORTED_PARAMS` (no API key in key)

---

## In-Memory Fallback

When `MONGODB_URI` is not set or connection fails, `db.py` provides `InMemoryDB`:

```python
class InMemoryDB:
    campaigns: dict[str, Campaign] = {}
    evidence_snapshots: dict[str, EvidenceSnapshot] = {}
    plans: dict[str, list[Plan]] = {}           # campaign_id -> [Plan]
    results: dict[str, Results] = {}
    ext_cache: dict[str, tuple[float, dict]] = {}  # key -> (timestamp, response)
```

- Same async interface as Motor
- Data lost on process restart
- No indexes, no TTL (manual cleanup in `get_cached`)
- Suitable for demo/development only

---

## Connection Management

```python
# apps/api/app/db.py
async def get_db() -> AsyncIOMotorDatabase | InMemoryDB:
    if not settings.MONGODB_URI:
        return InMemoryDB()
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        await client.admin.command("ping")  # Verify connection
        return client[settings.MONGODB_DB]
    except Exception:
        logger.warning("MongoDB unavailable, using in-memory fallback")
        return InMemoryDB()
```

- Single connection pool (Motor)
- Connection reused across requests
- Graceful degradation to in-memory

---

## Data Retention

| Collection | Retention | Deletion Trigger |
|---|---|---|
| campaigns | Indefinite | Manual (organizer request) |
| evidence_snapshots | Indefinite | Cascade with campaign |
| plans | Indefinite (versioned) | Cascade with campaign |
| results | Indefinite | Cascade with campaign |
| ext_cache | 24 hours | TTL index auto-expiry |

---

## Backup & Recovery

- **Production**: MongoDB Atlas continuous backups + point-in-time recovery
- **Self-hosted**: `mongodump` daily, `mongorestore` for recovery
- **Demo/Dev**: Not backed up (in-memory or ephemeral)

---

## Migration Strategy

1. **Additive only**: New fields optional with defaults
2. **No breaking changes**: Old documents must validate
3. **Version field**: For plan versioning (not schema version)
4. **One-time scripts**: For data transformations (run once, then delete)

Example migration (add `planner` field to existing plans):
```python
async def migrate_add_planner_field():
    db = await get_db()
    async for plan in db.plans.find({"planner": {"$exists": False}}):
        await db.plans.update_one(
            {"_id": plan["_id"]},
            {"$set": {"planner": "standard-template"}}
        )
```

---

*Related: [Data Model](DATA_MODEL.md) · [Provenance Model](PROVENANCE_MODEL.md) · [API Contracts](api/API_CONTRACTS.md)*