import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { sendTransactionalEmail } from "./mail";

@Injectable()
export class TaskReminderWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private db: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => void this.processDue(), 30_000); this.timer.unref(); void this.processDue(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async processDue() {
    if (this.running || !process.env.RESEND_API_KEY) return;
    this.running = true;
    try {
      const now = new Date();
      const rows = await this.db.taskReminder.findMany({
        where: { sentAt: null, remindAt: { lte: now }, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] },
        include: {
          task: {
            include: {
              assignedTo: { select: { email: true, name: true } },
              workspace: { select: { name: true, memberships: { where: { role: "OWNER" }, take: 1, include: { user: { select: { email: true, name: true } } } } } },
            },
          },
        },
        take: 25,
      });
      for (const reminder of rows) {
        const claim = await this.db.taskReminder.updateMany({ where: { id: reminder.id, sentAt: null, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(Date.now() - 5 * 60_000) } }] }, data: { claimedAt: new Date() } });
        if (!claim.count) continue;
        const recipient = reminder.task.assignedTo ?? reminder.task.workspace.memberships[0]?.user;
        if (!recipient) { await this.db.taskReminder.update({ where: { id: reminder.id }, data: { claimedAt: null, lastError: "No task assignee or workspace owner can receive this reminder.", remindAt: new Date(Date.now() + 60 * 60_000) } }); continue; }
        try {
          await sendTransactionalEmail(recipient.email, `Task reminder: ${reminder.task.title}`, `<p>Hello ${escapeHtml(recipient.name)},</p><p><strong>${escapeHtml(reminder.task.title)}</strong> is due ${reminder.task.dueAt?.toLocaleString() ?? "soon"} in ${escapeHtml(reminder.task.workspace.name)}.</p><p>Sign in to MarketFlow360 to view the task.</p>`);
          await this.db.taskReminder.update({ where: { id: reminder.id }, data: { sentAt: new Date(), claimedAt: null, lastError: null } });
        } catch (error) {
          await this.db.taskReminder.update({ where: { id: reminder.id }, data: { claimedAt: null, lastError: error instanceof Error ? error.message.slice(0, 300) : "Email delivery failed", remindAt: new Date(Date.now() + 5 * 60_000) } });
        }
      }
    } catch (error) { console.error("Task reminder worker failed:", error); }
    finally { this.running = false; }
  }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!); }
