import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { headerThemeButtons, reportThemeCss, reportThemeScript, uiThemeControls } from "./report-theme-controls.mjs";

const automationRoot = resolve(import.meta.dirname, "..");
const report = resolve(automationRoot, "allure-report");
const htmlPath = resolve(report, "index.html");
const definitions = [
  { name: "Product Defects", icon: "✹", color: "#fb4054", description: "Application behavior and business-rule validation failures." },
  { name: "Automation / Test Defects", icon: "⚙", color: "#ff762f", description: "Locator, selector, test script, hook, or framework failures." },
  { name: "API / Integration Issues", icon: "↗", color: "#278af7", description: "HTTP, API contract, service, or external integration failures." },
  { name: "Environment / Infrastructure", icon: "▤", color: "#8c50ee", description: "Network, browser, server, database, or test environment failures." },
  { name: "Test Data Issues", icon: "▤", color: "#32be72", description: "Missing, invalid, duplicate, or unavailable test data." },
  { name: "Timeout / Performance", icon: "◷", color: "#f8bd18", description: "Navigation, API response, wait, or performance thresholds." },
  { name: "Performance / Load", icon: "⌁", color: "#13b8a6", description: "k6 throughput, per-workspace latency, and load-test checks." },
  { name: "UI Coverage", icon: "▣", color: "#5d6ff1", description: "UI smoke, form validation, navigation, and responsive checks." },
  { name: "BDD / Stories", icon: "❖", color: "#c153d8", description: "Gherkin features, stories, and workspace journeys." },
  { name: "Database / Integrity", icon: "▤", color: "#4b92a7", description: "Database integrity and tenant isolation cases." },
  { name: "Known Issues", icon: "⚠", color: "#8798ad", description: "Known bugs, expected failures, and tracked third-party issues." },
  { name: "Skipped / Pending", icon: "▶", color: "#20b9b5", description: "Skipped tests, pending implementation, or unavailable dependencies." },
];

const readJson = async (file) => JSON.parse(await readFile(resolve(report, file), "utf8"));
const summary = await readJson("widgets/summary.json");
const suiteTree = await readJson("data/suites.json");
const resultFiles = await readdir(resolve(automationRoot, "allure-results"));
const resultAttempts = [];
for (const file of resultFiles.filter((name) => name.endsWith("-result.json"))) {
  try { resultAttempts.push(JSON.parse(await readFile(resolve(automationRoot, "allure-results", file), "utf8"))); } catch {}
}

const projectOf = (test) => test.labels?.find((label) => label.name === "parentSuite")?.value
  ?? test.parameters?.find((parameter) => parameter.name === "Project")?.value
  ?? "other";
const attemptsByCase = new Map();
for (const test of resultAttempts) {
  const key = `${projectOf(test)}|${test.historyId ?? test.uuid}`;
  const group = attemptsByCase.get(key) ?? { latest: test, count: 0 };
  group.count++;
  if ((test.stop ?? 0) > (group.latest.stop ?? 0)) group.latest = test;
  attemptsByCase.set(key, group);
}
const results = [...attemptsByCase.values()].map(({ latest, count }) => ({ ...latest, mf360RetryCount: Math.max(0, count - 1) }));
const suiteChildren = suiteTree.children ?? [];
const projectName = (project) => project === "ui" ? "UI" : project === "api" ? "API" : project === "bdd" ? "BDD" : project === "database" ? "Database" : project.includes("k6") ? "k6 Performance" : project;
const suiteFileNodes = (project) => {
  const group = suiteChildren.find((item) => item.name.toLowerCase() === project.toLowerCase());
  return group?.children ?? [];
};
const hrefFor = (test) => {
  const project = projectOf(test);
  const suiteLabel = test.labels?.find((label) => label.name === "suite")?.value ?? "";
  const candidates = suiteFileNodes(project);
  const file = candidates.find((item) => suiteLabel.endsWith(item.name) || item.name.endsWith(suiteLabel)) ?? candidates[0];
  if (!file?.uid) return `#/suites`;
  const findCase = (node) => {
    if (node.status && node.name === test.name && (node.time?.start ?? 0) === (test.start ?? 0)) return node;
    for (const child of node.children ?? []) { const match = findCase(child); if (match) return match; }
    return null;
  };
  const leaf = findCase(file) ?? (function findName(node) { if (node.status && node.name === test.name) return node; for (const child of node.children ?? []) { const match = findName(child); if (match) return match; } return null; })(file);
  return leaf?.uid ? `#/suites/${file.uid}/${leaf.uid}` : `#/suites/${file.uid}`;
};
const failureText = (test) => `${test.statusDetails?.message ?? ""}\n${test.statusDetails?.trace ?? ""}`;
function categoryFor(test) {
  if (test.status === "skipped" || test.status === "unknown") return "Skipped / Pending";
  if (projectOf(test) === "Performance / k6" || projectOf(test) === "k6-performance") return "Performance / Load";
  if (test.status === "passed") return ({ bdd: "BDD / Stories", ui: "UI Coverage", api: "API / Integration Issues", database: "Database / Integrity" })[projectOf(test)] ?? "Automation / Test Defects";
  const text = `${test.name}\n${failureText(test)}`;
  if (/timeout|timed out|exceed(?:ed)? .*threshold|slow response/i.test(text)) return "Timeout / Performance";
  if (/fixture|seed|faker|test data|unique constraint|foreign key|invalid.*data/i.test(text)) return "Test Data Issues";
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|browserType\.launch|Target closed|Safety stop|database.*(?:connect|unavailable)|network/i.test(text)) return "Environment / Infrastructure";
  if (projectOf(test) === "api" || /\bHTTP\b|status code|API contract|response schema/i.test(text)) return "API / Integration Issues";
  if (/known issue|expected failure|third.party/i.test(text)) return "Known Issues";
  if (/locator|selector|strict mode|test\.step|hook|playwright/i.test(text)) return "Automation / Test Defects";
  return "Product Defects";
}
function flatten(test) {
  const steps = [];
  const attachments = [];
  const walk = (items = [], prefix = "") => {
    for (const item of items) {
      const path = prefix ? `${prefix} › ${item.name}` : item.name;
      if (item.name) steps.push({ name: path, status: item.status ?? "passed" });
      for (const attachment of item.attachments ?? []) attachments.push(attachment);
      walk(item.steps, path);
    }
  };
  walk(test.steps);
  for (const attachment of test.attachments ?? []) attachments.push(attachment);
  return { steps, attachments };
}
function retryCount(test) {
  const fromFields = Number(test.retries ?? test.retriesCount ?? 0);
  const fromSteps = flatten(test).steps.reduce((max, step) => {
    const match = step.name.match(/retry count\s+(\d+)/i);
    return Math.max(max, Number(match?.[1] ?? 0));
  }, 0);
  return Math.max(fromFields, fromSteps, Number(test.mf360RetryCount ?? 0));
}
const categories = await Promise.all(definitions.map(async (definition) => {
  const tests = await Promise.all(results.filter((test) => categoryFor(test) === definition.name).map(async (test) => {
    const { steps, attachments } = flatten(test);
    return {
      name: test.name,
      status: test.status,
      project: projectOf(test),
      href: hrefFor(test),
      duration: Math.max(0, (test.stop ?? 0) - (test.start ?? 0)),
      message: test.statusDetails?.message ?? "",
      trace: test.statusDetails?.trace ?? "",
      steps,
      attachments: await Promise.all(attachments.map(async (attachment) => {
        let evidence;
        if (attachment.source && attachment.type?.includes("json")) {
          try { evidence = JSON.parse(await readFile(resolve(automationRoot, "allure-results", attachment.source), "utf8")); } catch {}
        }
        return { name: attachment.name, type: attachment.type, href: attachment.source ? `./${attachment.source}` : "", evidence };
      })),
    };
  }));
  return {
    ...definition,
    tests,
    total: tests.length,
    failed: tests.filter((test) => test.status === "failed").length,
    broken: tests.filter((test) => test.status === "broken").length,
    skipped: tests.filter((test) => test.status === "skipped" || test.status === "unknown").length,
    passed: tests.filter((test) => test.status === "passed").length,
  };
}));
const projects = ["ui", "api", "bdd", "database", "Performance / k6"].map((project) => {
  const rows = results.filter((test) => projectOf(test) === project);
  const suites = suiteFileNodes(project);
  const href = suites[0]?.uid ? `#/suites/${suites[0].uid}` : "#/suites";
  const durationMs = rows.reduce((sum, test) => sum + Math.max(0, (test.stop ?? 0) - (test.start ?? 0)), 0);
  return { id: project, name: projectName(project), href, total: rows.length, passed: rows.filter((test) => test.status === "passed").length, failed: rows.filter((test) => ["failed", "broken"].includes(test.status)).length, skipped: rows.filter((test) => ["skipped", "unknown"].includes(test.status)).length, durationMs, retries: rows.reduce((sum, test) => sum + retryCount(test), 0), avgDurationMs: rows.length ? durationMs / rows.length : 0 };
}).filter((project) => project.total > 0);
const suiteIndex = new Map();
const indexSuiteCases = (node, fileUid = "") => {
  if (node.uid && node.children?.length && node.status === undefined) fileUid = node.uid;
  if (node.status && node.uid) suiteIndex.set(`${node.parentUid}|${node.name}`, { ...node, fileUid });
  for (const child of node.children ?? []) indexSuiteCases(child, fileUid);
};
indexSuiteCases(suiteTree);
const featureMap = new Map();
for (const test of results.filter((row) => projectOf(row) === "bdd")) {
  const labels = Object.fromEntries((test.labels ?? []).map(({ name, value }) => [name, value]));
  const suitePath = labels.suite ?? "";
  const featureFile = suitePath.split("/").at(-1)?.replace(".feature.spec.js", "") ?? "BDD feature";
  const featureName = featureFile.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const storyPath = (labels.subSuite ?? test.name).split(" > ");
  const story = storyPath.at(-1) || test.name;
  const key = `${featureFile}::${story}`;
  if (!featureMap.has(key)) featureMap.set(key, { feature: featureName, story, total: 0, passed: 0, failed: 0, href: hrefFor(test) });
  const item = featureMap.get(key);
  item.total++;
  if (test.status === "passed") item.passed++;
  if (["failed", "broken"].includes(test.status)) item.failed++;
}
const features = [...featureMap.values()].sort((a, b) => a.feature.localeCompare(b.feature) || a.story.localeCompare(b.story));
const reportStarted = summary.time?.start ?? Date.now();
const reportStopped = summary.time?.stop ?? Date.now();
const reportHistoryPath = resolve(automationRoot, ".state/marketflow360-report-history.json");
await mkdir(resolve(automationRoot, ".state"), { recursive: true });
let history = [];
try { history = JSON.parse(await readFile(reportHistoryPath, "utf8")); } catch {}
const currentRun = { stop: reportStopped, start: reportStarted, total: summary.statistic?.total ?? results.length, passed: summary.statistic?.passed ?? 0, failed: (summary.statistic?.failed ?? 0) + (summary.statistic?.broken ?? 0), skipped: summary.statistic?.skipped ?? 0, durationMs: summary.time?.duration ?? 0, retries: projects.reduce((sum, project) => sum + project.retries, 0), categories: categories.map(({ name, total, passed, failed, broken, skipped }) => ({ name, total, passed, failed: failed + broken, skipped })), projects: projects.map(({ id, total, passed, failed, skipped, durationMs, retries }) => ({ id, total, passed, failed, skipped, durationMs, retries })) };
const sameRun = history.findIndex((run) => run.stop === reportStopped);
if (sameRun >= 0) history[sameRun] = currentRun;
else history.push(currentRun);
history = history.sort((a, b) => a.stop - b.stop).slice(-20);
await writeFile(reportHistoryPath, JSON.stringify(history, null, 2));
const dashboard = {
  reportName: "MarketFlow360 Automation Report",
  generatedAt: summary.time?.stop ?? Date.now(),
  duration: summary.time?.duration ?? 0,
  totals: summary.statistic ?? { total: results.length },
  owner: { name: "Raja Haroon Jamal", title: "Full Stack QA Automation Engineer", department: "QA Department" },
  projects,
  features,
  history,
  categories,
};
await writeFile(resolve(report, "marketflow-categories.json"), JSON.stringify(dashboard));
await copyFile(resolve(automationRoot, "scripts/report-categories.js"), resolve(report, "marketflow-categories.js"));
await copyFile(resolve(automationRoot, "scripts/report-categories.css"), resolve(report, "marketflow-categories.css"));
await copyFile(resolve(automationRoot, "../apps/web/public/marketflow360-logo.svg"), resolve(report, "marketflow360-logo.svg"));
const k6ReportDir = resolve(report, "k6-performance");
await mkdir(k6ReportDir, { recursive: true });
for (const [source, target] of [["k6-advanced-report.html", "advanced.html"], ["k6-native-report.html", "native.html"]]) {
  const sourcePath = resolve(automationRoot, "performance/reports", source);
  let reportHtml = await readFile(sourcePath, "utf8");
  reportHtml = reportHtml
    .replaceAll("../../allure-report/index.html", "../index.html")
    .replaceAll("../results/k6-summary.json", "./k6-summary.json")
    .replaceAll("./k6-native-report.html", "./native.html")
    .replaceAll("./k6-advanced-report.html", "./advanced.html");
  await writeFile(resolve(k6ReportDir, target), reportHtml);
}
await copyFile(resolve(automationRoot, "performance/results/k6-summary.json"), resolve(k6ReportDir, "k6-summary.json"));
let html = await readFile(htmlPath, "utf8");
// Regeneration can rerun this branding step against an already branded Allure
// report. Remove the previous injected pieces first so the page keeps one banner.
html = html
  .replace(/<style data-mf360-report-brand="true">[\s\S]*?<\/style>/g, "")
  .replace(/<style>:root\{--mf360-banner:[\s\S]*?<\/style>/g, "")
  .replace(/<style>\s*\.mf360-report-brand\{[\s\S]*?<\/style>/g, "")
  .replace(/<link rel="stylesheet" href="\.\/marketflow-categories\.css">/g, "")
  .replace(/<script src="\.\/marketflow-categories\.js"><\/script>/g, "")
  .replace(/<header class="mf360-report-brand">[\s\S]*?<\/header>/g, "");
const styles = `<style data-mf360-report-brand="true">${reportThemeCss}
.mf360-report-brand{box-sizing:border-box;position:relative;z-index:1000;display:flex;align-items:center;gap:26px;padding:18px 32px;background:var(--mf360-banner,linear-gradient(115deg,#071a35,#132e58 68%,#4220bd));color:#fff;box-shadow:0 5px 24px #10284a30}
.mf360-report-brand img{box-sizing:content-box;width:min(245px,27vw);height:46px;padding:6px 10px;border-radius:10px;background:#fff;object-fit:contain;object-position:left center;filter:drop-shadow(0 2px 8px #0004)}
.mf360-report-brand__copy{flex:1}.mf360-report-brand h1{margin:0;font:700 clamp(23px,2.25vw,34px)/1.15 Inter,system-ui,sans-serif;letter-spacing:-.035em}
.mf360-report-brand p{margin:5px 0 0;color:#cfdbf4;font:500 14px/1.5 Inter,system-ui,sans-serif}
.mf360-k6-report-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mf360-k6-report-nav a{display:inline-flex;align-items:center;padding:9px 12px;border:1px solid #ffffff65;border-radius:9px;background:#ffffff18;color:#fff;text-decoration:none;font:700 12px/1.3 Inter,system-ui,sans-serif;white-space:nowrap}.mf360-k6-report-nav a:hover{background:#ffffff32;border-color:#fff}
.mf360-report-brand__stats{display:flex;gap:6px;flex-wrap:wrap}.mf360-report-brand__stats span{padding:6px 8px;border:1px solid #ffffff32;border-radius:999px;color:#e8efff;font:600 11px/1.3 Inter,system-ui,sans-serif}
.mf360-report-theme{display:flex;align-items:center;gap:9px;color:#e1eaff;font:600 12px/1.3 Inter,system-ui,sans-serif;white-space:nowrap}.mf360-theme-picker{display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #ffffff50;border-radius:999px;background:#ffffff18}.mf360-theme-swatch{width:22px;height:22px;padding:0;border:2px solid #ffffff50;border-radius:50%;background:var(--mf360-swatch);cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}.mf360-theme-swatch:hover{transform:scale(1.16);border-color:#fff}.mf360-theme-swatch[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px #ffffff40,0 0 0 4px #071a35;transform:scale(1.1)}.mf360-theme-swatch:focus-visible{outline:2px solid #fff;outline-offset:4px}
@media(max-width:950px){.mf360-report-brand{gap:16px;flex-wrap:wrap}.mf360-report-brand__copy{flex:1 1 40%}.mf360-report-brand__stats{flex:1 1 100%}}
@media(max-width:760px){.mf360-report-brand{gap:12px;padding:14px 18px}.mf360-report-brand img{width:210px;height:38px}.mf360-report-brand__copy{flex-basis:100%}.mf360-report-theme{margin-left:auto}.mf360-k6-report-nav{flex-basis:100%}}
</style>`;
const startedAt = summary.time?.start ? new Date(summary.time.start).toLocaleString() : "Latest run";
const suiteNav = `${projects.map((project) => `<a class="mf360-report-suite-link" href="${project.href}">${project.name}</a>`).join("")}<a class="mf360-report-suite-link" href="#/categories">Categories</a>`;
const banner = `<header class="mf360-report-brand"><img src="./marketflow360-logo.svg" alt="MarketFlow360 logo"><div class="mf360-report-brand__copy"><h1>MarketFlow360 Automation Report</h1><p>${dashboard.owner.name} · ${dashboard.owner.department} · ${dashboard.owner.title}</p><nav class="mf360-report-suite-nav" aria-label="Open test project">${suiteNav}</nav></div><nav class="mf360-k6-report-nav" aria-label="k6 performance reports"><a href="./k6-performance/advanced.html">View k6 Advanced Report</a><a href="./k6-performance/native.html">View Native k6 Report</a></nav>${headerThemeButtons}<div class="mf360-report-brand__stats"><span>${summary.statistic?.total ?? results.length} cases</span><span>${summary.statistic?.passed ?? 0} passed</span><span>${(summary.statistic?.failed ?? 0) + (summary.statistic?.broken ?? 0)} failed</span><span>${summary.statistic?.skipped ?? 0} skipped</span></div></header>`;
html = html.replace("</head>", `${styles}<link rel="stylesheet" href="./marketflow-categories.css"></head>`)
  .replace("<body>", `<body>${banner}${uiThemeControls}`)
  .replace("</body>", `<script src="./marketflow-categories.js"></script><script>${reportThemeScript}</script></body>`);
await writeFile(htmlPath, html);
