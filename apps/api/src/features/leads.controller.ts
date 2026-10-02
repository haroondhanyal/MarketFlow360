import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { LeadDto, UpdateLeadDto, ConvertLeadDto, BulkLeadImportDto, BulkLeadStatusDto } from "../crm-dto";

@Controller("leads") @UseGuards(AuthGuard, WorkspaceGuard)
export class LeadsController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.lead.findMany({ where: { ...scoped(req), archivedAt: null }, include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }); }
  @Get("export") async exportCsv(@Req() req: SignedRequest, @Res() res: Response) {
    const rows = await this.db.lead.findMany({ where: { ...scoped(req), archivedAt: null }, include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
    const quote = (value: unknown) => `"${String(value ?? "").replace(/[\r\n]+/g, " ").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const csv = [["Name", "Email", "Phone", "Interest", "Source", "Status", "Notes", "Assigned To", "Created At"], ...rows.map(row => [row.name, row.email, row.phone, row.interest, row.source, row.status, row.notes, row.assignedTo?.name, row.createdAt.toISOString()])].map(row => row.map(quote).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=marketflow-leads.csv"); res.send(csv);
  }
  @Post("import") async importCsvRows(@Body() dto: BulkLeadImportDto, @Req() req: SignedRequest) {
    if (dto.leads.length > 500) throw new BadRequestException("Import up to 500 leads per batch.");
    const created: unknown[] = []; let skipped = 0;
    for (const item of dto.leads) {
      const email = item.email?.trim().toLowerCase();
      const duplicate = email ? await this.db.lead.findFirst({ where: { ...scoped(req), archivedAt: null, email } }) : null;
      if (duplicate) { skipped++; continue; }
      if (item.assignedToId && !await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: item.assignedToId, workspaceId: req.workspaceId! } } })) throw new BadRequestException("An imported lead assignee is not a member of this workspace.");
      created.push(await this.db.lead.create({ data: { ...item, ...scoped(req), email } }));
    }
    return { imported: created.length, skipped, leads: created };
  }
  @Patch("bulk/status") async bulkStatus(@Body() dto: BulkLeadStatusDto, @Req() req: SignedRequest) {
    if (dto.ids.length > 500) throw new BadRequestException("Update up to 500 leads per batch.");
    const result = await this.db.lead.updateMany({ where: { ...scoped(req), id: { in: dto.ids }, archivedAt: null }, data: { status: dto.status } });
    return { updated: result.count };
  }
  @Post() async create(@Body() dto: LeadDto, @Req() req: SignedRequest) {
    await this.checkAssignee(dto.assignedToId, req);
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim().replace(/[^\d+]/g, "");
    const duplicate = await this.db.lead.findFirst({ where: { ...scoped(req), archivedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } });
    if (duplicate) throw new ConflictException({ message: "Possible duplicate lead. Review the existing record before adding another.", existingLeadId: duplicate.id, existingLeadName: duplicate.name });
    const lead = await this.db.lead.create({ data: { ...dto, ...scoped(req), email, phone } });
    await this.db.leadActivity.create({ data: { ...scoped(req), leadId: lead.id, userId: req.authUser!.id, type: "CREATED", message: "Lead created" } });
    const automations = await this.db.automation.findMany({ where: { ...scoped(req), trigger: "NEW_LEAD", isActive: true } });
    for (const automation of automations) {
      let result = "No action applied.";
      if (automation.action === "CREATE_TASK") { await this.db.task.create({ data: { ...scoped(req), leadId: lead.id, title: automation.actionValue || "Follow up with new lead", description: "Created by automation" } }); result = "Follow-up task created."; }
      await this.db.automationRun.create({ data: { automationId: automation.id, recordId: lead.id, result } });
    }
    return lead;
  }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @Req() req: SignedRequest) {
    const old = await this.findLead(id, req);
    await this.checkAssignee(dto.assignedToId, req);
    if (dto.status && dto.status !== old.status) {
      const next: Record<string, string[]> = { NEW: ["CONTACTED", "LOST"], CONTACTED: ["NEW", "INTERESTED", "LOST"], INTERESTED: ["CONTACTED", "PROPOSAL_PENDING", "LOST"], PROPOSAL_PENDING: ["INTERESTED", "WON", "LOST"], WON: ["LOST"], LOST: ["NEW"] };
      if (!next[old.status].includes(dto.status)) throw new BadRequestException(`Cannot move a lead from ${old.status} to ${dto.status}.`);
    }
    const updated = await this.db.lead.update({ where: { id }, data: { ...dto, email: dto.email?.toLowerCase() } });
    if (dto.status && dto.status !== old.status) await this.db.leadActivity.create({ data: { ...scoped(req), leadId: id, userId: req.authUser!.id, type: "STAGE_CHANGED", message: `Stage changed from ${old.status} to ${dto.status}` } });
    else if (dto.notes !== undefined) await this.db.leadActivity.create({ data: { ...scoped(req), leadId: id, userId: req.authUser!.id, type: "NOTE_UPDATED", message: "Lead notes updated" } });
    return updated;
  }
  @Get(":id/activities") async activities(@Param("id") id: string, @Req() req: SignedRequest) {
    await this.findLead(id, req);
    return this.db.leadActivity.findMany({ where: { leadId: id, ...scoped(req) }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
  }
  @Post(":id/convert") async convert(@Param("id") id: string, @Body() dto: ConvertLeadDto, @Req() req: SignedRequest) {
    const lead = await this.findLead(id, req);
    if (lead.status === "WON") throw new NotFoundException("This lead has already been converted.");
    const result = await this.db.$transaction(async tx => {
      const customer = await tx.customer.create({ data: { ...scoped(req), name: dto.customerName?.trim() || lead.name, email: lead.email, phone: lead.phone, notes: lead.notes } });
      const deal = await tx.deal.create({ data: { ...scoped(req), leadId: lead.id, customerId: customer.id, title: dto.dealTitle?.trim() || `${lead.name} opportunity`, amountMinor: dto.dealAmountMinor ?? 0, currency: "PKR" } });
      await tx.lead.update({ where: { id }, data: { status: "WON" } });
      await tx.leadActivity.create({ data: { ...scoped(req), leadId: id, userId: req.authUser!.id, type: "CONVERTED", message: "Lead converted to a customer and deal" } });
      return { customer, deal };
    });
    return result;
  }
  @Delete(":id") async archive(@Param("id") id: string, @Req() req: SignedRequest) {
    await this.findLead(id, req);
    await this.db.lead.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.db.leadActivity.create({ data: { ...scoped(req), leadId: id, userId: req.authUser!.id, type: "ARCHIVED", message: "Lead archived" } });
    return { ok: true };
  }
  private async findLead(id: string, req: SignedRequest) { const row = await this.db.lead.findFirst({ where: { id, ...scoped(req), archivedAt: null } }); if (!row) throw new NotFoundException("Lead not found."); return row; }
  private async checkAssignee(userId: string | undefined, req: SignedRequest) { if (userId && !await this.db.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: req.workspaceId! } } })) throw new BadRequestException("Lead owner must be a member of this workspace."); }
}
