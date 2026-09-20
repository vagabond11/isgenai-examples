# isGenAI API examples

Working examples for the [isGenAI AI detector](https://isgenai.com/): check images, text and code for AI labels, saved creation details and tool-use statements.

## Quick start

Use Node.js 22 or newer. No package installation is needed.

```sh
node check-content.mjs
node check-content.mjs --text "This summary was drafted with Claude."
node check-content.mjs --code "// This function was coded using GitHub Copilot."
node check-content.mjs --file picture.png
```

The default command checks a clearly labelled demonstration sentence. Each command sends one request to the public isGenAI endpoint; current service limits apply. No API key is needed for that endpoint.

The script prints a headline, its basis, and the checks that ran. For the default sentence the headline is `AI DETECTED`, based on `Public label`: the sentence explicitly says ChatGPT was used. An ordinary mention of ChatGPT or an SDK import is not an authorship finding. Current text checks read AI-use labels and tool names; they do not provide a validated writing-style probability.

For images, upload PNG, JPEG, WebP or AVIF up to 20 MB. Text/code are limited to 16,000 characters. The script sends inputs with `privacy: private`, never executes submitted code, uses a 30-second timeout and avoids automatic retry loops. Its output excludes submitted content and feedback tokens. Read the [privacy policy](https://isgenai.com/privacy) before supplying sensitive material.

## Extract a saved image prompt

Use the saved-prompt example when you want the instructions stored in an original image, with no model reconstruction:

```bash
node extract-saved-prompt.mjs picture.png
```

The command sends one image to `POST /v1/prompt` with `mode=saved_only`. It prints `status: saved` and the saved prompt when supported records are present. HTTP 422 with `no_saved_prompt` becomes `status: not_found`; no model call or paid fallback is made. There are no automatic retries. This mode also works when the server's reconstruction budget is exhausted.

Supported saved records include AUTOMATIC1111 settings in PNG, JPEG and WebP files, ComfyUI or Flux workflows in PNG, and InvokeAI creation records in PNG. Different InvokeAI main/style prompts are not combined into a claimed original prompt. Not every workflow has a single recoverable prompt. Saved details are editable and can be absent from screenshots or exported copies. A missing saved prompt is not a finding of human authorship.

The original filename is replaced with a generic name during upload. Unlike the check example, this command deliberately prints the prompt; keep private prompts out of shared logs. The prompt endpoint processes the image on isGenAI's server and does not add the image or prompt to a public report. Upload and service limits apply.

Try the [paired demonstration images](https://isgenai.com/guides/how-to-check-ai-image#examples) or read the [saved-prompt API reference](https://isgenai.com/api#saved-prompts). These code-drawn fixtures have identical pixels, with and without deliberately saved generation instructions. They illustrate file behavior, not detection accuracy.

## Controlled PNG metadata and workflow lab

The [worked image guides](https://isgenai.com/guides) now include a downloadable [fixture lab](guide-lab). It contains ten PNG files, exact SHA-256 hashes and observed results. The pixels are code-drawn; the prompts, settings and workflow records are deliberately attached demonstration data. This is a record-reading exercise, not an AI accuracy benchmark.

The cases cover:

- One known AUTOMATIC1111-style parameters record in tEXt, zTXt and compressed iTXt chunks.
- An InvokeAI-style record that preserves a zero seed.
- Missing and conflicting saved records.
- Two ComfyUI record types: editable workflow and API graph.
- Byte copies, changed settings and a PNG re-export with identical decoded pixels.

To recreate the inputs and compare bytes and pixels, use Node.js 22+ in a new working directory:

```sh
npm install sharp
node /path/to/isgenai-examples/guide-lab/reproduce.mjs
```

The script downloads two public isGenAI fixture images and writes a new `isgenai-guide-lab` directory. It refuses to overwrite an existing run. It does not upload private files. Record the Sharp version when comparing re-encoded file hashes. Use [results.json](guide-lab/results.json) for the saved-field observations checked by the application reader.

Read the [PNG text-record guide](https://isgenai.com/guides/png-text-records), [ComfyUI graph guide](https://isgenai.com/guides/comfyui-editor-api-graphs) or [copy-versus-export guide](https://isgenai.com/guides/image-copy-versus-export). All fixture files, original example code and observations in this lab are CC0-1.0.

## Guides and reusable material

- [API walkthrough](https://isgenai.com/guides/ai-detector-api): how to read results, handle failures and add a review step.
- [API reference](https://isgenai.com/api): endpoints and request formats.
- [AI image detector](https://isgenai.com/ai-image-detector): check a file directly.
- [AI text detector](https://isgenai.com/ai-text-detector): inspect text or code in the browser.
- [Image review worksheet](image-review-worksheet.txt): a reusable source/copy/result log for journalists and researchers.
- [Controlled image example](https://isgenai.com/guides/how-to-check-ai-image#examples): identical pixels with different saved file details, illustrating what changes in the check.

## Local testing

Point the example at a running local deployment:

```sh
ISGENAI_BASE_URL=http://localhost:3000 node check-content.mjs
```

Hosted endpoints must use HTTPS. The script checks HTTP status and response shape. A `429` means wait before retrying; an unavailable check is not an AI/human verdict.

## Validation

The text, code and image request paths were run against the isGenAI application on 9 September 2026. The saved-prompt example was verified against production on 13 September 2026 with the paired demonstration images: `saved` for the labelled copy and `not_found` for the copy without saved instructions. Local regressions also check no provider call, no spend reservation, no reconstructed-cache reuse and no retry on HTTP 429. This validates the integration, not statistical detection accuracy. `NO AI SIGNAL DETECTED` does not establish human authorship, and a file label does not verify that a depicted event happened.

## Reuse

The original example code and worksheet are dedicated to the public domain under CC0-1.0. See [LICENSE](LICENSE). This repository contains examples only; it does not contain production credentials, user uploads or the private application repository.
