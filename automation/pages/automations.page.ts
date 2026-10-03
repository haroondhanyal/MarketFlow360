import { BasePage } from "./base.page";
import { automationsLocators } from "../locators/automations.locators";
import type { Page } from "@playwright/test";
export class AutomationsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/automations"); this.locators = automationsLocators(page); } }
