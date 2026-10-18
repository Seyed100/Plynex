import { mkdir, copyFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("src-tauri/resources/runtime");
await mkdir(`${root}/fonts`, { recursive: true });
await copyFile("public/quiet-horizon.mp4", `${root}/quiet-horizon.mp4`);
for (const file of ["Vazirmatn.ttf", "OFL.txt"])
  await copyFile(`assets/fonts/${file}`, `${root}/fonts/${file}`);
await mkdir(`${root}/licenses`, { recursive: true });
for (const file of [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "assets/ASSET_LICENSE.md",
])
  await copyFile(file, `${root}/licenses/${file.split("/").pop()}`);
await cp("LICENSES", `${root}/licenses/dependencies`, { recursive: true });
console.log("Local sample and licensed subtitle font prepared.");
