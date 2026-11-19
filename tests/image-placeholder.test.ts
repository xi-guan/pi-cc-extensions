import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	expandImagePlaceholders,
	toImagePlaceholder,
} from "../extensions/feature/shell/image-placeholder.ts";

const clipboardPath = (uuid: string) => path.join(os.tmpdir(), `pi-clipboard-${uuid}.png`);

test("replaces a pi clipboard image path with a numbered marker and expands it back", () => {
	const first = clipboardPath("9c2eaf6a-8d0d-4ddd-9cd9-9ce9b47b7c48");
	const second = clipboardPath("9d8bf441-10b1-4df4-8cbc-8cc9bda2d5b4");
	const a = toImagePlaceholder(first);
	const b = toImagePlaceholder(second);
	assert.match(a, /^\[Image #\d+\]$/);
	assert.notEqual(a, b);
	assert.equal(
		expandImagePlaceholders(`${a} 是否可以显示为 ${b}`),
		`${first} 是否可以显示为 ${second}`,
	);
});

test("leaves other inserted text alone", () => {
	assert.equal(toImagePlaceholder("hello"), "hello");
	assert.equal(toImagePlaceholder("/Users/me/shot.png"), "/Users/me/shot.png");
	assert.equal(
		toImagePlaceholder("/elsewhere/pi-clipboard-9c2eaf6a-8d0d-4ddd-9cd9-9ce9b47b7c48.png"),
		"/elsewhere/pi-clipboard-9c2eaf6a-8d0d-4ddd-9cd9-9ce9b47b7c48.png",
	);
});

test("keeps markers it never issued", () => {
	assert.equal(expandImagePlaceholders("see [Image #99999]"), "see [Image #99999]");
});
