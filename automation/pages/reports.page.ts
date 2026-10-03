import { BasePage } from "./base.page";
import { reportsLocators } from "../locators/reports.locators";
import type { Page } from "@playwright/test";
export class ReportsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/reports"); this.locators = reportsLocators(page); } }
