import { BasePage } from "./base.page";
import { landingPagesLocators } from "../locators/landing-pages.locators";
import type { Page } from "@playwright/test";
export class LandingPagesPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/landing-pages"); this.locators = landingPagesLocators(page); } }
