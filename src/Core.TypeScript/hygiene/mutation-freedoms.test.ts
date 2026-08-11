import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declareFreedom,
  freedomKey,
  isLive,
  loadAllLedgers,
  loadLedger,
  retractFreedom,
  viewOf,
  type Freedom,
} from "./mutation-freedoms";

// The declared-freedom ledger. Its whole job is to let a surviving mutant COEXIST once someone has
// said why it is free — and to keep disagreement visible instead of averaging it away.

const scratch = () => mkdtempSync(join(tmpdir(), "freedoms-"));
const dim = { source: "a.ts", test: "a.test.ts", mutation: "gte-to-gt" };
const mk = (over: Partial<Freedom> = {}): Freedom => ({
  ...dim,
  reason: "boundary is genuinely unconstrained here",
  declaredAt: "2026-08-11T00:00:00.000Z",
  ...over,
});

describe("idempotence — replaying a tick must be free", () => {
  test("declaring the same dimension twice is an UPSERT, not a duplicate", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    const after = declareFreedom(root, "otto", mk({ reason: "revised reason" }));
    expect(after.freedoms.length).toBe(1);
    expect(after.freedoms[0]!.reason).toBe("revised reason");
  });

  test("a missing ledger is EMPTY, never an error — most agents never declare anything", () => {
    expect(loadLedger(scratch(), "nobody").freedoms).toEqual([]);
    expect(loadAllLedgers(scratch())).toEqual([]);
  });

  test("entries are written sorted, so the git diff stays readable", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk({ source: "z.ts" }));
    declareFreedom(root, "otto", mk({ source: "a.ts" }));
    const raw = readFileSync(join(root, "db/mutation-freedoms/otto.json"), "utf8");
    expect(raw.indexOf("a.ts")).toBeLessThan(raw.indexOf("z.ts"));
  });
});

describe("preservation — near-extinct records are kept, not deleted", () => {
  test("retraction MARKS the entry; the record survives so it can be resurrected", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    const after = retractFreedom(root, "otto", dim, "turned out to matter");

    // Still there — this is the point. Deleting would destroy the fact that it was once free.
    expect(after.freedoms.length).toBe(1);
    expect(isLive(after.freedoms[0]!)).toBe(false);
    expect(after.freedoms[0]!.retractedReason).toBe("turned out to matter");
    // ... and the original reason is preserved alongside the retraction, not overwritten.
    expect(after.freedoms[0]!.reason).toBe("boundary is genuinely unconstrained here");
  });

  test("a retracted freedom no longer SUPPRESSES — inert for reporting, live for history", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    retractFreedom(root, "otto", dim, "no longer free");
    const view = viewOf(loadAllLedgers(root), "otto", dim);
    expect(view.mine).toBeUndefined();
  });

  test("RESURRECTION: re-declaring after retraction makes it live again", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    retractFreedom(root, "otto", dim, "mistake");
    const after = declareFreedom(root, "otto", mk({ reason: "free after all", declaredAt: "2026-09-01T00:00:00.000Z" }));
    expect(after.freedoms.length).toBe(1);
    expect(isLive(after.freedoms[0]!)).toBe(true);
  });
});

describe("the rainbow — disagreement is preserved, not resolved", () => {
  test("each declarer's own view decides; two declarers legitimately differ", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk({ reason: "free, by my model of this code" }));
    declareFreedom(root, "vera", mk({ source: "b.ts" })); // vera has a ledger, but not THIS dimension

    const ottoView = viewOf(loadAllLedgers(root), "otto", dim);
    const veraView = viewOf(loadAllLedgers(root), "vera", dim);

    // Same dimension, same evidence, opposite reportability — and both are correct.
    expect(ottoView.mine).toBeDefined();
    expect(veraView.mine).toBeUndefined();
    expect(veraView.othersDeclaring).toEqual(["otto"]);
  });

  test("CONTESTED is surfaced: some declare it free, some do not", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    declareFreedom(root, "vera", mk({ source: "b.ts" }));
    expect(viewOf(loadAllLedgers(root), "otto", dim).contested).toBe(true);
  });

  test("unanimity is NOT contested — agreement is not a finding", () => {
    const root = scratch();
    declareFreedom(root, "otto", mk());
    declareFreedom(root, "vera", mk());
    expect(viewOf(loadAllLedgers(root), "otto", dim).contested).toBe(false);
  });

  test("SILENCE IS NOT DISSENT — a declarer with no ledger is not counted as disagreeing", () => {
    // Same discipline as SymmetricEndurance: absence of corroboration is never evidence against.
    // Only declarers who actually keep a ledger participate.
    const root = scratch();
    declareFreedom(root, "otto", mk());
    const view = viewOf(loadAllLedgers(root), "otto", dim);
    expect(view.contested).toBe(false); // otto is the only ledger-holder, and otto declares it
  });
});

describe("keys and safety", () => {
  test("the natural key is (source, test, mutation) and excludes the declarer", () => {
    // The same dimension IS the same dimension across declarers — that is what makes disagreement
    // about it expressible at all.
    expect(freedomKey(dim)).toBe("a.ts::a.test.ts::gte-to-gt");
  });

  test("declarer names that would escape the ledger directory are refused", () => {
    expect(() => loadLedger(scratch(), "../../etc/passwd")).toThrow(/unsafe declarer/);
  });
});
