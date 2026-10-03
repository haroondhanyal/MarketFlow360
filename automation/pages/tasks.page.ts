import { BasePage } from "./base.page";
import { tasksLocators } from "../locators/tasks.locators";
import type { Page } from "@playwright/test";
export class TasksPage extends BasePage { readonly locators; constructor(page: Page) { super(page, "/tasks"); this.locators = tasksLocators(page); } }
