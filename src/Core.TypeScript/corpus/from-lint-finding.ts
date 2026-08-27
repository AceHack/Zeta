/**
 * from-lint-finding.ts — a lint finding as a labelled-observation row.
 *
 * WHY. The correction corpus Aaron named (081M12CZRHC) is (rule, violation, repair).
 * `"Failed"` has no second half — Landauer erasure. A `FIX:` string is the human-readable
 * half of a supervised pair. This module is the first collector: it maps a finding onto
 * `labelled-observation.ts` and does NOT invent a repair when the linter did not teach one.
 *
 * HUB / SATELLITE (DV2). The observation identity is the violation (file + signature +
 * detail). The repair, if any, is a satellite label. Changing the FIX prose must not mint
 * a new observation — that would make the hub as unstable as the satellite.
 *
 * Dual-use: the FACT is "this finding carries a repair label" or it does not. This module
 * does not emit an `erasure` / `failure-only` verdict; absence of `lint/repair` is the
 * measurement. A later oracle may read that as heat.
 *
 * NO AMBIENT ANYTHING. Tick and asserter are supplied. No clock, no fs, no network.
 * Hash is over the hub fields only.
 *
 * Not a scraper. Does not walk the 27 `lint-*.ts` modules. Does not write patches.
 */

import { createHash } from "node:crypto";
import {
  addLabels,
  type Asserter,
  type CorpusRow,
  type Label,
  type LabelRefusal,
} from "./labelled-observation.ts";

const CORPUS = "lint";
const NS = "lint";

/** The smallest finding a collector can hold. Line is omitted: it moves. */
export interface LintFindingSeed {
  readonly rule: string;
  readonly file: string;
  readonly signature: string;
  readonly detail: string;
  /**
   * Present only when the detector taught a repair. Empty / whitespace is treated as
   * ABSENT — do not mint a `lint/repair` label that cannot be disagreed with honestly.
   */
  readonly fix?: string;
}

export interface FromLintFindingInput {
  readonly finding: LintFindingSeed;
  readonly assertedBy: Asserter;
  readonly at: number;
}

export interface FromLintFindingResult {
  readonly row: CorpusRow | null;
  readonly refused: readonly LabelRefusal[];
  readonly why: string | null;
}

function frame(s: string): string {
  return `${String(s.length)}:${s};`;
}

/** Hub identity: violation only. Repair is not in this hash. */
export function lintFindingId(finding: LintFindingSeed): string {
  const material = `lint-finding/v1\n${frame(finding.file)}${frame(finding.signature)}${frame(finding.detail)}`;
  return `sha256:${createHash("sha256").update(material, "utf8").digest("hex")}`;
}

function trimOrEmpty(s: string | undefined): string {
  if (s === undefined) return "";
  return s.trim();
}

function seedRefusalReason(finding: LintFindingSeed, assertedBy: Asserter, at: number): string | null {
  if (finding.file.trim().length === 0) return "file is empty";
  if (finding.signature.trim().length === 0) return "signature is empty";
  if (finding.detail.trim().length === 0) return "detail is empty — a violation with no content is not an observation";
  if (finding.rule.trim().length === 0) return "rule is empty";
  if (assertedBy.length === 0) return "label has no asserter — an unattributed label cannot be disagreed with, which defeats the corpus";
  if (!Number.isInteger(at) || at < 0) return `at ${String(at)} is not a non-negative tick`;
  return null;
}

function labelsForFinding(finding: LintFindingSeed, assertedBy: Asserter, at: number): readonly Label[] {
  const labels: Label[] = [
    { key: { namespace: NS, name: "rule" }, value: finding.rule.trim(), assertedBy, at },
    { key: { namespace: NS, name: "path" }, value: finding.file.trim(), assertedBy, at },
  ];
  const fix = trimOrEmpty(finding.fix);
  if (fix.length > 0) {
    labels.push({ key: { namespace: NS, name: "repair" }, value: fix, assertedBy, at });
  }
  return labels;
}

/**
 * Map a finding onto a corpus row. Returns `row: null` when the HUB cannot be formed.
 * Label-shape refusals (should not happen for labels we construct) are still data.
 */
export function fromLintFinding(input: FromLintFindingInput): FromLintFindingResult {
  const why = seedRefusalReason(input.finding, input.assertedBy, input.at);
  if (why !== null) return { row: null, refused: [], why };
  const empty: CorpusRow = {
    observation: {
      id: lintFindingId(input.finding),
      origin: { corpus: CORPUS, ref: `${input.finding.file.trim()}#${input.finding.signature.trim()}` },
      content: input.finding.detail.trim(),
      provenance: null,
    },
    labels: [],
  };
  const { row, refused } = addLabels(empty, labelsForFinding(input.finding, input.assertedBy, input.at));
  return { row, refused, why: null };
}
