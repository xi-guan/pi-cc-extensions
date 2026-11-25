import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { AssistantMessageComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { config } from "../extensions/config/config.ts";
import {
	installCompactMode,
	summaryLineLabel,
	summaryLineTools,
} from "../extensions/renderer/compact-mode.ts";
import { collapsedHintHitbox } from "../extensions/renderer/mouse/layout.ts";
import { WriteExecutionMetadataStore } from "../extensions/renderer/tool/diff/write-execution.ts";

initTheme("dark");

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function toolCallMessage(): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{ type: "thinking", thinking: "plan the listing" },
			{ type: "toolCall", id: "call-1", name: "bash", arguments: { command: "ls" } },
		],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: Date.now(),
	} as AssistantMessage;
}

test("summaryLineLabel keeps only time on the right", () => {
	const end = new Date(2026, 0, 1, 0, 5).getTime();
	assert.equal(summaryLineLabel("Ran for 14s, bash×2, read×1", end), "14s · 12:05 AM");
	// the working row below already ticks the time, so the rule does not repeat it
	assert.equal(summaryLineLabel("Running... · 9s, bash×1"), "Running...");
	assert.equal(summaryLineLabel("Running..."), "Running...");
	assert.equal(summaryLineLabel("bash×1"), "");
});

test("summaryLineTools keeps only the tool counts for the left side", () => {
	assert.equal(summaryLineTools("Ran for 14s, bash×2, read×1"), "bash×2, read×1");
	assert.equal(summaryLineTools("Running... · 9s, bash×1"), "bash×1");
	assert.equal(summaryLineTools("Running..."), "");
	assert.equal(summaryLineTools("bash×1"), "bash×1");
});

test("rule hitbox: the whole round rule is clickable, running or done, and a bare horizontal rule is not", () => {
	for (const line of [
		"  bash×1 ──────── Running... 23s",
		"  bash×1 ──────── 32s · 5:02 PM ▸",
		"  ──── ▾",
	]) {
		assert.deepEqual(collapsedHintHitbox(line), { startCol: 3, endCol: line.length }, line);
	}
	assert.equal(collapsedHintHitbox("  ────────────"), null);
});

test("rule style: a running round leads with tool counts and draws no ▸; expanding shows ▾ and opens plain content below it", () => {
	const previous = { mode: config.mode, style: config.compactSummaryStyle };
	config.mode = "compact";
	config.compactSummaryStyle = "rule";
	const hooks = installCompactMode({ writeMetadata: new WriteExecutionMetadataStore() });
	try {
		const message = toolCallMessage();
		const assistant = new AssistantMessageComponent(message, true) as any;
		assistant.updateContent(message);
		const ruleLine = () => {
			assistant.invalidate?.();
			return strip(assistant.render(80).find((line: string) => line.includes("─")) ?? "");
		};
		const collapsed = ruleLine();
		// the tool call has no result yet, so the round is still running
		assert.match(collapsed, /^ *bash×1 ─+ Running\.\.\.$/);
		const hit = collapsedHintHitbox(collapsed);
		assert.ok(hit, collapsed);
		assert.equal(collapsed[hit.startCol - 1], "b");
		assert.equal(hit.endCol, collapsed.trimEnd().length);
		assistant.setExpanded(true);
		assert.match(ruleLine(), /^ *bash×1 ─+ Running\.\.\. ▾$/);
		// expanded content sits right under the rule: no card background, no blank padding row
		const lines: string[] = assistant.render(80);
		const at = lines.findIndex((line) => line.includes("▾"));
		const below = lines.slice(at + 1);
		assert.ok(below.length > 0);
		assert.ok(strip(below[0]).trim().length > 0, JSON.stringify(below[0]));
		assert.ok(!below.some((line) => line.includes("\x1b[48")), JSON.stringify(below));
	} finally {
		hooks.shutdown();
		config.mode = previous.mode;
		config.compactSummaryStyle = previous.style;
	}
});
