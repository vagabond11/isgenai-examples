// isGenAI public API example. CC0-1.0. Requires Node.js 22 or newer.
// Checks one explicitly supplied file/text or the clearly labelled default example.
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";

const [mode, value, extra] = process.argv.slice(2);
if (extra || (mode && (!["--text", "--code", "--file"].includes(mode) || !value))) {
  throw new Error('Usage: node check-content.mjs [--text "words" | --code "code" | --file picture.png]');
}
const base = new URL(process.env.ISGENAI_BASE_URL || "https://isgenai.com");
if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) {
  throw new Error("Use HTTPS, or HTTP localhost for a local test.");
}
let body;
let headers;
if (mode === "--file") {
  const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif" }[extname(value).toLowerCase()];
  if (!type || (await stat(value)).size > 20 * 1024 * 1024) throw new Error("Use a PNG, JPEG, WebP or AVIF file up to 20 MB.");
  body = new FormData();
  body.set("file", new Blob([await readFile(value)], { type }), `image${extname(value).toLowerCase()}`);
  body.set("privacy", "private");
  body.set("source_context", "isgenai-api-example");
} else {
  const text = value || "This demonstration caption was generated with ChatGPT.";
  if (!text.trim() || text.length > 16000) throw new Error("Use 1 to 16,000 characters.");
  body = JSON.stringify({ text, kind: mode === "--code" ? "code" : "text", privacy: "private", source_context: "isgenai-api-example" });
  headers = { "content-type": "application/json" };
}
const response = await fetch(new URL("/v1/check", base), { method: "POST", headers, body, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Check returned HTTP ${response.status}. For 429, wait before retrying; do not loop requests.`);
const result = await response.json();
if (!result.public_result?.headline || !Array.isArray(result.adapter_runs)) throw new Error("Unexpected check response.");
// Print the headline and check statuses only: no submitted content, filenames or feedback tokens.
console.log(JSON.stringify({
  headline: result.public_result.headline,
  basis: result.public_result.basis,
  checks: result.adapter_runs.map(({ adapter, status }) => ({ adapter, status })),
}, null, 2));
