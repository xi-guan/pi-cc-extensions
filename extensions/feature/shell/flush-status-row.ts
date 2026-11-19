/**
 * Working / retry / compaction 状态行顶格：spinner 从第 0 列开始，与输入框 `❯` 对齐。
 *
 * pi 的状态行是 Loader（Text，paddingX=1），行首留一个空格。StatusIndicator 没有导出，
 * 只能 patch Loader.prototype.render，用实例上的 `kind` 只认 pi 的状态行，其他 Loader 不动。
 */
import { Loader } from "@earendil-works/pi-tui";
import { FLUSH_STATUS_ROW_PATCH, patchRegistry } from "../../utils/patch-keys.ts";

const STATUS_KINDS = new Set(["working", "retry", "compaction", "branchSummary"]);

type FlushPatch = { active: boolean; dispose: () => void };

/** 安装 Loader.render 补丁，返回 dispose（/reload 链安全）。 */
export function installFlushStatusRow(): () => void {
	patchRegistry.get<FlushPatch>(FLUSH_STATUS_ROW_PATCH)?.dispose();
	const prototype = Loader.prototype as unknown as { render: (width: number) => string[] };
	const original = prototype.render;
	const patch: FlushPatch = { active: true, dispose: () => {} };
	const installed = function (this: { kind?: unknown }, width: number): string[] {
		const lines = original.call(this, width);
		if (!patch.active || !STATUS_KINDS.has(this.kind as string)) return lines;
		// 行首 padding 空格挪到行尾，行宽不变。
		return lines.map((line) => (line.startsWith(" ") ? `${line.slice(1)} ` : line));
	};
	prototype.render = installed;
	patch.dispose = () => {
		patch.active = false;
		if (prototype.render === installed) prototype.render = original;
		patchRegistry.dispose(FLUSH_STATUS_ROW_PATCH, patch);
	};
	patchRegistry.install(FLUSH_STATUS_ROW_PATCH, patch);
	return patch.dispose;
}
