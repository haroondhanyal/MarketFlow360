import { BasePage } from "./base.page"; import { registerLocators } from "../locators/register.locators"; import type { Page } from "@playwright/test";
export class RegisterPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/register"); this.locators = registerLocators(page); } }
