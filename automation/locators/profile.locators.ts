import type { Page } from "@playwright/test";
export const profileLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /profile|account|appearance/i }).first(), forms: page.locator("form"), file: page.locator('input[type="file"]'), theme: page.getByLabel(/color theme/i), font: page.getByLabel(/interface font/i), save: page.getByRole("button", { name: /apply and save/i }) });
