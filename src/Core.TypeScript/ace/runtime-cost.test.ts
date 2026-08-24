// runtime-cost.test.ts — falsifiers for the chooser.
//
// Each test below FAILS if the property it names is removed. The mutations that were run
// against it are recorded in the PR body; a test that survives its own mutation is not a
// falsifier and does not belong here.

import { describe, expect, test } from "bun:test";
import {
  choose,
  rank,
  report,
  sensitivity,
  viability,
  type HostProfile,
  type RuntimeCandidate,
} from "./runtime-cost.ts";
import { CANDIDATES } from "./runtime-candidates.ts";
import { DEFAULT_PROBES, probeHost, probeOne, type ProbeEffects } from "./runtime-probe.ts";

// ---------------------------------------------------------------- synthetic host profiles
const RICH: HostProfile = { bun: "present", node: "present", dotnet: "present", "wasm-runtime": "present" };
const NODE_ONLY: HostProfile = { bun: "absent", node: "present", dotnet: "absent", "wasm-runtime": "absent" };
const BARE: HostProfile = { bun: "absent", node: "absent", dotnet: "absent", "wasm-runtime": "absent" };
const UNKNOWN: HostProfile = {
  bun: "indeterminate",
  node: "indeterminate",
  dotnet: "indeterminate",
  "wasm-runtime": "indeterminate",
};

describe("three-state viability", () => {
  test("an INDETERMINATE toolchain is not treated as absent", () => {
    const c = CANDIDATES.find((x) => x.id === "source-on-bun")!;
    const v = viability(c, { bun: "indeterminate" });
    expect(v.viable).toBe(false);
    // The distinction the third state exists for: it is unprobed, NOT missing.
    expect(v.indeterminate).toEqual(["bun"]);
    expect(v.missing).toEqual([]);
  });

  test("an ABSENT toolchain is missing, not merely unprobed", () => {
    const c = CANDIDATES.find((x) => x.id === "source-on-bun")!;
    const v = viability(c, { bun: "absent" });
    expect(v.missing).toEqual(["bun"]);
    expect(v.indeterminate).toEqual([]);
  });

  test("a toolchain absent from the profile entirely is indeterminate, never present", () => {
    // Defaulting an unknown key to "present" would make the chooser hallucinate a runtime.
    const c = CANDIDATES.find((x) => x.id === "source-on-bun")!;
    expect(viability(c, {}).indeterminate).toEqual(["bun"]);
  });
});

describe("toolchain-missing is a first-class outcome", () => {
  test("a bare host reports the gap and does NOT silently fall back to a binary", () => {
    const s = choose(CANDIDATES, BARE, 0.5);
    expect(s.kind).toBe("toolchain-missing");
    if (s.kind !== "toolchain-missing") throw new Error("unreachable");
    expect(s.missing).toContain("bun");
    // The whole point of rung 2: no candidate is returned.
    expect(s).not.toHaveProperty("candidate");
  });

  test("an unprobed host is INDETERMINATE, distinct from a bare one", () => {
    const s = choose(CANDIDATES, UNKNOWN, 0.5);
    expect(s.kind).toBe("indeterminate");
    if (s.kind !== "indeterminate") throw new Error("unreachable");
    expect(s.unprobed.length).toBeGreaterThan(0);
  });
});

describe("the report covers every rung, not just the winner", () => {
  test("all candidates appear with their register and buildability", () => {
    const r = report(CANDIDATES, RICH);
    expect(r.length).toBe(CANDIDATES.length);
    for (const row of r) expect(["metered", "unmetered"]).toContain(row.cost.register);
  });

  test("every enablement is marked unmetered-by-nature — never rendered as a measurement", () => {
    for (const c of CANDIDATES) expect(c.enablement.register).toBe("unmetered-by-nature");
  });

  test("every enablement judgment is attributed and dated", () => {
    for (const c of CANDIDATES) {
      expect(c.enablement.by.length).toBeGreaterThan(0);
      expect(c.enablement.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.enablement.rationale.length).toBeGreaterThan(20);
    }
  });

  test("every metered cost carries a method, a host and a date", () => {
    for (const c of CANDIDATES) {
      if (c.cost.register !== "metered") continue;
      expect(c.cost.method.length).toBeGreaterThan(20);
      expect(c.cost.measuredOn.length).toBeGreaterThan(0);
      expect(c.cost.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("every unmetered cost states WHY there is no number", () => {
    for (const c of CANDIDATES) {
      if (c.cost.register !== "unmetered") continue;
      expect(c.cost.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("a rung that does not build is never selected", () => {
  test("known-broken rungs are excluded even when their toolchain is present", () => {
    const chosen = rank(CANDIDATES, RICH, 0.5).map((c) => c.id);
    // Measured 2026-08-24: both still fail to build. See runtime-candidates.ts for evidence.
    expect(chosen).not.toContain("portable-wasm");
    expect(chosen).not.toContain("native-dotnet-aot");
    // `source-on-node` was in this list until 081M0TKBDXN087G0R003HTKSAZ landed the 16
    // extension rewrites. It is now buildable, so it belongs on the OTHER side of the
    // assertion — an exclusion nobody re-checks is how a stale fact survives as a test.
    expect(chosen).toContain("source-on-node");
  });

  test("a node-only host now SELECTS the node source rung — rung 1b is no longer blocked", () => {
    // The prior version of this test asserted `toolchain-missing` here and carried a standing
    // instruction: "if someone fixes the 16 specifiers and flips `buildable` to yes, THIS TEST
    // MUST BE UPDATED". That happened (081M0TKBDXN087G0R003HTKSAZ): `node ace.ts list` -> rc=0
    // with output byte-identical to bun's, proven in `ace-node-runtime-parity.test.ts`.
    //
    // The assertion is kept STRONG rather than relaxed to "not toolchain-missing": a node-only
    // host must land on the source rung specifically. Aaron's ladder puts recompile-from-source
    // above download-a-binary, so a node-only host quietly selecting a prebuilt binary would be
    // the ladder inverting — exactly the failure this suite exists to catch.
    const s = choose(CANDIDATES, NODE_ONLY, 0.5);
    expect(s.kind).toBe("selected");
    if (s.kind !== "selected") return;
    expect(s.candidate.id).toBe("source-on-node");
    expect(s.candidate.trust.derivedByUser).toBe(true);
  });
});

describe("trust rank dominates cost", () => {
  test("a cheaper but less-verifiable rung never displaces a more-verifiable one", () => {
    const ordered = rank(CANDIDATES, RICH, 0.5);
    const src = ordered.findIndex((c) => c.id === "source-on-bun");
    const nat = ordered.findIndex((c) => c.id === "native-bun-compile");
    expect(src).toBeGreaterThanOrEqual(0);
    expect(nat).toBeGreaterThan(src);
    // ...and it is NOT because source is cheaper on enablement; it is the trust rank.
    const s = CANDIDATES.find((c) => c.id === "source-on-bun")!;
    const n = CANDIDATES.find((c) => c.id === "native-bun-compile")!;
    expect(s.trust.rank).toBeLessThan(n.trust.rank);
  });

  test("trust dominance is REAL: it wins even when cost and enablement both favour the rival", () => {
    // The previous assertion could not distinguish trust-dominance from source-on-bun simply
    // being cheaper (0 bytes vs 61 MiB). This fixture makes the two criteria DISAGREE: the
    // low-trust rung is cheaper AND more enabling. If trust rank stops dominating, it wins
    // and this test fails. That is what makes it a falsifier rather than a restatement.
    const verifiableButCostly: RuntimeCandidate = {
      id: "verifiable-costly",
      requires: [],
      cost: {
        register: "metered",
        addedBytes: 1_000_000,
        method: "synthetic fixture",
        measuredOn: "test",
        measuredAt: "2026-08-24",
      },
      enablement: {
        score: 0.01,
        by: "test",
        on: "2026-08-24",
        rationale: "synthetic fixture: deliberately unattractive on both non-trust axes",
        register: "unmetered-by-nature",
      },
      trust: { rank: 0, mustTrust: ["committed source"], derivedByUser: true },
      buildable: { state: "yes", evidence: "synthetic" },
    };
    const trustedBlindlyButCheap: RuntimeCandidate = {
      id: "prebuilt-cheap",
      requires: [],
      cost: {
        register: "metered",
        addedBytes: 1,
        method: "synthetic fixture",
        measuredOn: "test",
        measuredAt: "2026-08-24",
      },
      enablement: {
        score: 0.99,
        by: "test",
        on: "2026-08-24",
        rationale: "synthetic fixture: deliberately attractive on both non-trust axes",
        register: "unmetered-by-nature",
      },
      trust: { rank: 2, mustTrust: ["a binary you did not build"], derivedByUser: false },
      buildable: { state: "yes", evidence: "synthetic" },
    };
    const pair = [trustedBlindlyButCheap, verifiableButCostly];
    // At EVERY enablement weight, the verifiable rung must lead. Trust is not a tiebreak.
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      expect(rank(pair, {}, w).map((c) => c.id)[0]).toBe("verifiable-costly");
    }
  });

  test("source-derived rungs are marked derivedByUser; prebuilt ones are not", () => {
    for (const c of CANDIDATES) {
      if (c.trust.rank === 0) expect(c.trust.derivedByUser).toBe(true);
      else expect(c.trust.derivedByUser).toBe(false);
    }
  });
});

describe("the ordering is conditional on the enablement judgment, and says so", () => {
  test("sensitivity reports the winner across the whole judgment band", () => {
    const s = sensitivity(CANDIDATES, RICH);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0]!.weight).toBe(0);
  });

  test("a synthetic pair DOES reorder when the judgment moves — the scan can detect a flip", () => {
    // Falsifier for `sensitivity` itself: if it could never report a change, it would be a
    // check that cannot fail. Two equal-trust rungs, one cheap+low-enablement, one
    // expensive+high-enablement, must swap somewhere in [0,1].
    const mk = (id: string, bytes: number, score: number): RuntimeCandidate => ({
      id,
      requires: [],
      cost: {
        register: "metered",
        addedBytes: bytes,
        method: "synthetic fixture",
        measuredOn: "test",
        measuredAt: "2026-08-24",
      },
      enablement: {
        score,
        by: "test",
        on: "2026-08-24",
        rationale: "synthetic fixture for the sensitivity scan",
        register: "unmetered-by-nature",
      },
      trust: { rank: 0, mustTrust: [], derivedByUser: true },
      buildable: { state: "yes", evidence: "synthetic" },
    });
    const pair = [mk("cheap-narrow", 1, 0.1), mk("costly-broad", 1000, 0.9)];
    const scan = sensitivity(pair, {});
    expect(scan.length).toBeGreaterThan(1);
    expect(rank(pair, {}, 0).map((c) => c.id)[0]).toBe("cheap-narrow");
    expect(rank(pair, {}, 1).map((c) => c.id)[0]).toBe("costly-broad");
  });

  test("an unmetered rung never wins on a number nobody produced", () => {
    const metered: RuntimeCandidate = {
      id: "metered-rung",
      requires: [],
      cost: {
        register: "metered",
        addedBytes: 999999,
        method: "synthetic fixture",
        measuredOn: "test",
        measuredAt: "2026-08-24",
      },
      enablement: {
        score: 0.1,
        by: "test",
        on: "2026-08-24",
        rationale: "synthetic fixture, deliberately unattractive",
        register: "unmetered-by-nature",
      },
      trust: { rank: 0, mustTrust: [], derivedByUser: true },
      buildable: { state: "yes", evidence: "synthetic" },
    };
    const unmetered: RuntimeCandidate = {
      ...metered,
      id: "unmetered-rung",
      cost: { register: "unmetered", reason: "synthetic fixture with deliberately no measurement" },
      enablement: { ...metered.enablement, score: 1 },
    };
    // Even with maximal enablement, the unmeasured rung loses to a measured one at equal trust.
    expect(rank([unmetered, metered], {}, 0.9).map((c) => c.id)[0]).toBe("metered-rung");
  });
});

describe("probe: the third state is reachable", () => {
  const fx = (impl: ProbeEffects["run"]): ProbeEffects => ({ run: impl });

  test("exit 0 => present", () => {
    expect(
      probeOne(
        DEFAULT_PROBES[0]!,
        fx(() => ({ code: 0, stdout: "1.3.14" })),
      ),
    ).toBe("present");
  });
  test("non-zero exit => absent (a real answer)", () => {
    expect(
      probeOne(
        DEFAULT_PROBES[0]!,
        fx(() => ({ code: 127, stdout: "" })),
      ),
    ).toBe("absent");
  });
  test("null => indeterminate (THE CHECK DID NOT RUN)", () => {
    expect(
      probeOne(
        DEFAULT_PROBES[0]!,
        fx(() => null),
      ),
    ).toBe("indeterminate");
  });
  test("a throwing effect is indeterminate, never absent", () => {
    expect(
      probeOne(
        DEFAULT_PROBES[0]!,
        fx(() => {
          throw new Error("spawn blew up");
        }),
      ),
    ).toBe("indeterminate");
  });
  test("probeHost covers every declared probe", () => {
    const h = probeHost(
      DEFAULT_PROBES,
      fx(() => ({ code: 0, stdout: "" })),
    );
    for (const p of DEFAULT_PROBES) expect(h[p.id]).toBe("present");
  });
});
