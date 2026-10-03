import { Lead } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { applyAutomationAction, conditionMatches } from "./automation-runner";

export async function runNewLeadAutomations(db: PrismaService, workspaceId: string, lead: Pick<Lead, "id" | "assignedToId" | "source" | "status" | "workspaceId">, defaultOwnerId?: string) {
  const workflows = await db.automation.findMany({ where: { workspaceId, trigger: "NEW_LEAD", isActive: true } });
  for (const workflow of workflows) {
    const context = { id: lead.id, workspaceId, source: lead.source, status: lead.status, assignedToId: lead.assignedToId };
    if (!conditionMatches(workflow, context)) {
      await db.automationRun.create({ data: { automationId: workflow.id, recordId: lead.id, result: "Skipped: lead did not match this automation condition.", status: "DONE" } });
      continue;
    }
    if (workflow.delayMinutes > 0) {
      const scheduledAt = new Date(Date.now() + workflow.delayMinutes * 60_000);
      await db.automationRun.create({ data: { automationId: workflow.id, recordId: lead.id, result: "Waiting for scheduled execution.", status: "PENDING", scheduledAt } });
      continue;
    }
    const result = await applyAutomationAction(db, workflow, context, defaultOwnerId);
    await db.automationRun.create({ data: { automationId: workflow.id, recordId: lead.id, result, status: "DONE" } });
  }
}
