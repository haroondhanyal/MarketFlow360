import type { Page } from "@playwright/test";
export const platformAdminLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /platform admin/i }).first(), main: page.locator("main") });
