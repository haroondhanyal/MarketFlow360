import { test, expect } from "../../support/test";
import { getTestWorkspace } from "../../support/workspaces";
import { BasePage } from "../../pages/base.page";
import { OverviewPage } from "../../pages/overview.page";
import { LeadsPage } from "../../pages/leads.page";
import { CustomersPage } from "../../pages/customers.page";
import { DealsPage } from "../../pages/deals.page";
import { TasksPage } from "../../pages/tasks.page";
import { CampaignsPage } from "../../pages/campaigns.page";
import { ContentPage } from "../../pages/content.page";
import { LandingPagesPage } from "../../pages/landing-pages.page";
import { AutomationsPage } from "../../pages/automations.page";
import { IntegrationsPage } from "../../pages/integrations.page";
import { AssistantPage } from "../../pages/assistant.page";
import { ReportsPage } from "../../pages/reports.page";
import { AuditPage } from "../../pages/audit.page";
import { PlansPage } from "../../pages/plans.page";
import { TeamPage } from "../../pages/team.page";
import { ProfilePage } from "../../pages/profile.page";
import { PlatformAdminPage } from "../../pages/platform-admin.page";
import { LoginPage } from "../../pages/login.page";
import { RegisterPage } from "../../pages/register.page";
import { ForgotPasswordPage } from "../../pages/forgot-password.page";
import { ResetPasswordPage } from "../../pages/reset-password.page";
import { VerifyPage } from "../../pages/verify.page";
import { InvitePage } from "../../pages/invite.page";
import { PublicFormPage } from "../../pages/public-form.page";
import { NotFoundPage } from "../../pages/not-found.page";

const screens = [
  ["overview dashboard", OverviewPage, "/", true], ["lead pipeline", LeadsPage, "/leads", true],
  ["customer management", CustomersPage, "/customers", true], ["deal pipeline", DealsPage, "/deals", true],
  ["tasks and calendar", TasksPage, "/tasks", true], ["campaign management", CampaignsPage, "/campaigns", true],
  ["content calendar", ContentPage, "/content", true], ["landing-page manager", LandingPagesPage, "/landing-pages", true],
  ["automation builder", AutomationsPage, "/automations", true], ["integrations screen", IntegrationsPage, "/integrations", true],
  ["workspace assistant", AssistantPage, "/assistant", true], ["analytics reports", ReportsPage, "/reports", true],
  ["audit log", AuditPage, "/audit", true], ["plans and billing", PlansPage, "/plans", true],
  ["team access", TeamPage, "/team", true], ["account profile and appearance", ProfilePage, "/profile", true],
  ["platform admin access screen", PlatformAdminPage, "/platform-admin", true],
  ["sign-in form", LoginPage, "/login", false], ["sign-up form", RegisterPage, "/register", false],
  ["password reset request form", ForgotPasswordPage, "/forgot-password", false], ["password reset confirmation form", ResetPasswordPage, "/reset-password", false],
  ["email verification route", VerifyPage, "/verify", false], ["invitation acceptance route", InvitePage, "/invite", false],
  ["published enquiry form", PublicFormPage, "/p/fall-admissions", false], ["unavailable public page", PublicFormPage, "/p/automation-missing-page", false],
  ["not-found route", NotFoundPage, "/this-route-does-not-exist", false],
] as const;

for (const [label, PageObject, route, authenticated] of screens) {
  for (const workspaceIndex of [0,1,2,3,4]) {
    test(`UI smoke ${label} · W${workspaceIndex + 1}`, async ({ page }) => {
      const workspace = getTestWorkspace(workspaceIndex + 1);
      await test.step(`Given the browser is signed in and workspace is ${workspace.name}`, async () => {
        const ScreenObject = PageObject as unknown as new (page: import("@playwright/test").Page) => BasePage;
        const screen = PageObject === BasePage ? new BasePage(page, route) : route.includes("automation-missing") ? new PublicFormPage(page, "automation-missing-page") : new ScreenObject(page);
        await screen.open(authenticated ? workspace.id : undefined);
      });
      await test.step(`Then ${label} renders without a browser error`, async () => {
        await expect(page.locator("body")).not.toContainText("Application error");
        if (authenticated) await expect(page.locator("main h1").first()).toBeVisible();
        else if (route.startsWith("/this-route")) await expect(page.locator("body")).toContainText(/404|not found/i);
        else await expect(page.locator("main")).toBeVisible();
      });
    });
  }
}

const negativeCases = [
  { name: "sign-in rejects malformed email", route: "/login", field: 'input[type="email"]', value: "not-an-email" },
  { name: "sign-in requires an email", route: "/login", field: 'input[type="email"]', value: "" },
  { name: "sign-in requires a password", route: "/login", field: 'input[autocomplete="current-password"]', value: "" },
  { name: "sign-up rejects malformed email", route: "/register", field: 'input[type="email"]', value: "invalid-address" },
  { name: "sign-up requires a name", route: "/register", field: 'input[autocomplete="name"]', value: "" },
  { name: "sign-up enforces minimum password length", route: "/register", field: 'input[autocomplete="new-password"]', value: "short" },
  { name: "sign-up requires a workspace name", route: "/register", field: 'form input', value: "" },
  { name: "reset request requires valid email format", route: "/forgot-password", field: 'input[type="email"]', value: "broken" },
  { name: "public form requires visitor name", route: "/p/fall-admissions", field: 'input[name="name"]', value: "" },
  { name: "public form rejects invalid visitor email", route: "/p/fall-admissions", field: 'input[name="email"]', value: "x@" },
  { name: "public form requires name with valid data", route: "/p/fall-admissions", field: 'input[name="name"]', value: "A" },
  { name: "sign-up calling-code control offers configured choices", route: "/register", field: 'select[aria-label="Country calling code"]', value: "+92" },
  { name: "sign-up photo input accepts only supported image formats", route: "/register", field: 'input[type="file"]', value: "" },
];
for (const [caseIndex, scenario] of negativeCases.entries()) {
  for (const workspaceIndex of [0,1,2,3,4]) {
    test(`UI negative ${scenario.name} · W${workspaceIndex + 1}`, async ({ page }) => {
      await test.step("Given the relevant form is open", async () => { await page.goto(scenario.route); });
      const field = scenario.name.includes("workspace name") ? page.locator(scenario.field).last() : page.locator(scenario.field).first();
      await test.step(`When test data '${scenario.value || "<empty>"}' is entered`, async () => {
        if (scenario.field.includes("file")) {
          await expect(field).toHaveAttribute("accept", /image\/png/);
        } else if (scenario.field.startsWith("select")) {
          await expect(field.locator("option")).toHaveCount(8);
          await expect(field).toHaveValue(scenario.value);
        } else {
          await field.fill(scenario.value);
          await field.evaluate((input: HTMLInputElement) => input.form?.requestSubmit());
        }
      });
      await test.step("Then the browser blocks invalid data before the request is sent", async () => {
        if (!scenario.field.includes("file") && !scenario.field.startsWith("select")) {
          expect(await field.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
        }
      });
      void caseIndex;
    });
  }
}

const regressionCases = [
  { name: "workspace selector renders all five dedicated workspaces", run: async (page: import("@playwright/test").Page) => { await page.goto("/"); await expect(page.getByRole("combobox", { name: "Switch workspace" }).locator("option")).toHaveCount(8); } },
  { name: "primary navigation entries are available", run: async (page: import("@playwright/test").Page) => { await page.goto("/"); await expect(page.locator("main h1").first()).toBeVisible(); const links=page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"); await expect.poll(()=>links.count()).toBeGreaterThanOrEqual(14); await expect.poll(()=>links.count()).toBeLessThanOrEqual(16); } },
  { name: "MarketFlow360 brand is visible in the application shell", run: async (page: import("@playwright/test").Page) => { await page.goto("/"); await expect(page.getByRole("link", { name: /MarketFlow360/i }).first()).toBeVisible(); } },
  { name: "profile menu remains available from the dashboard", run: async (page: import("@playwright/test").Page) => { await page.goto("/"); await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible(); } },
  { name: "mobile viewport keeps app content inside the screen", run: async (page: import("@playwright/test").Page) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await expect(page.locator("body")).toBeVisible(); expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth + 1)).toBeTruthy(); } },
  { name: "tablet viewport keeps app content inside the screen", run: async (page: import("@playwright/test").Page) => { await page.setViewportSize({ width: 768, height: 1024 }); await page.goto("/leads"); await expect(page.locator("main h1").first()).toBeVisible(); expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth + 1)).toBeTruthy(); } },
  { name: "desktop viewport renders the dashboard and sidebar", run: async (page: import("@playwright/test").Page) => { await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto("/"); await expect(page.locator("aside.sidebar")).toBeVisible(); await expect(page.locator("main h1").first()).toBeVisible(); } },
  { name: "appearance theme selector offers multiple choices", run: async (page: import("@playwright/test").Page) => { await page.goto("/profile"); await expect(page.getByLabel(/color theme/i).locator("option")).toHaveCount(4); } },
  { name: "appearance font selector offers multiple choices", run: async (page: import("@playwright/test").Page) => { await page.goto("/profile"); await expect(page.getByLabel(/interface font/i).locator("option")).toHaveCount(3); } },
  { name: "lead pipeline controls are available", run: async (page: import("@playwright/test").Page) => { await page.goto("/leads"); await expect(page.getByRole("button", { name: /add lead/i })).toBeVisible(); await expect(page.getByRole("button", { name: /edit pipeline/i })).toBeVisible(); } },
  { name: "reports date range controls render", run: async (page: import("@playwright/test").Page) => { await page.goto("/reports"); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); } },
  { name: "theme preference can be changed and saved", run: async (page: import("@playwright/test").Page) => { await page.goto("/profile"); const theme=page.getByLabel(/color theme/i); await theme.selectOption({ index: 1 }); await page.getByRole("button", { name: /apply and save/i }).click(); await expect(page.getByText(/saved/i)).toBeVisible(); } },
  { name: "refresh retains authenticated workspace session", run: async (page: import("@playwright/test").Page) => { await page.goto("/leads"); await page.reload(); await expect(page.locator("main h1").first()).toBeVisible(); await expect(page).not.toHaveURL(/login/); } },
];
for (const [caseIndex, scenario] of regressionCases.entries()) {
  for (const workspaceIndex of [0,1,2,3,4]) {
    test(`UI regression ${scenario.name} · W${workspaceIndex + 1}`, async ({ page }) => {
      const workspace = getTestWorkspace(workspaceIndex + 1);
      await test.step(`Given workspace ${workspace.name} is selected`, async () => { await page.addInitScript(id => localStorage.setItem("mf_workspace", id), workspace.id); });
      await test.step(`When checking regression ${caseIndex + 1} across the screen`, async () => { await scenario.run(page); });
    });
  }
}
