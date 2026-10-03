import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { applyAutomationAction } from "./features/automation-runner";

@Injectable()
export class AutomationWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private db: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => void this.processDue(), 15_000); this.timer.unref(); void this.processDue(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const runs = await this.db.automationRun.findMany({ where: { OR: [{ status: "PENDING", scheduledAt: { lte: now } }, { status: "RUNNING", claimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] }, include: { automation: true }, orderBy: { scheduledAt: "asc" }, take: 20 });
      for (const run of runs) {
        const claim = await this.db.automationRun.updateMany({ where: { id: run.id, OR: [{ status: "PENDING", scheduledAt: { lte: new Date() } }, { status: "RUNNING", claimedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] }, data: { status: "RUNNING", claimedAt: new Date(), attempts: { increment: 1 } } });
        if (!claim.count) continue;
        const attempts = run.attempts + 1;
        try {
          const lead = run.recordId ? await this.db.lead.findFirst({ where: { id: run.recordId, workspaceId: run.automation.workspaceId } }) : null;
          const result = lead ? await applyAutomationAction(this.db, run.automation, lead) : "Skipped: lead no longer exists.";
          await this.db.automationRun.update({ where: { id: run.id }, data: { status: "DONE", result, claimedAt: null, lastError: null } });
        } catch (error) {
          const failed = attempts >= 3;
          await this.db.automationRun.update({ where: { id: run.id }, data: { status: failed ? "FAILED" : "PENDING", scheduledAt: failed ? null : new Date(Date.now() + 60_000), claimedAt: null, lastError: error instanceof Error ? error.message.slice(0, 300) : "Automation action failed", result: failed ? "Failed after three attempts." : "Retry scheduled." } });
        }
      }
    } catch (error) { console.error("Automation worker failed:", error); }
    finally { this.running = false; }
  }
}
