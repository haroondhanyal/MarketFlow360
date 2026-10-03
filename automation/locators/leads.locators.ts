import type { Page } from "@playwright/test";
export const leadsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /lead/i }).first(), addLead: page.getByRole("button", { name: /add lead|new lead/i }), search: page.getByPlaceholder(/search leads/i), table: page.locator("table"), forms: page.locator("form") });
