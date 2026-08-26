// Falsifiers for AH006. Each case pins a behaviour whose removal turns it red — a test
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

  // MENTION IS NOT DECLARATION (2026-08-26).
  //
  // The bare-list fallback used to be guarded by `out.size === 0`, which cannot
  // tell "no task declared anywhere" from "a task declared as `none`". Since
  // `Task: none` is the value essentially every autonomous PR body carries, the
  // fallback fired on nearly all of them, scanned the WHOLE body, and promoted
  // any ZetaId cited in prose into a Task declaration.
  //
  // Live instance: PR #15573 said `Task: none` and mentioned an existing
  // backlog row's id in a sentence. `cross-verify` — a REQUIRED floor — went red
  // on all three of that branch's revisions, for a citation. Citing prior work
  // by id is what `anchor-to-human-prior-art` asks for, and
  // `workitems-mint-with-zetaid` already draws this exact line: "naming an
  // existing legacy id in prose is not minting."
  test("`Task: none` plus an id in PROSE declares NO task — the citation is not a Task id", () => {
    const body = [
      `Background: there is already a P1 row, \`${FAKE}\`, covering this.`,
      "",
      "Agency-Signature-Version: 1",
      "Agent: shadow",
      "Task: none",
      "Co-authored-by: Claude Opus 5 <noreply@anthropic.com>",
    ].join("\n");
    expect(extractTaskIds(body)).toEqual([]);
  });

  test("`Task: none` does not suppress a REAL Task id declared elsewhere in the same text", () => {
    // Guards the fix from over-reaching into "a Task line silences everything".
    const body = [`Task: none`, `Task: ${REAL}`].join("\n");
    expect(extractTaskIds(body)).toEqual([REAL]);
  });

  test("the bare-list fallback still fires when there is genuinely no Task: line", () => {
    // The behaviour the fallback exists for must survive the guard.
    expect(extractTaskIds(`prose around ${REAL} and ${FAKE}`).sort()).toEqual([FAKE, REAL].sort());
  });

  test("an unresolvable id in prose under `Task: none` produces NO finding", () => {
    // The end-to-end statement of the bug, at the level the gate step reads:
    // this is exactly what reddened #15573.
    const body = `See \`${FAKE}\` for context.\n\nTask: none\n`;
    expect(auditIds(extractTaskIds(body), new Set([REAL]))).toEqual([]);
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

describe("empty input is NOT a pass — but NO IDS is a different event", () => {
  // TEST CHANGED 2026-08-25, AND IT WAS PASSING WHEN CHANGED — flagged loudly because
  // altering a green test to admit new behaviour is normally the thing we forbid.
  //
  // It pinned `runAudit([]).inputWasEmpty === true`, i.e. it asserted the CONFLATION of two
  // distinct events: "zero bytes arrived" and "input arrived carrying no ids". Only the
  // first is a broken caller. The second is a real answer about a real PR — a
  // machine-generated telemetry flush has no work-item and legitimately has no Task id.
  //
  // The conflation had a measured cost: every flush PR exited 2, reddening `cross-verify`,
  // blocking the flush, head-of-line blocking its lane, and freezing the drift dashboard
  // for 13 hours behind a green check. The guard was right; its predicate was too broad.
  //
  // PRESENCE of a Task key is the AgencySignature check's job. THIS file checks
  // RESOLVABILITY. That division is why narrowing here loses no coverage.
  test("ZERO BYTES is a broken caller — the shallow-checkout fault this exit path exists for", () => {
    // This file's OWN first CI run passed having examined zero ids: the wiring piped a
    // shallow `git log`, which on a depth-1 checkout is one merge commit with no trailer.
    // "OK — 0 Task id(s); all resolve" is the vacuity class, produced by the audit written
    // to refuse it. That case still exits 2.
    expect(runAudit([], false).inputWasEmpty).toBe(true);
  });

  test("input that ARRIVED but carried no ids is NOT a broken caller", () => {
    const r = runAudit([], true);
    expect(r.inputWasEmpty).toBe(false);
    expect(r.noIdsInInput).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  test("the two flags are independent — a real id sets neither", () => {
    const r = runAudit([REAL], true);
    expect(r.inputWasEmpty).toBe(false);
    expect(r.noIdsInInput).toBe(false);
  });

  test("extractTaskIds on text with no trailer yields nothing — which the caller must treat as absence of INPUT, not absence of DEFECT", () => {
    expect(extractTaskIds("Merge pull request #15377 from Lucent-Financial-Group/x")).toEqual([]);
  });
});
