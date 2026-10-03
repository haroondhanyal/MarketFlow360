import type { Page } from "@playwright/test";
export const dealsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /deal/i }).first(), create: page.getByRole("button", { name: /add deal|new deal|create deal/i }), search: page.getByPlaceholder(/search deals/i), table: page.locator("table") });
