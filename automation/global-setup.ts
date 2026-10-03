import { request, type FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { copyFile } from "node:fs/promises";
import { config } from "./config/env";

const root = resolve(import.meta.dirname, "..");
const apiBase = config.apiBaseUrl;
const webBase = config.webBaseUrl;
const stateDir = resolve(root, "automation/.state");

export default async function globalSetup(_config: FullConfig) {
  const dbUrl = config.databaseUrl;
  if (!dbUrl) throw new Error("DATABASE_URL must be configured in apps/api/.env or automation/.env.");
  const databaseName = new URL(dbUrl).pathname.replace(/^\//, "");
  if (!/(automation|e2e|test)/i.test(databaseName) && process.env.AUTOMATION_ALLOW_NON_TEST_DATABASE !== "true") {
    throw new Error(`Safety stop: DATABASE_URL points to '${databaseName}'. Use a dedicated *automation, *e2e, or *test database. Set AUTOMATION_ALLOW_NON_TEST_DATABASE=true only for an intentional isolated test database.`);
  }

  await mkdir(stateDir, { recursive: true });
  await mkdir(resolve(root, "automation/allure-results"), { recursive: true });
  await copyFile(resolve(root, "automation/allure/categories.json"), resolve(root, "automation/allure-results/categories.json"));
  const api = await request.newContext({ baseURL: new URL(apiBase).origin });
  const prefix = new URL(apiBase).pathname.replace(/\/$/, "");
  const login = await api.post(`${prefix}/auth/login`, {
    data: {
      email: config.email,
      password: config.password,
    },
  });
  if (!login.ok()) throw new Error(`Automation login failed (${login.status()}): ${await login.text()}. Prepare and seed the dedicated automation database first.`);

  const me = await api.get(`${prefix}/auth/me`);
  if (!me.ok()) throw new Error(`Could not load automation owner workspaces (${me.status()}).`);
  const meBody = await me.json() as { workspaces: Array<{ id: string; name: string }> };
  const workspaces: Array<{ id: string; name: string }> = [];
  for (let index = 1; index <= 5; index++) {
    const name = `MarketFlow360 Automation ${index}`;
    let found = meBody.workspaces.find(workspace => workspace.name === name);
    if (!found) {
      const response = await api.post(`${prefix}/workspaces`, { data: { name, type: index === 5 ? "AGENCY" : "BUSINESS" } });
      if (!response.ok()) throw new Error(`Could not create test workspace '${name}' (${response.status()}): ${await response.text()}`);
      found = await response.json() as { id: string; name: string };
    }
    workspaces.push(found);
  }

  await api.storageState({ path: resolve(stateDir, "owner.json") });
  await writeFile(resolve(stateDir, "workspaces.json"), JSON.stringify(workspaces, null, 2));
  await api.dispose();
  if (!webBase.startsWith("http")) throw new Error("WEB_BASE_URL must be an absolute URL.");
}
