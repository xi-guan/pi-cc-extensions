import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	loadPlaceholderImages,
	toImagePlaceholder,
} from "../extensions/feature/shell/image-placeholder.ts";

function clipboardFile(bytes: string): string {
	const file = path.join(os.tmpdir(), `pi-clipboard-${randomUUID()}.png`);
	writeFileSync(file, bytes);
	return file;
}

test("pasted clipboard images become markers whose images are attached on submit", async () => {
	const first = clipboardFile("first");
	const second = clipboardFile("second");
	try {
		const a = toImagePlaceholder(first);
		const b = toImagePlaceholder(second);
		assert.match(a, /^\[Image #\d+\]$/);
		assert.notEqual(a, b);
		const { images, missing } = await loadPlaceholderImages(`${b} 和 ${a} 再看 ${b}`);
		assert.deepEqual(missing, []);
		assert.deepEqual(
			images.map((image) => [Buffer.from(image.data, "base64").toString(), image.mimeType]),
			[
				["second", "image/png"],
				["first", "image/png"],
			],
		);
	} finally {
		rmSync(first, { force: true });
		rmSync(second, { force: true });
	}
});

test("reports markers whose temp file is gone", async () => {
	const file = clipboardFile("gone");
	const marker = toImagePlaceholder(file);
	rmSync(file);
	assert.deepEqual(await loadPlaceholderImages(marker), { images: [], missing: [marker] });
});

test("leaves other inserted text and unknown markers alone", async () => {
	assert.equal(toImagePlaceholder("hello"), "hello");
	assert.equal(toImagePlaceholder("/Users/me/shot.png"), "/Users/me/shot.png");
	const elsewhere = `/elsewhere/pi-clipboard-${randomUUID()}.png`;
	assert.equal(toImagePlaceholder(elsewhere), elsewhere);
	assert.deepEqual(await loadPlaceholderImages("see [Image #99999]"), { images: [], missing: [] });
});
