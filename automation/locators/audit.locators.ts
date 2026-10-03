import type { Page } from "@playwright/test";
export const auditLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /audit/i }).first(), table: page.locator("table"), rows: page.locator("tbody tr") });
