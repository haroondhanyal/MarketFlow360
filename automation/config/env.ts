import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
loadEnv({ path: resolve(root, "apps/api/.env") });
loadEnv({ path: resolve(root, "automation/.env"), override: true });
const configuredDatabaseUrl = process.env.AUTOMATION_DATABASE_URL || process.env.DATABASE_URL || "";
let databaseUrl = configuredDatabaseUrl;
if (configuredDatabaseUrl && process.env.AUTOMATION_ALLOW_NON_TEST_DATABASE !== "true") {
  const url = new URL(configuredDatabaseUrl);
  const name = url.pathname.replace(/^\//, "");
  if (!/(automation|e2e|test)/i.test(name)) url.pathname = `/${name}_automation`;
  databaseUrl = url.toString();
}
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
export const config = {
  webBaseUrl: process.env.WEB_BASE_URL ?? "http://127.0.0.1:3100",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://127.0.0.1:4100/api/v1",
  databaseUrl,
  email: process.env.AUTOMATION_EMAIL ?? "owner@nexora.example",
  password: process.env.AUTOMATION_PASSWORD ?? "MarketFlow2026!",
};
