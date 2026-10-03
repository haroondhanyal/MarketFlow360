import { expect } from "@playwright/test";
import { test as base } from "playwright-bdd";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export { expect };

export const test = base.extend<{ marketflowAutomationHooks: void }>({
  marketflowAutomationHooks: [async ({ page }, use, testInfo) => {
    await base.step("Before hook: configure browser defaults and record scenario context", async () => {
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(45_000);
      await page.addInitScript(() => localStorage.removeItem("mf_workspace"));
      testInfo.annotations.push({ type: "suite", description: testInfo.project.name });
      await base.step(`Execution attempt ${testInfo.retry + 1}/${testInfo.project.retries + 1} · retry count ${testInfo.retry}`, async () => {});
    });
    await use();
    await base.step("After hook: capture screenshot and video attachments", async () => {
      if (page.isClosed() || page.url() === "about:blank") {
        await base.step("No browser navigation in this API/database case; skip blank screenshot and video", async () => {});
        return;
      }
      await mkdir(testInfo.outputDir, { recursive: true });
      const imagePath = testInfo.outputPath("case-screenshot.png");
      await page.screenshot({ path: imagePath, fullPage: true, animations: "disabled", timeout: 10_000 });
      await testInfo.attach("MarketFlow360 screenshot", { path: imagePath, contentType: "image/png" });
      const video = page.video();
      if (video) {
        const videoPath = testInfo.outputPath("case-video.webm");
        await page.close();
        await video.saveAs(videoPath);
        const bytes = await readFile(videoPath);
        await testInfo.attach("MarketFlow360 browser recording", { body: bytes, contentType: "video/webm" });
      }
    });
  }, { auto: true }],
});
