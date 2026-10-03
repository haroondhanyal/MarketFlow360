import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const automationRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(automationRoot, "..");
const guardedFiles = ["apps/web/next-env.d.ts", "apps/web/tsconfig.json"];
const snapshots = new Map();
// Keep Allure scoped to this run so old failures/retries never pollute a fresh report.
const allureResults = resolve(automationRoot, "allure-results");
await mkdir(allureResults, { recursive: true });
for (const entry of await readdir(allureResults)) {
  await rm(resolve(allureResults, entry), { recursive: true, force: true });
}
for (const file of guardedFiles) {
  const path = resolve(repoRoot, file);
  try { snapshots.set(path, await readFile(path)); } catch {}
}

let interrupted = false;
const child = spawn(resolve(automationRoot, "node_modules/.bin/playwright"), ["test", "--config=playwright.config.ts", ...process.argv.slice(2)], {
  cwd: automationRoot,
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { interrupted = true; child.kill(signal); });

let exitCode = 1;
try {
  const result = await new Promise((resolveResult, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveResult(code ?? (signal ? 128 : 1)));
  });
  exitCode = Number(result);
} finally {
  for (const [path, bytes] of snapshots) await writeFile(path, bytes);
}
process.exitCode = interrupted && exitCode === 0 ? 130 : exitCode;
