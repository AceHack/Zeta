import { test, expect } from "bun:test";
import { completeWorkItem } from "./complete-workitem";
import { mintWorkItem, type WorkItemEnv } from "./new-workitem";

const MINT_MS = Date.UTC(2026, 0, 15); // created 2026-01-15
const DONE_MS = Date.UTC(2026, 5, 6, 12, 30, 0); // completed 2026-06-06T12:30:00Z

const detEnv = (ms: number): WorkItemEnv => ({ nowMs: () => ms, nextInt64: () => 0n });

function mintSample() {
  const m = mintWorkItem({ title: "Wire run-tlaps into CI", type: "task", priority: "P1" }, detEnv(MINT_MS));
  return { m, fromPath: `workitems/${m.filename}` };
}

test("moves to done/YYYY/MM from the COMPLETION date, keeps the filename", () => {
  const { m, fromPath } = mintSample();
  const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
  expect(done.toPath).toBe(`workitems/done/2026/06/${m.filename}`);
  expect(done.zetaid).toBe(m.zetaid);
  expect(done.fromState).toBe("backlog");
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

test("emits NO aggregate index line — the done file is the record (081KZZ3Q990087G0R003QXYVN6)", () => {
  const { m, fromPath } = mintSample();
  const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
  // A shared `done/index.jsonl` append is the conflict class this work removed; the result
  // must carry no serialized aggregate row for a caller to write anywhere.
  expect(Object.keys(done).sort()).toEqual(["fromPath", "fromState", "newContent", "toPath", "zetaid"]);
  // Everything that line held is still on the record itself.
  expect(done.toPath).toBe(`workitems/done/2026/06/${m.filename}`);
  expect(done.newContent).toContain("completed: 2026-06-06T12:30:00.000Z");
  expect(done.newContent).toContain("Wire run-tlaps into CI");
});

test("DST: same (content, path, env) replays identically", () => {
  const { m, fromPath } = mintSample();
  const a = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
  const b = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
  expect(a.newContent).toBe(b.newContent);
  expect(a.toPath).toBe(b.toPath);
});

test("honors custom work-items dir for done path", () => {
  const { m } = mintSample();
  const fromPath = `/tmp/wi/${m.filename}`;
  const done = completeWorkItem(m.content, fromPath, detEnv(DONE_MS));
  expect(done.toPath).toBe(`/tmp/wi/done/2026/06/${m.filename}`);
});

test("rejects a non-ZetaId filename and missing state field", () => {
  const { m } = mintSample();
  expect(() => completeWorkItem(m.content, "workitems/not-a-zetaid-at-all.md", detEnv(DONE_MS))).toThrow();
  const noState = m.content.replace(/^state:.*$/m, "# no state");
  expect(() => completeWorkItem(noState, `workitems/${m.filename}`, detEnv(DONE_MS))).toThrow();
});
