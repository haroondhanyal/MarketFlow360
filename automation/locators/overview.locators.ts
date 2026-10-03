import type { Page } from "@playwright/test";
export const overviewLocators = (page: Page) => ({ heading: page.getByRole("heading", { level: 1 }), metricCards: page.locator(".metric-card, .summary-card, [class*=metric]") });
