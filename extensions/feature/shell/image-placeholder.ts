/**
 * Clipboard image placeholder: show a pasted screenshot as `[Image #N]` instead of its temp path.
 *
 * pi saves a pasted image to `<tmpdir>/pi-clipboard-<uuid>.<ext>` and inserts that path into the
 * editor; the editor swaps it for a marker and the `input` hook swaps the marker back before the
 * prompt reaches the model, so the model still sees the real path.
 */
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CLIPBOARD_FILE = /^pi-clipboard-[0-9a-f-]{36}\.[a-z0-9]+$/i;
const MARKER = /\[Image #(\d+)\]/g;

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

/** Replaces known `[Image #N]` markers with their file paths; unknown markers stay as typed. */
export function expandImagePlaceholders(text: string): string {
	return text.replace(MARKER, (marker, id: string) => imagePaths.get(Number(id)) ?? marker);
}

/** Expands image markers in submitted prompts before pi processes them. */
export default function imagePlaceholder(pi: ExtensionAPI): void {
	pi.on("input", (event) => {
		const text = expandImagePlaceholders(event.text);
		return text === event.text ? undefined : { action: "transform", text };
	});
}
