import { BasePage } from "./base.page"; import { verifyLocators } from "../locators/verify.locators"; import type { Page } from "@playwright/test";
export class VerifyPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/verify"); this.locators = verifyLocators(page); } }
