/**
 * Clipboard image placeholder: show a pasted screenshot as `[Image #N]` instead of its temp path.
 *
 * pi saves a pasted image to `<tmpdir>/pi-clipboard-<uuid>.<ext>` and inserts that path into the
 * editor; the editor swaps it for a marker, and the `input` hook attaches the image files to the
 * prompt while the text keeps `[Image #N]`. The chat then shows the same marker the editor did,
 * and the model gets the image directly instead of reading the path with a tool call.
 */
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CLIPBOARD_FILE = /^pi-clipboard-[0-9a-f-]{36}\.[a-z0-9]+$/i;
const MARKER = /\[Image #(\d+)\]/g;
const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
};

// numbers keep growing for the whole process so recalled history entries still resolve
const imagePaths = new Map<number, string>();
let lastImageId = 0;

/** Returns `[Image #N]` for a pi clipboard image path, otherwise the text unchanged. */
export function toImagePlaceholder(text: string): string {
	if (path.dirname(text) !== os.tmpdir() || !CLIPBOARD_FILE.test(path.basename(text))) return text;
	lastImageId++;
	imagePaths.set(lastImageId, text);
	return `[Image #${lastImageId}]`;
}

/** Loads the images behind known `[Image #N]` markers, once each, in order of first mention. */
export async function loadPlaceholderImages(
	text: string,
): Promise<{ images: ImageContent[]; missing: string[] }> {
	const ids = [...new Set([...text.matchAll(MARKER)].map((match) => Number(match[1])))];
	const images: ImageContent[] = [];
	const missing: string[] = [];
	for (const id of ids) {
		const file = imagePaths.get(id);
		if (!file) continue;
		const mimeType = MIME_TYPES[path.extname(file).toLowerCase()] ?? "image/png";
		try {
			images.push({ type: "image", data: (await readFile(file)).toString("base64"), mimeType });
		} catch {
			// temp files can be cleaned up by the OS between paste and submit
			missing.push(`[Image #${id}]`);
		}
	}
	return { images, missing };
}

/** Attaches the images behind `[Image #N]` markers to submitted prompts; the text is left as typed. */
export default function imagePlaceholder(pi: ExtensionAPI): void {
	pi.on("input", async (event, ctx) => {
		const { images, missing } = await loadPlaceholderImages(event.text);
		if (missing.length > 0)
			ctx.ui.notify(`Image file gone, not sent: ${missing.join(", ")}`, "warning");
		if (images.length === 0) return undefined;
		return { action: "transform", text: event.text, images: [...(event.images ?? []), ...images] };
	});
}
