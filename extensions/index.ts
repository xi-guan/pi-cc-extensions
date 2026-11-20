import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "./config/config.ts";

// shell
import piAliases from "./feature/shell/aliases.ts";
import { installFlushDockedBash } from "./feature/shell/flush-docked-bash.ts";
import { installFlushStatusRow } from "./feature/shell/flush-status-row.ts";
import customFooter from "./feature/shell/footer.ts";
import imagePlaceholder from "./feature/shell/image-placeholder.ts";
import { applyPromptEditor } from "./feature/shell/prompt-editor.ts";
import piStartupHeader, { installEarlyStartupHeader } from "./feature/shell/startup-header.ts";
import workingMessage from "./feature/shell/working-message.ts";

// feature
import agentAutocomplete from "./feature/reference/subagent.ts";
import agentSummary from "./feature/agent-summary/index.ts";
import context from "./feature/context.ts";
import sessionReference from "./feature/reference/index.ts";
import { installCompactThinking } from "./feature/compact-thinking.ts";
import { installMarkdownCompact } from "./renderer/markdown-compact.ts";

// renderer
import claudeCodeStyle, { getCompactThinkingConfig } from "./renderer/index.ts";
import { MARKDOWN_ENHANCE_MESSAGE_TYPES, transformMarkdown } from "./renderer/markdown-enhance.ts";
import tableCopy from "./renderer/table-copy.ts";

/** One registration per extension: table provenance must not replace enhancement. */
export function configureMarkdownRendering(
	pi: ExtensionAPI,
	{
		enableMarkdownEnhance,
		enableTableCopy,
	}: { enableMarkdownEnhance: boolean; enableTableCopy: boolean },
): void {
	const copy = enableTableCopy ? tableCopy(pi) : undefined;
	if (!enableMarkdownEnhance && !copy) return;
	pi.registerMarkdownTransformer(
		(markdown, context) => {
			copy?.noteSource(context);
			return enableMarkdownEnhance ? transformMarkdown(markdown, context) : markdown;
		},
		{ messageTypes: enableMarkdownEnhance ? MARKDOWN_ENHANCE_MESSAGE_TYPES : ["assistant"] },
	);
}

export default function (pi: ExtensionAPI): void {
	// shell chrome
	if (config.enableAliases) piAliases(pi);
	installFlushDockedBash();
	installEarlyStartupHeader();
	piStartupHeader(pi);
	if (config.enableWorkingMessage) workingMessage(pi);
	customFooter(pi);

	// 输入框 ❯ 提示符：session_start 时按配置应用；setEditorComponent 是一次性替换。
	pi.on("session_start", (_event, ctx) => {
		applyPromptEditor(ctx);
		// 思考块收起时的占位文字，和 Claude Code 一致。
		if (ctx.hasUI) ctx.ui.setHiddenThinkingLabel("✻ Thinking…");
		// Working... 前用静态的 `-`，不转圈。
		if (ctx.hasUI) ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("muted", "-")] });
	});
	// working 状态行顶格，和 ❯ 对齐。
	const disposeFlushStatusRow = installFlushStatusRow();
	// 标题后不空行、代码块不画 ``` 围栏，和 Claude Code 一样紧凑。
	const disposeMarkdownCompact = installMarkdownCompact();
	pi.on("session_shutdown", () => {
		disposeFlushStatusRow();
		disposeMarkdownCompact();
	});
	imagePlaceholder(pi);

	// render stack：thinking controller 直接交给 style 作 query
	// 两个功能独立开关，但共享同一个 transformer 注册槽位。
	configureMarkdownRendering(pi, config);
	claudeCodeStyle(pi, undefined, installCompactThinking(pi, getCompactThinkingConfig()));

	// features
	if (config.enableContextCommand) context(pi);
	if (config.enableSessionReference) sessionReference(pi);
	if (config.enableSubagentAutocomplete) agentAutocomplete(pi);
	if (config.enableAgentSummary) agentSummary(pi);
}
