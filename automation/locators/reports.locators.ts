import type { Page } from "@playwright/test";
export const reportsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /report/i }).first(), dateInputs: page.locator('input[type="date"]'), charts: page.locator("svg"), export: page.getByRole("link", { name: /export/i }) });
