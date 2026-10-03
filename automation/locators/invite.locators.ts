import type { Page } from "@playwright/test";
export const inviteLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), status: page.locator("main") });
