import { BasePage } from "./base.page"; import { authLocators } from "../locators/auth.locators"; import type { Page } from "@playwright/test";
export class AuthPage extends BasePage { readonly locators; constructor(page: Page, route: string) { super(page, route); this.locators = authLocators(page); } }
