// pi's select and confirm dialogs in claude code's look: `❯ 1. Yes` rows, 1-9 picks a row, only the title's first line in accent
import { ExtensionSelectorComponent, type Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { stripAnsi } from "../../utils/ansi-text.ts";
import { DIALOG_SELECTOR_PATCH, patchRegistry } from "../../utils/patch-keys.ts";

type DialogTheme = Pick<Theme, "fg" | "bold">;

// the private fields of ExtensionSelectorComponent this patch reads
type Selector = {
	options: string[];
	selectedIndex: number;
	listContainer: { clear(): void; addChild(child: Text): void };
	titleText: Text;
	onSelectCallback: (option: string) => void;
};

type SelectorPrototype = {
	updateList(this: Selector): void;
	handleInput(this: Selector, keyData: string): void;
};

type DialogPatch = { active: boolean; dispose: () => void };

/** patches every select and confirm dialog pi shows; returns the dispose (safe across /reload). */
export function installDialogSelector(theme: DialogTheme): () => void {
	patchRegistry.get<DialogPatch>(DIALOG_SELECTOR_PATCH)?.dispose();
	// both methods are private, so the prototype is the only way in
	const prototype = ExtensionSelectorComponent.prototype as unknown as SelectorPrototype;
	const original = { updateList: prototype.updateList, handleInput: prototype.handleInput };
	const patch: DialogPatch = { active: true, dispose: () => {} };
	const titled = new WeakSet<Selector>();
	const updateList = function (this: Selector): void {
		if (!patch.active) return original.updateList.call(this);
		if (!titled.has(this)) {
			titled.add(this);
			restyleTitle(this.titleText, theme);
		}
		renderRows(this, theme);
	};
	const handleInput = function (this: Selector, keyData: string): void {
		const option =
			patch.active && /^[1-9]$/.test(keyData) ? this.options[Number(keyData) - 1] : undefined;
		if (option === undefined) return original.handleInput.call(this, keyData);
		this.onSelectCallback(option);
	};
	prototype.updateList = updateList;
	prototype.handleInput = handleInput;
	patch.dispose = () => {
		patch.active = false;
		if (prototype.updateList === updateList) prototype.updateList = original.updateList;
		if (prototype.handleInput === handleInput) prototype.handleInput = original.handleInput;
		patchRegistry.dispose(DIALOG_SELECTOR_PATCH, patch);
	};
	patchRegistry.install(DIALOG_SELECTOR_PATCH, patch);
	return patch.dispose;
}

// a confirm's title is `title\nmessage`: the message (a guard's command and reason) reads as body text
function restyleTitle(title: Text, theme: DialogTheme): void {
	const setText = title.setText.bind(title);
	// the timeout countdown resets the title in pi's all-accent style every second
	title.setText = (text: string) => {
		const [heading = "", ...body] = stripAnsi(text).split("\n");
		setText(
			[theme.fg("accent", theme.bold(heading)), ...body.map((line) => theme.fg("text", line))].join(
				"\n",
			),
		);
	};
	title.setText((title as unknown as { text: string }).text);
}

// pi's own window: at most this many rows, centred on the selection
const MAX_VISIBLE = 10;

function renderRows(selector: Selector, theme: DialogTheme): void {
	const { options, selectedIndex, listContainer } = selector;
	const start = Math.max(
		0,
		Math.min(selectedIndex - Math.floor(MAX_VISIBLE / 2), options.length - MAX_VISIBLE),
	);
	const end = Math.min(start + MAX_VISIBLE, options.length);
	listContainer.clear();
	for (let i = start; i < end; i++) {
		const row = `${i + 1}. ${options[i]}`;
		const line =
			i === selectedIndex ? theme.fg("accent", `❯ ${row}`) : `  ${theme.fg("text", row)}`;
		listContainer.addChild(new Text(line, 1, 0));
	}
	if (start > 0 || end < options.length) {
		listContainer.addChild(
			new Text(theme.fg("muted", `  (${selectedIndex + 1}/${options.length})`), 0, 0),
		);
	}
}
