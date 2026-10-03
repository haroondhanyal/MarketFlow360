import { BasePage } from "./base.page"; import { platformAdminLocators } from "../locators/platform-admin.locators"; import type { Page } from "@playwright/test";
export class PlatformAdminPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/platform-admin"); this.locators = platformAdminLocators(page); } }
