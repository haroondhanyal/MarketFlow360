import type { Page } from "@playwright/test";
export const contentLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /content/i }).first(), create: page.getByRole("button", { name: /create content|add content/i }), cards: page.locator(".marketing-grid > *"), forms: page.locator("form") });
