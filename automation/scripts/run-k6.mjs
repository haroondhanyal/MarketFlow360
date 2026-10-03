import { spawnSync } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const performanceRoot = resolve(root, "performance");
const reportFile = resolve(performanceRoot, "results/k6-summary.json");
const stateFile = resolve(root, ".state/workspaces.json");
const ownerFile = resolve(root, ".state/owner.json");
await mkdir(resolve(performanceRoot, "results"), { recursive: true });
await mkdir(resolve(performanceRoot, "reports"), { recursive: true });
for (const file of [stateFile, ownerFile]) {
  try { await access(file); } catch { console.error(`Missing ${file}. Run the Playwright automation once to provision its five isolated workspaces and login state.`); process.exit(2); }
}

const envPath = resolve(root, ".env");
try {
  const envText = await readFile(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch {}
const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4100/api/v1";
try {
  const health = await fetch(`${apiBase.replace(/\/$/, "")}/health/ready`, { signal: AbortSignal.timeout(2500) });
  if (!health.ok) throw new Error(`HTTP ${health.status}`);
} catch {
  console.error(`MarketFlow360 API is not ready at ${new URL(apiBase).origin}. Start it with \`corepack pnpm dev\`, then retry.`);
  process.exit(2);
}

const workspaces = JSON.parse(await readFile(stateFile, "utf8"));
const owner = JSON.parse(await readFile(ownerFile, "utf8"));
if (workspaces.length < 5 || !owner.cookies?.some((cookie) => cookie.name === "mf_session")) {
  console.error("Automation state is incomplete; rerun the Playwright setup so all five workspaces and the owner session are available.");
  process.exit(2);
}
const runStartedAt = Date.now();
const k6 = spawnSync("k6", ["run", "performance/tests/marketflow360-performance.js"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, API_BASE_URL: apiBase },
});
if (k6.error?.code === "ENOENT") {
  console.error("k6 is not installed. Install Grafana k6 (macOS: brew install k6), then rerun `corepack pnpm test:e2e:k6`.");
  process.exit(2);
}
if (k6.status !== 0) {
  console.error("k6 did not complete successfully; keeping the previous reports and Allure results unchanged.");
  process.exit(k6.status ?? 1);
}
try {
  await access(reportFile);
  const currentSummary = JSON.parse(await readFile(reportFile, "utf8"));
  if (!Number.isFinite(Date.parse(currentSummary.finishedAt)) || Date.parse(currentSummary.finishedAt) < runStartedAt) {
    throw new Error("The summary file is stale; refusing to add old k6 results to Allure.");
  }
  const converter = resolve(root, "scripts/k6-to-allure.mjs");
  const conversion = spawnSync(process.execPath, [converter, reportFile], { cwd: root, stdio: "inherit" });
  if (conversion.status !== 0) process.exitCode = conversion.status ?? 1;
  const nativeReport = spawnSync(process.execPath, [resolve(performanceRoot, "generate-report.mjs"), reportFile], { cwd: root, stdio: "inherit" });
  if (nativeReport.status !== 0) process.exitCode = nativeReport.status ?? 1;
  const rawReport = spawnSync(process.execPath, [resolve(performanceRoot, "generate-native-report.mjs"), reportFile], { cwd: root, stdio: "inherit" });
  if (rawReport.status !== 0) process.exitCode = rawReport.status ?? 1;
} catch {
  console.error("k6 did not write performance/results/k6-summary.json; no reports were created.");
  process.exitCode ||= 1;
}
