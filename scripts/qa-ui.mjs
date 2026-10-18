import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Run after npm run dev. Uses installed Edge so no extra browser download is needed.
const browser = await chromium.launch({ ...(process.platform === "win32" ? {channel:"msedge"} : {}), headless: true });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await mkdir("output/playwright", { recursive: true });
try {
  await page.goto("http://127.0.0.1:1420");
  await page
    .getByRole("button", { name: /Open a video/ })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "output/playwright/dark.png" });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "output/playwright/light.png" });
  const misaligned = await page.locator(".icon-button").evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const s = b.querySelector(":scope > svg");
        if (!s) return false;
        const br = b.getBoundingClientRect(),
          sr = s.getBoundingClientRect();
        return (
          Math.abs(br.left + br.width / 2 - sr.left - sr.width / 2) > 0.6 ||
          Math.abs(br.top + br.height / 2 - sr.top - sr.height / 2) > 0.6
        );
      })
      .map((b) => b.getAttribute("aria-label")),
  );
  assert.deepEqual(misaligned, []);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Subtitles", exact: true })
    .last()
    .click();
  await page.getByRole("slider", { name: "Subtitle font size" }).fill("1.25");
  await page
    .getByRole("spinbutton", { name: "Subtitle delay in seconds" })
    .fill("0.5");
  await page.screenshot({ path: "output/playwright/subtitle-settings.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  assert(await page.getByText('Something worth watching.').isVisible());
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Try a sample", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("video").currentTime > 0.25,
  );
  await page.keyboard.press("k");
  const t = await page.locator("video").evaluate((v) => v.currentTime);
  await page.keyboard.press("ArrowRight");
  assert((await page.locator("video").evaluate((v) => v.currentTime)) > t + 4);
  await page
    .getByRole("button", { name: "Playback speed", exact: true })
    .click();
  await page.getByRole("button", { name: "1.5×", exact: true }).click();
  assert.equal(
    await page.locator("video").evaluate((v) => v.playbackRate),
    1.5,
  );
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("150");
  assert(await page.getByText("150%", { exact: true }).isVisible());
  await page.locator(".film-info p").click();
  await page.keyboard.press("m");
  assert(await page.locator("video").evaluate((v) => v.muted));
  await page.getByRole("button", { name: "Toggle playlist" }).click();
  assert.equal(await page.locator(".playlist").count(), 1);
  await page.keyboard.press("l");
  assert.equal(await page.locator(".playlist").count(), 0);
  await page.getByRole("button", { name: "Search library" }).click();
  await page
    .getByRole("textbox", { name: "Search films" })
    .fill("no such film");
  assert(
    await page.getByText("No films found. Add something you love.").isVisible(),
  );
  await page.keyboard.press("Escape");
  for (const [width, height] of [
    [940, 650],
    [1600, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: `output/playwright/size-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS UI: dark/light, library, settings, playback, seek, speed, volume, mute, playlist, empty search, resize; no uncaught browser errors",
  );
} finally {
  await browser.close();
}
