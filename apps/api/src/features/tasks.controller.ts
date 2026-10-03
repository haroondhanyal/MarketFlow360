import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { PrismaService } from "../prisma.service";
import { scoped } from "../crm-common";
import { TaskDto, UpdateTaskDto, TaskCommentDto } from "../crm-dto";

@Controller("tasks") @UseGuards(AuthGuard, WorkspaceGuard)
export class TasksController {
  constructor(private db: PrismaService) {}
  @Get() list(@Req() req: SignedRequest) { return this.db.task.findMany({ where: scoped(req), include: { lead: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } }, reminder: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 300 }); }
  @Post() async create(@Body() dto: TaskDto, @Req() req: SignedRequest) { await this.checkLinks(dto, req); await this.checkAssignee(dto.assignedToId, req); const task = await this.db.task.create({ data: { ...dto, ...scoped(req), assignedToId: dto.assignedToId ?? req.authUser!.id, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } }); await this.syncReminder(task); return task; }
  @Get(":id/comments") async comments(@Param("id") id: string, @Req() req: SignedRequest) {
    const task = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!task) throw new NotFoundException("Task not found.");
    return this.db.taskComment.findMany({ where: { taskId: id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
  }
  @Post(":id/comments") async comment(@Param("id") id: string, @Body() dto: TaskCommentDto, @Req() req: SignedRequest) {
    const task = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!task) throw new NotFoundException("Task not found.");
    return this.db.taskComment.create({ data: { taskId: id, userId: req.authUser!.id, body: dto.body.trim() }, include: { user: { select: { id: true, name: true, email: true } } } });
  }
  @Patch(":id") async update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @Req() req: SignedRequest) {
    const row = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Task not found."); await this.checkLinks(dto, req); await this.checkAssignee(dto.assignedToId, req);
    const task = await this.db.task.update({ where: { id }, data: { ...dto, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } }); await this.syncReminder(task); return task;
  }
  @Delete(":id") async remove(@Param("id") id: string, @Req() req: SignedRequest) { const row = await this.db.task.findFirst({ where: { id, ...scoped(req) } }); if (!row) throw new NotFoundException("Task not found."); await this.db.$transaction([this.db.attachment.deleteMany({ where: { ...scoped(req), recordType: "TASK", recordId: id } }), this.db.task.delete({ where: { id } })]); return { ok: true }; }
  private async checkAssignee(userId: string | undefined, req: SignedRequest) { if (userId && !await this.db.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: req.workspaceId! } } })) throw new NotFoundException("Task assignee must be a member of this workspace."); }
  private async syncReminder(task: { id: string; workspaceId: string; dueAt: Date | null; status: string }) {
    if (!task.dueAt || task.status === "DONE") return this.db.taskReminder.deleteMany({ where: { taskId: task.id } });
    const remindAt = new Date(task.dueAt.getTime() - 30 * 60_000);
    return this.db.taskReminder.upsert({ where: { taskId: task.id }, update: { workspaceId: task.workspaceId, remindAt, sentAt: null, claimedAt: null, lastError: null }, create: { workspaceId: task.workspaceId, taskId: task.id, remindAt } });
  }
  private async checkLinks(dto: Partial<TaskDto>, req: SignedRequest) {
    if (dto.leadId && !await this.db.lead.findFirst({ where: { id: dto.leadId, ...scoped(req) } })) throw new NotFoundException("Lead not found in this workspace.");
    if (dto.customerId && !await this.db.customer.findFirst({ where: { id: dto.customerId, ...scoped(req) } })) throw new NotFoundException("Customer not found in this workspace.");
  }
}
