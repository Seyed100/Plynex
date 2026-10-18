import { readFile } from "node:fs/promises";
const file = await readFile(process.argv[2]);
const pe = file.readUInt32LE(0x3c),
  optional = pe + 24,
  count = file.readUInt16LE(pe + 6),
  sectionStart = optional + file.readUInt16LE(pe + 20),
  is64 = file.readUInt16LE(optional) === 0x20b;
const offset = (rva) => {
  for (let i = 0; i < count; i++) {
    const s = sectionStart + i * 40,
      va = file.readUInt32LE(s + 12),
      size = Math.max(file.readUInt32LE(s + 8), file.readUInt32LE(s + 16));
    if (rva >= va && rva < va + size)
      return rva - va + file.readUInt32LE(s + 20);
  }
  throw Error("Invalid PE RVA");
};
let descriptor = offset(file.readUInt32LE(optional + (is64 ? 112 : 96) + 8));
while (file.readUInt32LE(descriptor + 12)) {
  const name = offset(file.readUInt32LE(descriptor + 12));
  console.log(file.toString("ascii", name, file.indexOf(0, name)));
  descriptor += 20;
}
