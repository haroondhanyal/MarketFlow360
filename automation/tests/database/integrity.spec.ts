import { test, expect } from "../../support/test";
import { Pool } from "pg";
import { config } from "../../config/env";
import { getTestWorkspace, getTestWorkspaces } from "../../support/workspaces";

if (!config.databaseUrl) throw new Error("DATABASE_URL is required for database automation tests.");
const pool = new Pool({ connectionString: config.databaseUrl, max: 5, application_name: "marketflow360-playwright" });
type DbCase = { title: string; sql: string; params?: (workspace: { id: string; name: string }) => unknown[]; validate: (rows: Record<string, unknown>[]) => void };
const zero = (rows: Record<string, unknown>[]) => expect(Number(rows[0]?.count ?? 0)).toBe(0);
const atLeastOne = (rows: Record<string, unknown>[]) => expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
const cases: DbCase[] = [
  { title: "workspace row is persisted", sql: 'SELECT COUNT(*)::int AS count FROM "Workspace" WHERE id=$1', params:w=>[w.id], validate:atLeastOne },
  { title: "workspace name is preserved without tenant collision", sql: 'SELECT COUNT(*)::int AS count FROM "Workspace" WHERE id=$1 AND name=$2', params:w=>[w.id,w.name], validate:atLeastOne },
  { title: "owner membership exists for the workspace", sql: 'SELECT COUNT(*)::int AS count FROM "Membership" WHERE "workspaceId"=$1 AND role=\'OWNER\'', params:w=>[w.id], validate:atLeastOne },
  { title: "workspace has exactly one owner membership", sql: 'SELECT COUNT(*)::int AS count FROM "Membership" WHERE "workspaceId"=$1 AND role=\'OWNER\'', params:w=>[w.id], validate:r=>expect(Number(r[0].count)).toBe(1) },
  { title: "test workspaces are limited to five named fixtures", sql: 'SELECT COUNT(*)::int AS count FROM "Workspace" WHERE name LIKE \'MarketFlow360 Automation %\'', params:()=>[], validate:r=>expect(Number(r[0].count)).toBe(5) },
  { title: "workspace uses default PKR currency", sql: 'SELECT COUNT(*)::int AS count FROM "Workspace" WHERE id=$1 AND currency=\'PKR\'', params:w=>[w.id], validate:atLeastOne },
  { title: "workspace timezone is populated", sql: 'SELECT COUNT(*)::int AS count FROM "Workspace" WHERE id=$1 AND timezone IS NOT NULL AND length(timezone)>0', params:w=>[w.id], validate:atLeastOne },
  { title: "all five workspaces have unique identifiers", sql: 'SELECT COUNT(DISTINCT id)::int AS count FROM "Workspace" WHERE id = ANY($1::text[])', params:()=>[`{${getTestWorkspaces().map(w=>w.id).join(",")}}`], validate:r=>expect(Number(r[0].count)).toBe(5) },
  { title: "test fixture membership maps to the seeded owner", sql: 'SELECT COUNT(*)::int AS count FROM "Membership" m JOIN "User" u ON u.id=m."userId" WHERE m."workspaceId"=$1 AND u.email=$2', params:w=>[w.id,process.env.AUTOMATION_EMAIL ?? "owner@nexora.example"], validate:atLeastOne },
  { title: "no orphan lead rows exist for this tenant", sql: 'SELECT COUNT(*)::int AS count FROM "Lead" l LEFT JOIN "Workspace" w ON w.id=l."workspaceId" WHERE l."workspaceId"=$1 AND w.id IS NULL', params:w=>[w.id], validate:zero },
  { title: "no lead assignee points outside workspace membership", sql: 'SELECT COUNT(*)::int AS count FROM "Lead" l LEFT JOIN "Membership" m ON m."userId"=l."assignedToId" AND m."workspaceId"=l."workspaceId" WHERE l."workspaceId"=$1 AND l."assignedToId" IS NOT NULL AND m.id IS NULL', params:w=>[w.id], validate:zero },
  { title: "customer rows have valid workspace foreign keys", sql: 'SELECT COUNT(*)::int AS count FROM "Customer" c LEFT JOIN "Workspace" w ON w.id=c."workspaceId" WHERE c."workspaceId"=$1 AND w.id IS NULL', params:w=>[w.id], validate:zero },
  { title: "deal customer references stay within tenant", sql: 'SELECT COUNT(*)::int AS count FROM "Deal" d JOIN "Customer" c ON c.id=d."customerId" WHERE d."workspaceId"=$1 AND c."workspaceId"<>d."workspaceId"', params:w=>[w.id], validate:zero },
  { title: "deal lead references stay within tenant", sql: 'SELECT COUNT(*)::int AS count FROM "Deal" d JOIN "Lead" l ON l.id=d."leadId" WHERE d."workspaceId"=$1 AND l."workspaceId"<>d."workspaceId"', params:w=>[w.id], validate:zero },
  { title: "task lead references stay within tenant", sql: 'SELECT COUNT(*)::int AS count FROM "Task" t JOIN "Lead" l ON l.id=t."leadId" WHERE t."workspaceId"=$1 AND l."workspaceId"<>t."workspaceId"', params:w=>[w.id], validate:zero },
  { title: "task customer references stay within tenant", sql: 'SELECT COUNT(*)::int AS count FROM "Task" t JOIN "Customer" c ON c.id=t."customerId" WHERE t."workspaceId"=$1 AND c."workspaceId"<>t."workspaceId"', params:w=>[w.id], validate:zero },
  { title: "campaign content references stay within tenant", sql: 'SELECT COUNT(*)::int AS count FROM "ContentItem" c JOIN "Campaign" m ON m.id=c."campaignId" WHERE c."workspaceId"=$1 AND c."workspaceId"<>m."workspaceId"', params:w=>[w.id], validate:zero },
  { title: "automation run attempts are nonnegative", sql: 'SELECT COUNT(*)::int AS count FROM "AutomationRun" r JOIN "Automation" a ON a.id=r."automationId" WHERE a."workspaceId"=$1 AND r.attempts<0', params:w=>[w.id], validate:zero },
  { title: "pipeline stage positions are unique per tenant", sql: 'SELECT COUNT(*)::int AS count FROM (SELECT position FROM "PipelineStage" WHERE "workspaceId"=$1 GROUP BY position HAVING COUNT(*)>1) d', params:w=>[w.id], validate:zero },
  { title: "lead activity workspace matches linked lead workspace", sql: 'SELECT COUNT(*)::int AS count FROM "LeadActivity" a JOIN "Lead" l ON l.id=a."leadId" WHERE a."workspaceId"=$1 AND a."workspaceId"<>l."workspaceId"', params:w=>[w.id], validate:zero },
];
if (cases.length !== 20) throw new Error(`Database suite needs 20 templates; found ${cases.length}.`);

for (const [caseIndex, scenario] of cases.entries()) {
  for (const workspaceIndex of [0,1,2,3,4]) {
    test(`DB integrity ${String(caseIndex+1).padStart(2,"0")} ${scenario.title} · W${workspaceIndex+1}`, async () => {
      const workspace = getTestWorkspace(workspaceIndex + 1);
      await test.step(`Given a direct SQL connection to ${workspace.name}`, async () => { expect(config.databaseUrl).toContain("marketflow"); });
      await test.step(`When parameterized integrity query ${caseIndex+1} runs`, async () => {
        const result = await pool.query(scenario.sql, scenario.params?.(workspace) ?? []);
        scenario.validate(result.rows);
      });
    });
  }
}

// Playwright may reuse a worker for multiple file lifecycles. Closing this
// module-scoped pool in afterAll can race tests still assigned to that worker;
// process shutdown releases the pool's sockets after the suite completes.
