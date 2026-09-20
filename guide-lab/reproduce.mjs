// isGenAI controlled image-record lab. CC0-1.0.
// Requires Node.js 22+ and sharp: npm install sharp
// Run in an empty working directory: node reproduce.mjs
// Reads two public, code-drawn isGenAI examples. Sends no private files anywhere.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import sharp from "sharp";

const directory = "isgenai-guide-lab";
await mkdir(directory); // Refuse to overwrite a previous run.
async function example(path) {
  const response = await fetch(`https://isgenai.com${path}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Example download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function textChunk(png, key, value, type = "tEXt") {
  const text = Buffer.from(value);
  const payload = type === "zTXt" ? Buffer.concat([Buffer.from([0]), deflateSync(text)]) : type === "iTXt" ? Buffer.concat([Buffer.from([1, 0, 0, 0]), deflateSync(text)]) : text;
  const bytes = Buffer.concat([Buffer.from(type), Buffer.from(`${key}\0`), payload]);
  const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length - 4);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(bytes));
  return Buffer.concat([png.subarray(0, -12), size, bytes, crc, png.subarray(-12)]);
}
const base = await example("/examples/saved-details/without-saved-details.png");
const text = "Controlled example: a paper boat on a blue table\nNegative prompt: text, blur\nSteps: 20, Sampler: Euler, CFG scale: 7, Seed: 42, Size: 1024x768, Model: demonstration-only";
const changed = text.replace("Steps: 20", "Steps: 30").replace("Seed: 42", "Seed: 84");
const files = { "without-records.png": base };
for (const type of ["tEXt", "zTXt", "iTXt"]) files[`parameters-${type}.png`] = textChunk(base, "parameters", text, type);
files["changed-settings.png"] = textChunk(base, "parameters", changed);
files["conflicting-records.png"] = textChunk(files["parameters-tEXt.png"], "parameters", changed);
files["invokeai-record.png"] = textChunk(base, "invokeai_metadata", JSON.stringify({ app_version: "6.0.0", generation_mode: "txt2img", positive_prompt: "Controlled example: three folded paper stars", negative_prompt: "text", seed: 0, steps: 30, cfg_scale: 4.5, scheduler: "euler", width: 1024, height: 768, model: { name: "demonstration-only" } }));
files["workflow-records.png"] = await example("/examples/workflows/with-workflow.png");
files["original-copy.png"] = Buffer.from(files["parameters-tEXt.png"]);
files["reencoded.png"] = await sharp(files["parameters-tEXt.png"]).png().toBuffer();
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const pixels = await sharp(files["parameters-tEXt.png"]).ensureAlpha().raw().toBuffer();
const output = [];
for (const [name, bytes] of Object.entries(files)) {
  await writeFile(`${directory}/${name}`, bytes);
  output.push({ name, bytes: bytes.length, sha256: hash(bytes), decoded_rgba_equals_parameters: pixels.equals(await sharp(bytes).ensureAlpha().raw().toBuffer()) });
}
assert.equal(hash(files["original-copy.png"]), hash(files["parameters-tEXt.png"]));
for (const name of ["original-copy.png", "changed-settings.png", "reencoded.png", "without-records.png"]) assert.equal(output.find(row => row.name === name).decoded_rgba_equals_parameters, true);
await writeFile(`${directory}/reproduction.json`, JSON.stringify({ scope: "Controlled records on code-drawn pixels, not generator or authorship evidence.", node: process.version, sharp: sharp.versions.sharp, note: "Re-encoded bytes can depend on library version. Open generated files in the checkers to compare saved fields with the published observations.", files: output }, null, 2) + "\n");
console.log(`Created ${output.length} files in ${directory}. Byte-copy and four pixel-equality checks passed.`);
