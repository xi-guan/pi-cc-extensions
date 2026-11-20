import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { AssistantMessageComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { config } from "../extensions/config/config.ts";
import { installCompactMode, summaryLineLabel } from "../extensions/renderer/compact-mode.ts";
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
	assert.equal(summaryLineLabel("Running... · 9s, bash×1"), "Running... 9s");
	assert.equal(summaryLineLabel("Running..."), "Running...");
	assert.equal(summaryLineLabel("bash×1"), "");
});

test("rule style: a rule with ↓ ends the round; expanding flips it to ↑ and opens plain content below it", () => {
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
		assert.match(collapsed, /^ *─+ [^─]*↓$/);
		assert.ok(!collapsed.includes("bash×"), collapsed);
		const hit = collapsedHintHitbox(collapsed);
		assert.ok(hit, collapsed);
		assert.equal(
			collapsed
				.slice(hit.startCol - 1)
				.trimEnd()
				.endsWith("↓"),
			true,
		);
		assistant.setExpanded(true);
		assert.match(ruleLine(), /↑$/);
		// expanded content sits right under the rule: no card background, no blank padding row
		const lines: string[] = assistant.render(80);
		const at = lines.findIndex((line) => line.includes("↑"));
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
