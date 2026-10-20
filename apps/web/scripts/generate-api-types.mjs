import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const here = dirname(fileURLToPath(import.meta.url));

const normalize = (p) =>
  p.split("?")[0].replace(/\{[^}]+\}/g, "{}").replace(/\/+$/, "");

try {
  const res = await fetch(`${BASE}/openapi.json`);
  if (!res.ok) throw new Error(`API not reachable: ${res.status}`);
  const schema = await res.json();

  const apiPaths = new Set(
    Object.keys(schema.paths || {}).map(normalize),
  );

  const clientSource = readFileSync(join(here, "..", "lib", "api.ts"), "utf8");
  const clientPaths = new Set();
  for (const match of clientSource.matchAll(/(["`])(\/api\/[^"`$]*?(?:\$\{[^}]+\}[^"`$]*)*)\1/g)) {
    clientPaths.add(normalize(match[2].replace(/\$\{[^}]+\}/g, "{}")));
  }

  const missingInApi = [...clientPaths].filter((p) => !apiPaths.has(p));
  const unusedByClient = [...apiPaths].filter(
    (p) => !clientPaths.has(p) && p !== "/health",
  );

  console.log(
    `OpenAPI: ${schema.info?.title} v${schema.info?.version} — ${apiPaths.size} paths; client uses ${clientPaths.size}.`,
  );
  if (missingInApi.length) {
    console.error("Drift: client calls paths missing from the API:");
    for (const p of missingInApi) console.error(`  - ${p}`);
    process.exit(1);
  }
  if (unusedByClient.length) {
    console.log("Note: API paths not used by the web client (informational):");
    for (const p of unusedByClient) console.log(`  - ${p}`);
  }
  console.log("Parity OK: every path called by lib/api.ts exists in the live OpenAPI schema.");
} catch (e) {
  console.error("generate:api failed — is the API running? (pnpm dev:api)");
  console.error(String(e));
  process.exit(1);
}
