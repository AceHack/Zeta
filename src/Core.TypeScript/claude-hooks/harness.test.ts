import { describe, expect, test } from "bun:test";

import { sessionReadLogPath, OTTO343_READLOG_TAG } from "../../../.claude/hooks/harness";

// WHY THIS TEST DOES NOT SIT NEXT TO ITS SUBJECT. It lived at
// `.claude/hooks/harness.test.ts` from 2026-06-21 until 081KZZ1RK6A087G0R003C773WC, and in
// that whole time NOTHING EXECUTED IT. Measured against bun 1.3.14: a test file under a
// dot-prefixed directory is not discovered by a bare `bun test`, and no positional filter
// reaches it either -- bun answers "the following filters did not match any test files".
// Only an explicit `./`-prefixed path argument does. So the gate's whole-suite job
// (`bun test`, gate.yml) could not see it by construction, and the same invisibility held
// for `tsc`: `.claude/hooks/*.ts` was outside the tsconfig program too, because TypeScript's
// wildcard `include` skips dot-prefixed segments. A guard nobody runs is a guard nobody is
// checking, and these are the hooks that run on every agent session.
//
// The subject stays at `.claude/hooks/` because `.claude/settings.json` names it there and
// the harness resolves it by that configured path. The TEST moves instead: adjacency is a
// convenience, execution is the point. `hygiene/unexecuted-test-files.ts` now FAILS on any
// tracked test file under a dot-prefixed path, so this cannot silently recur.

// Regression guard for the Otto-343 read-log re-key fix (2026-06-21).
//
// The original hooks keyed /tmp/zeta-reads-<ppid>.json on process.ppid. On
// remote / Claude-Code-on-the-web sessions every hook runs in a fresh process,
// so the writer (post-read-track) and reader (pre-edit-recent-read) never
// agreed on a filename and every Edit was wrongly denied. The fix keys the log
// on the stable per-session id. These tests pin that behaviour; if read
// tracking ever breaks again, the failing test + OTTO343_READLOG_TAG point
// straight at the cause.
describe("sessionReadLogPath — Otto-343 read-log keying", () => {
  test("same session id ⇒ same path (the property the ppid bug violated)", () => {
    const a = sessionReadLogPath({ session_id: "sess-abc-123" });
    const b = sessionReadLogPath({ session_id: "sess-abc-123" });
    expect(a).toBe(b);
    expect(a).toContain(OTTO343_READLOG_TAG);
    // sonarjs/publicly-writable-directories: this literal is an ASSERTION TARGET, not a path
    // this file writes to. The rule fires here for the first time only because moving the
    // file out of `.claude/` brought it into eslint's scope -- eslint skips dot-prefixed
    // directories by default, the same invisibility that kept the test unexecuted.
    // eslint-disable-next-line sonarjs/publicly-writable-directories
    expect(a.startsWith("/tmp/zeta-reads-")).toBe(true);
  });

  test("different sessions ⇒ different paths (no cross-session bleed)", () => {
    expect(sessionReadLogPath({ session_id: "s1" })).not.toBe(sessionReadLogPath({ session_id: "s2" }));
  });

  test("falls back to cwd when session_id is absent", () => {
    const p = sessionReadLogPath({ cwd: "/home/user/Zeta" });
    expect(p).toBe(sessionReadLogPath({ cwd: "/home/user/Zeta" }));
    expect(p).toContain("home_user_Zeta");
  });

  test("sanitises the key to a single safe component (no path traversal)", () => {
    const p = sessionReadLogPath({ session_id: "../../etc/passwd" });
    // sonarjs/publicly-writable-directories: this assertion IS the safe-use check the rule
    // asks for -- it pins that a traversal-shaped session id stays inside one flat, tagged
    // filename under /tmp and never escapes it (the next three assertions).
    // eslint-disable-next-line sonarjs/publicly-writable-directories
    expect(p.startsWith("/tmp/zeta-reads-")).toBe(true);
    expect(p).not.toContain("..");
    expect(p).not.toContain("/etc/");
    expect(p.endsWith(".json")).toBe(true);
  });

  test("never throws on empty input; degrades to a shared key", () => {
    expect(() => sessionReadLogPath({})).not.toThrow();
    expect(sessionReadLogPath({})).toContain("shared");
  });
});
