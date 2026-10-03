import { BasePage } from "./base.page";
import { overviewLocators } from "../locators/overview.locators";
import type { Page } from "@playwright/test";
export class OverviewPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/"); this.locators = overviewLocators(page); } }
