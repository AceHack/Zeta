#!/usr/bin/env bun
// lint-treaty-rule-discrimination.ts — the guard that would have blocked the #10759 premise.
//
// PR #10759 was filed on the premise "the tie-break behaviour is byte-locked into the
// four-oracle treaty." Measured, that premise was FALSE: first-occurrence and
// ordinal-minimum each changed 0 of 7 pinned vectors, and six of the seven had no tie
// reaching quorum at all, so they could not discriminate ANY tie-break rule. Its own
// summary is the sharpest statement of the class — "the treaty pinned a POINT; the
// prose claimed a RULE."
//
// This is spec-side mutation testing, one level up from `mutation-runner.ts`. That tool
// mutates the CODE and asks whether a test notices; this one mutates the RULE and asks
// whether a VECTOR notices. Same principle: a test that survives mutation is not a
// falsifier, and a treaty that survives a rule-swap does not pin that rule.
//
// WHAT IT CHECKS (and, just as importantly, what it does not)
// ----------------------------------------------------------
// A golden-vector treaty does two jobs. Job 1, cross-oracle byte agreement, is real and
// is NOT audited here — reporting a treaty as "vacuous" when it does job 1 fine would be
// the overreach this lint exists to catch. Only job 2, RULE PINNING, is checked:
//
//   expect: "excluded"      -> at least one vector MUST change under the alternative.
//                              0 => the treaty pins a point, not the rule. FAIL.
//   expect: "not-excluded"  -> no vector may change, AND a `kind` + `reason` must say
//                              which of the honest zeroes this is (gap / equivalent /
//                              unreachable / blocked / declared). A non-zero means a
//                              discriminator has since been added: the declaration is
//                              stale and must be PROMOTED. FAIL.
//   kind: "gap"             -> a real, reachable, unexcluded alternative. Must cite a
//                              filed work-item, or the finding evaporates. FAIL if not.
//
// The harness is generic; the alternative evaluators in `treaty-rule-alternatives.ts`
// are necessarily hand-written per treaty. That is inherent, not a shortcut: "plausible
// alternative rule" is a judgement about what a competent implementer might have chosen
// and cannot be enumerated mechanically. What IS mechanical, and is the whole point, is
// evaluating a declared alternative and refusing a zero that nobody explained.
//
// Usage: bun src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.ts [--verbose]
// Exit:  0 — every declared alternative behaves as declared
//        1 — at least one declaration is contradicted by measurement

import { readFileSync, existsSync } from "node:fs";
import { TREATY_DECLARATIONS, type AlternativeRule, type TreatyDeclaration } from "./treaty-rule-alternatives";

export interface CheckResult {
  readonly treaty: string;
  readonly alternative: string;
  readonly changed: number;
  readonly total: number;
  readonly ok: boolean;
  /** Populated when `ok` is false. */
  readonly failure?: string;
}

/**
 * A `gap` is only a finding if it was filed; an unfiled gap is a note that will rot.
 * A ZetaId is 26 Crockford base32 characters — the alphabet omits I, L, O and U.
 */
export function citesWorkItem(reason: string): boolean {
  return /\b081[0-9A-HJKMNP-TV-Z]{23}\b/.test(reason);
}

/** Evaluate one declared alternative against one loaded seed. */
export function checkAlternative(decl: TreatyDeclaration, alt: AlternativeRule, seed: unknown): CheckResult {
  const total = decl.vectorCount(seed);
  const changed = alt.evaluate(seed);
  const base = { treaty: decl.treaty, alternative: alt.name, changed, total };

  if (alt.expect === "excluded") {
    if (changed === 0) {
      return {
        ...base,
        ok: false,
        failure:
          `declared EXCLUDED but changes 0 of ${total} vectors.\n` +
          `     claim (${decl.claimSource}): ${decl.claim}\n` +
          `     The vectors pin a POINT, not this rule. Either add a discriminating vector, or\n` +
          `     re-declare it as not-excluded with a kind + reason saying which zero this is.`,
      };
    }
    return { ...base, ok: true };
  }

  // expect === "not-excluded"
  if (!alt.kind) {
    return {
      ...base,
      ok: false,
      failure: "declared NOT-EXCLUDED without a `kind` — an unexplained zero is the defect itself.",
    };
  }
  if (!alt.reason || alt.reason.trim().length === 0) {
    return { ...base, ok: false, failure: `declared NOT-EXCLUDED (kind: ${alt.kind}) without a \`reason\`.` };
  }
  if (alt.kind === "gap" && !citesWorkItem(alt.reason)) {
    return {
      ...base,
      ok: false,
      failure:
        "declared a `gap` — a reachably-different rule that no vector excludes — but the reason cites no\n" +
        "     work-item ZetaId. A gap nobody filed is a note that will rot; file it and cite the id.",
    };
  }
  if (changed > 0) {
    return {
      ...base,
      ok: false,
      failure:
        `declared NOT-EXCLUDED (kind: ${alt.kind}) but now changes ${changed} of ${total} vectors.\n` +
        `     A discriminator has been added since this was measured. PROMOTE the row to\n` +
        `     expect: "excluded" and drop the reason — the treaty now pins the rule.`,
    };
  }
  return { ...base, ok: true };
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  const verbose = argv.includes("--verbose");
  const failures: string[] = [];
  const results: CheckResult[] = [];

  for (const decl of TREATY_DECLARATIONS) {
    if (!existsSync(decl.treaty)) {
      failures.push(
        `  ${decl.treaty}\n     declared, but the seed FILE IS MISSING. A claim whose evidence is absent is worse than one that disagrees.`,
      );
      continue;
    }
    let seed: unknown;
    try {
      seed = JSON.parse(readFileSync(decl.treaty, "utf8"));
    } catch (e) {
      failures.push(`  ${decl.treaty}\n     is not parseable JSON: ${String(e)}`);
      continue;
    }
    for (const alt of decl.alternatives) {
      const r = checkAlternative(decl, alt, seed);
      results.push(r);
      if (!r.ok) failures.push(`  ${r.treaty}\n     alt: ${r.alternative}\n     ${r.failure}`);
    }
  }

  if (verbose) {
    for (const decl of TREATY_DECLARATIONS) {
      const rs = results.filter((r) => r.treaty === decl.treaty);
      if (rs.length === 0) continue;
      console.log(`\n${decl.treaty}`);
      console.log(`  claim (${decl.claimSource}): ${decl.claim}`);
      for (const r of rs) {
        const alt = decl.alternatives.find((a) => a.name === r.alternative)!;
        const tag = alt.expect === "excluded" ? "excluded  " : `${alt.kind}`.padEnd(10);
        console.log(
          `  ${tag} ${String(r.changed).padStart(3)} of ${String(r.total).padStart(3)} change | ${r.alternative}`,
        );
      }
    }
    console.log("");
  }

  if (failures.length > 0) {
    console.error("[treaty-rule-discrimination] x declared alternatives contradicted by measurement:\n");
    console.error(failures.join("\n\n"));
    console.error(
      "\n  A golden-vector treaty does TWO jobs: cross-oracle byte agreement (real, not audited here)\n" +
        "  and RULE PINNING (vacuous unless some vector discriminates the claimed rule). Prose that\n" +
        "  claims the second while the vectors only do the first is the #10759 class.\n",
    );
    process.exit(1);
  }

  const gaps = TREATY_DECLARATIONS.flatMap((d) => d.alternatives.filter((a) => a.kind === "gap")).length;
  console.log(
    `[treaty-rule-discrimination] ok ${results.length} declared alternative(s) across ` +
      `${TREATY_DECLARATIONS.length} treaties behave as declared` +
      (gaps > 0 ? `; ${gaps} open gap(s) filed and tracked.` : "."),
  );
}

if (import.meta.main) main();
