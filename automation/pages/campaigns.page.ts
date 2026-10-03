import { BasePage } from "./base.page";
import { campaignsLocators } from "../locators/campaigns.locators";
import type { Page } from "@playwright/test";
export class CampaignsPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/campaigns"); this.locators = campaignsLocators(page); } }
