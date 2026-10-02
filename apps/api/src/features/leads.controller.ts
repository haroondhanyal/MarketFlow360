import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { LeadDto, UpdateLeadDto, ConvertLeadDto } from "../crm-dto";

@Controller("leads") @UseGuards(AuthGuard, WorkspaceGuard)
export class LeadsController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.lead.findMany({ where: { ...scoped(req), archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 }); }
  @Post() async create(@Body() dto: LeadDto, @Req() req: SignedRequest) {
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim().replace(/[^\d+]/g, "");
    const duplicate = await this.db.lead.findFirst({ where: { ...scoped(req), archivedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } });
    if (duplicate) throw new ConflictException({ message: "Possible duplicate lead. Review the existing record before adding another.", existingLeadId: duplicate.id, existingLeadName: duplicate.name });
    const lead = await this.db.lead.create({ data: { ...dto, ...scoped(req), email, phone } });
    await this.db.leadActivity.create({ data: { ...scoped(req), leadId: lead.id, userId: req.authUser!.id, type: "CREATED", message: "Lead created" } });
    return lead;
  }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @Req() req: SignedRequest) {
    const old = await this.findLead(id, req);
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
}
