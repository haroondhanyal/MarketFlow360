import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { TaskDto, UpdateTaskDto, TaskCommentDto } from "../crm-dto";

@Controller("tasks") @UseGuards(AuthGuard, WorkspaceGuard)
export class TasksController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.task.findMany({ where: scoped(req), include: { lead: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 300 }); }
  @Post() async create(@Body() dto: TaskDto, @Req() req: SignedRequest) { await this.checkLinks(dto, req); return this.db.task.create({ data: { ...dto, ...scoped(req), dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } }); }
  @Get(":id/comments") async comments(@Param("id") id: string, @Req() req: SignedRequest) {
    const task = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!task) throw new NotFoundException("Task not found.");
    return this.db.taskComment.findMany({ where: { taskId: id }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } });
  }
  @Post(":id/comments") async comment(@Param("id") id: string, @Body() dto: TaskCommentDto, @Req() req: SignedRequest) {
    const task = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!task) throw new NotFoundException("Task not found.");
    return this.db.taskComment.create({ data: { taskId: id, userId: req.authUser!.id, body: dto.body.trim() }, include: { user: { select: { id: true, name: true } } } });
  }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @Req() req: SignedRequest) {
    const row = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Task not found."); await this.checkLinks(dto, req);
    return this.db.task.update({ where: { id }, data: { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } });
  }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { const row = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Task not found."); await this.db.task.delete({ where: { id } }); return { ok: true }; }
  private async checkLinks(dto: Partial<TaskDto>, req: SignedRequest) {
    if (dto.leadId && !await this.db.lead.findFirst({ where: { id: dto.leadId, ...scoped(req) } })) throw new NotFoundException("Lead not found in this workspace.");
    if (dto.customerId && !await this.db.customer.findFirst({ where: { id: dto.customerId, ...scoped(req) } })) throw new NotFoundException("Customer not found in this workspace.");
  }
}
