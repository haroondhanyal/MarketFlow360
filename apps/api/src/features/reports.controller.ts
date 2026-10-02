import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { scoped } from "../crm-common";
import { PrismaService } from "../prisma.service";

@Controller("reports") @UseGuards(AuthGuard, WorkspaceGuard)
export class ReportsController {
  constructor(private db: PrismaService) {}
  @Get("summary") async summary(@Req() req: SignedRequest) {
    const [leadStages, leadSources, deals, tasks, campaigns, content] = await Promise.all([
      this.db.lead.groupBy({ by: ["status"], where: { ...scoped(req), archivedAt: null }, _count: { _all: true } }),
      this.db.lead.groupBy({ by: ["source"], where: { ...scoped(req), archivedAt: null }, _count: { _all: true } }),
      this.db.deal.groupBy({ by: ["stage", "currency"], where: scoped(req), _count: { _all: true }, _sum: { amountMinor: true } }),
      this.db.task.groupBy({ by: ["status"], where: scoped(req), _count: { _all: true } }),
      this.db.campaign.groupBy({ by: ["status"], where: scoped(req), _count: { _all: true }, _sum: { budgetMinor: true } }),
      this.db.contentItem.groupBy({ by: ["status"], where: scoped(req), _count: { _all: true } }),
    ]);
    return { leadStages: leadStages.map(x => ({ name: x.status, count: x._count._all })), leadSources: leadSources.map(x => ({ name: x.source, count: x._count._all })), deals: deals.map(x => ({ stage: x.stage, currency: x.currency, count: x._count._all, amountMinor: x._sum.amountMinor ?? 0 })), tasks: tasks.map(x => ({ name: x.status, count: x._count._all })), campaigns: campaigns.map(x => ({ name: x.status, count: x._count._all, plannedBudgetMinor: x._sum.budgetMinor ?? 0 })), content: content.map(x => ({ name: x.status, count: x._count._all })) };
  }
  @Get("export") async export(@Req() req: SignedRequest, @Res() res: Response) {
    const report = await this.summary(req);
    const rows: (string | number)[][] = [["Report", "Category", "Count", "Amount", "Currency"], ...report.leadStages.map(x => ["Leads", x.name, x.count, "", ""]), ...report.leadSources.map(x => ["Lead source", x.name, x.count, "", ""]), ...report.deals.map(x => ["Deals", x.stage, x.count, (x.amountMinor / 100).toFixed(2), x.currency]), ...report.tasks.map(x => ["Tasks", x.name, x.count, "", ""]), ...report.campaigns.map(x => ["Campaigns", x.name, x.count, (x.plannedBudgetMinor / 100).toFixed(2), "PKR"]), ...report.content.map(x => ["Content", x.name, x.count, "", ""])];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/[\r\n]+/g, " ").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=marketflow-workspace-report.csv"); res.send(csv);
  }
}
