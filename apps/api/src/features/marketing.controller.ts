import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CampaignStatus, ContentStatus, LeadSource, LeadStatus } from "@prisma/client";
import { PartialType } from "@nestjs/mapped-types";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { scoped } from "../crm-common";
import { PrismaService } from "../prisma.service";
import { runNewLeadAutomations } from "./lead-automation";
import type { Request } from "express";
import { consumeRateLimit } from "../rate-limit";
import { applyAutomationAction, conditionMatches, validSource } from "./automation-runner";

class CampaignDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsInt() @Min(0) budgetMinor?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() goal?: string;
}
class UpdateCampaignDto extends PartialType(CampaignDto) {}
class ContentDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsDateString() publishAt?: string;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() campaignId?: string;
}
class UpdateContentDto extends PartialType(ContentDto) {}
class LandingPageDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() @MinLength(2) headline!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsString() @MinLength(2) slug!: string;
  @IsOptional() @IsString() buttonText?: string;
  @IsOptional() @IsString() interest?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @MaxLength(60, { each: true }) @IsString({ each: true }) formFields?: string[];
}
class UpdateLandingPageDto extends PartialType(LandingPageDto) {}
class AutomationDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(["NEW_LEAD"]) trigger!: string;
  @IsIn(["CREATE_TASK", "UPDATE_LEAD_STATUS"]) action!: string;
  @IsOptional() @IsString() actionValue?: string;
  @IsOptional() @IsIn(["STATUS", "SOURCE"]) conditionField?: string;
  @IsOptional() @IsString() @MaxLength(40) conditionValue?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10080) delayMinutes?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateAutomationDto extends PartialType(AutomationDto) {}
class PublicLeadDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
}

@Controller("campaigns") @UseGuards(AuthGuard, WorkspaceGuard)
export class CampaignsController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.campaign.findMany({ where: scoped(req), include: { _count: { select: { content: true } } }, orderBy: { updatedAt: "desc" } }); }
  @Post() create(@Body() dto: CampaignDto, @Req() req: SignedRequest) { return this.db.campaign.create({ data: { ...dto, ...scoped(req), startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined, currency: dto.currency ?? "PKR" } }); }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateCampaignDto, @Req() req: SignedRequest) { await this.find(id, req); return this.db.campaign.update({ where: { id }, data: { ...dto, startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined } }); }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { await this.find(id, req); await this.db.campaign.delete({ where: { id } }); return { ok: true }; }
  private async find(id: string, req: SignedRequest) { const row = await this.db.campaign.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Campaign not found."); return row; }
}

@Controller("content") @UseGuards(AuthGuard, WorkspaceGuard)
export class ContentController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.contentItem.findMany({ where: scoped(req), include: { campaign: { select: { id: true, name: true } } }, orderBy: [{ publishAt: "asc" }, { createdAt: "desc" }] }); }
  @Post() async create(@Body() dto: ContentDto, @Req() req: SignedRequest) { await this.checkCampaign(dto.campaignId, req); return this.db.contentItem.create({ data: { ...dto, ...scoped(req), publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined } }); }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateContentDto, @Req() req: SignedRequest) {
    await this.find(id, req); await this.checkCampaign(dto.campaignId, req);
    if (req.workspaceRole === "APPROVER" && (Object.keys(dto).some(key => key !== "status") || (dto.status && !["APPROVED", "REJECTED"].includes(dto.status)))) throw new ForbiddenException("Approvers can only approve or reject content.");
    if (req.workspaceRole === "CONTENT_CREATOR" && dto.status && !["DRAFT", "IN_REVIEW"].includes(dto.status)) throw new ForbiddenException("Content creators can draft and submit items for review; an approver must publish them.");
    return this.db.contentItem.update({ where: { id }, data: { ...dto, publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined } });
  }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { await this.find(id, req); await this.db.contentItem.delete({ where: { id } }); return { ok: true }; }
  private async find(id: string, req: SignedRequest) { const row = await this.db.contentItem.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Content item not found."); return row; }
  private async checkCampaign(id: string | undefined, req: SignedRequest) { if (id && !await this.db.campaign.findFirst({ where: { id, ...scoped(req) } })) throw new NotFoundException("Campaign not found in this workspace."); }
}

@Controller("landing-pages") @UseGuards(AuthGuard, WorkspaceGuard)
export class LandingPagesController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.landingPage.findMany({ where: scoped(req), orderBy: { updatedAt: "desc" } }); }
  @Post() async create(@Body() dto: LandingPageDto, @Req() req: SignedRequest) { const slug = this.slug(dto.slug); if (await this.db.landingPage.findUnique({ where: { slug } })) throw new ConflictException("That public URL is already in use."); return this.db.landingPage.create({ data: { ...dto, formFields: this.formFields(dto.formFields), ...scoped(req), slug } }); }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateLandingPageDto, @Req() req: SignedRequest) { const row = await this.db.landingPage.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Landing page not found."); const slug = dto.slug ? this.slug(dto.slug) : undefined; if (slug && slug !== row.slug && await this.db.landingPage.findUnique({ where: { slug } })) throw new ConflictException("That public URL is already in use."); return this.db.landingPage.update({ where: { id }, data: { ...dto, formFields: dto.formFields === undefined ? undefined : this.formFields(dto.formFields), slug } }); }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { const row = await this.db.landingPage.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Landing page not found."); await this.db.landingPage.delete({ where: { id } }); return { ok: true }; }
  private slug(value: string) { const slug = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""); if (!slug) throw new ConflictException("Enter a valid public URL slug."); return slug; }
  private formFields(fields?: string[]) { const normalized = (fields ?? []).map(value => value.trim()).filter(Boolean); if (normalized.some(value => value.length < 2) || new Set(normalized.map(value => value.toLowerCase())).size !== normalized.length) throw new BadRequestException("Custom form field labels must be unique and at least two characters."); return normalized; }
}

@Controller("automations") @UseGuards(AuthGuard, WorkspaceGuard)
export class AutomationsController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.automation.findMany({ where: scoped(req), include: { runs: { take: 5, orderBy: { createdAt: "desc" } } }, orderBy: { updatedAt: "desc" } }); }
  @Post() async create(@Body() dto: AutomationDto, @Req() req: SignedRequest) { await this.validateAction(dto.action, dto.actionValue, req); await this.validateCondition(dto.conditionField, dto.conditionValue, req); return this.db.automation.create({ data: { ...dto, delayMinutes: dto.delayMinutes ?? 0, ...scoped(req) } }); }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateAutomationDto, @Req() req: SignedRequest) { const old = await this.find(id, req); await this.validateAction(dto.action ?? old.action, dto.actionValue ?? old.actionValue ?? undefined, req); await this.validateCondition(dto.conditionField ?? old.conditionField ?? undefined, dto.conditionValue ?? old.conditionValue ?? undefined, req); return this.db.automation.update({ where: { id }, data: dto }); }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { await this.find(id, req); await this.db.automation.delete({ where: { id } }); return { ok: true }; }
  @Post(":id/run") async run(@Param("id") id: string, @Req() req: SignedRequest) { const automation = await this.find(id, req); if (!automation.isActive) throw new NotFoundException("Enable this automation before running it."); const lead = await this.db.lead.findFirst({ where: { ...scoped(req), archivedAt: null }, orderBy: { createdAt: "desc" } }); return this.execute(automation, lead?.id ?? null, req); }
  async execute(automation: { id: string; action: string; actionValue: string | null; conditionField: string | null; conditionValue: string | null; delayMinutes: number }, leadId: string | null, req: SignedRequest) {
    const lead = leadId ? await this.db.lead.findFirst({ where: { id: leadId, ...scoped(req), archivedAt: null } }) : null;
    if (!lead) return this.db.automationRun.create({ data: { automationId: automation.id, recordId: null, result: "No lead available for this run.", status: "DONE" } });
    if (!conditionMatches(automation, lead)) return this.db.automationRun.create({ data: { automationId: automation.id, recordId: lead.id, result: "Skipped: lead did not match this automation condition.", status: "DONE" } });
    if (automation.delayMinutes > 0) return this.db.automationRun.create({ data: { automationId: automation.id, recordId: lead.id, result: "Waiting for scheduled execution.", status: "PENDING", scheduledAt: new Date(Date.now() + automation.delayMinutes * 60_000) } });
    const result = await applyAutomationAction(this.db, automation, lead, req.authUser!.id);
    return this.db.automationRun.create({ data: { automationId: automation.id, recordId: lead.id, result, status: "DONE" } });
  }
  private async find(id: string, req: SignedRequest) { const row = await this.db.automation.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Automation not found."); return row; }
  private async validateAction(action: string, value: string | undefined, req: SignedRequest) {
    if (action !== "UPDATE_LEAD_STATUS") return;
    const configuredStages = await this.db.pipelineStage.findMany({ where: scoped(req), select: { key: true } });
    const allowedStages = new Set(configuredStages.length ? configuredStages.map(stage => stage.key) : Object.values(LeadStatus));
    if (!value || !allowedStages.has(value)) throw new BadRequestException("Choose a valid lead stage for this action.");
  }
  private async validateCondition(field: string | undefined, value: string | undefined, req: SignedRequest) {
    if (!field && !value) return;
    if (!field || !value) throw new BadRequestException("Choose both a condition field and its value.");
    if (field === "SOURCE" && validSource(value)) return;
    if (field === "STATUS") {
      const configuredStages = await this.db.pipelineStage.findMany({ where: scoped(req), select: { key: true } });
      const allowedStages = new Set(configuredStages.length ? configuredStages.map(stage => stage.key) : Object.values(LeadStatus));
      if (allowedStages.has(value)) return;
    }
    throw new BadRequestException("Choose a valid workspace lead status or source condition.");
  }
}

@Controller("public")
export class PublicLandingController {
  constructor(private db: PrismaService) {}
  @Get("pages/:slug") async page(@Param("slug") slug: string) {
    const page = await this.db.landingPage.findFirst({ where: { slug, isPublished: true }, select: { title: true, headline: true, description: true, buttonText: true, interest: true, slug: true, formFields: true } });
    if (!page) throw new NotFoundException("This landing page is not published.");
    return page;
  }
  @Post("pages/:slug/leads") async capture(@Param("slug") slug: string, @Body() dto: PublicLeadDto, @Req() req: Request) {
    const page = await this.db.landingPage.findFirst({ where: { slug, isPublished: true } });
    if (!page) throw new NotFoundException("This landing page is not published.");
    await consumeRateLimit(this.db, `landing:${slug}:${req.ip}`, 10, 60_000);
    const fields = Array.isArray(page.formFields) ? page.formFields.filter((field): field is string => typeof field === "string") : [];
    const extraNotes = fields.map(field => [field, dto.customFields?.[field]] as const).filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0).map(([field, value]) => `${field}: ${value.trim().slice(0, 600)}`).join("\n");
    const lead = await this.db.lead.create({ data: { workspaceId: page.workspaceId, name: dto.name.trim(), email: dto.email?.trim().toLowerCase() || undefined, phone: dto.phone?.trim() || undefined, notes: extraNotes || undefined, source: "WEBSITE", interest: page.interest ?? page.title, activities: { create: { workspaceId: page.workspaceId, type: "CAPTURED", message: `Captured from landing page: ${page.title}` } } } });
    await runNewLeadAutomations(this.db, page.workspaceId, lead);
    return { ok: true, message: "Thanks. Your enquiry has been sent." };
  }
}
