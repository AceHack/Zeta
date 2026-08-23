/**
 * env-witness.ts — how to prove a credential is IGNORED without creating one.
 *
 * THE CLASS THIS EXISTS FOR
 * ------------------------------------------------------------------------
 * On 2026-08-23 two different agents, within one hour, independently wrote a
 * test that proves "this code does not use ambient credentials" BY SETTING AN
 * AMBIENT CREDENTIAL, and both reddened `main` against
 * `src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts`. A third
 * built a scoped exemption mechanism in response and discarded it once the red
 * was fixed properly; a fourth narrowed the guard so one of the lines stopped
 * being reported. Four agents, two hours, one shape. Nobody was careless — the
 * pull is structural:
 *
 *   The only obvious way to test that a credential is ignored is to make one
 *   present. A guard that forbids making one present looks like it forbids
 *   testing its own property.
 *
 * It does not, and this module is the reason. The claim being tested is never
 * about `process.env`; it is about a FUNCTION OF an environment. So pass the
 * environment as a VALUE. The hostile case is then an object you constructed,
 * the detector is aimed at that object, and nothing ambient is ever touched.
 *
 * THE THREE FORMS, STRONGEST FIRST
 * ------------------------------------------------------------------------
 *  1. INJECT IT. The code under test takes `env` as a parameter and the hostile
 *     environment is a literal. `credential.ts`'s `buildChildEnv(parentEnv, ...)`
 *     is the shape, and its tests prove "the parent is not mutated" with no
 *     credential and no keychain anywhere in the run.
 *
 *  2. WITNESS IT (this module). When the subject is the DETECTOR rather than the
 *     tool — "would my env assertion actually notice a hoist?" — build the
 *     hoisted environment with `withHoistedCredential` and aim `envDigest` /
 *     `envDiffNames` / `envNamesCarrying` at it. The same mutant dies; the
 *     process environment is read, never written.
 *
 *  3. SCAN THE SOURCE. When the claim is "this module names no credential
 *     variable at all", assert it against comment-stripped source — the module's
 *     own header names those variables in order to say it ignores them, so
 *     scanning prose would fail on the documentation of the property and, worse,
 *     would pass the moment someone deleted that paragraph. Worked example:
 *     `src/Core.TypeScript/cluster/measure-lane-footprints.test.ts` (PR #14330).
 *
 * WHY THE VALUE FORM IS STRICTLY BETTER, NOT MERELY LINT-COMPLIANT
 * ------------------------------------------------------------------------
 *  - A `try/finally` restore leaves a real window. `bun test` runs a file's
 *    tests in ONE process, so between the assignment and the `finally` any child
 *    spawned by any concurrently-running test inherits the value — an
 *    environment variable crosses `exec` regardless of the child's identity,
 *    which is the entire defect the guard exists for. A constructed object has
 *    no window because it never crosses anything.
 *  - `expect(JSON.stringify(process.env)).toBe(before)` prints BOTH environments
 *    on failure. On a developer machine that diff is a live secret in a CI log.
 *    `envDigest` fails as two hashes, and `envDiffNames` says which NAMES moved.
 *    Values are never in the failure output.
 *
 * NOT SELF-EXEMPT — ON PURPOSE. This file is not in the linter's `SELF_EXEMPT`
 * roster and must never be added to it. The pattern's whole claim is that it
 * needs no exemption; a helper that had to be excused would refute itself.
 * `lint-no-ambient-credential-hoist.test.ts` pins the roster, so an addition is
 * a visible diff.
 *
 * Anchor: Goguen & Meseguer 1982, noninterference — influence enters only
 * through declared channels. A parameter is a declared channel; the ambient
 * environment is the definition of an undeclared one.
 */

import { createHash } from "node:crypto";

/** Anything environment-shaped: the real `process.env`, or one you built. */
export type EnvLike = Readonly<Record<string, string | undefined>>;

/** Ordinal (code-unit) comparison, never locale-sensitive. See `.claude/rules/culture-invariant-by-default.md`. */
function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function definedEntries(env: EnvLike): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(env)) if (typeof v === "string") out.push([k, v]);
  out.sort((x, y) => ordinal(x[0], y[0]));
  return out;
}

/**
 * A stable fingerprint of an environment: sha256 over NUL-separated name/value
 * pairs in ordinal key order. The separator is `\u0000` because it cannot occur
 * in a POSIX environment name or value, so no rename-plus-edit can collide two
 * different environments onto one digest. Two environments are byte-identical
 * iff their digests are.
 *
 * The hash is the point, not decoration: this value goes into assertions, and an
 * assertion's failure message gets printed. A digest cannot print a secret.
 */
export function envDigest(env: EnvLike): string {
  const h = createHash("sha256");
  for (const [k, v] of definedEntries(env)) {
    h.update(k, "utf8");
    h.update("\u0000", "utf8"); // NUL: cannot occur in a POSIX env name or value
    h.update(v, "utf8");
    h.update("\u0000", "utf8"); // NUL: cannot occur in a POSIX env name or value
  }
  return h.digest("hex");
}

/**
 * The NAMES that differ between two environments — added, removed, or changed —
 * in ordinal order. Names only: this is the "what moved" companion to
 * `envDigest`'s "did anything move", and it stays printable in a failing test.
 */
export function envDiffNames(before: EnvLike, after: EnvLike): string[] {
  const names = new Set<string>();
  for (const [k, v] of definedEntries(before)) if (after[k] !== v) names.add(k);
  for (const [k, v] of definedEntries(after)) if (before[k] !== v) names.add(k);
  return [...names].sort(ordinal);
}

/**
 * The names whose value contains `secret`. The leak, located — never the value.
 *
 * An empty `secret` returns `[]` rather than every name: a substring search for
 * "" matches everything, which would make a "nothing carries the token" check
 * pass or fail by vacuity instead of by measurement.
 */
export function envNamesCarrying(env: EnvLike, secret: string): string[] {
  if (secret === "") return [];
  const out: string[] = [];
  for (const [k, v] of definedEntries(env)) if (v.includes(secret)) out.push(k);
  return out;
}

/**
 * THE HOSTILE ENVIRONMENT, AS A VALUE.
 *
 * Returns a COPY of `env` with `name` set to `value`. It mutates nothing: not
 * the argument, and — when the argument is the real process environment — not
 * this process. That is the whole trick. The credential-shaped string exists
 * only inside an object you hold, so the detector under test gets the
 * adversarial input it needs and no descendant of this process can inherit it.
 */
export function withHoistedCredential(env: EnvLike, name: string, value: string): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const [k, v] of definedEntries(env)) copy[k] = v;
  copy[name] = value;
  return copy;
}
