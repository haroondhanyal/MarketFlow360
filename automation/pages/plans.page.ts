import { BasePage } from "./base.page"; import { plansLocators } from "../locators/plans.locators"; import type { Page } from "@playwright/test";
export class PlansPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/plans"); this.locators = plansLocators(page); } }
