import { BadRequestException, Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, SignedRequest, WorkspaceGuard } from "../auth";
import { scoped } from "../crm-common";
import { PrismaService } from "../prisma.service";

@Controller("reports") @UseGuards(AuthGuard, WorkspaceGuard)
export class ReportsController {
  constructor(private db: PrismaService) {}
  @Get("summary") async summary(@Req() req: SignedRequest, @Query("from") from?: string, @Query("to") to?: string) {
    const date: { gte?: Date; lte?: Date } = {};
    if (from) { const d = new Date(from); if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid from date."); date.gte = d; }
    if (to) { const d = new Date(to); if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid to date."); d.setUTCHours(23,59,59,999); date.lte = d; }
    if (date.gte && date.lte && date.gte > date.lte) throw new BadRequestException("The from date must be before the to date.");
    const createdAt = Object.keys(date).length ? date : undefined;
    const trendFrom = date.gte ?? new Date(Date.now() - 29 * 86400_000);
    const trendTo = date.lte ?? new Date();
    const bucket = trendTo.getTime() - trendFrom.getTime() <= 90 * 86400_000 ? "day" : "week";
    const [leadStages, leadSources, deals, tasks, campaigns, content, leadTrend] = await Promise.all([
      this.db.lead.groupBy({ by: ["status"], where: { ...scoped(req), archivedAt: null, createdAt }, _count: { _all: true } }),
      this.db.lead.groupBy({ by: ["source"], where: { ...scoped(req), archivedAt: null, createdAt }, _count: { _all: true } }),
      this.db.deal.groupBy({ by: ["stage", "currency"], where: { ...scoped(req), createdAt }, _count: { _all: true }, _sum: { amountMinor: true } }),
      this.db.task.groupBy({ by: ["status"], where: { ...scoped(req), createdAt }, _count: { _all: true } }),
      this.db.campaign.groupBy({ by: ["status"], where: { ...scoped(req), createdAt }, _count: { _all: true }, _sum: { budgetMinor: true } }),
      this.db.contentItem.groupBy({ by: ["status"], where: { ...scoped(req), createdAt }, _count: { _all: true } }),
      this.db.$queryRaw<{ period: Date; count: number }[]>`
        SELECT date_trunc(${bucket}, "createdAt") AS period, COUNT(*)::int AS count
        FROM "Lead"
        WHERE "workspaceId" = ${req.workspaceId!} AND "archivedAt" IS NULL
          AND "createdAt" >= ${trendFrom} AND "createdAt" <= ${trendTo}
        GROUP BY period ORDER BY period
      `,
    ]);
    return { leadStages: leadStages.map(x => ({ name: x.status, count: x._count._all })), leadSources: leadSources.map(x => ({ name: x.source, count: x._count._all })), deals: deals.map(x => ({ stage: x.stage, currency: x.currency, count: x._count._all, amountMinor: x._sum.amountMinor ?? 0 })), tasks: tasks.map(x => ({ name: x.status, count: x._count._all })), campaigns: campaigns.map(x => ({ name: x.status, count: x._count._all, plannedBudgetMinor: x._sum.budgetMinor ?? 0 })), content: content.map(x => ({ name: x.status, count: x._count._all })), leadTrend: leadTrend.map(x => ({ period: x.period.toISOString(), count: x.count, bucket })) };
  }
  @Get("export") async export(@Req() req: SignedRequest, @Res() res: Response, @Query("from") from?: string, @Query("to") to?: string) {
    const report = await this.summary(req, from, to);
    const rows: (string | number)[][] = [["Report", "Category", "Count", "Amount", "Currency"], ...report.leadStages.map(x => ["Leads", x.name, x.count, "", ""]), ...report.leadSources.map(x => ["Lead source", x.name, x.count, "", ""]), ...report.deals.map(x => ["Deals", x.stage, x.count, (x.amountMinor / 100).toFixed(2), x.currency]), ...report.tasks.map(x => ["Tasks", x.name, x.count, "", ""]), ...report.campaigns.map(x => ["Campaigns", x.name, x.count, (x.plannedBudgetMinor / 100).toFixed(2), "PKR"]), ...report.content.map(x => ["Content", x.name, x.count, "", ""])];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/[\r\n]+/g, " ").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=marketflow-workspace-report.csv"); res.send(csv);
  }
}
