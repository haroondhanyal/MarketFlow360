import { BasePage } from "./base.page";
import { customersLocators } from "../locators/customers.locators";
import type { Page } from "@playwright/test";
export class CustomersPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/customers"); this.locators = customersLocators(page); } }
