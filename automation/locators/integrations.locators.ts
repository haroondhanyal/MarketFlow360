import type { Page } from "@playwright/test";
export const integrationsLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /integration/i }).first(), forms: page.locator("form"), cards: page.locator(".panel") });
