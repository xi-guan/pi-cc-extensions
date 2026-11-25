import assert from "node:assert/strict";
import test from "node:test";
import { ExtensionSelectorComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { installDialogSelector } from "../extensions/feature/shell/dialog-selector.ts";
import { stripAnsi } from "../extensions/utils/ansi-text.ts";

initTheme("dark");

// tags instead of colours, so a test reads which part got which style
const theme = {
	fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
	bold: (text: string) => `<b>${text}</b>`,
};

function confirm(onSelect: (option: string) => void = () => {}): ExtensionSelectorComponent {
	const title =
		"agent-guard: bash\nls ~/.config/agents\n\n命令里提到了 ~/.config/agents, 看不出是读还是改";
	return new ExtensionSelectorComponent(title, ["Yes", "No"], onSelect, () => {});
}

const lines = (selector: ExtensionSelectorComponent) =>
	selector.render(100).map((line) => stripAnsi(line).trimEnd());

test("rows are numbered with ❯ on the selection, and only the title's first line is accent", () => {
	const dispose = installDialogSelector(theme);
	try {
		const rendered = lines(confirm());
		assert.ok(rendered.includes(" <accent>❯ 1. Yes</accent>"), rendered.join("\n"));
		assert.ok(rendered.includes("   <text>2. No</text>"), rendered.join("\n"));
		assert.ok(rendered.includes(" <accent><b>agent-guard: bash</b></accent>"), rendered.join("\n"));
		assert.ok(rendered.includes(" <text>ls ~/.config/agents</text>"), rendered.join("\n"));
	} finally {
		dispose();
	}
});

test("a digit picks its row directly, and a digit past the last row does nothing", () => {
	const dispose = installDialogSelector(theme);
	try {
		const picked: string[] = [];
		const selector = confirm((option) => picked.push(option));
		selector.handleInput("3");
		selector.handleInput("2");
		assert.deepEqual(picked, ["No"]);
	} finally {
		dispose();
	}
});

test("dispose gives the dialog back to pi's own → rows", () => {
	installDialogSelector(theme)();
	const rendered = lines(confirm());
	assert.ok(
		rendered.some((line) => line.includes("→ Yes")),
		rendered.join("\n"),
	);
	assert.ok(!rendered.some((line) => line.includes("❯")), rendered.join("\n"));
});
