import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "./auth";
import { PrismaService } from "./prisma.service";

@Controller("dashboard")
@UseGuards(AuthGuard, WorkspaceGuard)
export class DashboardController {
  constructor(private db: PrismaService) {}
  @Get("overview") async overview(@Req() req: SignedRequest) {
    const workspaceId = req.workspaceId!;
    const [totalLeads, wonDeals, openTasks, stages, sources, recentLeads, upcomingTasks] = await Promise.all([
      this.db.lead.count({ where: { workspaceId, archivedAt: null } }),
      this.db.deal.count({ where: { workspaceId, stage: "WON" } }),
      this.db.task.count({ where: { workspaceId, status: { not: "DONE" } } }),
      this.db.lead.groupBy({ by: ["status"], where: { workspaceId, archivedAt: null }, _count: { _all: true } }),
      this.db.lead.groupBy({ by: ["source"], where: { workspaceId, archivedAt: null }, _count: { _all: true } }),
      this.db.lead.findMany({ where: { workspaceId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, interest: true, status: true, createdAt: true } }),
      this.db.task.findMany({ where: { workspaceId, status: { not: "DONE" } }, orderBy: { dueAt: "asc" }, take: 5, select: { id: true, title: true, dueAt: true, lead: { select: { name: true } }, customer: { select: { name: true } } } }),
    ]);
    return { metrics: { totalLeads, wonDeals, openTasks }, stages: stages.map(x => ({ status: x.status, count: x._count._all })), sources: sources.map(x => ({ source: x.source, count: x._count._all })), recentLeads, upcomingTasks };
  }
}
