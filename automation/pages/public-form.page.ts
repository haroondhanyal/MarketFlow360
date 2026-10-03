import { BasePage } from "./base.page"; import { publicFormLocators } from "../locators/public-form.locators"; import type { Page } from "@playwright/test";
export class PublicFormPage extends BasePage { readonly locators; constructor(page: Page, slug = "fall-admissions") { super(page, `/p/${slug}`); this.locators = publicFormLocators(page); } }
