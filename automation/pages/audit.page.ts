import { BasePage } from "./base.page"; import { auditLocators } from "../locators/audit.locators"; import type { Page } from "@playwright/test";
export class AuditPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/audit"); this.locators = auditLocators(page); } }
