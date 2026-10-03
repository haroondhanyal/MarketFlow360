import { expect, type Page } from "@playwright/test";
import { sharedLocators } from "../locators/shared.locators";

export class BasePage {
  readonly ui;
  constructor(readonly page: Page, readonly route: string) { this.ui = sharedLocators(page); }
  async open(workspaceId?: string) {
    if (workspaceId) await this.page.addInitScript(id => localStorage.setItem("mf_workspace", id), workspaceId);
    await this.page.goto(this.route, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await this.page.waitForLoadState("domcontentloaded");
  }
  async expectShell() {
    await expect(this.ui.main).toBeVisible();
    await expect(this.ui.brand).toBeVisible();
  }
  async expectHeading() { await expect(this.ui.heading).toBeVisible(); }
}
