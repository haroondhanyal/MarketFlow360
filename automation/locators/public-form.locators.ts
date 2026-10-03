import type { Page } from "@playwright/test";
export const publicFormLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), name: page.getByLabel(/your name/i), email: page.getByLabel(/email/i), phone: page.getByLabel(/phone/i), submit: page.locator(".public-form button") });
