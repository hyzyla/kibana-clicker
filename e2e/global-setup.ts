import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const EXTENSION_PATH = path.resolve(__dirname, "..", ".output", "chrome-mv3");

/**
 * Each entry describes one test environment.
 * esUrl   — Elasticsearch / OpenSearch endpoint (used for health check + seeding)
 * dashUrl — Kibana / OpenSearch Dashboards endpoint (used for data view creation)
 */
const ENVIRONMENTS = [
  { esUrl: "http://localhost:19200", dashUrl: "http://localhost:15601", label: "Kibana v8" },
  { esUrl: "http://localhost:29200", dashUrl: "http://localhost:25601", label: "Kibana v9" },
  { esUrl: "http://localhost:39200", dashUrl: "http://localhost:35601", label: "OpenSearch" },
];

/** Check if the extension has been built. If not, build it now. */
async function ensureExtensionBuilt() {
  const manifest = path.join(EXTENSION_PATH, "manifest.json");
  if (fs.existsSync(manifest)) return;

  console.log("[setup] Extension not built — running npm run build...");
  execSync("npm run build", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  console.log("[setup] Extension built.");
}

/** Return true if the Elasticsearch / OpenSearch endpoint is reachable. */
async function isReachable(esUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${esUrl}/_cluster/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete and re-create the test-logs index with 20 fresh documents.
 * Timestamps span the last 20 minutes so they are always within the
 * "last 24 hours" window used by navigateToDiscover.
 */
async function seedIndex(esUrl: string, label: string) {
  const levels    = ["info", "warn", "error", "debug"];
  const services  = ["api-gateway", "auth-service", "user-service", "payment-service"];
  const hosts     = ["host-01", "host-02", "host-03"];
  const messages  = [
    "Request processed successfully", "Connection timeout reached",
    "User authentication failed",     "Cache miss for key session_abc",
    "Database query took too long",   "Rate limit exceeded for client",
    "Health check passed",            "TLS handshake completed",
    "Retry attempt 2 of 3",           "Response sent to client",
    "Starting background job",        "Memory usage above threshold",
    "Configuration reloaded",         "New connection from 10.0.0.5",
    "Shutting down gracefully",       "Index rotation completed",
    "Disk usage at 78 percent",       "Upstream returned 502",
    "JWT token expired",              "Batch processing complete",
  ];

  // Delete existing index so timestamps are always fresh
  await fetch(`${esUrl}/test-logs`, { method: "DELETE" }).catch(() => {});

  // Create index with explicit mapping
  await fetch(`${esUrl}/test-logs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mappings: {
        properties: {
          "@timestamp":  { type: "date" },
          level:         { type: "keyword" },
          message:       { type: "text" },
          service:       { type: "keyword" },
          host:          { type: "keyword" },
          status_code:   { type: "integer" },
          duration_ms:   { type: "integer" },
          trace_id:      { type: "keyword" },
        },
      },
    }),
  });

  // Build ndjson bulk body — one document per minute going back 20 minutes
  const now = Date.now();
  const lines: string[] = [];
  for (let i = 0; i < 20; i++) {
    lines.push(JSON.stringify({ index: { _index: "test-logs" } }));
    lines.push(JSON.stringify({
      "@timestamp": new Date(now - i * 60_000).toISOString(),
      level:        levels[i % 4],
      message:      messages[i],
      service:      services[i % 4],
      host:         hosts[i % 3],
      status_code:  200 + (i % 5) * 100,
      duration_ms:  10 + i * 15,
      trace_id:     `trace-${String(i).padStart(4, "0")}`,
    }));
  }

  await fetch(`${esUrl}/_bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body: `${lines.join("\n")}\n`,
  });

  console.log(`[setup] Seeded 20 documents into ${label}.`);
}

/**
 * Create the test-logs* data view via the dashboard API.
 * Tries the Kibana API first, falls back to the OpenSearch Dashboards API.
 * Both 200 and 409 (already exists) are treated as success.
 */
async function createDataView(dashUrl: string, label: string) {
  // Kibana v8/v9 API
  try {
    const res = await fetch(`${dashUrl}/api/data_views/data_view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "kbn-xsrf": "reporting" },
      body: JSON.stringify({ data_view: { title: "test-logs*", timeFieldName: "@timestamp" } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok || res.status === 409) {
      console.log(`[setup] Data view ready on ${label}.`);
      return;
    }
  } catch {
    // Dashboard not yet ready or not Kibana — fall through to OpenSearch API
  }

  // OpenSearch Dashboards API
  try {
    const res = await fetch(`${dashUrl}/api/saved_objects/index-pattern/test-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "kbn-xsrf": "reporting", // older OpenSearch Dashboards requires kbn- prefix
        "osd-xsrf": "reporting", // newer versions accept osd- prefix
      },
      body: JSON.stringify({ attributes: { title: "test-logs*", timeFieldName: "@timestamp" } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok || res.status === 409) {
      console.log(`[setup] Data view ready on ${label}.`);
    } else {
      console.warn(`[setup] Failed to create data view on ${label}: ${res.status} ${await res.text()}`);
    }
  } catch {
    // Dashboard not ready yet — tests will fail on their own if this matters
    console.warn(`[setup] Could not reach dashboard at ${dashUrl} (${label}).`);
  }
}

/** Set up a single environment: seed data + ensure data view exists. */
async function setupEnvironment({ esUrl, dashUrl, label }: typeof ENVIRONMENTS[number]) {
  if (!(await isReachable(esUrl))) {
    console.log(`[setup] ${label} not running — skipping.`);
    return;
  }
  console.log(`[setup] Preparing ${label}...`);
  await seedIndex(esUrl, label);
  await createDataView(dashUrl, label);
}

export default async function globalSetup() {
  await ensureExtensionBuilt();
  // Set up all running environments in parallel
  await Promise.all(ENVIRONMENTS.map(setupEnvironment));
}
