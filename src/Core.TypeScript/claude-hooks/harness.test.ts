import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { basename, dirname } from "node:path";

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
    // Assert the INVARIANT -- a tagged log file directly inside the OS temp dir --
    // not the literal "/tmp". Pinning the POSIX spelling is what let the Windows
    // break hide: native Bun resolves a leading `/` against the current drive, so
    // post-read-track's write threw ENOENT, its "non-fatal" catch swallowed it, the
    // log was never created, and pre-edit-recent-read then denied EVERY Edit. A
    // test that pins a platform-specific path cannot catch a platform-specific bug.
    expect(dirname(a)).toBe(tmpdir());
    expect(basename(a).startsWith("zeta-reads-")).toBe(true);
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
    // The safe-use check: a traversal-shaped session id must collapse to ONE flat,
    // tagged filename directly inside the temp dir and never escape it. Expressed
    // via dirname/basename so it holds on every platform, not just POSIX.
    expect(dirname(p)).toBe(tmpdir());
    expect(basename(p).startsWith("zeta-reads-")).toBe(true);
    expect(basename(p)).not.toContain("..");
    // The escape-proof property is the absence of SEPARATORS, not of the word
    // "etc": the traversal is flattened to `______etc_passwd`, which contains
    // "etc" harmlessly and cannot leave the directory. Checking the substring
    // instead would fail on a safe input.
    expect(basename(p)).not.toContain("/");
    expect(basename(p)).not.toContain("\\");
    expect(p.endsWith(".json")).toBe(true);
  });

  test("never throws on empty input; degrades to a shared key", () => {
    expect(() => sessionReadLogPath({})).not.toThrow();
    expect(sessionReadLogPath({})).toContain("shared");
  });
});
