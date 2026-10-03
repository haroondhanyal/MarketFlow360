import { BasePage } from "./base.page"; import { integrationsLocators } from "../locators/integrations.locators"; import type { Page } from "@playwright/test";
export class IntegrationsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/integrations"); this.locators = integrationsLocators(page); } }
