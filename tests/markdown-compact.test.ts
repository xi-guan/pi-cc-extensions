import assert from "node:assert/strict";
import test from "node:test";
import { getMarkdownTheme, initTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import { DEFAULT_CONFIG, normalizeConfig, setConfig } from "../extensions/config/config.ts";
import { installMarkdownCompact } from "../extensions/renderer/markdown-compact.ts";

initTheme("dark");

const SOURCE = "## Title\n- item\n\n```ts\nconst a = 1;\n```\n\nafter";
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
const render = () => new Markdown(SOURCE, 0, 0, getMarkdownTheme()).render(40).map(strip);

test("ccstyle on: no blank line after headings and no ``` fence rows", () => {
	setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "on" }));
	const dispose = installMarkdownCompact();
	try {
		assert.deepEqual(render(), ["Title", "- item", "", "  const a = 1;", "", "after"]);
		setConfig(normalizeConfig({ ...DEFAULT_CONFIG, mode: "off" }));
		assert.deepEqual(render().slice(0, 2), ["Title", ""]);
	} finally {
		dispose();
		setConfig(normalizeConfig({ ...DEFAULT_CONFIG }));
	}
	assert.ok(render().includes("```ts"));
});
