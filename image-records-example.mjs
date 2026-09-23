// isGenAI image-records example. CC0-1.0. Requires Node.js 22 or newer.
// Uploads only the local files explicitly supplied. No model calls or retries.
import { open } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MIB = 1024 * 1024;
const USAGE = "Usage: node image-records-example.mjs workflow picture.png|workflow.json\n"
  + "       node image-records-example.mjs compare original.png exported.png";
const types = { ".png": "image/png", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function endpointBase(value) {
  const base = new URL(value);
  const local = base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || (base.protocol !== "https:" && !local)
    || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("ISGENAI_BASE_URL must be an HTTPS origin, or HTTP localhost, without credentials, a path, query or fragment.");
  }
  return base;
}

async function readUpload(path, mode, field) {
  // URL-shaped arguments are never retrieved. Windows drive paths are local paths.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) {
    throw new Error("Supply a local file path, not a URL.");
  }
  const extension = extname(path).toLowerCase();
  const allowed = mode === "workflow" ? [".png", ".json"] : [".png", ".jpg", ".jpeg", ".webp"];
  if (!allowed.includes(extension)) throw new Error(mode === "workflow"
    ? "Workflow input must be a PNG or JSON file." : "Comparison inputs must be PNG, JPEG or WebP files.");
  const limit = mode === "workflow" ? (extension === ".json" ? MIB : 20 * MIB) : 10 * MIB;
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || !info.size || info.size > limit) {
      throw new Error(`Use a non-empty regular ${extension} file up to ${limit / MIB} MiB.`);
    }
    // Read through the opened handle, capped even if the file grows after stat().
    const chunks = [];
    let size = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit + 1 - size));
      const { bytesRead } = await handle.read(chunk);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > limit) throw new Error(`File exceeds ${limit / MIB} MiB.`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    if (!size) throw new Error("The selected file is empty.");
    // Generic multipart names avoid transmitting local directory or project names.
    return { blob: new Blob(chunks, { type: types[extension] }), name: `${field}${extension}` };
  } finally { await handle.close(); }
}

function validResult(result, mode) {
  if (!result || typeof result !== "object") return false;
  if (mode === "workflow") {
    return Array.isArray(result.records) && Array.isArray(result.unreadable)
      && result.unreadable.every(value => typeof value === "string")
      && result.records.every(record => record && ["workflow", "prompt"].includes(record.kind)
        && typeof record.text === "string" && Array.isArray(record.nodes) && Array.isArray(record.node_types));
  }
  return typeof result.identical_files === "boolean" && Array.isArray(result.rows)
    && [result.before, result.after].every(file => file && typeof file.sha256 === "string"
      && file.values && typeof file.values === "object" && Array.isArray(file.warnings))
    && result.rows.every(row => row && typeof row.field === "string"
      && ["same", "changed", "unreadable_after", "readable_after", "not_found"].includes(row.state));
}

export async function inspectImageRecords(args, {
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.ISGENAI_BASE_URL || "https://isgenai.com",
} = {}) {
  const [mode, ...paths] = args;
  if ((mode !== "workflow" && mode !== "compare") || paths.length !== (mode === "workflow" ? 1 : 2)) {
    throw new Error(USAGE);
  }
  const base = endpointBase(baseUrl);
  const fields = mode === "workflow" ? ["file"] : ["before", "after"];
  const body = new FormData();
  for (const [index, field] of fields.entries()) {
    const upload = await readUpload(paths[index], mode, field);
    body.set(field, upload.blob, upload.name);
  }
  try {
    const response = await fetchImpl(new URL(mode === "workflow" ? "/v1/workflow" : "/v1/metadata-compare", base), {
      method: "POST", body, redirect: "error", signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 429) {
      const retry = response.headers.get("retry-after");
      throw new Error(`HTTP 429: checks are busy. ${retry && /^\d{1,5}$/.test(retry)
        ? `Wait at least ${retry} seconds before trying again.` : "Wait before trying again."} No automatic retry was made.`);
    }
    if (!response.ok) {
      const guidance = { 400: "Check the file format and required inputs.", 403: "The server rejected the request origin.",
        413: "Reduce the file size to the documented endpoint limit." }[response.status] || "The service could not complete this request.";
      throw new Error(`HTTP ${response.status}: ${guidance} No automatic retry was made.`);
    }
    const result = await response.json();
    if (!validResult(result, mode)) throw new Error("Unexpected image-records response.");
    return result;
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("The request timed out after 30 seconds. No automatic retry was made.");
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await inspectImageRecords(process.argv.slice(2));
    // Results contain saved prompts and graph input values. Keep private output out of shared logs.
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "The image-records request failed.");
    process.exitCode = 1;
  }
}
