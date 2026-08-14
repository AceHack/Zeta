#!/usr/bin/env bun
// audit-attestation-vendor-root.ts — flag hardware-attestation claims that never name their trust root
//
// Mechanizes work-item 081M00QP7FB087G0R00031BQ93 ("name the vendor root in every attestation
// claim"). The finding: every hardware attestation Zeta could offer terminates in a silicon
// vendor's self-signed key (AMD ARK, Intel SGX Root CA, NVIDIA's device CA, the TPM manufacturer's
// EK root, AWS Nitro's PKI). A doc that says "attested" without saying whose root it stands on
// lets a reader walk away believing the attestation is self-rooted.
//
// Why doc-scoped and not line-scoped:
//
//   The repo uses "attest" in TWO unrelated senses — the SOCIAL one (privacy budget is earned by
//   others attesting you added value; pairwise/trio attestation events) and the HARDWARE one. A
//   line-level grep for "attest" is ~90% false positives and would be a check that cries wolf until
//   it is disabled. So this audit triggers only on unambiguous HARDWARE-MECHANISM names, and
//   satisfies at DOCUMENT scope: naming the root anywhere in the doc that makes the claim.
//
// The mechanism/root distinction this encodes (and why NRAS and KDS are NOT roots):
//
//   AMD KDS, Intel PCS/PCCS, and NVIDIA NRAS are certificate-DISTRIBUTION and VERIFICATION
//   services. All three ecosystems support offline verification, so the service is avoidable.
//   The ROOT is the self-signed key behind it (ARK / SGX Root CA / NVIDIA's device CA) and is not
//   avoidable. Naming the service is therefore NOT naming the root, and the ROOT_TERMS list
//   deliberately excludes NRAS/KDS/PCS so that a doc citing only the service is still flagged.
//
// Scope:
//
//   Markdown under docs/, workitems/, universal/, .claude/rules/ (tracked substrate that makes
//   claims to readers). Not code, not memory/, not vendored/reference material.
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-attestation-vendor-root.ts            # detect-only, exit 0
//   bun src/Core.TypeScript/hygiene/audit-attestation-vendor-root.ts --enforce  # exit 1 on findings
//   bun src/Core.TypeScript/hygiene/audit-attestation-vendor-root.ts --json     # machine-readable
//
// Exit codes:
//
//   0   no findings, or detect-only mode
//   1   findings present AND --enforce
//   64  argument error
//
// DST-friendliness: read-only, no clock, no network. Deterministic given a tree.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Unambiguous HARDWARE ATTESTATION mechanisms. Presence of any ⇒ the doc makes an attestation claim.
 *
 * Deliberately EXCLUDES bare "Secure Enclave", "TPM 2.0", "TPM-sealed", "StrongBox". Those name key
 * CUSTODY (sealing / non-extractable storage), which is a different claim: a seal binds material to
 * a chip and works without anyone ever validating that chip's EK certificate. The vendor root only
 * becomes load-bearing when the seal is offered to ANOTHER PARTY as evidence — i.e. when it becomes
 * an attestation. Flagging every mention of a TPM would make this check cry wolf until someone
 * disables it, which is worse than not having it. The `attested …` patterns below catch the cases
 * where those same devices ARE used to make a claim.
 */
const MECHANISM_TERMS: ReadonlyArray<RegExp> = [
    /\bSEV-SNP\b/,
    /\bIntel TDX\b/,
    /\bTDX\b/,
    /\bVCEK\b/,
    /\bNRAS\b/,
    /\bremote[- ]attestation\b/i,
    /\battested boot\b/i,
    /\bmeasured boot\b/i,
    /\battestation-gated\b/i,
    /\bNitro Enclave/i,
    /\bPCR-sealed\b/i,
    /\btpm_devid\b/,
    /\bamd_sev_snp\b/,
    /\bhardware attestation\b/i,
    /\bkey attestation\b/i,
    /\bdeletion attestation\b/i,
    /\battested (non-extractable|creation|erasure|destruction)\b/i,
];

/**
 * Terms that count as NAMING A ROOT. These must be SPECIFIC.
 *
 * Deliberately EXCLUDES the vendor verification/distribution services (NRAS, KDS, PCS, PCCS):
 * those are avoidable infrastructure, not the irreducible root, so citing them does not discharge
 * the obligation. Also excludes bare vendor names ("AMD", "Intel") — saying "AMD SEV-SNP" is naming
 * a product, not a root.
 *
 * Also deliberately EXCLUDES the generic phrases "trust root" and "root of trust". Measured against
 * the pre-correction versions of three real docs, those two phrases produced FALSE NEGATIVES in two
 * of them: the sovereign-keys ladder satisfied "root of trust" with a sentence about *HSMs*, and the
 * code-bound-key doc satisfied "trust root" four times while talking about *ace's software signing
 * roots*. Both docs' actual attestation claims were unqualified. A generic phrase used elsewhere in
 * a long document is not evidence that the attestation claim was qualified — so only a named root,
 * or an explicit `(root: …)` marker at the claim, counts.
 */
const ROOT_TERMS: ReadonlyArray<RegExp> = [
    /\bARK\b/,
    /\bAMD Root Key\b/i,
    /\bSGX Root CA\b/i,
    /\bIntel Root CA\b/i,
    /\bPCK certificate/i,
    /\bEK (certificate|root|cert)\b/i,
    /\bEndorsement Key\b/i,
    /\bPlatform Key\b/i,
    /\bvendor[- ]root(ed)?\b/i,
    /\bself-signed (root|key|vendor)\b/i,
    /\bmanufacturer'?s? (root|CA|EK)\b/i,
    /\bdevice[- ]identity CA\b/i,
    /\bdevice CA\b/i,
    /\bNitroEnclaves_Root\b/,
    /\bNitro Attestation PKI\b/i,
    /\(root:/i,
    /\bsilicon vendor\b/i,
];

const SCAN_DIRS: ReadonlyArray<string> = ["docs", "workitems", "universal", ".claude/rules"];

/**
 * Paths exempt from the check, each with a stated reason. An allowlist entry is a claim that the
 * file does not make a reader-facing hardware-attestation capability claim — not a way to silence
 * a real finding.
 */
const ALLOWLIST: ReadonlyArray<{ prefix: string; reason: string }> = [
    { prefix: "docs/amara-full-conversation/", reason: "verbatim conversation archive — others' memory, never edited" },
    { prefix: "docs/research/ip-questionable/", reason: "verbatim forwarded transcripts — preserved, not curated" },
    { prefix: "docs/github/", reason: "generated PR mirror" },
    { prefix: "docs/pr-discussions/", reason: "verbatim PR discussion archive" },
    { prefix: "docs/history/pr-reviews/", reason: "archived PR reviews — a frozen record of what was said, not a live claim surface" },
    { prefix: "docs/recovered-orphan-branches-2026-05/", reason: "historical branch recovery snapshot" },
    { prefix: "docs/books/", reason: "narrative prose, not a technical claim surface" },
    { prefix: "docs/letters/", reason: "verbatim correspondence archive" },
    { prefix: "docs/substrate-shelves/", reason: "reference shelf; 'attests' used in the historical-evidence sense" },
];

interface Finding {
    readonly path: string;
    readonly mechanisms: ReadonlyArray<string>;
}

function walk(dir: string, out: string[]): void {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        let st;
        try {
            st = statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) {
            walk(full, out);
        } else if (entry.endsWith(".md")) {
            out.push(full);
        }
    }
}

function isAllowlisted(path: string): boolean {
    return ALLOWLIST.some((a) => path.startsWith(a.prefix));
}

export function scanText(text: string): { mechanisms: string[]; hasRoot: boolean } {
    const mechanisms: string[] = [];
    for (const re of MECHANISM_TERMS) {
        const m = re.exec(text);
        if (m !== null) mechanisms.push(m[0]);
    }
    const hasRoot = ROOT_TERMS.some((re) => re.test(text));
    return { mechanisms, hasRoot };
}

export function auditFiles(files: ReadonlyArray<string>, read: (p: string) => string): Finding[] {
    const findings: Finding[] = [];
    for (const path of files) {
        if (isAllowlisted(path)) continue;
        const { mechanisms, hasRoot } = scanText(read(path));
        if (mechanisms.length > 0 && !hasRoot) {
            findings.push({ path, mechanisms: [...new Set(mechanisms)].sort() });
        }
    }
    return findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function main(argv: ReadonlyArray<string>): number {
    const enforce = argv.includes("--enforce");
    const asJson = argv.includes("--json");
    for (const a of argv) {
        if (a.startsWith("--") && !["--enforce", "--json"].includes(a)) {
            process.stderr.write(`unknown argument: ${a}\n`);
            return 64;
        }
    }

    const files: string[] = [];
    for (const dir of SCAN_DIRS) walk(dir, files);
    const findings = auditFiles(files, (p) => readFileSync(p, "utf8"));

    if (asJson) {
        process.stdout.write(`${JSON.stringify({ scanned: files.length, findings }, null, 2)}\n`);
    } else {
        process.stdout.write(`attestation vendor-root audit — scanned ${files.length} markdown files\n`);
        if (findings.length === 0) {
            process.stdout.write("no findings: every hardware-attestation claim names its trust root\n");
        } else {
            process.stdout.write(`${findings.length} file(s) name a hardware-attestation mechanism but no trust root:\n\n`);
            for (const f of findings) {
                process.stdout.write(`  ${f.path}\n    mechanisms: ${f.mechanisms.join(", ")}\n`);
            }
            process.stdout.write(
                "\nEvery hardware attestation terminates in a silicon vendor's self-signed root\n" +
                    "(AMD ARK / Intel SGX Root CA / NVIDIA's device CA / TPM manufacturer EK root /\n" +
                    "AWS Nitro PKI). Name it at the claim, e.g. 'confidential VM (root: AMD ARK)'.\n" +
                    "Note NRAS / KDS / PCS are verification SERVICES, not roots — naming one does not\n" +
                    "discharge this. See 081M00QP7FB087G0R00031BQ93.\n",
            );
        }
    }

    return findings.length > 0 && enforce ? 1 : 0;
}

if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
