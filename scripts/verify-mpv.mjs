import { spawn, execFileSync } from "node:child_process";
import { connect } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const dir = await mkdtemp(join(tmpdir(), "plynex-test-"));
const windows = process.platform === "win32";
const pipe = windows
  ? `\\\\.\\pipe\\plynex-verify-${process.pid}`
  : join(dir, "ipc.sock");
const mpv = spawn(
  process.env.MPV_PATH ||
    (windows ? resolve("src-tauri/resources/mpv/mpv.exe") : "mpv"),
  [
    "--no-config",
    "--idle=yes",
    "--vo=null",
    "--ao=null",
    "--keep-open=yes",
    "--volume-max=150",
    `--input-ipc-server=${pipe}`,
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket;
const pending = new Map();
let id = 0,
  buffer = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(...command) {
  const request_id = ++id;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(request_id);
      reject(Error(`Timeout: ${command}`));
    }, 5000);
    pending.set(request_id, (v) => {
      clearTimeout(timeout);
      v.error === "success"
        ? resolve(v.data)
        : reject(Error(`${command[0]}: ${v.error}`));
    });
    socket.write(JSON.stringify({ command, request_id }) + "\n");
  });
}
async function waitFor(fn) {
  for (let i = 0; i < 100; i++) {
    try {
      if (await fn()) return;
    } catch {}
    await sleep(50);
  }
  throw Error("Property did not reach expected value");
}
function ffmpeg(args) {
  execFileSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", ...args],
    { windowsHide: true },
  );
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      socket = await new Promise((resolve, reject) => {
        const s = connect(pipe);
        s.once("connect", () => resolve(s));
        s.once("error", reject);
      });
      break;
    } catch {
      await sleep(50);
    }
  }
  assert(socket, "mpv did not expose its named pipe");
  socket.on("data", (d) => {
    buffer += d;
    for (;;) {
      const end = buffer.indexOf("\n");
      if (end < 0) break;
      const v = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (v.request_id) {
        const callback = pending.get(v.request_id);
        pending.delete(v.request_id);
        callback?.(v);
      }
    }
  });
  await rpc("set_property", "pause", true);
  await rpc("loadfile", resolve("public/quiet-horizon.mp4"), "replace");
  await waitFor(
    async () => Number(await rpc("get_property", "duration")) >= 29,
  );
  assert.equal((await rpc("get_property", "chapter-list")).length, 6);
  assert(
    (await rpc("get_property", "track-list")).some(
      (t) => t.type === "sub" && t.lang === "fas",
    ),
  );
  await rpc("set_property", "volume", 150);
  assert.equal(await rpc("get_property", "volume"), 150);
  await rpc("set_property", "speed", 1.5);
  assert.equal(await rpc("get_property", "speed"), 1.5);
  await rpc("seek", 12, "absolute+exact");
  await waitFor(
    async () => Math.abs((await rpc("get_property", "time-pos")) - 12) < 1,
  );
  await rpc("set_property", "sub-delay", 0.5);
  assert.equal(await rpc("get_property", "sub-delay"), 0.5);
  await rpc("set_property", "audio-delay", -0.2);
  assert.equal(await rpc("get_property", "audio-delay"), -0.2);
  const subtitle = join(dir, "زیرنویس فارسی.srt");
  await writeFile(
    subtitle,
    "1\n00:00:00,000 --> 00:00:01,000\nآزمون زیرنویس\n",
  );
  await rpc("sub-add", subtitle, "select");
  assert(
    (await rpc("get_property", "track-list")).some(
      (t) => t.external && t.type === "sub",
    ),
  );
  console.log(
    "PASS sample MP4: chapters, Persian track, seek, 150% volume, speed, sync, Unicode external subtitle",
  );
  const formats = [
    ["mkv", "libx265"],
    ["webm", "libvpx-vp9"],
    ["avi", "mpeg4"],
  ];
  for (const [ext, codec] of formats) {
    const path = join(dir, `آزمون.${ext}`);
    ffmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=10",
      "-t",
      "2",
      "-c:v",
      codec,
      "-threads",
      "2",
      path,
    ]);
    await rpc("loadfile", path, "replace");
    await waitFor(async () => {
      try {
        return (await rpc("get_property", "video-params"))?.w === 320;
      } catch {
        return false;
      }
    });
    console.log(`PASS ${ext}: ${codec}, Unicode file path`);
  }
  const flac = join(dir, "audio.flac");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    "-c:a",
    "flac",
    flac,
  ]);
  await rpc("loadfile", flac, "replace");
  await waitFor(async () => {
    try {
      return (await rpc("get_property", "track-list")).some(
        (t) => t.type === "audio" && t.codec === "flac",
      );
    } catch {
      return false;
    }
  });
  console.log("PASS FLAC audio-only");
  console.log("All native engine integration checks passed.");
} finally {
  socket?.destroy();
  mpv.kill();
  await sleep(200);
  await rm(dir, { recursive: true, force: true });
}
