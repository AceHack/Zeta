#!/usr/bin/env bun
// The PREMISE under the `src/Core.TLA/tla2tools.jar` rolling-auto-accept
// exception, checked offline on every gate run.
//
// THE EXCEPTION'S STATED REASON, and it is a claim about this repo rather than
// about tlaplus: we track the ROLLING v1.8.0 prerelease instead of the
// immutable v1.7.4 release because v1.7.4 prints the generic
//
//     Temporal properties were violated.
//
// where v1.8.0 prints
//
//     Temporal property Deterrence was violated.
//
// and `registry/tlc-models.json` pins the second form as an `expectDetail`. A
// checker that cannot say WHICH temporal property failed cannot discriminate
// the QuorumCollateralDeterrenceR2 witness from any other temporal violation,
// so the older, immutable, safer-to-pin jar is the weaker artefact. That is the
// whole reason a rolling upstream is tolerated here at all, and it is the
// reason the maintainer accepted the auto-accept exception on top of it.
//
// SO THE PREMISE IS FALSIFIABLE, AND THIS FALSIFIES IT: if no gate-tier model
// expects a NAMED temporal property any more, the repo no longer needs what
// only the rolling build provides, and the exception has outlived its reason
// regardless of what its `expires=` date says. This exits 1 in that case, which
// turns "the reason evaporated" from something nobody would notice into a red
// gate.
//
// WHAT THIS DOES NOT CHECK, said out loud rather than implied:
//
//   * whether tlaplus has cut a STABLE release carrying the named-property
//     diagnostic. That is the real exit condition and it needs the network, so
//     it is a manual revisit — the same disposition
//     `tools/setup/manifests/pinned-refs` records for the npm-advisory row
//     (`remeasure=manual:...`). It is written in the exception row's tradeoff
//     doc, not pretended at here.
//   * whether the rolling bytes currently on disk are trustworthy. Nothing
//     offline can check that; that is what `repin-rolling.ts` is for.
//
// Exit codes: 0 premise holds · 1 premise gone · 2 the check could not run.
//
// 081M24396B2087G0R000MDMDEA

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REGISTRY = "registry/tlc-models.json";

/**
 * The v1.8.0-only diagnostic shape: `Temporal property <Name> was violated`.
 *
 * Anchored on the NAME being present, which is the whole discrimination. The
 * v1.7.4 string is `Temporal properties were violated.` — plural, no name — and
 * it does not match, which is what makes this a check rather than a formality.
 */
export const NAMED_TEMPORAL = /^Temporal property \S+ was violated$/;

export interface TlcModelRow {
  readonly id?: unknown;
  readonly tier?: unknown;
  readonly expectDetail?: unknown;
}

/**
 * Model ids whose `expectDetail` names a specific temporal property.
 *
 * Restricted to `tier: "gate"` deliberately: an extended-tier model is declared
 * as NOT running in the PR lane, so an expectation only it carries is not
 * something the fleet's gate depends on, and resting a live security exception
 * on a model nothing runs would be the vacuity class.
 */
export function gateModelsNeedingNamedTemporal(models: readonly TlcModelRow[]): readonly string[] {
  const out: string[] = [];
  for (const model of models) {
    if (model.tier !== "gate") continue;
    const detail = model.expectDetail;
    if (typeof detail !== "string") continue;
    if (!NAMED_TEMPORAL.test(detail)) continue;
    out.push(typeof model.id === "string" ? model.id : "<unnamed>");
  }
  return out;
}

export function checkPremise(registryText: string): { readonly ok: boolean; readonly message: string } {
  let parsed: { models?: unknown };
  try {
    parsed = JSON.parse(registryText) as { models?: unknown };
  } catch (err) {
    throw new Error(`${REGISTRY} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const models = parsed.models;
  if (!Array.isArray(models)) {
    throw new Error(`${REGISTRY} has no models array`);
  }
  const needing = gateModelsNeedingNamedTemporal(models as readonly TlcModelRow[]);
  if (needing.length === 0) {
    return {
      ok: false,
      message:
        `PREMISE GONE: no gate-tier model in ${REGISTRY} expects a NAMED temporal\n` +
        "property any more (`Temporal property <Name> was violated`). That named\n" +
        "diagnostic is the ONLY thing the rolling v1.8.0 prerelease provides over the\n" +
        "immutable v1.7.4 release, so the reason for tracking a rolling upstream — and\n" +
        "therefore the reason for the auto-accept exception on it — has evaporated.\n" +
        "Retire the row in tools/setup/manifests/from-url-rolling-exceptions and pin\n" +
        "an immutable release instead.",
    };
  }
  return {
    ok: true,
    message:
      `premise holds: ${String(needing.length)} gate-tier model(s) expect a named temporal\n` +
      "property, which only the rolling build reports: " + needing.join(", "),
  };
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  let verdict: { ok: boolean; message: string };
  try {
    verdict = checkPremise(readFileSync(join(repoRoot, REGISTRY), "utf8"));
  } catch (err) {
    // Exit 2, never 0: a check that could not run is not a check that passed.
    process.stderr.write((err instanceof Error ? err.message : String(err)) + "\n");
    process.exit(2);
  }
  process.stdout.write(verdict.message + "\n");
  process.exit(verdict.ok ? 0 : 1);
}
