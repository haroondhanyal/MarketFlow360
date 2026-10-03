import type { Page } from "@playwright/test";
export const loginLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: "Welcome back" }), email: page.getByLabel("Email"), password: page.locator('input[autocomplete="current-password"]'), submit: page.getByRole("button", { name: "Sign in" }), error: page.locator(".form-error") });
