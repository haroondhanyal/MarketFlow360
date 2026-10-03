import type { Page } from "@playwright/test";
export const tasksLocators = (page: Page) => ({ heading: page.getByRole("heading", { name: /task/i }).first(), create: page.getByRole("button", { name: /add task|new task|create task/i }), table: page.locator("table"), calendar: page.locator("[class*=calendar]") });
