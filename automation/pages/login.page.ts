import { BasePage } from "./base.page"; import { loginLocators } from "../locators/login.locators"; import type { Page } from "@playwright/test";
export class LoginPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/login"); this.locators = loginLocators(page); } }
