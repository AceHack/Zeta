// tlc-invocation.ts -- the ONE place a TLC command line is built.
//
// WHY THIS FILE EXISTS. On 2026-08-13 a spec was MEASURED by a script passing
// -deadlock (which DISABLES deadlock checking) and CHECKED by a runner passing no
// such flag, so a hand-run green and a gated green were not the same result and
// nothing said so. Adding -config was necessary and not sufficient: the next
// mismatch would have been a different flag. The invocation is therefore pinned
// in registry/tlc-models.json and built HERE, from that file, for every consumer.
//
// RULE: no consumer may append a flag of its own. If a model needs different
// behaviour it changes the registry entry or the .cfg, never the command line --
// because the command line is not recorded next to the result and the .cfg is.
//
// Sibling consumer: tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs (the CI gate),
// which reads the same registry and applies the same verdict rule.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Whether a model is expected to come back clean or to produce a counterexample. */
export type TlcExpectation = "valid" | "violation";

/** Where a model sits in the CI budget. `gate` runs on every PR; `extended` is
 *  declared, reasoned, and deliberately not in the PR lane. An `extended` entry
 *  is a NAMED gap, which is the whole point of recording it. */
export type TlcTier = "gate" | "extended";

/** What the deadlock check is actually worth for this model.
 *   - off-cfg     CHECK_DEADLOCK FALSE is declared in the .cfg, with the reason
 *                 written into the .cfg itself.
 *   - on-vacuous  checking is left on, but Next carries an unconditional stutter
 *                 disjunct, so no state can deadlock. The check CANNOT FAIL and
 *                 the model makes no deadlock-freedom claim.
 *   - on          checking is on and no unconditional stutter was found, so the
 *                 green does carry a deadlock-freedom claim.
 *  The middle value exists so that a vacuous check stops looking like a passing
 *  one in the artefact, not only in prose. */
export type TlcDeadlockStatus = "off-cfg" | "on-vacuous" | "on";

export interface TlcModel {
  readonly id: string;
  readonly module: string;
  readonly config: string;
  readonly expect: TlcExpectation;
  /** Substring of the TLC `Error:` line. Required when expect is violation, so a
   *  witness that starts violating a DIFFERENT property fails instead of passing. */
  readonly expectDetail?: string;
  readonly exitCode: number;
  readonly tier: TlcTier;
  readonly tierReason?: string;
  readonly deadlock: TlcDeadlockStatus;
  /** Asserted. Present only for EXHAUSTIVE runs (0 states left on queue), which
   *  are worker-independent and therefore a genuine regression detector. */
  readonly distinctStates?: number;
  /** Recorded, NEVER asserted. A run that halts on violation explores in an order
   *  that depends on worker count, so this number is history, not a contract. */
  readonly haltDistinctStates?: number;
  readonly measured?: string;
  readonly note?: string;
}

export interface TlcToolchain {
  readonly jar: string;
  readonly jarSha256: string;
  readonly versionBanner: string;
  readonly note?: string;
}

export interface TlcInvocationPin {
  readonly jvm: readonly string[];
  readonly jvmDarwinArm64Extra: readonly string[];
  readonly workers: number;
  readonly note?: string;
}

export interface TlcRegistry {
  readonly note?: string;
  readonly toolchain: TlcToolchain;
  readonly invocation: TlcInvocationPin;
  readonly models: readonly TlcModel[];
}

export const REGISTRY_RELATIVE_PATH = "registry/tlc-models.json";
export const SPECS_RELATIVE_PATH = "src/Core.TLA/specs";

export function loadTlcRegistry(repoRoot: string): TlcRegistry {
  const raw = readFileSync(join(repoRoot, REGISTRY_RELATIVE_PATH), "utf8");
  return JSON.parse(raw) as TlcRegistry;
}

/** JVM policy, from the registry pin. OpenJDK 26 on macOS/aarch64 has crashed in
 *  C2 type-speculation cleanup after a model completed, so that one platform keeps
 *  C2 and disables only the failing optimisation. */
export function tlcJvmArguments(
  registry: TlcRegistry,
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): readonly string[] {
  const base = [...registry.invocation.jvm];
  if (platform === "darwin" && architecture === "arm64") {
    base.push(...registry.invocation.jvmDarwinArm64Extra);
  }
  return base;
}

/** The complete argv after the java executable. Every flag TLC sees originates here. */
export function buildTlcArgv(
  registry: TlcRegistry,
  model: TlcModel,
  jarPath: string,
  metadir: string,
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): readonly string[] {
  return [
    ...tlcJvmArguments(registry, platform, architecture),
    "-cp", jarPath,
    "tlc2.TLC",
    "-metadir", metadir,
    "-workers", String(registry.invocation.workers),
    "-config", model.config,
    model.module,
  ];
}

/** The invocation as a copy-pasteable line, for quoting NEXT TO a result. A verdict
 *  recorded without this string is a claim about an unknown experiment. */
export function invocationLine(registry: TlcRegistry, model: TlcModel): string {
  const argv = buildTlcArgv(registry, model, "../tla2tools.jar", "/tmp/tlc-" + model.id);
  return "cd " + SPECS_RELATIVE_PATH + " && java " + argv.join(" ");
}

export interface TlcJudgement {
  readonly ok: boolean;
  readonly reason: string;
}

const CLEAN_MARKER = "Model checking completed. No error has been found";

/** The verdict rule, stated once. Four independent ways to fail, and none of them
 *  is I did not like the output: the exit code, the clean marker, the pinned error
 *  substring, and the pinned exhaustive state count all have to agree with the
 *  registry. A witness that stops firing FAILS -- a model that has stopped modelling
 *  anything is not a passing check. */
export function judgeTlcRun(model: TlcModel, exitCode: number, stdout: string): TlcJudgement {
  // Checked FIRST, ahead of the exit code, because it is the diagnostic that
  // matters most: a negative config coming back clean means the model has
  // stopped modelling anything, and that must not read as a passing check.
  if (model.expect === "violation" && stdout.includes(CLEAN_MARKER)) {
    return { ok: false, reason: "expected the violation " + String(model.expectDetail) + " and TLC found none -- the witness has stopped firing" };
  }
  if (exitCode !== model.exitCode) {
    return { ok: false, reason: "exit code " + String(exitCode) + ", registry pins " + String(model.exitCode) };
  }
  const clean = stdout.includes(CLEAN_MARKER);
  if (model.expect === "valid") {
    if (!clean) return { ok: false, reason: "expected a clean run, TLC did not report the completion marker" };
  } else {
    if (clean) {
      return { ok: false, reason: "expected the violation " + String(model.expectDetail) + " and TLC found none -- the witness has stopped firing" };
    }
    const detail = model.expectDetail ?? "";
    if (detail === "" || !stdout.includes(detail)) {
      return { ok: false, reason: "expected the violation " + detail + " and TLC reported a different one" };
    }
  }
  const expectedDistinct = model.distinctStates;
  if (expectedDistinct !== undefined) {
    // The LAST match, not the first: TLC prints a progress line every minute
    // carrying the same shape, so exec() would read a partial count off a
    // long-running model and call it the state space.
    const all = [...stdout.matchAll(/([\d,]+) distinct states found/g)];
    const found = all.length === 0 ? "" : (all[all.length - 1]?.[1] ?? "");
    const actual = Number.parseInt(found.replace(/,/g, ""), 10);
    if (!Number.isFinite(actual) || actual !== expectedDistinct) {
      return { ok: false, reason: "explored " + found + " distinct states, registry pins " + String(expectedDistinct) };
    }
  }
  return { ok: true, reason: "" };
}

/** Asserts the jar actually loaded is the pinned one. TLC prints its banner on the
 *  first line; a swapped jar changes it. This is the TLC analogue of a solver-version
 *  floor, and it is cheaper than one because the jar is committed to the repo. */
export function judgeToolchainBanner(registry: TlcRegistry, stdout: string): TlcJudgement {
  const expected = registry.toolchain.versionBanner;
  if (stdout.includes(expected)) return { ok: true, reason: "" };
  const first = stdout.split("\n")[0] ?? "";
  return { ok: false, reason: "TLC banner is " + first.trim() + ", registry pins " + expected };
}
