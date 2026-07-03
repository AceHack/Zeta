import { test, expect } from "bun:test";
import { completeWorkItem } from "./complete-workitem";
import { mintWorkItem } from "./new-workitem";
const MINT_MS = Date.UTC(2026, 0, 15); // created 2026-01-15
const DONE_MS = Date.UTC(2026, 5, 6, 12, 30, 0); // completed 2026-06-06T12:30:00Z
const detEnv = (ms) => ({ nowMs: () => ms, nextInt64: () => 0n });
function mintSample() {
    const m = mintWorkItem({ title: "Wire run-tlaps into CI", type: "task", priority: "P1" }, detEnv(MINT_MS));
    return { m, fromPath: `workitems/${m.filename}` };
}
test("moves to done/YYYY/MM from the COMPLETION date, keeps the filename", () => {
    const { m, fromPath } = mintSample();
    const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
    expect(done.toPath).toBe(`workitems/done/2026/06/${m.filename}`); // completion month, not creation
    expect(done.zetaid).toBe(m.zetaid);
});
test("frontmatter: state → done and completed datetime added (precise, for DORA)", () => {
    const { m, fromPath } = mintSample();
    const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
    expect(done.newContent).toContain("state: done");
    expect(done.newContent).not.toContain("state: backlog");
    expect(done.newContent).toContain("completed: 2026-06-06T12:30:00.000Z");
    // created (from mint) preserved
    expect(done.newContent).toContain("created: 2026-01-15T");
});
test("emits an incremental done-index JSONL line (id, path, completed, title)", () => {
    const { m, fromPath } = mintSample();
    const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
    const entry = JSON.parse(done.indexLine);
    expect(entry.id).toBe(m.zetaid);
    expect(entry.path).toBe(`workitems/done/2026/06/${m.filename}`);
    expect(entry.completed).toBe("2026-06-06T12:30:00.000Z");
    expect(entry.title).toBe("Wire run-tlaps into CI");
    expect(done.indexLine.endsWith("\n")).toBe(true);
});
test("DST: same (content, path, env) replays identically", () => {
    const { m, fromPath } = mintSample();
    const a = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
    const b = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
    expect(a.newContent).toBe(b.newContent);
    expect(a.toPath).toBe(b.toPath);
    expect(a.indexLine).toBe(b.indexLine);
});
test("rejects a non-ZetaId filename and missing state field", () => {
    const { m } = mintSample();
    expect(() => completeWorkItem(m.content, "workitems/not-a-zetaid-at-all.md", detEnv(DONE_MS))).toThrow();
    const noState = m.content.replace(/^state:.*$/m, "# no state");
    expect(() => completeWorkItem(noState, `workitems/${m.filename}`, detEnv(DONE_MS))).toThrow();
});
