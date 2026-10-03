import { BasePage } from "./base.page"; import { forgotPasswordLocators } from "../locators/forgot-password.locators"; import type { Page } from "@playwright/test";
export class ForgotPasswordPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/forgot-password"); this.locators = forgotPasswordLocators(page); } }
