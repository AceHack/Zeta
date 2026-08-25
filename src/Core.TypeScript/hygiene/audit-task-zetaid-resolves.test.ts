// Falsifiers for AH005. Each case pins a behaviour whose removal turns it red — a test
// that survives a stubbed-out audit is not a falsifier.
//
// The live instance these exist for: `Task: 081M0X0JQGY087G0R000EBCPQ3` was written into a
// commit trailer without being minted. It matches no work-item, it passed the
// AgencySignature gate (which tests SHAPE, not existence), and it was caught only because
// its author happened to re-read his own trailer. That is luck, not a control.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { auditIds, extractTaskIds, indexWorkItems, runAudit } from "./audit-task-zetaid-resolves";

const REAL = "081KSNY2Z0008QG0R002JKH50A";
const FAKE = "081M0X0JQGY087G0R000EBCPQ3";

const roots: string[] = [];
function repoWith(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-ah005-"));
  roots.push(root);
  for (const f of files) {
    const p = join(root, f);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, "# item\n");
  }
  return root;
}
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe("extractTaskIds", () => {
  test("pulls the id out of a real AgencySignature trailer", () => {
    const block = [
      "Agency-Signature-Version: 1",
      "Agent: shadow",
      `Task: ${REAL}`,
      "",
      "Co-authored-by: Aaron Stainback <acehack00@gmail.com>",
    ].join("\n");
    expect(extractTaskIds(block)).toEqual([REAL]);
  });

  test("ignores a Task that is not a ZetaId — that is the shape check's job, not ours", () => {
    expect(extractTaskIds("Task: audit/dla-fractal-dimension-claim")).toEqual([]);
  });

  test("accepts a bare list (the CLI form) when no Task: line is present", () => {
    expect(extractTaskIds(`${REAL} ${FAKE}`).sort()).toEqual([FAKE, REAL].sort());
  });

  test("does not invent ids from prose that merely contains digits", () => {
    expect(extractTaskIds("see PR 15375 and run 32865080118")).toEqual([]);
  });

  test("deduplicates a repeated id", () => {
    expect(extractTaskIds(`Task: ${REAL}\nTask: ${REAL}`)).toEqual([REAL]);
  });
});

describe("indexWorkItems", () => {
  test("indexes an OPEN item", () => {
    const root = repoWith([`workitems/${REAL}-some-slug.md`]);
    expect(indexWorkItems(root).has(REAL)).toBe(true);
  });

  test("indexes a DONE item — state is a FOLDER, so both are valid referents", () => {
    // Checking only the open set would fail every commit whose item has since completed.
    const root = repoWith([`workitems/done/2026/06/${REAL}-some-slug.md`]);
    expect(indexWorkItems(root).has(REAL)).toBe(true);
  });

  test("does NOT index events/ — a different id space that would silently satisfy lookups", () => {
    const root = repoWith([`workitems/events/2026/08/25/${REAL}-thing.md`]);
    expect(indexWorkItems(root).has(REAL)).toBe(false);
  });

  test("requires the id to be the filename PREFIX, not merely present", () => {
    const root = repoWith([`workitems/notes-about-${REAL}.md`]);
    expect(indexWorkItems(root).has(REAL)).toBe(false);
  });

  test("ignores non-markdown files", () => {
    const root = repoWith([`workitems/${REAL}-slug.json`]);
    expect(indexWorkItems(root).has(REAL)).toBe(false);
  });

  test("VACUITY GUARD: a tree with no work-items indexes ZERO, it does not throw or pass", () => {
    const root = repoWith([]);
    mkdirSync(join(root, "workitems"), { recursive: true });
    expect(indexWorkItems(root).size).toBe(0);
  });
});

describe("auditIds", () => {
  test("LIVE INSTANCE: the fabricated id is reported unresolvable", () => {
    const found = auditIds([FAKE], new Set([REAL]));
    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe(FAKE);
    expect(found[0]?.reason).toBe("no-such-workitem");
  });

  test("a minted id is accepted", () => {
    expect(auditIds([REAL], new Set([REAL]))).toHaveLength(0);
  });

  test("reports EVERY unresolvable id, not just the first", () => {
    const other = "081M0000000000000000000000";
    expect(auditIds([FAKE, other], new Set([REAL]))).toHaveLength(2);
  });

  test("CONTROL: with an empty known-set, a real id also fails — so a passing result", () => {
    // ...genuinely depends on the index having been built. If this returned 0 findings the
    // audit could pass by failing to look, which is the defect it exists to refuse.
    expect(auditIds([REAL], new Set())).toHaveLength(1);
  });

  test("no ids to check yields no findings, and invents nothing", () => {
    expect(auditIds([], new Set([REAL]))).toHaveLength(0);
  });
});

describe("runAudit against the real repository", () => {
  test("indexes a non-trivial number of work-items", () => {
    // If this ever reads 0, the runner exits 2 rather than reporting success — pinned here
    // so a refactor that breaks the walk is caught by a test and not by a green CI run.
    expect(runAudit([]).workItemsIndexed).toBeGreaterThan(100);
  });

  test("the fabricated id does not resolve in the real tree", () => {
    expect(runAudit([FAKE]).findings).toHaveLength(1);
  });
});

describe("empty input is NOT a pass", () => {
  test("runAudit reports inputWasEmpty so the caller can refuse it", () => {
    // This file's OWN first CI run passed having examined zero ids: the wiring piped a
    // shallow `git log`, which on a depth-1 checkout is one merge commit with no trailer.
    // "OK — 0 Task id(s); all resolve" is the vacuity class, produced by the audit written
    // to refuse it. The runner now exits 2 on this.
    expect(runAudit([]).inputWasEmpty).toBe(true);
    expect(runAudit([REAL]).inputWasEmpty).toBe(false);
  });

  test("extractTaskIds on text with no trailer yields nothing — which the caller must treat as absence of INPUT, not absence of DEFECT", () => {
    expect(extractTaskIds("Merge pull request #15377 from Lucent-Financial-Group/x")).toEqual([]);
  });
});
