import "dotenv/config";
import "reflect-metadata";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import cookieParser = require("cookie-parser");
import express = require("express");
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { consumeRateLimit } from "../src/rate-limit";
import { securityHeaders } from "../src/security-headers";
const { AppModule } = require("../dist/module") as typeof import("../src/module");
const { PrismaService } = require("../dist/prisma.service") as typeof import("../src/prisma.service");
const { AutomationWorker } = require("../dist/automation.worker") as typeof import("../src/automation.worker");

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/\/marketflow_test(?:\?|$)/.test(databaseUrl)) throw new Error("Integration tests only run when DATABASE_URL points to a dedicated marketflow_test database.");

let app: Awaited<ReturnType<typeof NestFactory.create>>;
let db: InstanceType<typeof PrismaService>;
let baseUrl: string;
let userId = "";
let workspaceId = "";
let cookie = "";
const email = `phase13-${Date.now()}@example.test`;
const testStartedAt = new Date();

before(async () => {
  app = await NestFactory.create(AppModule, { bodyParser: false, logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.use(securityHeaders);
  app.use(express.json({ limit: "5mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  db = app.get(PrismaService);
});

after(async () => {
  if (workspaceId) await db.workspace.deleteMany({ where: { id: workspaceId } });
  if (userId) await db.user.deleteMany({ where: { id: userId } });
  await db.loginThrottle.deleteMany({ where: { updatedAt: { gte: testStartedAt } } });
  await app.close();
});

async function json(path: string, body?: unknown, headers: Record<string, string> = {}, method?: string) {
  const response = await fetch(`${baseUrl}${path}`, { method: method ?? (body === undefined ? "GET" : "POST"), headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

test("local API supports auth, tenant CRM, dynamic stages, landing forms, webhook, plans and throttling", async () => {
  const health = await json("/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.response.headers.get("x-content-type-options"), "nosniff");
  const readiness = await json("/health/ready");
  assert.equal(readiness.response.status, 200, JSON.stringify(readiness.payload));

  const profileImage = "data:image/png;base64,aGVsbG8=";
  const registration = await json("/auth/register", { name: "Phase 13 Test", email, password: "TestPassword2026!", workspaceName: "Phase 13 Workspace", phone: "+92 300 1234567", profileImage });
  assert.equal(registration.response.status, 201);
  userId = registration.payload.user.id;
  workspaceId = registration.payload.workspaces[0].id;
  const verificationToken = new URL(registration.payload.verificationUrl).searchParams.get("token");
  assert.ok(verificationToken);
  const verified = await json("/auth/verify-email", { token: verificationToken });
  assert.equal(verified.response.status, 201);
  cookie = (verified.response.headers.get("set-cookie") ?? "").split(";")[0];
  assert.match(cookie, /^mf_session=/);
  const profile = await json("/auth/me", undefined, { cookie });
  assert.equal(profile.payload.platformAdmin, false);
  assert.equal(profile.payload.user.phone, "+92 300 1234567");
  assert.equal(profile.payload.user.profileImage, profileImage);
  const updatedProfile = await json("/auth/profile", { name: "Updated Test User", phone: "+1 202 555 0101", profileImage: null }, { cookie }, "PATCH");
  assert.equal(updatedProfile.response.status, 200);
  assert.equal(updatedProfile.payload.name, "Updated Test User");
  assert.equal(updatedProfile.payload.profileImage, null);
  assert.equal((await json("/auth/password", { currentPassword: "WrongPassword2026!", newPassword: "AnotherPassword2026!" }, { cookie }, "PATCH")).response.status, 401);
  assert.equal((await json("/auth/password", { currentPassword: "TestPassword2026!", newPassword: "AnotherPassword2026!" }, { cookie }, "PATCH")).response.status, 200);
  assert.equal((await json("/platform-admin/overview", undefined, { cookie })).response.status, 404);

  const headers = { cookie, "x-workspace-id": workspaceId };
  const landingSlug = `phase13-${Date.now()}`;
  const landing = await json("/landing-pages", { title: "Test page", slug: landingSlug, headline: "Tell us what you need", formFields: ["Course preference"], isPublished: true }, headers);
  assert.equal(landing.response.status, 201);
  const automation = await json("/automations", { name: "Website follow-up", trigger: "NEW_LEAD", action: "CREATE_TASK", actionValue: "Call website lead", conditionField: "SOURCE", conditionValue: "WEBSITE", delayMinutes: 1, isActive: true }, headers);
  assert.equal(automation.response.status, 201, JSON.stringify(automation.payload));
  const publicLead = await json(`/public/pages/${landingSlug}/leads`, { name: "Form Lead", customFields: { "Course preference": "Evening course" } });
  assert.equal(publicLead.response.status, 201);
  const scheduledRun = await db.automationRun.findFirst({ where: { automationId: automation.payload.id, recordId: (await db.lead.findFirst({ where: { name: "Form Lead", workspaceId } }))?.id } });
  assert.equal(scheduledRun?.status, "PENDING");
  assert.ok(scheduledRun?.scheduledAt && scheduledRun.scheduledAt > new Date());
  await db.automationRun.update({ where: { id: scheduledRun!.id }, data: { scheduledAt: new Date(Date.now() - 1_000) } });
  await app.get(AutomationWorker).processDue();
  assert.equal((await db.automationRun.findUnique({ where: { id: scheduledRun!.id } }))?.status, "DONE");
  assert.ok(await db.task.findFirst({ where: { workspaceId, leadId: scheduledRun!.recordId!, title: "Call website lead" } }));

  const connection = await json("/integrations", { provider: "WEBHOOK", label: "Test website" }, headers);
  assert.equal(connection.response.status, 201);
  const captured = await json(`/webhooks/${connection.payload.webhookKey}/leads`, { name: "Webhook Lead", email: "lead@example.test", interest: "Demo course" });
  assert.equal(captured.response.status, 201);

  const leads = await json("/leads", undefined, headers);
  assert.equal(leads.response.status, 200);
  assert.ok(leads.payload.some((lead: { email: string }) => lead.email === "lead@example.test"));
  assert.equal(leads.payload.find((lead: { name: string }) => lead.name === "Form Lead").notes, "Course preference: Evening course");
  const stagesResult = await json("/pipeline/stages", undefined, headers);
  const stages = stagesResult.payload as { key: string; label: string; position: number }[];
  const addedStage = [...stages, { key: "QUALIFIED", label: "Qualified", position: stages.length }];
  assert.equal((await json("/pipeline/stages", { stages: addedStage }, headers, "PUT")).response.status, 200);
  assert.equal((await json(`/leads/${captured.payload.id}`, { status: "QUALIFIED" }, headers, "PATCH")).response.status, 200);
  const removedStage = addedStage.filter(stage => stage.key !== "QUALIFIED").map((stage, position) => ({ ...stage, position }));
  assert.equal((await json("/pipeline/stages", { stages: removedStage }, headers, "PUT")).response.status, 200);
  const updatedLeads = await json("/leads", undefined, headers);
  assert.equal(updatedLeads.payload.find((lead: { id: string }) => lead.id === captured.payload.id).status, "NEW");
  assert.equal((await json("/plans", undefined, headers)).response.status, 200);
  const report = await json("/reports/summary?from=2020-01-01&to=2035-12-31", undefined, headers);
  assert.equal(report.response.status, 200);
  assert.ok(Array.isArray(report.payload.leadTrend));
  const audit = await json("/audit", undefined, headers);
  assert.equal(audit.response.status, 200);
  assert.ok(audit.payload.some((event: { action: string }) => event.action === "webhook.lead_created"));
  assert.ok(audit.payload.some((event: { action: string }) => event.action === "api.post"));
  assert.equal((await json("/leads", undefined, { cookie, "x-workspace-id": "not-a-workspace" })).response.status, 401);

  const throttleKey = `phase13-${Date.now()}-${Math.random()}`;
  await consumeRateLimit(db, throttleKey, 1, 60_000);
  await assert.rejects(() => consumeRateLimit(db, throttleKey, 1, 60_000), (error: { status: number }) => error.status === 429);
});
