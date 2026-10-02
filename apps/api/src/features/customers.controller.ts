import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { CustomerDto, UpdateCustomerDto } from "../crm-dto";

@Controller("customers") @UseGuards(AuthGuard, WorkspaceGuard)
export class CustomersController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.customer.findMany({ where: scoped(req), orderBy: { updatedAt: "desc" }, take: 200 }); }
  @Get(":id") async detail(@Param("id") id: string, @Req() req: SignedRequest) {
    const row = await this.db.customer.findFirst({ where: { id, ...scoped(req) }, include: { deals: true, tasks: { include: { lead: { select: { id: true, name: true } } } } } });
    if (!row) throw new NotFoundException("Customer not found.");
    return row;
  }
  @Post() create(@Body() dto: CustomerDto, @Req() req: SignedRequest) { return this.db.customer.create({ data: { ...dto, ...scoped(req), email: dto.email?.toLowerCase() } }); }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateCustomerDto, @Req() req: SignedRequest) { await this.find(id, req); return this.db.customer.update({ where: { id }, data: dto }); }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { await this.find(id, req); await this.db.customer.delete({ where: { id } }); return { ok: true }; }
  private async find(id: string, req: SignedRequest) { const row = await this.db.customer.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Customer not found."); return row; }
}
