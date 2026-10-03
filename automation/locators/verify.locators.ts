import type { Page } from "@playwright/test";
export const verifyLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), status: page.locator("main") });
