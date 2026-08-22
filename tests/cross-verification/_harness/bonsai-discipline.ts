/**
 * bonsai-discipline.ts — `Cond` is one name for two functions. This makes the two
 * distinguishable, and makes substituting one for the other fail loudly.
 *
 * THE DEFECT (executed, not inferred — see the 2026-08-15 research doc)
 * --------------------------------------------------------------------
 * Bonsai's four byte-lock oracles are serializer-only; three evaluators exist and
 * they do not agree on `Cond` arm evaluation:
 *
 *   src/Core/BonsaiSoft.fs        BOTH arms, blended by truth-confidence  PREDICATED
 *   src/Core/Resume.fs            ONE arm                                 SHORT-CIRCUIT
 *   src/Core.TypeScript/…/resume.ts  ONE arm                              SHORT-CIRCUIT
 *
 * One serialized expression — `Cond(true, 1, Param "nope")` — returns `1` from
 * `resume.ts` and `Error "unbound param 'nope'"` from `BonsaiSoft.evalSoft`.
 * Same bytes. Opposite outcomes. Nothing prevented the handoff.
 *
 * THE RULING — LABEL, DO NOT CHOOSE
 * ---------------------------------
 * Aaron 2026-08-15: *"yes we just need to make sure everything is labeled honestly
 * and able to be reasoned about in the domain in which it is active. Choose the
 * right specialization for the job and make sure you don't use one assuming it's
 * the other. In worst case we would need two specs."*
 *
 * So neither reading is wrong. Short-circuit is **correct** for a saga interpreter
 * whose arms hold side-effecting activities; predication is **correct** for a soft,
 * shader-portable evaluator. The defect is that they are INDISTINGUISHABLE, and
 * "don't use one assuming it's the other" is a runtime property — prose does not
 * discharge it.
 *
 * This is a known failure class here, not a novel one:
 *   · `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`, the
 *     functional half — *"recognising sameness is not assigning identity — they are
 *     two different functions."* Two functions wearing one name, conflation silent,
 *     consequence corrupted downstream state. Identical shape.
 *   · #10831 — "time-crystal" carrying four referents across five files: the
 *     vocabulary-level version of the same thing.
 *
 * WHAT THIS DOES — AND THE ONE THING THAT MAKES IT NOT PROSE
 * ---------------------------------------------------------
 *   1. Names the two disciplines (`predicated` / `short-circuit`).
 *   2. Registers each evaluator with the discipline it ACTUALLY has — and the
 *      registration is **verified by executing a discriminating probe**, never
 *      trusted. `bonsai-discipline-probe.ts` runs the probe through all three
 *      evaluators; a registration that disagrees with observed behaviour FAILS.
 *      This is the load-bearing part: a label that cannot be checked is a comment.
 *   3. Decides, statically, whether a given program's MEANING depends on the
 *      discipline (`disciplineSensitivity`). Most programs' does not, and a guard
 *      that fires on those would be noise.
 *   4. Refuses the handoff (`checkHandoff`) when a discipline-SENSITIVE program
 *      authored under one discipline is aimed at an evaluator with the other.
 *
 * WHAT THIS DOES NOT DO, STATED PLAINLY
 * -------------------------------------
 *   · **It does not move the wire format.** No new node kind, no new field, no
 *     version bump; the pairing of a program with its discipline is a SIDECAR
 *     record here, and `serialize(expr)` is byte-identical with or without it.
 *     Carrying the discipline IN the bytes may well be the cleaner end state —
 *     it is a property of the program, not of a target, so #10827's carved test
 *     does not exclude it — but that is a format change, and a format change is
 *     gated. It is written up, not landed.
 *   · **It does not intercept a direct call.** Nothing stops someone calling
 *     `BonsaiSoft.evalSoft` on a short-circuit-authored program without going
 *     through `checkHandoff`. This guards the checked path and makes the unchecked
 *     one nameable; it is not a sandbox. The evaluators are deliberately untouched
 *     (a sibling agent holds that seam, and "fixing" them to agree would silently
 *     pick a reading — explicitly ruled out).
 */

import type { Expr } from "../../../src/Core.TypeScript/bonsai/index";
import { cbool, cint, cond, param } from "../../../src/Core.TypeScript/bonsai/index";

// ─── the two disciplines ─────────────────────────────────────────────────────

/**
 * How an evaluator treats `Cond` arms. Both are legitimate; each is correct in its
 * own domain. This type exists so the two stop being the same thing.
 */
export type Discipline = "predicated" | "short-circuit";

/** Human-readable, for refusal messages. */
export const DISCIPLINE_MEANING: Readonly<Record<Discipline, string>> = {
  predicated: "BOTH arms are evaluated; the result is a pure function of the predicate (branch-free, shader-portable). An error or effect in the not-taken arm IS observed.",
  "short-circuit": "exactly ONE arm is evaluated; the untaken arm is never touched. Required where an arm may hold a side-effecting activity that must not run.",
};

/**
 * A program paired with the discipline it was AUTHORED under.
 *
 * The pairing is a sidecar: `expr` serializes to exactly the same bytes it would
 * have without it. That is deliberate and is the constraint that has held all day.
 */
export interface AuthoredProgram {
  readonly expr: Expr;
  readonly discipline: Discipline;
  /** Where the program came from, for the refusal message. */
  readonly origin: string;
}

/**
 * An evaluator and the discipline it actually implements.
 *
 * `evidence` is not a justification, it is a claim the probe must reproduce.
 * `bonsai-discipline-probe.ts` executes each of these and fails on disagreement,
 * which is what keeps this table honest as the evaluators change.
 */
export interface EvaluatorRegistration {
  readonly name: string;
  readonly discipline: Discipline;
  readonly site: string;
  readonly evidence: string;
}

/**
 * The three evaluators in the repo, as of 2026-08-15. None of them is one of the
 * four byte-lock oracles — those are serializer-only and say nothing about
 * evaluation, which is how the divergence went unnoticed.
 */
export const EVALUATORS: readonly EvaluatorRegistration[] = [
  {
    name: "BonsaiSoft.evalSoft",
    discipline: "predicated",
    site: "src/Core/BonsaiSoft.fs",
    evidence: "evaluates thenE AND elseE, blends by the test's truth-confidence; its own header warns 'an error in the not-taken branch still propagates'",
  },
  {
    name: "Resume.run",
    discipline: "short-circuit",
    site: "src/Core/Resume.fs",
    evidence: "Branch frame: Eval((if t then thenE else elseE), env) — one arm",
  },
  {
    name: "resume.ts start",
    discipline: "short-circuit",
    site: "src/Core.TypeScript/bonsai/resume.ts",
    evidence: "branch frame: expr: t ? top.then : top.els — one arm",
  },
];

/** Look up a registration by name; unknown is refused, never defaulted. */
export function evaluatorNamed(name: string): EvaluatorRegistration {
  const found = EVALUATORS.find((e) => e.name === name);
  if (found === undefined) {
    throw new Error(
      `bonsai-discipline: no registered evaluator \`${name}\`. An unregistered evaluator has no ` +
        `declared discipline, and defaulting one would reintroduce exactly the silent substitution this file exists to stop.`,
    );
  }
  return found;
}

// ─── the probe: the label is checked, not trusted ────────────────────────────

/**
 * The discriminating expression.
 *
 *   Cond(true, 1, Param "nope")
 *
 * The predicate is `true`, so a short-circuit evaluator takes the `then` arm and
 * returns `1`. A predicated evaluator also evaluates the `else` arm, where `nope`
 * is unbound, and fails. Minimal, total in one discipline and failing in the other,
 * and it uses only v1 node kinds.
 */
export function disciplineProbe(): Expr {
  return cond(cbool(true), cint(1), param("nope"));
}

/** What running the probe through an evaluator looked like. */
export type ProbeOutcome =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "error"; readonly message: string };

/**
 * Read a probe outcome back to the discipline it demonstrates. TOTAL: an outcome
 * that demonstrates neither is REFUSED, not guessed — a probe that stopped
 * discriminating must fail loudly rather than silently certify whatever it saw.
 */
export function disciplineOfProbeOutcome(o: ProbeOutcome): Discipline {
  if (o.kind === "value" && o.value === "1") return "short-circuit";
  if (o.kind === "error" && /nope/.test(o.message)) return "predicated";
  throw new Error(
    `bonsai-discipline: the probe outcome ${JSON.stringify(o)} demonstrates NEITHER discipline. ` +
      `The probe has stopped discriminating (an evaluator changed, or the expression no longer forces the difference); ` +
      `refusing to certify a discipline from evidence that does not show one.`,
  );
}

// ─── which programs actually care ────────────────────────────────────────────

/** A reason a program's meaning depends on the discipline, with where it is. */
export interface SensitivityReason {
  readonly path: string;
  readonly cause: "call-in-arm" | "free-param-in-arm";
  readonly detail: string;
}

/**
 * Does this program's MEANING depend on which discipline evaluates it?
 *
 * A `Cond` whose arms are both total and closed computes the same value under
 * both disciplines — for those, a guard would be noise, and noise is how a guard
 * gets disabled. Sensitivity is decided by the two causes that were OBSERVED to
 * differ, not by speculation:
 *
 *   · **a `Call` in an arm** — under short-circuit the untaken arm's activity never
 *     runs; under predication `BonsaiSoft` reaches it (and declines `Call`
 *     outright). Effects and outcome both differ.
 *   · **a FREE param in an arm** — the executed case. Bound under one path, looked
 *     up and unbound under the other.
 *
 * Conservative by construction: it may over-report (a free param that is in fact
 * always bound at the call site), and it does not under-report on these two causes.
 *
 * NOT covered, and named rather than implied: an ill-typed `Binary` in an arm
 * (`BonsaiSoft` errors on it; short-circuit never sees it) and arithmetic overflow
 * — both real, neither detectable without types this analysis does not have. A
 * "sensitive: false" here means "not sensitive for the two causes checked."
 */
export function disciplineSensitivity(e: Expr): { sensitive: boolean; reasons: SensitivityReason[] } {
  const reasons: SensitivityReason[] = [];

  /** Collect the causes inside a single `Cond` arm. */
  const scanArm = (x: Expr, path: string, bound: ReadonlySet<string>): void => {
    switch (x.kind) {
      case "call":
        reasons.push({
          path,
          cause: "call-in-arm",
          detail: `\`${x.fn}\` is a call inside a Cond arm — a short-circuit evaluator may never run it, a predicated one always does`,
        });
        x.args.forEach((a, i) => scanArm(a, `${path}.args[${String(i)}]`, bound));
        return;
      case "param":
        if (!bound.has(x.name)) {
          reasons.push({
            path,
            cause: "free-param-in-arm",
            detail: `\`${x.name}\` is free inside a Cond arm — unbound it errors under predication and is never looked up under short-circuit`,
          });
        }
        return;
      case "lambda":
        scanArm(x.body, `${path}.body`, new Set([...bound, ...x.params]));
        return;
      case "binary":
        scanArm(x.left, `${path}.left`, bound);
        scanArm(x.right, `${path}.right`, bound);
        return;
      case "cond":
        scanArm(x.test, `${path}.test`, bound);
        scanArm(x.then, `${path}.then`, bound);
        scanArm(x.else, `${path}.else`, bound);
        return;
      case "const":
        return;
      default: {
        const unknown: string = (x as { kind: string }).kind;
        throw new Error(`bonsai-discipline: unknown Bonsai node kind \`${unknown}\``);
      }
    }
  };

  /** Walk the whole tree looking for `Cond`s; scan their arms (not their tests). */
  const walk = (x: Expr, path: string, bound: ReadonlySet<string>): void => {
    switch (x.kind) {
      case "cond":
        // The TEST is evaluated under both disciplines, so it is not a cause.
        walk(x.test, `${path}.test`, bound);
        scanArm(x.then, `${path}.then`, bound);
        scanArm(x.else, `${path}.else`, bound);
        return;
      case "lambda":
        walk(x.body, `${path}.body`, new Set([...bound, ...x.params]));
        return;
      case "binary":
        walk(x.left, `${path}.left`, bound);
        walk(x.right, `${path}.right`, bound);
        return;
      case "call":
        x.args.forEach((a, i) => walk(a, `${path}.args[${String(i)}]`, bound));
        return;
      case "const":
      case "param":
        return;
      default: {
        const unknown: string = (x as { kind: string }).kind;
        throw new Error(`bonsai-discipline: unknown Bonsai node kind \`${unknown}\``);
      }
    }
  };

  walk(e, "$", new Set<string>());
  return { sensitive: reasons.length > 0, reasons };
}

// ─── the guard ───────────────────────────────────────────────────────────────

/** What a checked handoff concluded, for callers that want to report rather than throw. */
export type HandoffVerdict =
  | { readonly ok: true; readonly why: "disciplines match" | "program is not discipline-sensitive" }
  | { readonly ok: false; readonly why: string };

/**
 * Decide whether `program` may be evaluated by `evaluator`, without throwing.
 *
 * The verdict names the FACT and leaves the reading to the caller — the neutral
 * shape `dual-use-detection-is-neutral-oracle-decides.md` asks for. `checkHandoff`
 * is the throwing form for call sites that want the refusal.
 */
export function handoffVerdict(program: AuthoredProgram, evaluator: EvaluatorRegistration): HandoffVerdict {
  if (program.discipline === evaluator.discipline) return { ok: true, why: "disciplines match" };
  const { sensitive, reasons } = disciplineSensitivity(program.expr);
  if (!sensitive) return { ok: true, why: "program is not discipline-sensitive" };
  return {
    ok: false,
    why:
      `DISCIPLINE SUBSTITUTION: the program from \`${program.origin}\` was authored under ` +
      `\`${program.discipline}\` (${DISCIPLINE_MEANING[program.discipline]}) and is aimed at ` +
      `\`${evaluator.name}\` (${evaluator.site}), which is \`${evaluator.discipline}\` ` +
      `(${DISCIPLINE_MEANING[evaluator.discipline]}). ` +
      `The program's meaning DEPENDS on which: ` +
      reasons.map((r) => `${r.path}: ${r.detail}`).join("; ") +
      `. Neither discipline is wrong — using one while assuming the other is.`,
  };
}

/**
 * The refusing form. Throws on substitution; returns the verdict otherwise.
 *
 * This is the behavioural bar: before it existed, a short-circuit-authored program
 * reached a predicated evaluator silently and produced a different answer. Through
 * this call it cannot.
 */
export function checkHandoff(program: AuthoredProgram, evaluator: EvaluatorRegistration): HandoffVerdict {
  const v = handoffVerdict(program, evaluator);
  if (!v.ok) throw new Error(`bonsai-discipline: ${v.why}`);
  return v;
}
