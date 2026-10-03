import { BasePage } from "./base.page"; import { assistantLocators } from "../locators/assistant.locators"; import type { Page } from "@playwright/test";
export class AssistantPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/assistant"); this.locators = assistantLocators(page); } }
