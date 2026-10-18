import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
const source = ts.transpileModule(fs.readFileSync("src/types.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { normalizePreferences: n } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
assert.equal(n(null).volume, 75);
assert.deepEqual(n({ queue: null, positions: [] }).queue, []);
const p = n({
  theme: "broken",
  volume: 999,
  speed: -3,
  subDelay: NaN,
  queue: [null, { path: "/film.mkv", name: "Film" }, { path: 1, name: 2 }],
  positions: { good: 45, bad: -1, nan: NaN },
});
assert.equal(p.theme, "dark");
assert.equal(p.volume, 150);
assert.equal(p.speed, 0.25);
assert.equal(p.subDelay, 0);
assert.equal(p.queue.length, 1);
assert.deepEqual(p.positions, { good: 45 });
console.log(
  "PASS invalid, legacy and out-of-range saved preferences recover safely.",
);
