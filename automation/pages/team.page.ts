import { BasePage } from "./base.page"; import { teamLocators } from "../locators/team.locators"; import type { Page } from "@playwright/test";
export class TeamPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/team"); this.locators = teamLocators(page); } }
