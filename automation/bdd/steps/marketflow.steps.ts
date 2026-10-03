import { createBdd } from "playwright-bdd";
import { test, expect } from "../../support/test";
import { getTestWorkspace } from "../../support/workspaces";

const { Given, When, Then } = createBdd(test);
const routes: Record<string, string> = {
  Overview: "/", Leads: "/leads", Customers: "/customers", Deals: "/deals", Tasks: "/tasks",
  Campaigns: "/campaigns", Content: "/content", "Landing pages": "/landing-pages", Automations: "/automations",
  Integrations: "/integrations", Assistant: "/assistant", Reports: "/reports", Audit: "/audit", Plans: "/plans",
  Profile: "/profile", Team: "/team", "Public form": "/p/fall-admissions",
};

Given("I selected test workspace {string}", async ({ page }, alias: string) => {
  const index = Number(alias.replace("W", ""));
  const workspace = getTestWorkspace(index);
  await test.step(`Select workspace ${workspace.name}`, async () => {
    await page.addInitScript(id => localStorage.setItem("mf_workspace", id), workspace.id);
  });
});

When("I open the {string} screen", async ({ page }, label: string) => {
  const route = routes[label];
  if (!route) throw new Error(`No screen route configured for '${label}'.`);
  await test.step(`Navigate to ${route}`, async () => { await page.goto(route); });
});

Then("a primary heading is displayed", async ({ page }) => {
  await test.step("Verify the page rendered its primary heading", async () => {
    await expect(page.locator("main h1").first()).toBeVisible();
  });
});
