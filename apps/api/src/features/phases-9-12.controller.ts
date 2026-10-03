import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { randomBytes } from "node:crypto";
import type { Request } from "express";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { scoped } from "../crm-common";
import { PrismaService } from "../prisma.service";
import { consumeRateLimit } from "../rate-limit";

const PROVIDERS = ["WEBHOOK"];
class IntegrationDto { @IsIn(PROVIDERS) provider!: string; @IsString() @MinLength(2) @MaxLength(80) label!: string; }
class AskDto { @IsString() @MinLength(3) @MaxLength(1000) question!: string; }

@Controller("integrations") @UseGuards(AuthGuard, WorkspaceGuard)
export class IntegrationsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Req() req: SignedRequest) { return this.db.integrationConnection.findMany({ where: scoped(req), select: { id: true, provider: true, label: true, status: true, webhookKey: true, createdAt: true } }); }
  @Post() async create(@Req() req: SignedRequest, @Body() dto: IntegrationDto) {
    const row = await this.db.integrationConnection.upsert({ where: { workspaceId_provider: { workspaceId: req.workspaceId!, provider: dto.provider } }, create: { ...scoped(req), provider: dto.provider, label: dto.label.trim(), webhookKey: randomBytes(32).toString("hex") }, update: { label: dto.label.trim(), status: "ACTIVE" } });
    return { id: row.id, provider: row.provider, label: row.label, status: row.status, webhookKey: row.webhookKey, createdAt: row.createdAt };
  }
  @Delete(":id") async remove(@Req() req: SignedRequest, @Param("id") id: string) {
    const deleted = await this.db.integrationConnection.deleteMany({ where: { id, ...scoped(req) } });
    if (!deleted.count) throw new NotFoundException("Integration not found.");
    return { ok: true };
  }
}

@Controller("webhooks")
export class WebhookController {
  constructor(private db: PrismaService) {}
  @Post(":key/leads") async lead(@Param("key") key: string, @Body() body: any, @Req() req: Request) {
    if (typeof body?.name !== "string" || body.name.trim().length < 2) throw new BadRequestException("A lead name is required.");
    const connection = await this.db.integrationConnection.findUnique({ where: { webhookKey: key } });
    if (!connection || connection.status !== "ACTIVE") throw new NotFoundException("Webhook is unavailable.");
    await consumeRateLimit(this.db, `webhook:${key}:${req.ip}`, 30, 60_000);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    if (email && !email.includes("@")) throw new BadRequestException("Email address is invalid.");
    const lead = await this.db.lead.create({ data: { workspaceId: connection.workspaceId, name: body.name.trim().slice(0, 120), email, phone: typeof body.phone === "string" ? body.phone.slice(0, 80) : undefined, interest: typeof body.interest === "string" ? body.interest.slice(0, 160) : undefined, source: "OTHER", activities: { create: { workspaceId: connection.workspaceId, type: "WEBHOOK", message: `Lead captured through ${connection.label}` } } } });
    await this.db.auditEvent.create({ data: { workspaceId: connection.workspaceId, action: "webhook.lead_created", entity: "lead", entityId: lead.id, details: { integrationId: connection.id } } });
    return { id: lead.id, accepted: true };
  }
}

@Controller("assistant") @UseGuards(AuthGuard, WorkspaceGuard)
export class AssistantController {
  constructor(private db: PrismaService) {}
  @Post("ask") async ask(@Req() req: SignedRequest, @Body() dto: AskDto) {
    const question = dto.question.trim();
    const q = question.toLowerCase();
    const workspace = scoped(req);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000);
    const now = new Date();
    const [leadCount, staleCount, staleLeads, newLeads, overdueCount, overdueTasks, activeTasks, dealSummary, dealStages, sourceSummary, activeCampaigns, leadStages] = await Promise.all([
      this.db.lead.count({ where: { ...workspace, archivedAt: null } }),
      this.db.lead.count({ where: { ...workspace, archivedAt: null, status: "NEW", createdAt: { lt: threeDaysAgo } } }),
      this.db.lead.findMany({ where: { ...workspace, archivedAt: null, status: "NEW", createdAt: { lt: threeDaysAgo } }, orderBy: { createdAt: "asc" }, take: 5, select: { name: true, interest: true, createdAt: true } }),
      this.db.lead.findMany({ where: { ...workspace, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { name: true, interest: true, status: true, createdAt: true } }),
      this.db.task.count({ where: { ...workspace, status: { not: "DONE" }, dueAt: { lt: now } } }),
      this.db.task.findMany({ where: { ...workspace, status: { not: "DONE" }, dueAt: { lt: now } }, orderBy: { dueAt: "asc" }, take: 5, select: { title: true, dueAt: true, lead: { select: { name: true } }, customer: { select: { name: true } } } }),
      this.db.task.count({ where: { ...workspace, status: { not: "DONE" } } }),
      this.db.deal.aggregate({ where: workspace, _count: true, _sum: { amountMinor: true } }),
      this.db.deal.groupBy({ by: ["stage", "currency"], where: workspace, _count: { _all: true }, _sum: { amountMinor: true } }),
      this.db.lead.groupBy({ by: ["source"], where: { ...workspace, archivedAt: null }, _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
      this.db.campaign.count({ where: { ...workspace, status: "ACTIVE" } }),
      this.db.lead.groupBy({ by: ["status"], where: { ...workspace, archivedAt: null }, _count: { _all: true } }),
    ]);
    const suggestions = [
      "Which leads should I follow up with today?",
      "Show me overdue tasks and what they relate to.",
      "Summarize my deal pipeline and value.",
      "Which lead sources are bringing the most enquiries?",
    ];
    const formatDate = (date: Date) => date.toLocaleDateString("en", { day: "numeric", month: "short" });
    const listLeads = (rows: typeof staleLeads) => rows.length ? rows.map(lead => `• ${lead.name}${lead.interest ? ` — ${lead.interest}` : ""} (added ${formatDate(lead.createdAt)})`).join("\n") : "There are no leads in that group right now.";
    const listTasks = overdueTasks.length ? overdueTasks.map(task => `• ${task.title}${task.lead?.name ? ` — lead: ${task.lead.name}` : task.customer?.name ? ` — customer: ${task.customer.name}` : ""} (due ${task.dueAt ? formatDate(task.dueAt) : "date not set"})`).join("\n") : "There are no overdue open tasks right now.";
    let answer: string;
    if (/overdue|task|reminder|due date/.test(q)) {
      answer = `${overdueCount} overdue task(s) out of ${activeTasks} open task(s).\n${listTasks}${overdueCount ? "\n\nStart with the oldest due item, then mark it complete or set a new due date." : ""}`;
    } else if (/source|channel|where.*lead|lead.*come/.test(q)) {
      answer = sourceSummary.length ? `Lead sources in this workspace (${leadCount} active leads):\n${sourceSummary.map(row => `• ${row.source.replaceAll("_", " ")}: ${row._count._all}`).join("\n")}\n\nFocus first on the source with the largest count, then compare it with lead quality and conversions.` : "There are no active leads yet, so source performance will appear after enquiries arrive.";
    } else if (/deal|pipeline|revenue|sales|value|forecast/.test(q)) {
      answer = `${dealSummary._count} deal(s) have a recorded total value of PKR ${((dealSummary._sum.amountMinor ?? 0) / 100).toLocaleString()}.\n${dealStages.length ? dealStages.map(row => `• ${row.stage.replaceAll("_", " ")} — ${row._count._all} deal(s), ${row.currency} ${((row._sum.amountMinor ?? 0) / 100).toLocaleString()}`).join("\n") : "No deals are recorded yet."}\n\nReview open deals with the next expected date and confirm the next action with their owner.`;
    } else if (/campaign|marketing|content|ad spend/.test(q)) {
      answer = `There ${activeCampaigns === 1 ? "is" : "are"} ${activeCampaigns} active campaign(s), ${leadCount} active lead(s), and ${staleCount} new lead(s) waiting more than three days.\n${staleCount ? `Follow up first with:\n${listLeads(staleLeads)}` : "No new lead has been waiting more than three days."}\n\nCompare each active campaign's leads and cost per lead in Campaigns before moving budget.`;
    } else if (/lead|follow.?up|stale|contact|enquir/.test(q)) {
      answer = `${leadCount} active lead(s); ${staleCount} new lead(s) have been waiting more than three days.\n${staleCount ? `Start with these oldest leads:\n${listLeads(staleLeads)}` : newLeads.length ? `No new lead is over three days old. Recent leads:\n${listLeads(newLeads)}` : "There are no leads yet."}\n\nOpen the lead record to check its owner and notes, then schedule the next follow-up.`;
    } else {
      const stageSummary = leadStages.map(row => `${row._count._all} ${row.status.replaceAll("_", " ")}`).join(", ") || "no leads yet";
      const priority = overdueCount ? `Clear ${overdueCount} overdue task(s), starting with “${overdueTasks[0]?.title}”.` : staleCount ? `Follow up with ${staleLeads[0]?.name}, the oldest untouched new lead.` : "Review today's tasks and progress the next qualified lead.";
      answer = `Here is your workspace snapshot: ${leadCount} active leads (${stageSummary}), ${activeTasks} open task(s), ${dealSummary._count} deal(s) worth PKR ${((dealSummary._sum.amountMinor ?? 0) / 100).toLocaleString()}, and ${activeCampaigns} active campaign(s).\n\nSuggested priority: ${priority}`;
    }
    return { answer, suggestions, generatedBy: "workspace-data-assistant", context: { activeLeads: leadCount, staleLeads: staleCount, overdueTasks: overdueCount, openTasks: activeTasks, deals: dealSummary._count, activeCampaigns } };
  }
}

@Controller("plans") @UseGuards(AuthGuard, WorkspaceGuard)
export class PlansController {
  constructor(private db: PrismaService) {}
  @Get() async get(@Req() req: SignedRequest) {
    const subscription = await this.db.workspaceSubscription.upsert({ where: { workspaceId: req.workspaceId! }, create: { workspaceId: req.workspaceId! }, update: {} });
    return { subscription, plans: [{ id: "FREE", name: "Starter", limits: { seats: 3, leads: 500 } }, { id: "PRO", name: "Growth", limits: { seats: 15, leads: 10000 } }, { id: "AGENCY", name: "Agency", limits: { seats: 100, leads: 100000 } }], billingConfigured: Boolean(process.env.BILLING_PORTAL_URL), billingPortalUrl: process.env.BILLING_PORTAL_URL ?? null };
  }
}

@Controller("audit") @UseGuards(AuthGuard, WorkspaceGuard)
export class AuditController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Req() req: SignedRequest) { return this.db.auditEvent.findMany({ where: scoped(req), orderBy: { createdAt: "desc" }, take: 100 }); }
}

@Controller("platform-admin") @UseGuards(AuthGuard)
export class PlatformAdminController {
  constructor(private db: PrismaService) {}
  @Get("overview") async overview(@Req() req: SignedRequest) {
    const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(req.authUser!.email.toLowerCase())) throw new NotFoundException();
    const [users, workspaces, leads] = await Promise.all([this.db.user.count(), this.db.workspace.count(), this.db.lead.count()]);
    return { users, workspaces, leads, plans: await this.db.workspaceSubscription.groupBy({ by: ["plan"], _count: { _all: true } }) };
  }
}
