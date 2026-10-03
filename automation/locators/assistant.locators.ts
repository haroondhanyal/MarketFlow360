import type { Page } from "@playwright/test";
export const assistantLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /assistant/i }).first(), prompt: page.locator("textarea, input").last(), submit: page.getByRole("button", { name: /ask|send|suggest/i }), suggestions: page.locator("button") });
