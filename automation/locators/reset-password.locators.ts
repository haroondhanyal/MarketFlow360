import type { Page } from "@playwright/test";
export const resetPasswordLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), password: page.locator('input[autocomplete="new-password"]'), submit: page.getByRole("button", { name: /save|reset/i }) });
