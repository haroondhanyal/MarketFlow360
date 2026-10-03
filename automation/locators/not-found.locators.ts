import type { Page } from "@playwright/test";
export const notFoundLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /not found|404/i }).first(), body: page.locator("body") });
