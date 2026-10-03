import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const summaryPath = resolve(process.argv[2] ?? resolve(root, "performance/results/k6-summary.json"));
const output = resolve(root, "allure-results");
await mkdir(output, { recursive: true });
const report = JSON.parse(await readFile(summaryPath, "utf8"));
const start = Date.parse(report.startedAt) || Date.now();
const stop = Date.parse(report.finishedAt) || Date.now();
const fmt = (value) => Number(value ?? 0).toFixed(1);
for (const file of (await readdir(output)).filter((name) => name.endsWith("-result.json"))) {
  let previous;
  try { previous = JSON.parse(await readFile(resolve(output, file), "utf8")); } catch { continue; }
  if (!previous.labels?.some((label) => label.name === "framework" && label.value === "k6")) continue;
  await rm(resolve(output, file), { force: true });
  for (const attachment of previous.attachments ?? []) if (attachment.source) await rm(resolve(output, attachment.source), { force: true });
}
for (const test of report.cases) {
  const uuid = randomUUID();
  const attachmentSource = `${uuid}-attachment.json`;
  const status = test.requests > 0 && test.failed === 0 && test.p95Ms <= report.limits.p95Ms && test.p99Ms <= report.limits.p99Ms ? "passed" : "failed";
  const error = test.errors.length ? test.errors.join("; ") : test.requests === 0 ? "No requests reached this case." : `Latency threshold exceeded: p95 ${fmt(test.p95Ms)}ms / ${report.limits.p95Ms}ms, p99 ${fmt(test.p99Ms)}ms / ${report.limits.p99Ms}ms.`;
  const attachments = [{
    name: "k6 request and latency evidence",
    source: attachmentSource,
    type: "application/json",
  }];
  await writeFile(resolve(output, attachmentSource), JSON.stringify({
    id: test.id, method: test.method, path: test.path, workspace: test.workspace,
    requestCount: test.requests, passed: test.passed, failed: test.failed, passRate: test.passRate,
    averageMs: test.avgMs, minMs: test.minMs, maxMs: test.maxMs, p95Ms: test.p95Ms, p99Ms: test.p99Ms,
    thresholds: report.limits, failures: test.errors,
  }, null, 2));
  const result = {
    uuid, historyId: `${test.id}-${test.workspaceId}`, testCaseId: `${test.id}-${test.workspaceId}`,
    name: `${test.id} ${test.name}`, fullName: `MarketFlow360 k6 Performance.${test.id} ${test.name}`,
    status, stage: "finished", start, stop,
    statusDetails: status === "failed" ? { known: false, muted: false, flaky: false, message: error, trace: error } : { known: false, muted: false, flaky: false },
    labels: [
      { name: "parentSuite", value: "Performance / k6" },
      { name: "suite", value: "k6-performance" },
      { name: "subSuite", value: test.workspace },
      { name: "tag", value: "performance" },
      { name: "tag", value: "read-only" },
      { name: "framework", value: "k6" },
    ],
    parameters: [{ name: "Workspace", value: test.workspace }, { name: "Request", value: `${test.method} ${test.path}` }, { name: "Requests", value: String(test.requests) }],
    steps: [
      { name: `Before: use authenticated session and select ${test.workspace}`, status: "passed", stage: "finished", start, stop: start + 1 },
      { name: `Given: send ${test.method} ${test.path} to the workspace API`, status: test.requests ? "passed" : "broken", stage: "finished", start: start + 1, stop: Math.max(start + 2, stop - 2), steps: [{ name: `k6 executed ${test.requests} request(s) over ${report.limits.vus} virtual users`, status: test.requests ? "passed" : "broken", stage: "finished" }] },
      { name: `When: check HTTP 200 and non-empty response; p95 ≤ ${report.limits.p95Ms}ms, p99 ≤ ${report.limits.p99Ms}ms`, status, stage: "finished", start: Math.max(start + 1, stop - 2), stop: Math.max(start + 2, stop - 1), steps: [{ name: `p95 ${fmt(test.p95Ms)}ms · p99 ${fmt(test.p99Ms)}ms · ${test.passed}/${test.requests} passing`, status, stage: "finished" }] },
      { name: "Then: performance result and response evidence are attached", status: "passed", stage: "finished", start: Math.max(start + 2, stop - 1), stop },
      { name: "After: retain per-case metrics for triage", status: "passed", stage: "finished", start: stop, stop },
    ],
    attachments,
  };
  await writeFile(resolve(output, `${uuid}-result.json`), JSON.stringify(result));
}
console.log(`Added ${report.cases.length} k6 case results to ${basename(output)}.`);
