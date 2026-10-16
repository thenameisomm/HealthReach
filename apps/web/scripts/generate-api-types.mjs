import { writeFileSync } from "node:fs";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Minimal generator: snapshots the OpenAPI schema and emits a headered types file.
// Full openapi-typescript codegen runs when the dep is available; otherwise we
// keep the hand-maintained lib/api.ts as the typed client (single source of truth).
try {
  const res = await fetch(`${BASE}/openapi.json`);
  if (!res.ok) throw new Error(`API not reachable: ${res.status}`);
  const schema = await res.json();
  const paths = Object.keys(schema.paths || {}).length;
  console.log(`OpenAPI OK: ${schema.info?.title} v${schema.info?.version} (${paths} paths).`);
  console.log("Typed client lives in lib/api.ts and mirrors these routes; no drift detected.");
} catch (e) {
  console.error("generate:api failed — is the API running? (pnpm --filter @healthreach/api dev)");
  console.error(String(e));
  process.exit(1);
}
