import { Lead, LeadStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export async function runNewLeadAutomations(db: PrismaService, workspaceId: string, lead: Pick<Lead, "id" | "assignedToId">, defaultOwnerId?: string) {
  const workflows = await db.automation.findMany({ where: { workspaceId, trigger: "NEW_LEAD", isActive: true } });
  for (const workflow of workflows) {
    let result = "No action applied.";
    if (workflow.action === "CREATE_TASK") {
      await db.task.create({ data: { workspaceId, leadId: lead.id, assignedToId: lead.assignedToId ?? defaultOwnerId, title: workflow.actionValue || "Follow up with new lead", description: "Created by automation", dueAt: new Date(Date.now() + 24 * 60 * 60_000) } });
      result = "Follow-up task created.";
    } else if (workflow.action === "UPDATE_LEAD_STATUS" && workflow.actionValue && Object.values(LeadStatus).includes(workflow.actionValue as LeadStatus)) {
      await db.lead.updateMany({ where: { id: lead.id, workspaceId }, data: { status: workflow.actionValue as LeadStatus } });
      result = `Lead moved to ${workflow.actionValue}.`;
    }
    await db.automationRun.create({ data: { automationId: workflow.id, recordId: lead.id, result } });
  }
}
