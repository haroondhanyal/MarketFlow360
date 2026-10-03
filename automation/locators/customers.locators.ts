import type { Page } from "@playwright/test";
export const customersLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /customer/i }).first(), create: page.getByRole("button", { name: /add customer|new customer/i }), search: page.getByPlaceholder(/search customers/i), table: page.locator("table"), forms: page.locator("form") });
