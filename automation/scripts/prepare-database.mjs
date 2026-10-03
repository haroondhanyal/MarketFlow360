import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";

const root = resolve(import.meta.dirname, "../..");
loadEnv({ path: resolve(root, "apps/api/.env") });
loadEnv({ path: resolve(root, "automation/.env"), override: true });
const configuredUrl = process.env.AUTOMATION_DATABASE_URL || process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Set DATABASE_URL in apps/api/.env or automation/.env.");
const dbUrlObject = new URL(configuredUrl);
const configuredName = dbUrlObject.pathname.replace(/^\//, "");
if (process.env.AUTOMATION_ALLOW_NON_TEST_DATABASE !== "true" && !/(automation|e2e|test)/i.test(configuredName)) dbUrlObject.pathname = `/${configuredName}_automation`;
const dbUrl = dbUrlObject.toString();
const database = new URL(dbUrl).pathname.replace(/^\//, "");
if (!/(automation|e2e|test)/i.test(database) && process.env.AUTOMATION_ALLOW_NON_TEST_DATABASE !== "true") {
  throw new Error(`Refusing database preparation for '${database}'. Point DATABASE_URL at a dedicated automation/test database.`);
}
const maintenanceUrl = new URL(dbUrl);
maintenanceUrl.pathname = "/postgres";
const adminPool = new pg.Pool({ connectionString: maintenanceUrl.toString(), max: 1, application_name: "marketflow360-test-db-prepare" });
try {
  const existing = await adminPool.query("SELECT 1 FROM pg_database WHERE datname=$1", [database]);
  if (!existing.rowCount) await adminPool.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
} finally {
  await adminPool.end();
}
for (const args of [
  ["--filter", "@marketflow/api", "db:generate"],
  ["--filter", "@marketflow/api", "db:deploy"],
  ["--filter", "@marketflow/api", "db:seed"],
]) {
  const result = spawnSync("corepack", ["pnpm", ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl, NODE_ENV: "test" },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
