// Falsifiers for AH007. Each case fails when the behaviour it pins is removed — a test that
// survives a stubbed-out audit is not a falsifier, it is decoration.
//
// The live instances these exist for, both found on 2026-08-25:
//
//  1. An agent building CI reached for `astral-sh/setup-uv` — used nowhere in this repo — with a
//     SHA it invented, and self-disclosed before shipping. Nothing in the tree would have caught
//     it: a fabricated 40-hex SHA is indistinguishable from a real one by shape alone.
//  2. `ruleset-apply.yml` landed the same day pinning `actions/upload-artifact` at
//     `ea165f8d` (2025-03-19) while ten other sites used `043fb46d` (2026-04-10). Both SHAs are
//     real. Nothing was fabricated. The repo simply ran two different versions of one action for
//     a day, and reviewing either told you nothing about the other.
//
// Neither is malice; both are an agent reaching for a remembered value instead of the one in use.
// The roster makes the value checkable instead of remembered.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import {
  auditReferences,
  collectReferences,
  deriveRoster,
  extractReferences,
  readRoster,
  ROSTER_PATH,
  type Roster,
} from "./audit-action-sha-roster";

const SHA_A = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const SHA_B = "ea165f8d65b6e75b540449e92b4886f43607fa02";

const roots: string[] = [];
function repoWith(workflows: Record<string, string>, roster?: Roster): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-ah007-"));
  roots.push(root);
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  for (const [name, body] of Object.entries(workflows)) {
    writeFileSync(join(root, ".github", "workflows", name), body, "utf8");
  }
  if (roster !== undefined) {
    mkdirSync(join(root, "src", "Core.TypeScript", "hygiene"), { recursive: true });
    writeFileSync(join(root, ROSTER_PATH), `${JSON.stringify(roster, null, 2)}\n`, "utf8");
  }
  return root;
}
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe("extractReferences", () => {
  test("finds a pinned third-party action and reports its line", () => {
    const refs = extractReferences("w.yml", `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA_A}\n`);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ action: "actions/checkout", sha: SHA_A, pinned: true, line: 4 });
  });

  test("a commented-out `uses:` runs nothing and is not a reference", () => {
    expect(extractReferences("w.yml", `      # - uses: actions/checkout@${SHA_A}\n`)).toHaveLength(0);
  });

  test("local (`./`) and docker uses are not third-party", () => {
    const src = `      - uses: ./.github/actions/local\n      - uses: docker://alpine:3.19\n`;
    expect(extractReferences("w.yml", src)).toHaveLength(0);
  });

  // The narrow form of this regex silently missed FOUR real actions in this repo
  // (github/codeql-action/{init,analyze,upload-sarif}, actions/cache/restore) because it required
  // `owner/repo@` with no subpath. An action the audit cannot see is an audit that did not run.
  test("an action referenced by SUBPATH is still a third-party action", () => {
    const refs = extractReferences("w.yml", `      - uses: github/codeql-action/init@${SHA_A}\n`);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.action).toBe("github/codeql-action/init");
  });

  // Requiring 40-hex to match would make a mutable tag invisible — the roster would read as
  // enforced over a reference that moves under CI on someone else's schedule.
  test("a mutable tag is captured, and marked unpinned rather than skipped", () => {
    const refs = extractReferences("w.yml", `      - uses: actions/checkout@v4\n`);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ action: "actions/checkout", sha: "v4", pinned: false });
  });
});

describe("auditReferences", () => {
  const roster: Roster = { "actions/checkout": SHA_A };

  test("a reference matching the roster is clean", () => {
    const refs = extractReferences("w.yml", `      - uses: actions/checkout@${SHA_A}\n`);
    expect(auditReferences(refs, roster)).toHaveLength(0);
  });

  // The `ruleset-apply.yml` incident, reproduced.
  test("a real-but-different SHA is caught — nothing has to be fabricated for this to bite", () => {
    const refs = extractReferences("w.yml", `      - uses: actions/checkout@${SHA_B}\n`);
    const f = auditReferences(refs, roster);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ reason: "sha-disagrees-with-roster", rosterSha: SHA_A });
  });

  // The `astral-sh/setup-uv` incident: the SHA's SHAPE is valid, so shape-checking cannot catch it.
  test("an action absent from the roster is refused even though its SHA is well-formed", () => {
    const refs = extractReferences("w.yml", `      - uses: astral-sh/setup-uv@${SHA_A}\n`);
    const f = auditReferences(refs, roster);
    expect(f).toHaveLength(1);
    expect(f[0]?.reason).toBe("not-on-roster");
  });

  test("an unpinned ref is its own finding, never judged against the roster", () => {
    const refs = extractReferences("w.yml", `      - uses: actions/checkout@v4\n`);
    const f = auditReferences(refs, roster);
    expect(f).toHaveLength(1);
    expect(f[0]?.reason).toBe("unpinned-mutable-ref");
  });

  // Per-reference, not per-action: one aggregate line would hide which half of the fleet runs what.
  test("every drifting SITE is named, not just the drifting action", () => {
    const refs = [
      ...extractReferences("a.yml", `      - uses: actions/checkout@${SHA_B}\n`),
      ...extractReferences("b.yml", `      - uses: actions/checkout@${SHA_B}\n`),
    ];
    expect(auditReferences(refs, roster).map((f) => f.file)).toEqual(["a.yml", "b.yml"]);
  });
});

describe("deriveRoster", () => {
  test("conflicting pins are REPORTED, never silently reconciled", () => {
    const refs = [
      ...extractReferences("a.yml", `      - uses: actions/upload-artifact@${SHA_A}\n`),
      ...extractReferences("b.yml", `      - uses: actions/upload-artifact@${SHA_B}\n`),
    ];
    const { conflicts } = deriveRoster(refs);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("actions/upload-artifact");
  });

  test("an unpinned ref contributes no roster entry — a tag is not a SHA to record", () => {
    const refs = extractReferences("a.yml", `      - uses: actions/checkout@v4\n`);
    expect(Object.keys(deriveRoster(refs).roster)).toHaveLength(0);
  });
});

describe("the CLI refuses rather than guesses", () => {
  const CLI = join(import.meta.dir, "audit-action-sha-roster.ts");

  function run(root: string, ...args: string[]) {
    return Bun.spawnSync(["bun", CLI, ...args], { cwd: root, env: { ...process.env, MISE_DISABLE: "1" } });
  }

  test("--write REFUSES on a conflicted tree instead of ratifying whichever pin sorted first", () => {
    const root = repoWith({
      "a.yml": `      - uses: actions/upload-artifact@${SHA_A}\n`,
      "b.yml": `      - uses: actions/upload-artifact@${SHA_B}\n`,
    });
    const r = run(root, "--write");
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toString()).toContain("REFUSING TO WRITE");
    expect(readRoster(root)).toBeNull(); // and wrote nothing
  });

  // Exit 2, not 0: a scan that found nothing is not a clean tree. rc=0 here would be the vacuity
  // class exactly — a check that did not run wearing the face of one that passed.
  test("a workflow dir with zero references exits 2 (configuration error), not 0", () => {
    const root = repoWith({ "a.yml": "jobs:\n  a:\n    steps:\n      - run: echo hi\n" });
    const r = run(root, "--json");
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toString()).toContain("scan that did not run");
  });

  test("a missing roster exits 2 rather than passing an unenforced check", () => {
    const root = repoWith({ "a.yml": `      - uses: actions/checkout@${SHA_A}\n` });
    const r = run(root);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toString()).toContain("no roster");
  });

  test("a clean tree with a matching roster exits 0", () => {
    const root = repoWith(
      { "a.yml": `      - uses: actions/checkout@${SHA_A}\n` },
      { "actions/checkout": SHA_A },
    );
    expect(run(root).exitCode).toBe(0);
  });
});

describe("the live tree", () => {
  // The control that matters: this audit must be running over a real, non-trivial reference set in
  // THIS repo. A green check over an empty scan proves nothing.
  test("scans the real workflow dir and finds a substantial reference set", () => {
    const { refs, workflows } = collectReferences(process.cwd());
    expect(workflows).toBeGreaterThan(50);
    expect(refs.length).toBeGreaterThan(100);
    expect(refs.every((r) => r.pinned)).toBe(true);
  });
});
