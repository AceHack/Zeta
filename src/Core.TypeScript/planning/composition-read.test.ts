/**
 * composition-read.test.ts — falsifiers for the composition read-path.
 *
 * Each test is written to go RED under one named mutation of `composition-read.ts`.
 * They are tests of the MECHANISM; none of them is evidence about any participant.
 *
 *   M-A  a no-track-record provider reads as reliable
 *          → collapse `unknown` into a `recorded` read with a default trustBand
 *   M-B  a provider self-asserts its own reliability
 *          → stop excluding self-labeled outcomes / accept a provider-supplied score
 *   M-C  the score is reachable without any conferral
 *          → put a numeric field on the `unknown` branch, or fold self-attestations
 *   M-D  binding and persuasive summed into one number
 *   M-E  an unattributed policy constant admitted
 *   M-F  a chain aggregated into a product of trust bands
 *   M-G  `review-vote` admitted to a composition decision
 */

import { describe, expect, it } from "bun:test";

import {
  type OutcomeRecord,
  type TreatmentEdge,
  admitOutcome,
  makeEdge,
} from "./competence-attribution";
import {
  type CompositionQuery,
  type DependencyPolicy,
  type DependencyRead,
  applyPolicy,
  explain,
  readCompositionChain,
  readDependency,
} from "./composition-read";

// ── Fixtures ────────────────────────────────────────────────────────────────────────

const A = "consumer-a";
const B = "provider-b";
const C = "provider-c";
const OTHER = "labeler-x";
const HAT = "signer";
const CAP = "oracle/typescript";

function edge(subjectRef: string, agentId: string, at: string, treatment: "authored" | "warned" = "authored"): TreatmentEdge {
  const r = makeEdge({ subjectRef, agentId, hatDomain: HAT, treatment, at });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

function outcome(
  subjectRef: string,
  hit: boolean,
  labeler: string,
  at: string,
  jurisdiction: string = CAP,
): OutcomeRecord {
  const r = admitOutcome({
    subjectRef,
    series: "use-defect",
    evidence: hit ? "clean-usage-window" : "defect-in-use",
    hit,
    labeler,
    jurisdiction,
    at,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

const QUERY: CompositionQuery = {
  consumerId: A,
  providerId: B,
  hatDomain: HAT,
  capability: CAP,
  series: "use-defect",
};

function read(outcomes: readonly OutcomeRecord[], edges: readonly TreatmentEdge[], q: CompositionQuery = QUERY): DependencyRead {
  const r = readDependency(outcomes, edges, q);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

// ── M-A: a provider with no track record must read UNKNOWN, never reliable ──────────

describe("M-A — no track record reads as unknown, not as good", () => {
  it("an empty record yields kind=unknown with conferredCount 0", () => {
    const r = read([], []);
    expect(r.kind).toBe("unknown");
    if (r.kind !== "unknown") throw new Error("unreachable");
    expect(r.conferredCount).toBe(0);
  });

  it("the unknown branch exposes NO score field a caller could mistake for one", () => {
    const r = read([], []);
    // Structural, not stylistic: if `unknown` ever grows a numeric reliability field,
    // this fails. `conferredCount` is a count of nothing, and it is pinned at 0 above.
    const numericKeys = Object.entries(r)
      .filter(([, v]) => typeof v === "number")
      .map(([k]) => k)
      .sort();
    expect(numericKeys).toEqual(["conferredCount", "scopedOut", "selfAttestedExcluded", "unattributable"]);
    expect(Object.hasOwn(r, "trustBand")).toBe(false);
    expect(Object.hasOwn(r, "binding")).toBe(false);
    expect(Object.hasOwn(r, "mu")).toBe(false);
  });

  it("the unknown case is stated as an absence, not as a low or clean record", () => {
    const text = explain(read([], []));
    expect(text).toContain("UNKNOWN");
    expect(text).toContain("not a low score");
    expect(text).toContain("not a clean record");
  });

  it("a provider with no record and a provider with a bad record are DIFFERENT reads", () => {
    const unknownRead = read([], []);
    const badRead = read(
      [outcome("s1", false, OTHER, "2026-08-17T00:00:00.000Z")],
      [edge("s1", B, "2026-08-17T00:00:00.000Z")],
    );
    expect(unknownRead.kind).toBe("unknown");
    expect(badRead.kind).toBe("recorded");
    if (badRead.kind !== "recorded") throw new Error("unreachable");
    expect(badRead.binding?.misses).toBe(1);
  });
});

// ── M-B / M-C: conferral is the only path to a number ───────────────────────────────

describe("M-B — a provider cannot self-assert its own reliability", () => {
  it("an outcome B labeled about B is excluded and COUNTED, leaving the read unknown", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const r = read([outcome("s1", true, /* labeler = */ B, at)], [edge("s1", B, at)]);
    expect(r.kind).toBe("unknown");
    if (r.kind !== "unknown") throw new Error("unreachable");
    expect(r.selfAttestedExcluded).toBe(1);
  });

  it("ten self-attestations still read unknown — volume does not launder self-certification", () => {
    const outcomes: OutcomeRecord[] = [];
    const edges: TreatmentEdge[] = [];
    for (let i = 0; i < 10; i += 1) {
      const at = `2026-08-17T00:00:${String(i).padStart(2, "0")}.000Z`;
      outcomes.push(outcome(`s${String(i)}`, true, B, at));
      edges.push(edge(`s${String(i)}`, B, at));
    }
    const r = read(outcomes, edges);
    expect(r.kind).toBe("unknown");
    if (r.kind !== "unknown") throw new Error("unreachable");
    expect(r.selfAttestedExcluded).toBe(10);
  });

  it("the same evidence labeled by someone else DOES confer — the guard is the labeler, not the volume", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const r = read([outcome("s1", true, OTHER, at)], [edge("s1", B, at)]);
    expect(r.kind).toBe("recorded");
    if (r.kind !== "recorded") throw new Error("unreachable");
    expect(r.selfAttestedExcluded).toBe(0);
    expect(r.binding?.hits).toBe(1);
  });

  it("readDependency exposes no parameter through which a provider supplies a score", () => {
    // Arity is the check: (outcomes, edges, query, rule?). A fifth "advertisedReliability"
    // parameter — or a fourth positional number — would break this.
    expect(readDependency.length).toBe(3);
  });
});

describe("M-C — no number is reachable without conferral", () => {
  it("a self-attested-only provider yields no binding block at all", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const r = read([outcome("s1", true, B, at)], [edge("s1", B, at)]);
    // Reaching a number requires narrowing to "recorded"; this read cannot narrow.
    expect(r.kind === "recorded").toBe(false);
  });

  it("a recorded read's numbers rest on a positive conferredCount", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const r = read([outcome("s1", true, OTHER, at)], [edge("s1", B, at)]);
    if (r.kind !== "recorded") throw new Error("expected recorded");
    expect(r.conferredCount).toBeGreaterThan(0);
    expect(r.binding).toBeDefined();
    expect(r.binding?.obsCount).toBe(r.conferredCount);
  });

  it("a hit moves the posterior UP and a miss moves it DOWN — the fold is not an identity", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const good = read([outcome("s1", true, OTHER, at)], [edge("s1", B, at)]);
    const bad = read([outcome("s1", false, OTHER, at)], [edge("s1", B, at)]);
    if (good.kind !== "recorded" || bad.kind !== "recorded") throw new Error("expected recorded");
    expect(good.binding?.trustBand ?? 0).toBeGreaterThan(0.5);
    expect(bad.binding?.trustBand ?? 1).toBeLessThan(0.5);
  });
});

// ── M-D: binding and persuasive are never summed ────────────────────────────────────

describe("M-D — cross-scope evidence stays separate from the queried capability", () => {
  it("evidence recorded in another scope lands in persuasive, never in binding", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const r = read(
      [outcome("s1", true, OTHER, at, "oracle/fsharp")],
      [edge("s1", B, at)],
    );
    if (r.kind !== "recorded") throw new Error("expected recorded");
    expect(r.binding).toBeUndefined();
    expect(r.persuasive.length).toBe(1);
    expect(r.persuasive[0]?.jurisdiction).toBe("oracle/fsharp");
    expect(r.persuasive[0]?.weight).toBeLessThan(1);
  });

  it("standing in one scope does not raise the count in the queried scope", () => {
    const outcomes = [
      outcome("s1", true, OTHER, "2026-08-17T00:00:00.000Z", CAP),
      outcome("s2", true, OTHER, "2026-08-17T00:00:01.000Z", "oracle/fsharp"),
      outcome("s3", true, OTHER, "2026-08-17T00:00:02.000Z", "oracle/fsharp"),
    ];
    const edges = [
      edge("s1", B, "2026-08-17T00:00:00.000Z"),
      edge("s2", B, "2026-08-17T00:00:01.000Z"),
      edge("s3", B, "2026-08-17T00:00:02.000Z"),
    ];
    const r = read(outcomes, edges);
    if (r.kind !== "recorded") throw new Error("expected recorded");
    expect(r.binding?.obsCount).toBe(1);
    expect(r.binding?.weight).toBe(1);
    expect(r.persuasive.length).toBe(1);
    expect(r.persuasive[0]?.obsCount).toBe(2);
    // conferredCount counts everything seen; the binding block counts only the queried scope.
    expect(r.conferredCount).toBe(3);
  });

  it("explain() says out loud that persuasive is not added to binding", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const text = explain(read([outcome("s1", true, OTHER, at)], [edge("s1", B, at)]));
    expect(text).toContain("NOT added to the binding figure");
  });
});

// ── M-E: no unattributed gating constant may pass through this surface ──────────────

describe("M-E — a policy must name what its numbers were derived from", () => {
  const unattributed: DependencyPolicy = {
    id: "gate@v1",
    derivedFrom: "   ",
    decide: () => ({ choice: "depend", because: "it felt right" }),
  };
  const attributed: DependencyPolicy = {
    id: "gate@v1",
    derivedFrom:
      "0.7 chosen by the maintainer for this call site on 2026-08-17; unmetered, no calibration behind it",
    decide: (r) => ({
      choice: r.kind === "recorded" && (r.binding?.trustBand ?? 0) > 0.7 ? "depend" : "hedge",
      because: "caller's own constant, attributed above",
    }),
  };

  it("refuses an unattributed policy", () => {
    const out = applyPolicy(read([], []), unattributed);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.reason).toContain("unattributed gating constant is refused");
  });

  it("admits an attributed policy and carries the derivation with the decision", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const out = applyPolicy(read([outcome("s1", true, OTHER, at)], [edge("s1", B, at)]), attributed);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.value.derivedFrom.length).toBeGreaterThan(0);
    expect(["depend", "hedge"]).toContain(out.value.decision.choice);
  });

  it("the module itself exports no threshold constant", async () => {
    const mod: Record<string, unknown> = await import("./composition-read");
    const numericExports = Object.entries(mod)
      .filter(([, v]) => typeof v === "number")
      .map(([k]) => k);
    expect(numericExports).toEqual([]);
  });
});

// ── M-F / M-G: chains are reported; review-vote is refused ──────────────────────────

describe("M-F — a chain is reported, never aggregated", () => {
  it("reports each link and the indices of the unknown ones", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const outcomes = [outcome("s1", true, OTHER, at)];
    const edges = [edge("s1", B, at)];
    const chain: CompositionQuery[] = [QUERY, { ...QUERY, consumerId: B, providerId: C }];
    const out = readCompositionChain(outcomes, edges, chain);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.value.links.length).toBe(2);
    expect(out.value.unknownLinks).toEqual([1]);
  });

  it("the chain result carries no aggregate score field", () => {
    const out = readCompositionChain([], [], [QUERY]);
    if (!out.ok) throw new Error("unreachable");
    const numericKeys = Object.entries(out.value)
      .filter(([, v]) => typeof v === "number")
      .map(([k]) => k);
    expect(numericKeys).toEqual([]);
    expect(Object.hasOwn(out.value, "chainTrust")).toBe(false);
  });

  it("flags a link that has a record but not in the capability asked for", () => {
    const at = "2026-08-17T00:00:00.000Z";
    const out = readCompositionChain(
      [outcome("s1", true, OTHER, at, "oracle/fsharp")],
      [edge("s1", B, at)],
      [QUERY],
    );
    if (!out.ok) throw new Error("unreachable");
    expect(out.value.offCapabilityLinks).toEqual([0]);
    expect(out.value.unknownLinks).toEqual([]);
  });
});

describe("M-G — the review vote may not decide who gets built upon", () => {
  it("refuses a composition read over the review-vote series", () => {
    const out = readDependency([], [], { ...QUERY, series: "review-vote" });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.reason).toContain("recorded, never folded");
  });

  it("refuses an empty providerId or consumerId", () => {
    expect(readDependency([], [], { ...QUERY, providerId: "" }).ok).toBe(false);
    expect(readDependency([], [], { ...QUERY, consumerId: "" }).ok).toBe(false);
  });
});

// ── Determinism (DST) ───────────────────────────────────────────────────────────────

describe("receive order does not change the read", () => {
  it("the same set folded in reverse order yields the same posterior", () => {
    const outcomes = [
      outcome("s1", true, OTHER, "2026-08-17T00:00:00.000Z"),
      outcome("s2", false, OTHER, "2026-08-17T00:00:01.000Z"),
      outcome("s3", true, OTHER, "2026-08-17T00:00:02.000Z"),
    ];
    const edges = [
      edge("s1", B, "2026-08-17T00:00:00.000Z"),
      edge("s2", B, "2026-08-17T00:00:01.000Z"),
      edge("s3", B, "2026-08-17T00:00:02.000Z"),
    ];
    const forward = read(outcomes, edges);
    const backward = read([...outcomes].reverse(), [...edges].reverse());
    if (forward.kind !== "recorded" || backward.kind !== "recorded") throw new Error("expected recorded");
    expect(backward.binding?.mu).toBe(forward.binding?.mu ?? Number.NaN);
    expect(backward.binding?.trustBand).toBe(forward.binding?.trustBand ?? Number.NaN);
  });
});
