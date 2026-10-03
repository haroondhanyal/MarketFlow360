import type { Page } from "@playwright/test";
export const plansLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /plan|billing/i }).first(), cards: page.locator(".panel") });
