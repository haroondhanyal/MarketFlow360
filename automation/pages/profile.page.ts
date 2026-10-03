import { BasePage } from "./base.page"; import { profileLocators } from "../locators/profile.locators"; import type { Page } from "@playwright/test";
export class ProfilePage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/profile"); this.locators = profileLocators(page); } }
