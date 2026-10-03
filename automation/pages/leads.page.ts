import { BasePage } from "./base.page";
import { leadsLocators } from "../locators/leads.locators";
import type { Page } from "@playwright/test";
export class LeadsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/leads"); this.locators = leadsLocators(page); } }
