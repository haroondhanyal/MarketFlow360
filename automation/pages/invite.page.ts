import { BasePage } from "./base.page"; import { inviteLocators } from "../locators/invite.locators"; import type { Page } from "@playwright/test";
export class InvitePage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/invite"); this.locators = inviteLocators(page); } }
