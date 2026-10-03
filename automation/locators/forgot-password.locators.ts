import type { Page } from "@playwright/test";
export const forgotPasswordLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), email: page.locator('input[type="email"]'), submit: page.getByRole("button", { name: /send|reset/i }) });
