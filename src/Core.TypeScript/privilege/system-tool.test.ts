// system-tool.test.ts — falsifiers for the allowlisted-absolute-path admission check.
//
// Every test below was run against a MUTATED implementation and observed to go red; the
// mutants are listed in the PR body. A test that survives a stubbed implementation is not
// a falsifier, so the negative cases (a rejection that MUST happen) carry the weight here,
// not the happy path.
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  LAUNCHCTL_SPEC,
  identityMismatch,
  realSystemToolEffects,
  resolveSystemTool,
  toolCandidates,
  toolRejectReason,
  type SystemToolEffects,
  type SystemToolSpec,
  type ToolFileFacts,
  type ToolIdentity,
} from "./system-tool";

/** A host described entirely in data. Nothing here touches the real machine. */
function fakeFx(plat: string, files: Record<string, ToolFileFacts>, hashes: Record<string, string> = {}): SystemToolEffects {
  return {
    platform: () => plat,
    stat: (p) => files[p] ?? null,
    realpath: (p) => (files[p] === undefined ? null : p),
    sha256: (p) => hashes[p] ?? (files[p] === undefined ? null : "deadbeef"),
  };
}

const GOOD: ToolFileFacts = { isFile: true, uid: 0, mode: 0o100755, size: 364448, dev: 1, ino: 42 };

describe("toolRejectReason — each refusal is pinned separately", () => {
  test("admits a root-owned, non-group-writable regular file", () => {
    expect(toolRejectReason(GOOD, LAUNCHCTL_SPEC)).toBeNull();
  });

  test("absent file is refused, not skipped", () => {
    expect(toolRejectReason(null, LAUNCHCTL_SPEC)).toBe("absent or unreadable");
  });

  test("a directory named launchctl is not a tool", () => {
    expect(toolRejectReason({ ...GOOD, isFile: false }, LAUNCHCTL_SPEC)).toBe("not a regular file");
  });

  test("non-root owner is refused — this is the hijack shape", () => {
    expect(toolRejectReason({ ...GOOD, uid: 501 }, LAUNCHCTL_SPEC)).toContain("not root-owned");
  });

  test("group-writable is refused even though root owns it", () => {
    expect(toolRejectReason({ ...GOOD, mode: 0o100775 }, LAUNCHCTL_SPEC)).toContain("group- or other-writable");
  });

  test("other-writable is refused even though root owns it", () => {
    expect(toolRejectReason({ ...GOOD, mode: 0o100757 }, LAUNCHCTL_SPEC)).toContain("group- or other-writable");
  });

  test("setuid is NOT required for launchctl — the real binary is 0755", () => {
    // The whole reason this module exists beside elevator.ts. If this flips, the real
    // /bin/launchctl (mode 0755, not setuid) would be rejected on every macOS host.
    expect(LAUNCHCTL_SPEC.requireSetuid).toBe(false);
    expect(toolRejectReason(GOOD, LAUNCHCTL_SPEC)).toBeNull();
  });

  test("setuid IS enforced when a spec asks for it — the predicate is live, not ignored", () => {
    const elevatorish: SystemToolSpec = { ...LAUNCHCTL_SPEC, requireSetuid: true };
    expect(toolRejectReason(GOOD, elevatorish)).toBe("not setuid");
    expect(toolRejectReason({ ...GOOD, mode: 0o104755 }, elevatorish)).toBeNull();
  });
});

describe("allowlist per platform", () => {
  test("darwin allows exactly one location", () => {
    expect(toolCandidates(LAUNCHCTL_SPEC, "darwin")).toEqual(["/bin/launchctl"]);
  });

  test("linux and win32 have NO launchctl — empty, on purpose", () => {
    expect(toolCandidates(LAUNCHCTL_SPEC, "linux")).toEqual([]);
    expect(toolCandidates(LAUNCHCTL_SPEC, "win32")).toEqual([]);
  });

  test("empty allowlist FAILS CLOSED and names the platform", () => {
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fakeFx("linux", {}));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("no allowlisted location");
    expect(r.reason).toContain("linux");
  });
});

describe("resolveSystemTool", () => {
  test("admits the allowlisted path and records an identity", () => {
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fakeFx("darwin", { "/bin/launchctl": GOOD }, { "/bin/launchctl": "aa11" }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.path).toBe("/bin/launchctl");
    expect(r.identity.sha256).toBe("aa11");
    expect(r.identity.ino).toBe(42);
  });

  test("a non-root-owned binary at the allowlisted path is REFUSED", () => {
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fakeFx("darwin", { "/bin/launchctl": { ...GOOD, uid: 501 } }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("a uid-501 launchctl must never be admitted");
    expect(r.rejected[0]?.why).toContain("not root-owned");
  });

  test("refusal reason names PATH explicitly so the reader knows it was not consulted", () => {
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fakeFx("darwin", {}));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("PATH is deliberately NOT consulted");
  });

  test("unreadable contents refuse when the spec asks for a hash", () => {
    const fx: SystemToolEffects = { ...fakeFx("darwin", { "/bin/launchctl": GOOD }), sha256: () => null };
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fx);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.rejected[0]?.why).toContain("contents unreadable");
  });

  test("realpath failure refuses rather than admitting an unresolvable path", () => {
    const fx: SystemToolEffects = { ...fakeFx("darwin", { "/bin/launchctl": GOOD }), realpath: () => null };
    const r = resolveSystemTool(LAUNCHCTL_SPEC, fx);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.rejected[0]?.why).toBe("realpath failed");
  });
});

describe("identity pin — the ONLY thing here that detects substitution", () => {
  const seen: ToolIdentity = { realpath: "/bin/launchctl", dev: 1, ino: 42, size: 364448, mode: 0o100755, uid: 0, sha256: "aa11" };

  test("agreement returns null", () => {
    expect(identityMismatch(seen, { sha256: "aa11", size: 364448 })).toBeNull();
  });

  test("a changed hash is caught and NAMED", () => {
    expect(identityMismatch(seen, { sha256: "bb22" })).toContain("sha256");
  });

  test("a changed inode is caught even when size and hash are unpinned", () => {
    expect(identityMismatch(seen, { ino: 7 })).toContain("ino");
  });

  test("an EMPTY pin checks nothing — stated, so nobody mistakes it for a check", () => {
    // This is the honest limit: with no baseline, identity is an observation only.
    expect(identityMismatch(seen, {})).toBeNull();
  });

  test("resolveSystemTool refuses on pin mismatch", () => {
    const r = resolveSystemTool(
      LAUNCHCTL_SPEC,
      fakeFx("darwin", { "/bin/launchctl": GOOD }, { "/bin/launchctl": "aa11" }),
      { sha256: "not-the-same" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("a pin mismatch must refuse");
    expect(r.rejected[0]?.why).toContain("identity pin mismatch");
  });
});

// ---------------------------------------------------------------------------
// THE PATH-HIJACK TEST. This is the reason the module exists, so it runs against the
// REAL host rather than a described one. It has a control that can come out the other
// way: the same forged binary IS picked up by a PATH-resolved spawn.
const onDarwin = process.platform === "darwin";
/** Typed view of the environment so PATH is a normal property, not an index signature. */
const env = process.env as Record<string, string | undefined>;
describe.if(onDarwin)("PATH hijack (real host, darwin)", () => {
  function forge(): { dir: string; path: string } {
    const dir = mkdtempSync(join(tmpdir(), "zeta-hijack-"));
    const p = join(dir, "launchctl");
    // A forgery that exits 0 and does nothing — the interesting attack, not a crash.
    writeFileSync(p, "#!/bin/sh\nexit 0\n");
    chmodSync(p, 0o755);
    return { dir, path: p };
  }

  test("CONTROL: a PATH-resolved spawn DOES execute the forgery", () => {
    const { dir, path } = forge();
    // DELIBERATE: the next line IS the vulnerability under demonstration. The whole
    // module exists because a PATH-resolved spawn really does execute the forgery.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("launchctl", ["version"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${env.PATH ?? ""}` },
    });
    // The forgery exits 0 with empty stdout; the real launchctl prints a version banner.
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("Bootstrapper");
    // Prove the forgery is what a PATH lookup finds.
    const which = spawnSync("/usr/bin/which", ["launchctl"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${env.PATH ?? ""}` },
    });
    expect(which.stdout.trim()).toBe(path);
  });

  test("the resolver is UNAFFECTED by a hijacked PATH", () => {
    const { dir } = forge();
    const saved = env.PATH;
    try {
      env.PATH = `${dir}:${saved ?? ""}`;
      const r = resolveSystemTool(LAUNCHCTL_SPEC, realSystemToolEffects());
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(r.reason);
      // Not the forgery, and not anywhere near the hijack dir.
      expect(r.path).toBe("/bin/launchctl");
      expect(r.identity.realpath).toBe("/bin/launchctl");
      expect(r.identity.uid).toBe(0);
      expect(r.path.startsWith(dir)).toBe(false);
    } finally {
      if (saved === undefined) delete env.PATH;
      else env.PATH = saved;
    }
  });

  test("the forgery would be REFUSED even if it were somehow allowlisted", () => {
    const { path } = forge();
    const spec: SystemToolSpec = { ...LAUNCHCTL_SPEC, darwin: [path] };
    const r = resolveSystemTool(spec, realSystemToolEffects());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("a user-owned forgery must never be admitted");
    // It is user-owned, so the structural check catches it independently of the allowlist.
    expect(r.rejected[0]?.why).toContain("not root-owned");
  });
});
