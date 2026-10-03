import { BasePage } from "./base.page";
import { contentLocators } from "../locators/content.locators";
import type { Page } from "@playwright/test";
export class ContentPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/content"); this.locators = contentLocators(page); } }
