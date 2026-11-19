import assert from "node:assert/strict";
import test from "node:test";
import { Loader } from "@earendil-works/pi-tui";
import { installFlushStatusRow } from "../extensions/feature/shell/flush-status-row.ts";

const tui = { requestRender() {} } as never;
const plain = (s: string) => s;

function loader(kind?: string): Loader {
	const instance = new Loader(tui, plain, plain, "Working...", { frames: ["*"] });
	instance.stop();
	if (kind) Object.assign(instance, { kind });
	return instance;
}

test("pi status rows start at column 0; other loaders keep their padding", () => {
	const dispose = installFlushStatusRow();
	try {
		const [, row] = loader("working").render(20);
		assert.ok(row.startsWith("* Working..."), JSON.stringify(row));
		assert.equal(row.length, 20);
		assert.ok(loader().render(20)[1].startsWith(" * Working..."));
	} finally {
		dispose();
	}
	assert.ok(loader("working").render(20)[1].startsWith(" * Working..."));
});
