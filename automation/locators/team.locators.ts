import type { Page } from "@playwright/test";
export const teamLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /team/i }).first(), inviteForm: page.locator("form"), email: page.getByLabel("Email"), members: page.locator("tbody tr") });
