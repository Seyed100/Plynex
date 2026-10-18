import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ ...(process.platform === "win32" ? {channel:"msedge"} : {}), headless: true });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
try {
  await page.goto("http://127.0.0.1:1420");
  await page.getByRole("button", { name: "Try a sample", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("video").currentTime > 0.2,
  );
  await page.locator(".film-info p").click();
  await page.keyboard.press("k");
  const timeline = await page
    .getByRole("slider", { name: "Seek video" })
    .boundingBox();
  assert(timeline.width > 1200 && timeline.height >= 24);
  for (const fraction of [0.8, 0.2, 0.65]) {
    await page.mouse.click(
      timeline.x + 6 + (timeline.width - 12) * fraction,
      timeline.y + 12,
    );
    assert(
      Math.abs(
        (await page.locator("video").evaluate((v) => v.currentTime)) -
          30 * fraction,
      ) < 0.25,
      `Click at ${fraction * 100}% must seek exactly`,
    );
  }
  await page.getByRole("slider", { name: "Seek video" }).press("ArrowRight");
  assert(
    Math.abs(
      (await page.locator("video").evaluate((v) => v.currentTime)) - 24.5,
    ) < 0.25,
  );
  await page.mouse.move(timeline.x + 5, timeline.y + 12);
  await page.mouse.down();
  await page.mouse.move(timeline.x + timeline.width * 0.6, timeline.y + 12, {
    steps: 8,
  });
  await page.mouse.up();
  assert(
    Math.abs(
      (await page.locator("video").evaluate((v) => v.currentTime)) - 18,
    ) < 1,
  );
  await page.screenshot({ path: "output/playwright/playback-dark.png" });
  await page
    .getByRole("button", { name: "Playback speed", exact: true })
    .click();
  const speedRows = await page
    .locator(".speed-grid button")
    .evaluateAll((buttons) =>
      buttons
        .slice(0, 5)
        .map(
          (b) => b.querySelector(".speed-value").getBoundingClientRect().top,
        ),
    );
  assert(
    Math.max(...speedRows) - Math.min(...speedRows) < 1,
    "Speed numbers and units must share a row",
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: "output/playwright/speed-refined.png" });
  await page.keyboard.press("Escape");
  const before = await page.locator(".video-area").boundingBox();
  await page.locator(".film-info p").click();
  await page.keyboard.press("k");
  await page.mouse.move(650, 380);
  await page.waitForTimeout(3200);
  assert(await page.locator(".app.chrome-hidden").count());
  assert.equal(
    await page.locator(".topbar").evaluate((e) => getComputedStyle(e).opacity),
    "0",
  );
  assert.equal(
    await page
      .locator(".controls")
      .evaluate((e) => getComputedStyle(e).opacity),
    "0",
  );
  assert.deepEqual(await page.locator(".video-area").boundingBox(), before);
  await page.screenshot({ path: "output/playwright/playback-clean.png" });
  await page.mouse.move(650, 20);
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".topbar").evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  await page.keyboard.press("l");
  const video = await page.locator(".video-area").boundingBox(),
    queue = await page.locator(".playlist").boundingBox();
  assert(video.x + video.width <= queue.x + 1, "Queue must not cover video");
  await page.screenshot({ path: "output/playwright/playback-queue.png" });
  await page.keyboard.press("l");
  await page.keyboard.press("k");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "output/playwright/playback-light.png" });
  await page.setViewportSize({ width: 940, height: 650 });
  await page.screenshot({ path: "output/playwright/playback-small.png" });
  const controls = await page.locator(".controls").boundingBox();
  assert(controls.x >= 0 && controls.x + controls.width <= 940);
  await page.getByRole("button", { name: "Close video", exact: true }).click();
  await page.getByRole("button", { name: /Open a video/ }).waitFor();
  assert.equal(await page.locator(".watching").count(), 0);
  console.log(
    "PASS playback layout: full-width 6px seek with 24px hit area, real drag seek, auto-hide, hover reveal, unchanged video bounds, non-overlapping queue, both themes, small window, close film.",
  );
} finally {
  await browser.close();
}
