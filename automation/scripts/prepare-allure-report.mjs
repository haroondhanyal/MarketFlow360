import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const results = resolve(root, "allure-results");
await mkdir(results, { recursive: true });
await copyFile(resolve(root, "allure/categories.json"), resolve(results, "categories.json"));
const reportRun = new Date();
await writeFile(resolve(results, "executor.json"), JSON.stringify({
  name: "MarketFlow360 Automation",
  type: "local",
  reportName: "MarketFlow360 Allure Report",
  reportUrl: process.env.ALLURE_REPORT_URL ?? "http://127.0.0.1:59647",
  buildName: `MarketFlow360 · ${reportRun.toLocaleString()}`,
  buildOrder: reportRun.getTime(),
  environment: {
    Owner: "Raja Haroon Jamal",
    Role: "Full Stack QA Automation Engineer",
    Department: "QA Department",
    Suites: "UI · API · BDD · Database · k6 Performance",
  },
}, null, 2));

// Carry Allure history forward only when this is a newer test execution, not a report-only rebuild.
const previousSummaryPath = resolve(root, "allure-report/widgets/summary.json");
const previousHistory = resolve(root, "allure-report/history");
const historyTarget = resolve(results, "history");
try {
  const previousSummary = JSON.parse(await readFile(previousSummaryPath, "utf8"));
  const resultFiles = (await readdir(results)).filter((file) => file.endsWith("-result.json"));
  let currentStop = 0;
  for (const file of resultFiles) {
    try { currentStop = Math.max(currentStop, JSON.parse(await readFile(resolve(results, file), "utf8")).stop ?? 0); } catch {}
  }
  if (currentStop > (previousSummary.time?.stop ?? 0)) {
    await mkdir(historyTarget, { recursive: true });
    for (const entry of await readdir(previousHistory)) {
      await copyFile(resolve(previousHistory, entry), resolve(historyTarget, entry));
    }
  }
} catch {}
