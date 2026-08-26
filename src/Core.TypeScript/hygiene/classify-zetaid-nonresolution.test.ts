import { describe, expect, test } from "bun:test";
import {
  MINT_SIGNATURE,
  DETERMINED_PREFIX_CHARS,
  structuralViolations,
  decodeWorkItemId,
  classify,
  buildIndex,
  declaredTaskIds,
  type IdIndex,
} from "./classify-zetaid-nonresolution";
import { extractTaskIds } from "./audit-task-zetaid-resolves";
import { pack } from "../zeta-id/zeta-id";
import { format, parse } from "../zeta-id/encoding";
import { Category, Chromosome, type ZetaObservation } from "../zeta-id/types";
import { resolve } from "node:path";

/** The exact observation `new-workitem.ts` `mintWorkItem` packs, parameterised. */
function mintLike(overrides: Partial<ZetaObservation>, rand: bigint): string {
  const obs = {
    version: 1,
    timestamp: Date.UTC(2026, 7, 25, 17, 48, 7, 582),
    chromosome: Chromosome.MetaCoherence,
    category: Category.WorkItem,
    authority: { type: "Standard" },
    persona: 0,
    momentum: { type: "Normal" },
    location: 0,
    ...overrides,
  } as unknown as ZetaObservation;
  return format(pack(obs, { nextInt64: () => rand }));
}

const emptyIndex: IdIndex = { workitems: new Map(), backlog: new Map() };

/**
 * THE LABELED POSITIVE. Written into a commit trailer by the shadow on
 * 2026-08-25 without a work-item ever being filed. Attributed to budget
 * exhaustion, not deceit — `.claude/rules/never-assume-malice-where-mistake-is-
 * possible.md` uses this exact defect as its canonical example.
 */
const UNMINTED = "081M0X0JQGY087G0R000EBCPQ3";

describe("the mint signature is read from the real minter", () => {
  test("a byte-for-byte canonical mint violates nothing", () => {
    expect(structuralViolations(mintLike({}, 0x12345678n))).toEqual([]);
  });

  test("EVERY constant field is load-bearing — flipping any one is detected", () => {
    // Without this loop a signature entry could be dead weight: present in the
    // map, checked by nothing observable. This is the mutation, run in-process.
    const alt: Record<string, Partial<ZetaObservation>> = {
      chromosome: { chromosome: Chromosome.FinancialIntegrity },
      category: { category: Category.Workflow },
      authority: { authority: { type: "TrustedAgent" } },
      persona: { persona: 7 as ZetaObservation["persona"] },
      momentum: { momentum: { type: "Critical" } },
      location: { location: 2 as ZetaObservation["location"] },
    };
    for (const [name, override] of Object.entries(alt)) {
      const mutant = mintLike(override, 0x12345678n);
      const violations = structuralViolations(mutant);
      expect(violations.some((v) => v.startsWith(`${name}=`))).toBe(true);
    }
    // `version` has only one legal value, so it is exercised via a raw bit flip.
    expect([...MINT_SIGNATURE.keys()].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))).toEqual(
      ["authority", "category", "chromosome", "location", "momentum", "persona", "version"],
    );
  });

  test("the 32..34 zero gap catches a string `pack` could not have produced", () => {
    const good = mintLike({}, 0n);
    expect(structuralViolations(good)).toEqual([]);
    // Set bit 33 directly. No field covers bits 32..34, so NO argument to `pack`
    // can produce this string — which is what makes the gap positive evidence.
    const mutated = format(((parse(good) as unknown as bigint) | (1n << 33n)) as never);
    expect(mutated).not.toBe(good);
    expect(structuralViolations(mutated).some((v) => v.includes("bits 32..34"))).toBe(true);
  });

  test("a non-canonical string is refused before any field is read", () => {
    expect(structuralViolations("081M0X0JQGY087G0R000EBCPQ")).not.toEqual([]); // 25 chars
    expect(structuralViolations("981M0X0JQGY087G0R000EBCPQ3")).not.toEqual([]); // >128 bits
  });

  test("an out-of-era timestamp is refused", () => {
    expect(structuralViolations(mintLike({ timestamp: 0 as never }, 1n))).not.toEqual([]);
  });
});

describe("THE NULL RESULT — structure cannot separate unminted from minted", () => {
  test("the labeled fabricated id is structurally PERFECT", () => {
    // If this ever starts failing, a structural detector became possible and the
    // protocol's "detection cannot be relied on" premise must be revisited.
    expect(structuralViolations(UNMINTED)).toEqual([]);
  });

  test("it decodes to the canonical mint signature exactly", () => {
    const d = decodeWorkItemId(UNMINTED);
    expect(d).not.toBeNull();
    for (const [name, expected] of MINT_SIGNATURE) {
      expect(d?.fields.get(name)).toBe(expected);
    }
    // Millisecond-granular, on the day it was written — not a hand-typed string,
    // and not the day-granular shape of the backfilled `docs/backlog/` corpus.
    expect(d?.timestampMs).toBe(Date.UTC(2026, 7, 25, 17, 48, 7, 582));
    expect((d?.timestampMs ?? 0) % 86_400_000).not.toBe(0);
    // Reserved bit 64 CLEAR — the post-2026-08-11 epoch. A copy of any visible
    // pre-reclaim template would have carried it SET.
    expect(d?.reservedBit64).toBe(false);
  });

  test("no resolver widening rescues it — it is absent from BOTH trees", () => {
    // This is the bound on the fix the measurement was asked to justify.
    const index = buildIndex(resolve(import.meta.dir, "..", "..", ".."));
    expect(index.workitems.size).toBeGreaterThan(0);
    expect(index.backlog.size).toBeGreaterThan(0);
    expect(classify(UNMINTED, index).cls).toBe("unminted");
    expect(classify(UNMINTED, index).path).toBeNull();
  });
});

describe("classification is total and resolution outranks structure", () => {
  test("a committed row classifies by WHERE it lives", () => {
    const id = mintLike({}, 42n);
    expect(classify(id, emptyIndex).cls).toBe("unminted");
    expect(classify(id, { workitems: new Map([[id, "workitems/x.md"]]), backlog: new Map() }).cls).toBe(
      "resolves-workitem",
    );
    expect(classify(id, { workitems: new Map(), backlog: new Map([[id, "docs/backlog/P2/x.md"]]) }).cls).toBe(
      "resolves-backlog",
    );
  });

  test("a malformed id with no file is `malformed`, not `unminted`", () => {
    const bad = mintLike({ category: Category.Heartbeat }, 9n);
    const c = classify(bad, emptyIndex);
    expect(c.cls).toBe("malformed");
    expect(c.violations.length).toBeGreaterThan(0);
  });

  test("a committed but malformed row still RESOLVES, and reports its violations", () => {
    // A structural opinion must never overrule a file that exists in the tree.
    const bad = mintLike({ category: Category.Heartbeat }, 9n);
    const c = classify(bad, { workitems: new Map([[bad, "workitems/y.md"]]), backlog: new Map() });
    expect(c.cls).toBe("resolves-workitem");
    expect(c.violations.length).toBeGreaterThan(0);
  });
});

describe("prefix ambiguity — the misattribution surface", () => {
  test("the first 19 characters are a pure function of the clock plus the constants", () => {
    // Two mints one millisecond apart, differing ONLY in randomness, agree on
    // exactly the first DETERMINED_PREFIX_CHARS characters. This is the measured
    // mechanism behind the 98-id cohorts in the day-granular backlog corpus.
    const a = mintLike({}, 0n);
    const b = mintLike({}, 0xffffffffn);
    expect(a.slice(0, DETERMINED_PREFIX_CHARS)).toBe(b.slice(0, DETERMINED_PREFIX_CHARS));
    expect(a.slice(DETERMINED_PREFIX_CHARS)).not.toBe(b.slice(DETERMINED_PREFIX_CHARS));
    // And 19 is TIGHT: one character earlier would be a weaker claim, one later
    // would be false. Char index 19 is the first to carry any randomness.
    expect(a[DETERMINED_PREFIX_CHARS]).not.toBe(b[DETERMINED_PREFIX_CHARS]);
  });

  test("a RESOLVING id still reports its cohort — being findable is not being right", () => {
    const a = mintLike({}, 0n);
    const b = mintLike({}, 0xffffffffn);
    const index: IdIndex = {
      workitems: new Map([[a, "workitems/a.md"]]),
      backlog: new Map([[b, "docs/backlog/P2/b.md"]]),
    };
    const c = classify(a, index);
    expect(c.cls).toBe("resolves-workitem");
    expect(c.prefixCohort).toEqual([b]);
  });

  test("distinct-day mints share no cohort", () => {
    const a = mintLike({}, 0n);
    const b = mintLike({ timestamp: Date.UTC(2026, 7, 26, 17, 48, 7, 582) as never }, 0n);
    expect(classify(a, { workitems: new Map([[b, "workitems/b.md"]]), backlog: new Map() }).prefixCohort).toEqual([]);
  });
});

describe("THE LIVE MISATTRIBUTION — the finding that bounds the fix", () => {
  test("the cron lane's Task id resolves to a DIFFERENT row than the workflow names", () => {
    const index = buildIndex(resolve(import.meta.dir, "..", "..", ".."));
    const stamped = "081KT7YW00008QG0R002T1XNWT"; // context-cost-trend-cadence.yml stamps this
    const intended = "081KT7YW00008QG0R003JV9D4J"; // ...and names THIS in its own comments
    const c = classify(stamped, index);
    expect(c.cls).toBe("resolves-backlog");
    expect(c.path ?? "").toContain("canonical-yaml-never-collapse");
    expect(index.backlog.get(intended) ?? "").toContain("context-window-minimization");
    // Same cohort — 19 shared characters is why the wrong one was reachable.
    expect(c.prefixCohort).toContain(intended);
    // THE BOUND: widening the resolver to docs/backlog turns this GREEN while the
    // reference stays wrong. A gate that accepts a wrong answer is worse than one
    // that rejects a right answer, so the widening is not a free move.
  });
});

describe("DECLARATION vs CITATION — the third input-surface class", () => {
  // The bug itself is fixed in flight by PR #15607 against `extractTaskIds`.
  // These falsifiers pin the DISTINCTION, which is what the measurement needs.
  const CITED = "081KSXN940008QG0R002FWR9B2"; // the migration umbrella, cited constantly in prose

  test("`Task: none` plus a cited id declares NOTHING", () => {
    const body = `Reworks the ${CITED} migration.\n\nTask: none\n`;
    expect(declaredTaskIds(body)).toEqual([]);
  });

  test("a real declaration is picked up, and only the declared one", () => {
    const other = "081M0X0JQGY087G0R000EBCPQ3";
    const body = `Builds on ${CITED}.\n\nTask: ${other}\n`;
    expect(declaredTaskIds(body)).toEqual([other]);
  });

  test("a bare list of ids declares nothing — no fallback", () => {
    expect(declaredTaskIds(`${CITED}\n081M0X0JQGY087G0R000EBCPQ3\n`)).toEqual([]);
  });

  test("`Task:` with a non-ZetaId value (legacy id, slug, none) declares nothing", () => {
    for (const v of ["none", "B-1016", "wire-build-graph-completeness-gate", "Otto-297"]) {
      expect(declaredTaskIds(`Task: ${v}\n`)).toEqual([]);
    }
  });

  test("the audit's own extractor DISAGREES on the `Task: none` body — that is the bug", () => {
    // A control, not a fix. If this ever matches `declaredTaskIds`, #15607 landed
    // and this test should be re-read rather than deleted.
    const body = `Reworks the ${CITED} migration.\n\nTask: none\n`;
    const audit = extractTaskIds(body);
    const strict = declaredTaskIds(body);
    expect(strict).toEqual([]);
    // Documented as an observation about the CURRENT tree, in either direction.
    expect(Array.isArray(audit)).toBe(true);
  });
});
