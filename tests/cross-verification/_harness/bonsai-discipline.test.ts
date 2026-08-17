/**
 * bonsai-discipline.test.ts — falsifiers for the `Cond` discipline guard.
 *
 * The behavioural bar this must meet (Aaron 2026-08-15, via the coordinator):
 *
 *   > Can a program authored under one discipline be silently evaluated under the
 *   > other? Before: yes. After: it must FAIL LOUDLY.
 *
 * So the load-bearing test is not "the guard exists" — it is that the guard
 * REFUSES the exact substitution that was silent, and that it does NOT refuse the
 * cases where substitution is harmless (a guard that cries wolf gets switched off).
 *
 * The cross-language half — that each evaluator's registered discipline is the one
 * it actually demonstrates, executed through the real built `Zeta.Core.dll` — is
 * `bonsai-discipline-probe.ts`, which needs the .NET SDK and so is a script.
 */

import { describe, expect, test } from "bun:test";
import { cbool, cint, cond, cstr, call, lambda, param, serialize } from "../../../src/Core.TypeScript/bonsai/index";
import {
  EVALUATORS,
  type AuthoredProgram,
  checkHandoff,
  disciplineOfProbeOutcome,
  disciplineProbe,
  disciplineSensitivity,
  evaluatorNamed,
  handoffVerdict,
} from "./bonsai-discipline";

/** The executed case from the research doc: `1` under short-circuit, error under predication. */
const PROBE_AUTHORED_SHORT: AuthoredProgram = {
  expr: disciplineProbe(),
  discipline: "short-circuit",
  origin: "a saga authored against resume.ts",
};

describe("bonsai-discipline — the substitution that was silent now fails loudly", () => {
  test("a short-circuit-authored, sensitive program aimed at the predicated evaluator is REFUSED", () => {
    expect(() => checkHandoff(PROBE_AUTHORED_SHORT, evaluatorNamed("BonsaiSoft.evalSoft"))).toThrow(
      /DISCIPLINE SUBSTITUTION/,
    );
  });

  test("the refusal NAMES both disciplines, the site, and why the program cares", () => {
    // A refusal a reader cannot act on is a refusal that gets suppressed.
    const v = handoffVerdict(PROBE_AUTHORED_SHORT, evaluatorNamed("BonsaiSoft.evalSoft"));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.why).toContain("short-circuit");
    expect(v.why).toContain("predicated");
    expect(v.why).toContain("src/Core/BonsaiSoft.fs");
    expect(v.why).toContain("nope");
    expect(v.why).toContain("Neither discipline is wrong");
  });

  test("the mirror substitution is refused too — this is not a one-way rule", () => {
    const authoredPredicated: AuthoredProgram = { ...PROBE_AUTHORED_SHORT, discipline: "predicated", origin: "a soft program" };
    expect(() => checkHandoff(authoredPredicated, evaluatorNamed("resume.ts start"))).toThrow(/DISCIPLINE SUBSTITUTION/);
  });

  test("the SAME program under its own discipline is accepted", () => {
    expect(handoffVerdict(PROBE_AUTHORED_SHORT, evaluatorNamed("resume.ts start"))).toEqual({
      ok: true,
      why: "disciplines match",
    });
  });

  test("an unregistered evaluator is REFUSED, never defaulted", () => {
    // Defaulting an unknown evaluator's discipline would reintroduce the silence.
    expect(() => evaluatorNamed("SomeNewEvaluator")).toThrow(/no registered evaluator/);
  });
});

describe("bonsai-discipline — the guard is quiet where substitution is harmless", () => {
  test("a closed, total Cond is NOT discipline-sensitive and passes either way", () => {
    const closed: AuthoredProgram = {
      expr: cond(cbool(true), cint(1), cint(2)),
      discipline: "short-circuit",
      origin: "a closed, total Cond",
    };
    expect(disciplineSensitivity(closed.expr).sensitive).toBe(false);
    expect(handoffVerdict(closed, evaluatorNamed("BonsaiSoft.evalSoft"))).toEqual({
      ok: true,
      why: "program is not discipline-sensitive",
    });
  });

  test("a program with NO Cond at all is not sensitive", () => {
    // The emission edge's own program — this is why that work is unaffected.
    const e = call("join", [cstr(",\n"), call("map", [lambda(["id", "x"], call("row", [param("id")])), param("inputs")])]);
    expect(disciplineSensitivity(e).sensitive).toBe(false);
  });

  test("a param BOUND by an enclosing lambda inside the arm is not a cause", () => {
    // Over-reporting here would fire on ordinary closed code.
    const e = cond(cbool(true), cint(1), lambda(["y"], param("y")));
    expect(disciplineSensitivity(e).sensitive).toBe(false);
  });
});

describe("bonsai-discipline — sensitivity is decided by OBSERVED causes", () => {
  test("a free param in an arm is a cause (the executed case)", () => {
    const s = disciplineSensitivity(disciplineProbe());
    expect(s.sensitive).toBe(true);
    expect(s.reasons.map((r) => r.cause)).toEqual(["free-param-in-arm"]);
    expect(s.reasons[0]!.path).toBe("$.else");
  });

  test("a call in an arm is a cause — under short-circuit the activity never runs", () => {
    const e = cond(cbool(true), cint(1), call("chargeCard", [cint(500)]));
    const s = disciplineSensitivity(e);
    expect(s.sensitive).toBe(true);
    expect(s.reasons.some((r) => r.cause === "call-in-arm")).toBe(true);
  });

  test("a free param in the TEST is NOT a cause — the test runs under both", () => {
    const e = cond(param("flag"), cint(1), cint(2));
    expect(disciplineSensitivity(e).sensitive).toBe(false);
  });

  test("sensitivity is found in NESTED positions, not just at the root", () => {
    const e = call("wrap", [lambda(["a"], cond(cbool(true), cint(1), param("free")))]);
    const s = disciplineSensitivity(e);
    expect(s.sensitive).toBe(true);
    expect(s.reasons[0]!.path).toContain(".else");
  });
});

describe("bonsai-discipline — the label cannot certify itself", () => {
  test("a probe outcome that demonstrates NEITHER discipline is REFUSED", () => {
    // The probe going quiet must fail loudly rather than certify whatever it saw —
    // otherwise an evaluator change silently invalidates every registration.
    expect(() => disciplineOfProbeOutcome({ kind: "value", value: "42" })).toThrow(/demonstrates NEITHER/);
    expect(() => disciplineOfProbeOutcome({ kind: "error", message: "some other failure" })).toThrow(/demonstrates NEITHER/);
  });

  test("the probe discriminates: the two outcomes map to DIFFERENT disciplines", () => {
    expect(disciplineOfProbeOutcome({ kind: "value", value: "1" })).toBe("short-circuit");
    expect(disciplineOfProbeOutcome({ kind: "error", message: "BonsaiSoft: unbound param 'nope'" })).toBe("predicated");
  });

  test("both disciplines are actually present in the registry", () => {
    // If every evaluator had the same discipline there would be nothing to guard,
    // and this whole file would be vacuous.
    expect([...new Set(EVALUATORS.map((e) => e.discipline))].sort()).toEqual(["predicated", "short-circuit"]);
  });
});

describe("bonsai-discipline — the wire format did not move", () => {
  test("the discipline is a SIDECAR: pairing it changes no byte", () => {
    const bare = serialize(disciplineProbe());
    const paired = serialize(PROBE_AUTHORED_SHORT.expr);
    expect(bare.ok && paired.ok).toBe(true);
    if (!bare.ok || !paired.ok) return;
    expect(paired.value).toBe(bare.value);
    // …and it is still a v1 document with only v1 node kinds.
    expect(paired.value.startsWith('{"v":1,')).toBe(true);
    const kinds = new Set([...paired.value.matchAll(/"kind":"([a-z]+)"/g)].map((m) => m[1]!));
    expect([...kinds].sort()).toEqual(["cond", "const", "param"]);
  });
});
