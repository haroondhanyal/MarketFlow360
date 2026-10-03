import type { Page } from "@playwright/test";
export const sharedLocators = (page: Page) => ({
  heading: page.locator("main h1").first(),
  main: page.locator("main").first(),
  sidebar: page.locator("aside.sidebar"),
  navigation: page.getByRole("navigation", { name: "Main navigation" }),
  workspace: page.getByRole("combobox", { name: "Switch workspace" }),
  brand: page.getByRole("link", { name: /MarketFlow360/i }).first(),
  profile: page.getByRole("link", { name: "Edit profile" }),
  logout: page.getByRole("button", { name: "Log out" }),
});
