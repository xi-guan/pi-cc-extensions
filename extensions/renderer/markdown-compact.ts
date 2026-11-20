/**
 * Claude Code 式紧凑 Markdown：标题后不留空行，代码块不画 ``` 围栏行（代码本身已缩进 + 高亮）。
 *
 * pi 的 Markdown 没有这两个开关，只能 patch 私有的 Markdown.prototype.renderToken；
 * mode=off 时原样返回。
 */
import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import { config } from "../config/config.ts";
import { MARKDOWN_COMPACT_PATCH, patchRegistry } from "../utils/patch-keys.ts";

type MarkdownToken = { type: string; lang?: string };
type RenderToken = (
	this: { theme: MarkdownTheme },
	token: MarkdownToken,
	width: number,
	nextTokenType?: string,
	styleContext?: unknown,
) => string[];
type CompactPatch = { active: boolean; dispose: () => void };

/** 安装 renderToken 补丁，返回 dispose（/reload 链安全）。 */
export function installMarkdownCompact(): () => void {
	patchRegistry.get<CompactPatch>(MARKDOWN_COMPACT_PATCH)?.dispose();
	const prototype = Markdown.prototype as unknown as { renderToken: RenderToken };
	const original = prototype.renderToken;
	const patch: CompactPatch = { active: true, dispose: () => {} };
	const installed: RenderToken = function (token, width, nextTokenType, styleContext) {
		const lines = original.call(this, token, width, nextTokenType, styleContext);
		if (!patch.active || config.mode === "off") return lines;
		if (token.type === "heading") return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
		if (token.type !== "code") return lines;
		const open = this.theme.codeBlockBorder(`\`\`\`${token.lang || ""}`);
		const close = this.theme.codeBlockBorder("```");
		// 代码行都带缩进，不会和围栏行相等。
		return lines.filter((line, i) => !(i === 0 && line === open) && line !== close);
	};
	prototype.renderToken = installed;
	patch.dispose = () => {
		patch.active = false;
		if (prototype.renderToken === installed) prototype.renderToken = original;
		patchRegistry.dispose(MARKDOWN_COMPACT_PATCH, patch);
	};
	patchRegistry.install(MARKDOWN_COMPACT_PATCH, patch);
	return patch.dispose;
}
