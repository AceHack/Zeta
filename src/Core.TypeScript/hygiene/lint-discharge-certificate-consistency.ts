#!/usr/bin/env bun
// lint-discharge-certificate-consistency.ts — the guard that would have blocked Z-2.
//
// On 2026-08-01 five conjecture rows (Z-2/4/5/6/7) were written as "§A — DISCHARGED"
// in FROZEN-CORE-AND-CONJECTURE-REGISTER.md. §A is the frozen core — "closed, build on
// this, nothing here rests on anything open" — so a false row there is an integrity
// problem, not a style one.
//
// Z-2 was the decisive case: its own cited certificate said
//     { "status": "OPEN", "relativeError": 0.9468, "falsifierThresholdRelative": 0.25 }
// The script ran, HONESTLY REPORTED FAILURE at 94.7% error against a 25% threshold —
// and the register cell was written as DISCHARGED anyway. The falsifier fired and was
// overridden by prose.
//
// That specific failure needs no judgement to catch: a row claiming DISCHARGED while
// the certificate it cites says otherwise is a MECHANICAL contradiction. This lint is
// that check. It is deliberately narrow — it does not evaluate whether a discharge is
// *good* (see the audit for why that needs a human/verifier); it only refuses rows that
// contradict their own evidence.
//
// Design notes:
//   - Reads only committed files; no network, no clock. Pure and replayable.
//   - Fails LOUDLY with the row, the certificate, and the mismatch — never a silent skip.
//   - A row citing a certificate that does NOT EXIST is also a failure (a claim whose
//     evidence is missing is worse than one whose evidence disagrees).
//
// Usage: bun src/Core.TypeScript/hygiene/lint-discharge-certificate-consistency.ts
// Exit:  0 — every DISCHARGED row's certificate agrees AND every §A anchor resolves
//        1 — a row contradicts (or is missing) its certificate, or a §A anchor names no file

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";

const REGISTER = "docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md";

/** A row asserting §A DISCHARGED, plus every certificate path it cites. */
export interface DischargeRow {
  readonly line: number;
  readonly label: string;
  readonly certificates: readonly string[];
  /** Whether the row cites ANY evidence artifact (certificate, proof, byte-lock, test, SMT). */
  readonly evidence: boolean;
}

/** Does this row TEXT assert a live §A discharge? Demotion banners explicitly do not. */
export function assertsDischarged(text: string): boolean {
  if (!/§A\s*[—-]\s*DISCHARGED/.test(text)) return false;
  // A row that has been demoted retains its prior text for the record; that is not a claim.
  if (/DEMOTED\s+§A/.test(text)) return false;
  if (/NOT IN FORCE/.test(text)) return false;
  return true;
}

/** Certificate paths cited anywhere in a row. */
export function citedCertificates(text: string): readonly string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/docs\/research\/[A-Za-z0-9._-]*certificate[A-Za-z0-9._-]*\.json/g)) {
    out.add(m[0]);
  }
  return [...out];
}

/**
 * Does the row cite ANY evidence artifact at all?
 *
 * The register's own §A gate (lines 21-22) admits a row on "a proof / byte-lock / conformance
 * anchor that is closed" — so evidence is broader than a certificate. But it is never NOTHING.
 * A row asserting DISCHARGED while pointing at no artifact whatsoever is discharged BY ASSERTION,
 * which is the failure this whole guard exists for — arguably worse than contradicting a
 * certificate, because there is not even a claim to check.
 *
 * Real example: Z-3 claimed "§A — DISCHARGED (analytic identity)" citing no artifact. The
 * "identity" was -ln(1/x) = ln(x) evaluated at a rendering constant — true for every x, and
 * therefore unfalsifiable. The certificate check skipped it; this one does not.
 */
export function citesAnyEvidence(text: string): boolean {
  return (
    citedCertificates(text).length > 0 ||
    /\.lean\b/.test(text) || // Lean proof
    /\.tla\b/.test(text) || // TLA+ spec
    /golden[- ]?vector/i.test(text) || // byte-lock
    /\.Tests?\.fs\b|\.test\.ts\b/.test(text) || // a gated test
    /\.smt2\b|\bZ3\b/.test(text) // SMT obligation
  );
}

// ── The §A ANCHOR check (added 2026-08-18, Soraya) ────────────────────────────
//
// WHY THIS EXISTS. The DISCHARGED check above scans for the literal phrase
// `§A — DISCHARGED`. As of 2026-08-18 that phrase survives on SIX lines of the
// register and every one of them sits inside a `DEMOTED §A → §B` banner, which
// the check correctly excludes. So it scanned ZERO rows and printed a tick.
//
// A green over an empty set is the vacuity class: "0 findings" and "0 measurements"
// are different facts, and this lint reported them in the same words. §A meanwhile
// holds 40+ live rows, every one of which claims PROVEN and names its anchor, and
// nothing checked that those anchors resolve to anything.
//
// This block gives the lint jurisdiction it can actually exercise. It does NOT
// re-judge whether a row's evidence is sufficient (that is the register's own
// promotion gate, and a lint cannot hold it); it enforces the one mechanical
// precondition without which the sufficiency question cannot even be asked:
//
//     an anchor named in §A must resolve to a file that exists.
//
// It went red when written — §A's "Reticulum Transport Integration" row named
// `ReticulumTransport.fs`, a file that has never existed in this repo; the code
// it describes is `src/Bayesian/MeshLatencyModel.fs`. A citation nobody can open
// is an anchor cited but never CHECKED (.claude/rules/anchor-to-human-prior-art.md).

/** Extensions that name a checkable artifact rather than a prose document. */
const ARTIFACT_EXT = /\.(fs|fsx|lean|tla|als|smt2|cs|rs|ts|py|go)$/;

/** Backticked artifact tokens in a chunk of register text. */
export function citedArtifacts(text: string): readonly string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([A-Za-z0-9_./-]+)`/g)) {
    const tok = m[1];
    if (tok !== undefined && ARTIFACT_EXT.test(tok)) out.add(tok);
  }
  return [...out];
}

/**
 * Does a cited token resolve to a real file?
 *
 * §A cites two ways and both are legitimate: a repo-relative path
 * (`src/Core/SoftValue.fs`) or a bare basename (`SoftValue.fs`). A basename is
 * accepted when SOME tracked file carries it — deliberately lenient, because the
 * failure this catches is a name that exists nowhere at all, not an ambiguous one.
 */
export function artifactResolves(
  token: string,
  root: string,
  trackedBasenames: ReadonlySet<string>,
): boolean {
  if (token.includes("/") && existsSync(join(root, token))) return true;
  return trackedBasenames.has(basename(token));
}

/** The §A region of the register — heading to the next top-level heading. */
export function sectionABody(body: string): string {
  const start = body.indexOf("## A. THE FROZEN CORE");
  if (start < 0) return "";
  const rest = body.slice(start);
  const end = rest.indexOf("\n## B.");
  return end < 0 ? rest : rest.slice(0, end);
}

/** Basenames of every tracked file, read from the index rather than a walk. */
function trackedBasenames(root: string): ReadonlySet<string> {
  const out = new Set<string>();
  // maxBuffer: the tracked-file listing is ~7 MB here and the 1 MB default
  // makes this throw ENOBUFS. It throws rather than truncating, which is the
  // right failure -- a SHORT list would have silently made dangling anchors
  // look resolvable. Sized generously and left loud.
  // git is a hard prerequisite of this repo and the args are an array, so no
  // shell is involved.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const listing = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  for (const f of listing.split("\n")) {
    if (f.length > 0) out.add(basename(f));
  }
  return out;
}

/** Short human label for a row (the bolded conjecture name, else a truncation). */
export function rowLabel(text: string): string {
  const m = text.match(/\*\*([^*]{3,80})\*\*/);
  return m?.[1]?.trim() ?? text.slice(0, 60).trim();
}

export function scanRegister(body: string): readonly DischargeRow[] {
  const rows: DischargeRow[] = [];
  body.split("\n").forEach((text, idx) => {
    if (!assertsDischarged(text)) return;
    rows.push({
      line: idx + 1,
      label: rowLabel(text),
      certificates: citedCertificates(text),
      evidence: citesAnyEvidence(text),
    });
  });
  return rows;
}

/** A certificate is consistent only if it explicitly states a discharged status. */
export function certificateAgrees(raw: string): { ok: boolean; status: string } {
  let status = "<unparseable>";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    status = typeof parsed.status === "string" ? parsed.status : "<no status field>";
  } catch {
    return { ok: false, status: "<invalid JSON>" };
  }
  return { ok: /^DISCHARGED$/i.test(status.trim()), status };
}

/** Every way one DISCHARGED row can fail its certificate/evidence obligation. */
function certificateFailures(row: DischargeRow, root: string): string[] {
  // No certificate is fine ONLY if some other evidence artifact is cited (proof,
  // byte-lock, gated test, SMT obligation). Citing nothing at all is
  // discharge-by-assertion.
  if (row.certificates.length === 0) {
    if (row.evidence) return [];
    return [
      `  ${REGISTER}:${String(row.line)} — "${row.label}"\n     claims §A DISCHARGED but cites NO evidence artifact at all` +
        ` (no certificate, proof, byte-lock, gated test, or SMT obligation) — discharged by assertion`,
    ];
  }
  return row.certificates.flatMap((cert) => {
    const certPath = join(root, cert);
    if (!existsSync(certPath)) {
      return [
        `  ${REGISTER}:${String(row.line)} — "${row.label}"\n     claims §A DISCHARGED but its cited certificate is MISSING: ${cert}`,
      ];
    }
    const { ok, status } = certificateAgrees(readFileSync(certPath, "utf8"));
    return ok
      ? []
      : [`  ${REGISTER}:${String(row.line)} — "${row.label}"\n     claims §A DISCHARGED but ${cert} says status = "${status}"`];
  });
}

/** One failure line per §A anchor that names no tracked file. */
function danglingAnchorFailures(anchors: readonly string[], root: string): string[] {
  const known = trackedBasenames(root);
  return anchors
    .filter((a) => !artifactResolves(a, root, known))
    .map(
      (a) =>
        `  ${REGISTER} §A — cites \`${a}\`, which resolves to NO tracked file.\n` +
        `     §A anchors are CHECKED, not merely cited. Repair the path, or demote the row to §B.`,
    );
}

function main(): void {
  const root = process.cwd();
  const registerPath = join(root, REGISTER);
  if (!existsSync(registerPath)) {
    console.error(`[discharge-consistency] FATAL: ${REGISTER} not found (run from the repo root).`);
    process.exit(1);
  }

  const rows = scanRegister(readFileSync(registerPath, "utf8"));
  const failures: string[] = rows.flatMap((row) => certificateFailures(row, root));

  // ── §A anchor resolution — the half of this lint that has live jurisdiction ──
  const anchors = citedArtifacts(sectionABody(readFileSync(registerPath, "utf8")));
  failures.push(...danglingAnchorFailures(anchors, root));

  if (failures.length > 0) {
    console.error("[discharge-consistency] ✗ §A-DISCHARGED rows failed the evidence check:\n");
    console.error(failures.join("\n\n"));
    console.error(
      "\n  §A is the frozen core — 'closed, build on this, nothing here rests on anything open'.\n" +
        "  A DISCHARGED row must cite evidence, and that evidence must agree with it.\n" +
        "  Either produce/repair the evidence, or demote the row to §B.\n",
    );
    process.exit(1);
  }

  // "0 findings" and "0 measurements" are DIFFERENT FACTS. Say which one this is.
  // The old message said "every cited certificate agrees" over an EMPTY set -- a check
  // that did not run, wearing the words of one that passed.
  if (rows.length === 0) {
    console.log(
      "[discharge-consistency] ! ZERO rows matched the literal DISCHARGED phrasing, so the\n" +
        "  certificate half of this lint MEASURED NOTHING -- which is not the same fact as\n" +
        "  finding nothing wrong. Live section-A rows carry a PROVEN / FULL PROVEN banner\n" +
        "  instead; widening the matcher needs the section-A table triaged first, and is\n" +
        "  filed as 081M0B2R2BQ087G0R000EC2E9Y rather than silently skipped.",
    );
  } else {
    console.log(
      `[discharge-consistency] ✓ ${String(rows.length)} §A-DISCHARGED row(s) scanned; every cited certificate agrees.`,
    );
  }
  console.log(
    `[discharge-consistency] ✓ ${String(anchors.length)} §A anchor(s) checked; every one resolves to a tracked file.`,
  );
}

if (import.meta.main) main();
