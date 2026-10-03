import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const root = __ENV.API_BASE_URL || "http://127.0.0.1:4100/api/v1";
const workspaceRows = JSON.parse(open("../../.state/workspaces.json"));
const authState = JSON.parse(open("../../.state/owner.json"));
const session = authState.cookies?.find((cookie) => cookie.name === "mf_session")?.value;
if (!session) throw new Error("No mf_session in automation/.state/owner.json. Run Playwright global setup first.");
if (workspaceRows.length < 5) throw new Error("Five automation workspaces are required for the 150-case matrix.");

// Thirty read-only request profiles are each exercised against five workspaces = 150 cases.
// Query-string variants cover default and filtered/date-window request handling without writes.
const profiles = [
  ["Leads list", "/leads", ""], ["Leads list with page query", "/leads", "?page=1"],
  ["Customers list", "/customers", ""], ["Customers list with page query", "/customers", "?page=1"],
  ["Deals list", "/deals", ""], ["Deals list with page query", "/deals", "?page=1"],
  ["Tasks list", "/tasks", ""], ["Tasks list with page query", "/tasks", "?page=1"],
  ["Campaigns list", "/campaigns", ""], ["Campaigns list with page query", "/campaigns", "?page=1"],
  ["Content calendar list", "/content", ""], ["Content calendar list with page query", "/content", "?page=1"],
  ["Landing pages list", "/landing-pages", ""], ["Landing pages list with page query", "/landing-pages", "?page=1"],
  ["Automations list", "/automations", ""], ["Automations list with page query", "/automations", "?page=1"],
  ["Integrations list", "/integrations", ""], ["Integrations list with page query", "/integrations", "?page=1"],
  ["Audit events list", "/audit", ""], ["Audit events list with page query", "/audit", "?page=1"],
  ["Pipeline stages", "/pipeline/stages", ""], ["Pipeline stages with format query", "/pipeline/stages", "?format=json"],
  ["Reports summary", "/reports/summary", ""], ["Reports summary for current month", "/reports/summary", `?from=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`],
  ["Dashboard overview", "/dashboard/overview", ""], ["Dashboard overview with format query", "/dashboard/overview", "?format=json"],
  ["Workspace members", "/workspaces/{workspaceId}/members", ""], ["Workspace members with page query", "/workspaces/{workspaceId}/members", "?page=1"],
  ["Lead export response", "/leads/export", ""], ["Lead export response with format query", "/leads/export", "?format=csv"],
];
const caseCount = profiles.length * 5;
if (caseCount !== 150) throw new Error(`Expected 150 cases, found ${caseCount}`);

const maxVuCount = Number(__ENV.PERF_VUS || 10);
const iterations = Number(__ENV.PERF_ITERATIONS || 300);
const p95Limit = Number(__ENV.PERF_P95_MS || 800);
const p99Limit = Number(__ENV.PERF_P99_MS || 1500);
const caseMetrics = Array.from({ length: caseCount }, (_, i) => {
  const key = String(i + 1).padStart(3, "0");
  return { passed: new Rate(`k6_case_${key}_passed`), duration: new Trend(`k6_case_${key}_duration_ms`, true) };
});

export const options = {
  scenarios: { marketflow360_reads: { executor: "shared-iterations", vus: maxVuCount, iterations, maxDuration: __ENV.PERF_MAX_DURATION || "3m" } },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: [`p(95)<${p95Limit}`, `p(99)<${p99Limit}`],
    checks: ["rate>0.99"],
  },
};

export default function () {
  // Spread each VU across all profiles while keeping the request volume small by default.
  const profileIndex = (__VU - 1 + __ITER * maxVuCount) % profiles.length;
  const workspaceIndex = (__VU - 1 + __ITER) % 5;
  const [label, path, query] = profiles[profileIndex];
  const workspace = workspaceRows[workspaceIndex];
  const resolvedPath = path.replace("{workspaceId}", workspace.id);
  const caseId = profileIndex * 5 + workspaceIndex;
  const response = http.get(`${root}${resolvedPath}${query}`, {
    headers: { Cookie: `mf_session=${session}`, "x-workspace-id": workspace.id, Accept: "application/json, text/csv;q=0.9" },
    tags: { suite: "k6-performance", case: `K6-${String(caseId + 1).padStart(3, "0")}` },
    timeout: __ENV.PERF_REQUEST_TIMEOUT || "10s",
  });
  const passed = check(response, {
    [`K6-${String(caseId + 1).padStart(3, "0")} ${label} · W${workspaceIndex + 1} returns HTTP 200`]: (r) => r.status === 200,
    [`K6-${String(caseId + 1).padStart(3, "0")} ${label} · W${workspaceIndex + 1} response is non-empty`]: (r) => r.body !== null && r.body.length > 0,
    [`K6-${String(caseId + 1).padStart(3, "0")} ${label} · W${workspaceIndex + 1} completes below ${p95Limit}ms case target`]: (r) => r.timings.duration < p95Limit,
  });
  caseMetrics[caseId].passed.add(passed);
  caseMetrics[caseId].duration.add(response.timings.duration);
  sleep(Number(__ENV.PERF_SLEEP_SECONDS || 0.05));
}

export function handleSummary(data) {
  const cases = [];
  profiles.forEach(([label, path, query], profileIndex) => {
    for (let workspaceIndex = 0; workspaceIndex < 5; workspaceIndex++) {
      const id = profileIndex * 5 + workspaceIndex;
      const key = String(id + 1).padStart(3, "0");
      const passedMetric = data.metrics[`k6_case_${key}_passed`]?.values ?? {};
      const latency = data.metrics[`k6_case_${key}_duration_ms`]?.values ?? {};
      const passedCount = passedMetric.passes ?? 0;
      const failedCount = passedMetric.fails ?? 0;
      const count = passedCount + failedCount;
      cases.push({
        id: `K6-${String(id + 1).padStart(3, "0")}`,
        name: `${label} ${query ? `(${query}) ` : ""}· ${workspaceRows[workspaceIndex].name}`,
        workspace: workspaceRows[workspaceIndex].name,
        workspaceId: workspaceRows[workspaceIndex].id,
        method: "GET", path: `${path.replace("{workspaceId}", workspaceRows[workspaceIndex].id)}${query}`, requests: count, passed: passedCount,
        failed: failedCount, passRate: count ? passedCount / count : 0,
        avgMs: latency.avg ?? 0, minMs: latency.min ?? 0, maxMs: latency.max ?? 0,
        p95Ms: latency["p(95)"] ?? 0, p99Ms: latency["p(99)"] ?? 0,
        errors: failedCount ? [`${failedCount} request checks failed or exceeded ${p95Limit}ms`] : [],
      });
    }
  });
  const payload = { suite: "k6-performance", startedAt: new Date(data.state.testRunDurationMs ? Date.now() - data.state.testRunDurationMs : Date.now()).toISOString(), finishedAt: new Date().toISOString(), limits: { p95Ms: p95Limit, p99Ms: p99Limit, vus: maxVuCount, iterations }, cases, k6: data };
  return { "performance/results/k6-summary.json": JSON.stringify(payload, null, 2), stdout: textSummary(data, { indent: " ", enableColors: true }) };
}

function textSummary(data, options) {
  const metrics = data.metrics;
  return `MarketFlow360 k6: ${caseCount} named cases | ${metrics.http_reqs?.values?.count ?? 0} requests | p95 ${metrics.http_req_duration?.values?.["p(95)"]?.toFixed?.(1) ?? "n/a"} ms\n`;
}
