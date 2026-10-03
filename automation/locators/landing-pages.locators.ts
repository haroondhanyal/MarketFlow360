import type { Page } from "@playwright/test";
export const landingPagesLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /landing/i }).first(), create: page.getByRole("button", { name: /create landing page|new landing page/i }), cards: page.locator(".marketing-grid > *"), forms: page.locator("form") });
