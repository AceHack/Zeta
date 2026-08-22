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
// Exit:  0 — every DISCHARGED row's certificate agrees
//        1 — at least one row contradicts (or is missing) its cited certificate

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

function main(): void {
  const root = process.cwd();
  const registerPath = join(root, REGISTER);
  if (!existsSync(registerPath)) {
    console.error(`[discharge-consistency] FATAL: ${REGISTER} not found (run from the repo root).`);
    process.exit(1);
  }

  const rows = scanRegister(readFileSync(registerPath, "utf8"));
  const failures: string[] = [];

  for (const row of rows) {
    if (row.certificates.length === 0) {
      // No certificate is fine ONLY if some other evidence artifact is cited (proof, byte-lock,
      // gated test, SMT obligation). Citing nothing at all is discharge-by-assertion.
      if (!row.evidence) {
        failures.push(
          `  ${REGISTER}:${row.line} — "${row.label}"\n     claims §A DISCHARGED but cites NO evidence artifact at all` +
            ` (no certificate, proof, byte-lock, gated test, or SMT obligation) — discharged by assertion`,
        );
      }
      continue;
    }
    for (const cert of row.certificates) {
      const certPath = join(root, cert);
      if (!existsSync(certPath)) {
        failures.push(`  ${REGISTER}:${row.line} — "${row.label}"\n     claims §A DISCHARGED but its cited certificate is MISSING: ${cert}`);
        continue;
      }
      const { ok, status } = certificateAgrees(readFileSync(certPath, "utf8"));
      if (!ok) {
        failures.push(
          `  ${REGISTER}:${row.line} — "${row.label}"\n     claims §A DISCHARGED but ${cert} says status = "${status}"`,
        );
      }
    }
  }

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

  console.log(
    `[discharge-consistency] ✓ ${rows.length} §A-DISCHARGED row(s) scanned; every cited certificate agrees.`,
  );
}

if (import.meta.main) main();
