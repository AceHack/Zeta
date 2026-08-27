// defender-exclusions.test.ts -- the falsifiers.
//
// One property carries this tool, and it is the kind that is trivially asserted and rarely tested:
//
//     WITHOUT `--apply`, NOTHING ON THE HOST CHANGES.
//
// Reading the source and seeing an early `return 0` is not evidence -- the guard could sit below a
// mutating line, an `mdatp` call could slip in above it during a later edit, or `--apply` could be
// defaulted to true by a typo. The honest check is a `Host` that RECORDS every invocation, run both
// ways, compared.
//
// The injected `Host` is also what makes the apply path testable at all. Real `mdatp` would make a
// genuine security change to the developer's machine, which a test must never do.

import { describe, expect, test } from "bun:test";
import { apply, candidates, main, renderProposal, type Host } from "./defender-exclusions.ts";

const HOME = "/home/tester";

/** Directories that exist, plus a recorder for every mdatp call. */
function hostOf(opts: {
  dirs?: readonly string[];
  withMdatp?: boolean;
  addFails?: boolean;
  listEcho?: boolean;
}): { host: Host; calls: string[][] } {
  const dirs = new Set(
    opts.dirs ?? [
      `${HOME}/Documents/src/repos`,
      `${HOME}/.nuget/packages`,
      `${HOME}/.dotnet`,
      `${HOME}/zeta-wt-alpha`,
      `${HOME}/zeta-wt-beta`,
    ],
  );
  const calls: string[][] = [];
  const added: string[] = [];
  const host: Host = {
    isDir: (p) => dirs.has(p),
    list: (p) =>
      p === HOME
        ? [...dirs].filter((d) => d.startsWith(`${HOME}/zeta-wt-`)).map((d) => d.slice(HOME.length + 1))
        : [],
    mdatp:
      opts.withMdatp === false
        ? null
        : (args) => {
            calls.push([...args]);
            if (args[0] === "exclusion" && args[1] === "folder" && args[2] === "add") {
              if (opts.addFails === true) return { ok: false, stdout: "" };
              added.push(args[4] ?? "");
              return { ok: true, stdout: "" };
            }
            // `listEcho: false` models the managed-host case: the add reports success and the
            // exclusion is silently not held.
            return { ok: true, stdout: opts.listEcho === false ? "" : added.join("\n") };
          },
  };
  return { host, calls };
}

const sink = (): { log: (s: string) => void; out: () => string } => {
  const lines: string[] = [];
  return { log: (s) => lines.push(s), out: () => lines.join("\n") };
};

describe("without --apply, nothing on the host changes", () => {
  test("the default invocation NEVER calls mdatp", () => {
    // The load-bearing test. A mutating line above the dry-run guard, or `--apply` defaulted on by
    // typo, fails here and nowhere else.
    const { host, calls } = hostOf({});
    const s = sink();
    expect(main([], HOME, host, s.log)).toBe(0);
    expect(calls).toEqual([]);
    expect(s.out()).toContain("DRY RUN");
  });

  test("an explicit --dry-run also never calls mdatp", () => {
    const { host, calls } = hostOf({});
    main(["--dry-run"], HOME, host, sink().log);
    expect(calls).toEqual([]);
  });

  test("--apply DOES call it -- otherwise the tests above pass on a tool that does nothing", () => {
    // The control, and it earned its place: an earlier version of this suite ran against a sandbox
    // containing none of the target directories, so the apply path was skipped entirely and both
    // assertions above were passing VACUOUSLY -- a guard proven by a system that could not act.
    const { host, calls } = hostOf({});
    expect(main(["--apply"], HOME, host, sink().log)).toBe(0);
    expect(calls.some((c) => c[0] === "exclusion" && c[2] === "add")).toBe(true);
  });
});

describe("the read-back is a measurement, not the add's own exit code", () => {
  test("adds that SUCCEED but are not held afterwards are reported, and the run fails", () => {
    // The managed-host case, and the reason `apply` re-reads at all: policy can silently override a
    // local add, which still exits 0. Trusting the return value would report a completed change
    // that did not happen.
    const { host } = hostOf({ listEcho: false });
    const s = sink();
    expect(main(["--apply"], HOME, host, s.log)).toBe(1);
    expect(s.out()).toContain("NOT PRESENT after apply");
    expect(s.out()).toContain("silently overridden");
  });

  test("a failing add is collected, not thrown -- one rejection must not strand the rest", () => {
    const { host } = hostOf({ addFails: true });
    const r = apply(candidates(HOME, host), host);
    expect(r.applied).toBe(0);
    expect(r.failed.length).toBeGreaterThan(1);
  });
});

describe("the worktree glob replaces enumeration", () => {
  test("many worktrees collapse to ONE wildcard entry", () => {
    const dirs = [`${HOME}/.dotnet`, ...Array.from({ length: 40 }, (_, i) => `${HOME}/zeta-wt-${i}`)];
    const { host } = hostOf({ dirs });
    const cs = candidates(HOME, host);
    const globs = cs.filter((c) => c.isGlob);
    expect(globs).toHaveLength(1);
    expect(globs[0]?.path).toBe(`${HOME}/zeta-wt-*`);
    expect(globs[0]?.reason).toContain("40 present");
    // And no worktree appears literally -- the whole point of the collapse.
    expect(cs.filter((c) => c.path.includes("zeta-wt-") && !c.isGlob)).toHaveLength(0);
  });

  test("with NO worktrees the glob is absent -- it is not proposed unconditionally", () => {
    const { host } = hostOf({ dirs: [`${HOME}/.dotnet`] });
    expect(candidates(HOME, host).filter((c) => c.isGlob)).toHaveLength(0);
  });
});

describe("the cost is stated before anything is proposed", () => {
  test("the proposal says exclusions are NOT scanned, unprompted", () => {
    // An exclusion list advertising only its speed benefit is a security change wearing a
    // performance costume. The warning is part of the deliverable, so it is pinned.
    const { host } = hostOf({});
    const out = renderProposal(candidates(HOME, host), host);
    expect(out).toMatch(/NOT scanned/i);
    expect(out).toMatch(/NOT on a server or shared host/i);
  });

  test("every proposed path carries a reason", () => {
    const { host } = hostOf({});
    for (const c of candidates(HOME, host)) expect(c.reason.length).toBeGreaterThan(20);
  });

  test("an absent literal path is marked absent and never sent to mdatp", () => {
    const { host, calls } = hostOf({ dirs: [`${HOME}/.dotnet`] });
    expect(renderProposal(candidates(HOME, host), host)).toContain("[ABSENT");
    main(["--apply"], HOME, host, sink().log);
    const sent = calls.filter((c) => c[2] === "add").map((c) => c[4]);
    expect(sent).toEqual([`${HOME}/.dotnet`]);
  });
});

describe("platform detection fails closed and stays loud", () => {
  test("with no mdatp it exits 0, says so, and calls nothing", () => {
    // A no-op is correct when the product is absent. Announcing it is what stops a silent success
    // from reading as a completed change.
    const { host, calls } = hostOf({ withMdatp: false });
    const s = sink();
    expect(main(["--apply"], HOME, host, s.log)).toBe(0);
    expect(s.out()).toContain("mdatp NOT FOUND");
    expect(calls).toEqual([]);
  });

  test("the proposal still prints -- review must not require the product", () => {
    const { host } = hostOf({ withMdatp: false });
    const s = sink();
    main([], HOME, host, s.log);
    expect(s.out()).toMatch(/proposed antivirus scan exclusions/i);
  });
});

describe("argument handling refuses what it does not understand", () => {
  test("an unknown flag exits 2 rather than being ignored", () => {
    // Silently ignoring `--aply` would run the dry path while the operator believed they had
    // applied -- a typo becoming a false report of a completed change.
    const { host, calls } = hostOf({});
    const s = sink();
    expect(main(["--aply"], HOME, host, s.log)).toBe(2);
    expect(s.out()).toContain("unknown argument");
    expect(calls).toEqual([]);
  });
});

describe("re-running is safe", () => {
  test("two --apply runs issue identical adds -- no accumulation", () => {
    const a = hostOf({});
    const b = hostOf({});
    main(["--apply"], HOME, a.host, sink().log);
    main(["--apply"], HOME, b.host, sink().log);
    expect(a.calls).toEqual(b.calls);
    // Non-empty, or this compares two blanks.
    expect(a.calls.length).toBeGreaterThan(1);
  });
});
