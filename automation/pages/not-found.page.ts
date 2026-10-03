import { BasePage } from "./base.page"; import { notFoundLocators } from "../locators/not-found.locators"; import type { Page } from "@playwright/test";
export class NotFoundPage extends BasePage { readonly locators; constructor(page: Page, route = "/this-route-does-not-exist") { super(page, route); this.locators = notFoundLocators(page); } }
