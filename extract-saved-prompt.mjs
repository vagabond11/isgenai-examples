// isGenAI saved image prompt example. CC0-1.0. Requires Node.js 22 or newer.
// One explicit upload; no model reconstruction, paid fallback or automatic retries.
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";

const [file, extra] = process.argv.slice(2);
if (!file || extra) throw new Error("Usage: node extract-saved-prompt.mjs picture.png");
const base = new URL(process.env.ISGENAI_BASE_URL || "https://isgenai.com");
if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) {
  throw new Error("Use HTTPS, or HTTP localhost for a local test.");
}
const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif" }[extname(file).toLowerCase()];
const info = await stat(file);
if (!type || !info.isFile() || !info.size || info.size > 20 * 1024 * 1024) throw new Error("Use a PNG, JPEG, WebP or AVIF file up to 20 MB.");
const body = new FormData();
body.set("file", new Blob([await readFile(file)], { type }), `image${extname(file).toLowerCase()}`);
body.set("mode", "saved_only");
const response = await fetch(new URL("/v1/prompt", base), {
  method: "POST", body, redirect: "error", signal: AbortSignal.timeout(30000),
});
if (!response.ok && response.status !== 422) throw new Error(`Extraction returned HTTP ${response.status}. For 429, wait before retrying; do not loop requests.`);
const result = await response.json();
if (response.status === 422 && result.error?.code === "no_saved_prompt") {
  console.log(JSON.stringify({ status: "not_found", note: "No supported saved prompt was found in this copy." }, null, 2));
} else {
  if (!response.ok) throw new Error(`Extraction returned HTTP ${response.status}. For 429, wait before retrying; do not loop requests.`);
  if (result.schema !== "isgenai.prompt.v1" || result.status !== "saved" || typeof result.prompt !== "string") throw new Error("Unexpected saved-prompt response.");
  // This command deliberately prints the saved prompt. Do not send private prompts to shared logs.
  console.log(JSON.stringify({ status: result.status, prompt: result.prompt, negative_prompt: result.negative_prompt,
    recorded_model: result.recorded_model, note: result.note }, null, 2));
}
