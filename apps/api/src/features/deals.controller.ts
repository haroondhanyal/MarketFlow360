import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { DealDto, UpdateDealDto } from "../crm-dto";

@Controller("deals") @UseGuards(AuthGuard, WorkspaceGuard)
export class DealsController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.deal.findMany({ where: scoped(req), include: { customer: true, lead: true }, orderBy: { updatedAt: "desc" }, take: 200 }); }
  @Post() async create(@Body() dto: DealDto, @Req() req: SignedRequest) {
    await this.checkLinks(dto, req);
    return this.db.deal.create({ data: { title: dto.title, amountMinor: dto.amountMinor ?? 0, currency: dto.currency ?? "PKR", stage: dto.stage ?? "OPEN", leadId: dto.leadId, customerId: dto.customerId, expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined, ...scoped(req) } });
  }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateDealDto, @Req() req: SignedRequest) {
    const row = await this.db.deal.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Deal not found."); await this.checkLinks(dto, req);
    return this.db.deal.update({ where: { id }, data: { ...dto, expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined } });
  }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { const row = await this.db.deal.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Deal not found."); await this.db.deal.delete({ where: { id } }); return { ok: true }; }
  private async checkLinks(dto: Partial<DealDto>, req: SignedRequest) {
    if (dto.leadId && !await this.db.lead.findFirst({ where: { id: dto.leadId, ...scoped(req) } })) throw new NotFoundException("Lead not found in this workspace.");
    if (dto.customerId && !await this.db.customer.findFirst({ where: { id: dto.customerId, ...scoped(req) } })) throw new NotFoundException("Customer not found in this workspace.");
  }
}
