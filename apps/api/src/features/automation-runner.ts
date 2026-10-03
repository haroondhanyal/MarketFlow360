import { LeadSource, LeadStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type LeadContext = { id: string; workspaceId: string; source: string; status: string; assignedToId: string | null };
type Rule = { action: string; actionValue: string | null; conditionField: string | null; conditionValue: string | null };

export function conditionMatches(rule: Rule, lead: LeadContext) {
  if (!rule.conditionField) return true;
  if (rule.conditionField === "SOURCE") return lead.source === rule.conditionValue;
  if (rule.conditionField === "STATUS") return lead.status === rule.conditionValue;
  return false;
}

export async function applyAutomationAction(db: PrismaService, rule: Rule, lead: LeadContext, ownerId?: string) {
  if (!conditionMatches(rule, lead)) return "Skipped: lead did not match this automation condition.";
  if (rule.action === "CREATE_TASK") {
    await db.task.create({ data: { workspaceId: lead.workspaceId, leadId: lead.id, assignedToId: lead.assignedToId ?? ownerId, title: rule.actionValue || "Follow up with new lead", description: "Created by automation", dueAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    return "Follow-up task created.";
  }
  if (rule.action === "UPDATE_LEAD_STATUS" && rule.actionValue) {
    const configured = await db.pipelineStage.findMany({ where: { workspaceId: lead.workspaceId }, select: { key: true } });
    const stages = new Set(configured.length ? configured.map(stage => stage.key) : Object.values(LeadStatus));
    if (stages.has(rule.actionValue)) {
      await db.lead.updateMany({ where: { id: lead.id, workspaceId: lead.workspaceId }, data: { status: rule.actionValue } });
      return `Lead moved to ${rule.actionValue}.`;
    }
  }
  return "Skipped: action is not valid for this workspace.";
}

export function validSource(value: string) { return Object.values(LeadSource).includes(value as LeadSource); }
