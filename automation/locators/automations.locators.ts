import type { Page } from "@playwright/test";
export const automationsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /automation/i }).first(), create: page.getByRole("button", { name: /create automation|new automation/i }), cards: page.locator(".marketing-grid > *"), forms: page.locator("form") });
