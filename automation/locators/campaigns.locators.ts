import type { Page } from "@playwright/test";
export const campaignsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /campaign/i }).first(), create: page.getByRole("button", { name: /create campaign/i }), cards: page.locator(".marketing-grid > *"), forms: page.locator("form") });
