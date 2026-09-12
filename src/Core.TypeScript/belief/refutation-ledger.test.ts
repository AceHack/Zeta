// refutation-ledger.test.ts -- falsifiers for the refutation ledger.
//
// Verified by reverting each behaviour and watching the named test go red; the mutants are in
// `MUTANTS` and in the PR body. The CONTROL block is first for the same reason as in
// `dual-score.test.ts`: a `buildRow` that refuses everything passes every refusal test here.
//
// Filesystem tests write into a fresh `mkdtempSync` directory and never touch the repository.

import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LEDGER_ROOT,
  buildRow,
  byClaim,
  claimId,
  loadLedger,
  renderBriefing,
  rowBytes,
  rowPath,
  validateRow,
  writeRow,
  type RefutationDraft,
  type RefutationRow,
} from "./refutation-ledger";
import { contradiction, ignorance } from "./dual-score";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import { compareCodePoints } from "../federated-identity/ports";

export const MUTANTS = [
  "buildRow-refuses-everything",
  "rowPath-writes-one-flat-directory",
  "claimId-concatenates-instead-of-length-prefixing",
  "validateRow-trusts-the-stored-id",
  "writeRow-overwrites-on-EEXIST",
  "loadLedger-silently-skips-unreadable-rows",
  "writeRow-overwrites-when-bodies-differ",
  "rowBytes-drops-the-canonical-key-order",
] as const;

const DRAFT: RefutationDraft = {
  at: "2026-09-11T10:00:00.000Z",
  by: "shadow",
  surface: "src/Core.TypeScript/child-floor",
  hypothesis: "process.stdin.resume() keeps a detached child alive",
  refutedBy: 'under stdio: "ignore" stdin is /dev/null, so the read hits EOF immediately',
  witness: "child exits within one tick with the resume() call present",
  score: { trueChance: 0, falseChance: 0.95 },
};

const build = (over: Partial<RefutationDraft> = {}): RefutationRow => {
  const r = buildRow({ ...DRAFT, ...over });
  if (!r.ok) throw new Error(`fixture is not constructible: ${r.refusal.detail}`);
  return r.row;
};

const tmpRoots: string[] = [];
const freshRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "zeta-refutation-"));
  tmpRoots.push(root);
  return root;
};
afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

// ============================================================================================
// CONTROL
// ============================================================================================

describe("CONTROL: buildRow ACCEPTS a well-formed draft", () => {
  it("builds a row and mints two canonical ZetaIds", () => {
    const r = buildRow(DRAFT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isCanonicalZetaIdHex(r.row.id)).toBe(true);
    expect(isCanonicalZetaIdHex(r.row.claim)).toBe(true);
    expect(r.row.id).not.toBe(r.row.claim);
  });

  it("accepts every mass shape, including a contradictory row", () => {
    expect(buildRow({ ...DRAFT, score: { trueChance: 0, falseChance: 0 } }).ok).toBe(true);
    expect(buildRow({ ...DRAFT, score: { trueChance: 0.5, falseChance: 0.5 } }).ok).toBe(true);
    expect(buildRow({ ...DRAFT, score: { trueChance: 0.9, falseChance: 0.9 } }).ok).toBe(true);
  });
});

// ============================================================================================
// REFUSALS -- mutant: buildRow-refuses-everything is caught by the CONTROL above
// ============================================================================================

describe("buildRow refuses rows a future reader could not act on", () => {
  it("refuses an empty or whitespace-only text field, naming it", () => {
    for (const field of ["by", "surface", "hypothesis", "refutedBy", "witness"] as const) {
      const r = buildRow({ ...DRAFT, [field]: "   " });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.refusal.reason).toBe("empty-field");
        expect(r.refusal.field).toBe(field);
      }
    }
  });

  it("refuses an out-of-range score through the primitive's own constructor", () => {
    const r = buildRow({ ...DRAFT, score: { trueChance: 2, falseChance: 0 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("bad-score");
  });

  it("refuses a local-offset instant, because it would partition by the writer's timezone", () => {
    for (const at of ["2026-09-11T10:00:00+02:00", "2026-09-11", "2026-09-11T10:00:00Z", "yesterday"]) {
      const r = buildRow({ ...DRAFT, at });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal.reason).toBe("bad-instant");
    }
  });
});

// ============================================================================================
// PARTITIONING -- mutant: rowPath-writes-one-flat-directory
// ============================================================================================

describe("storage is date-partitioned, one file per row -- NEVER a single file", () => {
  it("puts a row at db/refutations/YYYY/MM/DD/<id>.json", () => {
    const row = build();
    expect(rowPath(row)).toBe(join(LEDGER_ROOT, "2026", "09", "11", `${row.id}.json`));
  });

  it("routes rows from different days into different directories", () => {
    const a = build({ at: "2026-09-11T23:59:59.999Z" });
    const b = build({ at: "2026-09-12T00:00:00.000Z" });
    const dirOf = (r: RefutationRow): string => rowPath(r).slice(0, rowPath(r).lastIndexOf("/"));
    expect(dirOf(a)).not.toBe(dirOf(b));
    expect(dirOf(a)).toBe(join(LEDGER_ROOT, "2026", "09", "11"));
    expect(dirOf(b)).toBe(join(LEDGER_ROOT, "2026", "09", "12"));
  });

  it("the path has four segments below the root -- year, month, day, file", () => {
    // A flat `db/refutations/<id>.json` layout passes "one file per row" and still fails the
    // requirement, so the DEPTH is asserted, not just the file-per-row part.
    const rel = rowPath(build());
    expect(rel.startsWith(`${LEDGER_ROOT}/`)).toBe(true);
    expect(rel.slice(LEDGER_ROOT.length + 1).split("/")).toHaveLength(4);
  });

  it("no row's path is the ledger root itself, nor any fixed filename", () => {
    const paths = new Set([
      rowPath(build()),
      rowPath(build({ at: "2026-10-01T00:00:00.000Z" })),
      rowPath(build({ hypothesis: "something else entirely" })),
    ]);
    expect(paths.size).toBe(3);
  });
});

// ============================================================================================
// IDS -- mutants: claimId-concatenates-instead-of-length-prefixing, validateRow-trusts-the-id
// ============================================================================================

describe("both ids are content addresses that are recomputed, never trusted", () => {
  it("the claim id is shared by two rows about the same hypothesis on the same surface", () => {
    const first = build({ by: "otto", at: "2026-09-11T10:00:00.000Z" });
    const second = build({ by: "alexa", at: "2026-09-12T11:00:00.000Z" });
    expect(second.claim).toBe(first.claim);
    expect(second.id).not.toBe(first.id);
  });

  it("the claim id is length-prefixed, so a boundary shift does not collide", () => {
    // Plain concatenation makes these two equal. The failure is silent under concatenation:
    // two unrelated hypotheses would share a hub key and be grouped as one claim.
    expect(claimId("ab", "c")).not.toBe(claimId("a", "bc"));
    expect(claimId("a b", "c")).not.toBe(claimId("a", "b c"));
  });

  it("the body id changes when any body field changes", () => {
    const base = build();
    for (const over of [
      { by: "someone-else" },
      { witness: "a different witness" },
      { score: { trueChance: 0, falseChance: 0.9 } },
      { at: "2026-09-11T10:00:00.001Z" },
    ] as Partial<RefutationDraft>[]) {
      expect(build(over).id).not.toBe(base.id);
    }
  });

  it("stores top-level keys in canonical code-point order, so a row's diff stays stable", () => {
    // Without this the stored order is whatever object-literal order `buildRow` happened to
    // use, which is deterministic by accident rather than by rule -- and a later refactor
    // would silently reorder every future row against every past one.
    const keys = [...rowBytes(build()).matchAll(/^ {2}"([A-Za-z]+)":/gm)].map((m) => m[1] as string);
    expect(keys).toEqual([...keys].sort(compareCodePoints));
    expect(keys[0]).toBe("at");
    expect(keys).toContain("witness");
  });

  it("validateRow accepts a freshly built row (control for this block)", () => {
    expect(validateRow(JSON.parse(rowBytes(build())) as unknown).ok).toBe(true);
  });

  it("validateRow REFUSES a row whose body was edited after minting", () => {
    const tampered = { ...build(), witness: "a witness nobody recorded" };
    const r = validateRow(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal.reason).toBe("bad-id");
      expect(r.refusal.detail).toContain("does not address");
    }
  });

  it("validateRow REFUSES 32 hex characters that are not a decodable ZetaId", () => {
    const r = validateRow({ ...build(), id: "f".repeat(32) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("bad-id");
  });
});

// ============================================================================================
// IO -- mutants: writeRow-overwrites-on-EEXIST, loadLedger-silently-skips-unreadable-rows
// ============================================================================================

describe("writing is idempotent and never overwrites", () => {
  it("writes a row, then reports the identical re-write as a no-op", () => {
    const root = freshRoot();
    const row = build();
    const first = writeRow(root, row);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.state).toBe("written");
    const second = writeRow(root, row);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.state).toBe("already-identical");
    expect(readFileSync(join(root, rowPath(row)), "utf8")).toBe(rowBytes(row));
  });

  it("REFUSES, without overwriting, when different bytes occupy the same address", () => {
    const root = freshRoot();
    const row = build();
    writeRow(root, row);
    const impostor: RefutationRow = { ...row, witness: "not what was minted" };
    const outcome = writeRow(root, impostor);
    expect(outcome.ok).toBe(false);
    // The original bytes survive -- this is the half that a silent overwrite would destroy.
    expect(readFileSync(join(root, rowPath(row)), "utf8")).toBe(rowBytes(row));
  });
});

describe("loading reports what it could not read", () => {
  it("an absent ledger is an empty ledger, not an error", () => {
    const result = loadLedger(freshRoot());
    expect(result.rows).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it("round-trips written rows, ordered by instant (control for the rejection test)", () => {
    const root = freshRoot();
    const later = build({ at: "2026-09-12T09:00:00.000Z", by: "alexa" });
    const earlier = build({ at: "2026-09-11T09:00:00.000Z", by: "otto" });
    writeRow(root, later);
    writeRow(root, earlier);
    const result = loadLedger(root);
    expect(result.rejected).toHaveLength(0);
    expect(result.rows.map((r) => r.by)).toEqual(["otto", "alexa"]);
  });

  it("walks past a non-directory sitting beside the year folders (a README)", () => {
    const root = freshRoot();
    const row = build();
    writeRow(root, row);
    writeFileSync(join(root, LEDGER_ROOT, "README.md"), "# refutations\n", "utf8");
    const result = loadLedger(root);
    expect(result.rows).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("REPORTS an unreadable or tampered row instead of skipping it", () => {
    const root = freshRoot();
    const row = build();
    writeRow(root, row);
    const dir = join(root, LEDGER_ROOT, "2026", "09", "11");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${"0".repeat(31)}1.json`), "{ not json", "utf8");
    writeFileSync(join(dir, `${"1".repeat(32)}.json`), JSON.stringify({ ...row, id: "1".repeat(32) }), "utf8");
    const result = loadLedger(root);
    expect(result.rows).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
    // A ledger that silently drops its unreadable rows under-reports exactly when something is
    // wrong with it, so the count AND the reasons are asserted.
    expect(result.rejected.every((r) => r.detail.length > 0)).toBe(true);
  });
});

// ============================================================================================
// READING -- the ledger's actual product
// ============================================================================================

describe("byClaim groups without picking a winner", () => {
  const agree = build({ by: "otto", score: { trueChance: 0, falseChance: 0.9 } });
  const disagree = build({
    by: "alexa",
    at: "2026-09-12T10:00:00.000Z",
    score: { trueChance: 0.8, falseChance: 0 },
  });

  it("keeps BOTH rows when two witnesses disagree -- raw vault, not reconciliation", () => {
    const [view] = byClaim([agree, disagree]);
    expect(view?.rows).toHaveLength(2);
    expect(view?.rows.map((r) => r.by).sort()).toEqual(["alexa", "otto"]);
  });

  it("surfaces the disagreement as CONTRADICTION on the toy join, rather than averaging it", () => {
    const [view] = byClaim([agree, disagree]);
    expect(view?.toyJoined).toEqual({ trueChance: 0.8, falseChance: 0.9 });
    expect(contradiction(view?.toyJoined ?? { trueChance: 0, falseChance: 0 })).toBeCloseTo(0.7, 10);
  });

  it("a lone weak row stays IGNORANT rather than being rounded up", () => {
    const weak = build({ score: { trueChance: 0.1, falseChance: 0.2 } });
    const [view] = byClaim([weak]);
    expect(ignorance(view?.toyJoined ?? { trueChance: 1, falseChance: 1 })).toBeCloseTo(0.7, 10);
  });

  it("separates two different hypotheses on the same surface", () => {
    const other = build({ hypothesis: "a completely different proposal" });
    expect(byClaim([agree, other])).toHaveLength(2);
  });
});

describe("renderBriefing states both legs separately and applies no threshold", () => {
  it("says so when there is nothing to report", () => {
    expect(renderBriefing([])).toBe("No refutations recorded.\n");
  });

  it("prints both legs, the shape, and every contributing row", () => {
    const text = renderBriefing(byClaim([build({ by: "otto" })]));
    expect(text).toContain("trueChance 0 / falseChance 0.95");
    expect(text).toContain("ignorant");
    expect(text).toContain("otto");
    expect(text).toContain(DRAFT.hypothesis);
    // No verdict word is applied on the reader's behalf.
    expect(text).not.toContain("leans-");
  });

  it("shouts CONTRADICTION when witnesses disagree, and still prints both rows", () => {
    const text = renderBriefing(
      byClaim([
        build({ by: "otto", score: { trueChance: 0, falseChance: 0.9 } }),
        build({ by: "alexa", at: "2026-09-12T10:00:00.000Z", score: { trueChance: 0.8, falseChance: 0 } }),
      ]),
    );
    expect(text).toContain("CONTRADICTION");
    expect(text).toContain("otto");
    expect(text).toContain("alexa");
    expect(text).toContain("not a fusion rule");
  });
});
