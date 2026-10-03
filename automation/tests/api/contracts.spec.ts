import { test, expect } from "../../support/test";
import { request, type APIRequestContext } from "@playwright/test";
import { resolve } from "node:path";
import { config } from "../../config/env";
import { getTestWorkspace, getTestWorkspaces } from "../../support/workspaces";
import { fakeLead, uniqueMarker } from "../../utils/faker-data";

type ApiClient = Pick<APIRequestContext, "get" | "post" | "put" | "patch">;
type ApiCase = { title: string; run: (api: ApiClient, workspaceId: string) => Promise<void> };
const cases: ApiCase[] = [
  ...["leads", "customers", "deals", "tasks", "campaigns", "content", "landing-pages", "automations", "integrations", "audit", "pipeline/stages", "reports/summary", "dashboard/overview", "plans"].map(path => ({
    title: `authenticated GET /${path} returns a valid response`,
    run: async (api: ApiClient, workspaceId: string) => {
      const response = await api.get(`/${path}`, { headers: { "x-workspace-id": workspaceId } });
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.json();
      expect(body).toBeTruthy();
      if (!["reports/summary", "dashboard/overview", "plans"].includes(path)) expect(Array.isArray(body)).toBe(true);
    },
  })),
  { title: "assistant answers workspace-scoped suggested question", run: async (api,id) => { const r=await api.post("/assistant/ask",{headers:{"x-workspace-id":id},data:{question:"Which leads should I follow up with today?"}}); expect(r.status(),await r.text()).toBe(201); expect((await r.json()).answer).toBeTruthy(); } },
  { title: "workspace guard rejects missing workspace selection", run: async (api) => { const r=await api.get("/leads"); expect(r.status()).toBe(401); } },
  { title: "auth guard rejects an unauthenticated request", run: async () => { const anonymous=await request.newContext({baseURL:new URL(config.apiBaseUrl).origin,storageState:{cookies:[],origins:[]}}); const r=await anonymous.get(`${new URL(config.apiBaseUrl).pathname}/leads`,{headers:{"x-workspace-id":getTestWorkspace(1).id}}); const body=await r.text(); expect(r.status(), body).toBe(401); await anonymous.dispose(); } },
  { title: "lead validation rejects a missing name", run: async (api,id) => { const r=await api.post("/leads",{headers:{"x-workspace-id":id},data:{email:`${uniqueMarker()}@example.test`}}); expect(r.status()).toBe(400); } },
  { title: "lead validation rejects a malformed email", run: async (api,id) => { const r=await api.post("/leads",{headers:{"x-workspace-id":id},data:{name:"Invalid Email",email:"bad-address"}}); expect(r.status()).toBe(400); } },
  { title: "customer validation rejects a one-character name", run: async (api,id) => { const r=await api.post("/customers",{headers:{"x-workspace-id":id},data:{name:"X"}}); expect(r.status()).toBe(400); } },
  { title: "deal validation rejects a negative amount", run: async (api,id) => { const r=await api.post("/deals",{headers:{"x-workspace-id":id},data:{title:"Invalid deal",amountMinor:-1}}); expect(r.status()).toBe(400); } },
  { title: "task validation rejects unsupported status", run: async (api,id) => { const r=await api.post("/tasks",{headers:{"x-workspace-id":id},data:{title:"Bad status",status:"WAITING"}}); expect(r.status()).toBe(400); } },
  { title: "lead export responds as CSV", run: async (api,id) => { const r=await api.get("/leads/export",{headers:{"x-workspace-id":id}}); expect(r.status()).toBe(200); expect(r.headers()["content-type"]).toContain("text/csv"); } },
  { title: "reports reject malformed date filters", run: async (api,id) => { const r=await api.get("/reports/summary?from=not-a-date",{headers:{"x-workspace-id":id}}); expect(r.status()).toBe(400); } },
  { title: "pipeline update rejects a missing NEW stage", run: async (api,id) => { const r=await api.put("/pipeline/stages",{headers:{"x-workspace-id":id},data:{stages:[{key:"CONTACTED",label:"Contacted",position:0}]}}); expect(r.status()).toBe(400); } },
  { title: "pipeline update rejects duplicate stage keys", run: async (api,id) => { const r=await api.put("/pipeline/stages",{headers:{"x-workspace-id":id},data:{stages:[{key:"NEW",label:"New",position:0},{key:"NEW",label:"Another",position:1}]}}); expect(r.status()).toBe(400); } },
  { title: "bulk lead update rejects unknown status", run: async (api,id) => { const r=await api.patch("/leads/bulk/status",{headers:{"x-workspace-id":id},data:{ids:[],status:"INVALID"}}); expect(r.status()).toBe(400); } },
  { title: "lead detail hides IDs from another workspace", run: async (api,id) => { const lead=fakeLead(); const other=getTestWorkspaces().find(x=>x.id!==id)!; const created=await api.post("/leads",{headers:{"x-workspace-id":other.id},data:lead}); expect(created.status()).toBe(201); const row=await created.json(); const detail=await api.get(`/leads/${row.id}`,{headers:{"x-workspace-id":id}}); expect([403,404]).toContain(detail.status()); } },
];
if (cases.length !== 28) throw new Error(`API suite needs 28 templates; found ${cases.length}.`);

for (const [caseIndex, scenario] of cases.entries()) {
  for (const workspaceIndex of [0,1,2,3,4]) {
    test(`API contract ${String(caseIndex+1).padStart(2,"0")} ${scenario.title} · W${workspaceIndex+1}`, async () => {
      const workspace = getTestWorkspace(workspaceIndex + 1);
      const rawApi = await request.newContext({ baseURL: new URL(config.apiBaseUrl).origin, storageState: resolve(import.meta.dirname, "../../.state/owner.json") });
      const prefix = new URL(config.apiBaseUrl).pathname.replace(/\/$/, "");
      const api: ApiClient = {
        get: (path, options) => rawApi.get(`${prefix}${path}`, options),
        post: (path, options) => rawApi.post(`${prefix}${path}`, options),
        put: (path, options) => rawApi.put(`${prefix}${path}`, options),
        patch: (path, options) => rawApi.patch(`${prefix}${path}`, options),
      };
      await test.step(`Given authenticated API access to ${workspace.name}`, async () => { expect(workspace.id).toBeTruthy(); });
      await test.step(`When API scenario ${caseIndex+1} is executed with workspace isolation`, async () => { await scenario.run(api, workspace.id); });
      await rawApi.dispose();
    });
  }
}
