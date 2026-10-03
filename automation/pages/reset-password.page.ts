import { BasePage } from "./base.page"; import { resetPasswordLocators } from "../locators/reset-password.locators"; import type { Page } from "@playwright/test";
export class ResetPasswordPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/reset-password"); this.locators = resetPasswordLocators(page); } }
