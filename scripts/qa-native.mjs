import { chromium } from "playwright";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";

// Launch the built application with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222.
let browser;
for(let retry=0;retry<30;retry++) { try { browser=await chromium.connectOverCDP('http://127.0.0.1:9222'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
assert(browser, 'WebView2 debugging endpoint did not start');
const page = browser.contexts()[0].pages()[0];
const invoke = (command, args = {}) =>
  page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
const property = (name) =>
  invoke("player_command", { command: ["get_property", name] });
try {
  await page.waitForFunction(() =>
    document.querySelector(".statusbar")?.innerText.includes("Native playback"),
  );
  assert((await page.title()).startsWith("Plynex"));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  if(await page.getByRole('button',{name:'Switch to dark theme'}).count()) await page.getByRole('button',{name:'Switch to dark theme'}).click();
  if(await page.getByRole('button', { name: 'Try a sample', exact: true }).count()) await page.getByRole('button', { name: 'Try a sample', exact: true }).click();
  else { if(!await page.locator('.playlist').count()) await page.keyboard.press('l'); await page.locator('.queue-play').filter({hasText:'The Quiet Horizon'}).click(); }
  await page.waitForFunction(() =>
    document.querySelector(".stage")?.classList.contains("native-playing"),
  );
  await invoke('player_command',{command:['seek',1,'absolute+exact']});
  await invoke('player_command',{command:['set_property','pause',false]});
  await page.waitForTimeout(200);
  await invoke('player_command',{command:['set_property','mute',false]});
  await page.keyboard.press("k");
  assert.equal(await property("pause"), true);
  const before = await property("time-pos");
  await page.keyboard.press("ArrowRight");
  assert((await property("time-pos")) >= before + 4.5);
  const timeline = await page.getByRole('slider',{name:'Seek video'}).boundingBox();
  for(const fraction of [.8,.2,.65]) {
    await page.mouse.click(timeline.x+6+(timeline.width-12)*fraction,timeline.y+12);
    for(let retry=0;retry<60;retry++){if(Math.abs((await property('time-pos'))-30*fraction)<.3)break;await page.waitForTimeout(25);}
    assert(Math.abs((await property('time-pos'))-30*fraction)<.3,`Native click at ${fraction*100}% must reach its target`);
  }
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("150");
  assert.equal(await property("volume"), 150);
  await page.locator(".film-info p").click();
  await page.keyboard.press("m");
  assert.equal(await property("mute"), true);
  await page
    .getByRole("button", { name: "Playback speed", exact: true })
    .click();
  await page.getByRole("button", { name: "1.5×", exact: true }).click();
  assert.equal(await property("speed"), 1.5);
  await page.getByRole("button", { name: "Subtitles", exact: true }).click();
  await page.locator('.track-list button').filter({hasText:/Persian|fas/}).click();
  await page.keyboard.press("Escape");
  assert.equal(typeof (await property("sid")), "number");
  assert.equal((await property("chapter-list")).length, 6);
  await invoke('player_command',{command:['seek',3,'absolute+exact']});
  const path = await invoke("screenshot");
  assert((await stat(path)).size > 1000);
  console.log("Native frame saved:", path);
  await page
    .getByRole("button", { name: "Fullscreen (F)", exact: true })
    .click();
  await page.locator('.app.fullscreen').waitFor();
  assert(await page.locator(".app.fullscreen").count());
  await page.keyboard.press("Escape");
  await page.locator('.app:not(.fullscreen)').waitFor();
  assert.equal(await page.locator(".app.fullscreen").count(), 0);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  const misaligned = await page.locator(".icon-button").evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const s = b.querySelector(":scope > svg");
        if (!s) return false;
        const br = b.getBoundingClientRect(),
          sr = s.getBoundingClientRect();
        return (
          Math.abs(br.left + br.width / 2 - (sr.left + sr.width / 2)) > 0.6 ||
          Math.abs(br.top + br.height / 2 - (sr.top + sr.height / 2)) > 0.6
        );
      })
      .map((b) => b.getAttribute("aria-label")),
  );
  assert.deepEqual(misaligned, []);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.screenshot({ path: "output/playwright/native-settings.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("75");
  await page.locator(".film-info p").click();
  await page.keyboard.press("m");
  await invoke("player_command", { command: ["set_property", "speed", 1] });
  await invoke("player_command", { command: ["seek", 3, "absolute+exact"] });
  console.log(
    "PASS native desktop: real playback, pause, keyboard seek, volume 150, mute, speed, Persian subtitle, chapters, screenshot, fullscreen, light/dark, centered Phosphor icons.",
  );
  process.exit(0);
} finally {
  process.exitCode ??= 0;
}
