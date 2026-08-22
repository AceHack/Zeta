import { describe, expect, test } from "bun:test";

import { sessionReadLogPath, OTTO343_READLOG_TAG } from "./harness";

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
