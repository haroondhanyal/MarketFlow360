import { BasePage } from "./base.page";
import { dealsLocators } from "../locators/deals.locators";
import type { Page } from "@playwright/test";
export class DealsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/deals"); this.locators = dealsLocators(page); } }
