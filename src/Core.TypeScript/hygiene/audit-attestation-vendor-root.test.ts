#!/usr/bin/env bun
// Tests for audit-attestation-vendor-root.ts
//
// These tests exist to answer one question honestly: CAN THIS CHECK FAIL?
// Ten checks that could not fail were found in this repo on 2026-08-14 (most recently `ace verify`,
// which printed "present" and returned 0 without re-verifying anything). So every test below that
// asserts "clean" is paired with a PLANTED MUTANT asserting the check actually fires.

import { describe, expect, test } from "bun:test";
import { auditFiles, scanText } from "./audit-attestation-vendor-root.ts";

/** Build an in-memory corpus reader so tests never touch the real tree. */
function corpus(files: Record<string, string>): {
    paths: string[];
    read: (p: string) => string;
} {
    return {
        paths: Object.keys(files),
        read: (p) => files[p] ?? "",
    };
}

describe("scanText — mechanism detection", () => {
    test("detects SEV-SNP as a hardware-attestation mechanism", () => {
        expect(scanText("we run the combine inside AMD SEV-SNP").mechanisms).toContain("SEV-SNP");
    });

    test("detects remote attestation, attested boot, attestation-gated", () => {
        expect(scanText("remote attestation heartbeats").mechanisms.length).toBeGreaterThan(0);
        expect(scanText("attested boot is on").mechanisms.length).toBeGreaterThan(0);
        expect(scanText("attestation-gated invocation").mechanisms.length).toBeGreaterThan(0);
    });

    test("does NOT fire on the SOCIAL sense of attest (privacy budget, pairwise events)", () => {
        const social =
            "Privacy budget is earned by others in society attesting you added value to them. " +
            "An NFT is a pairwise-attested transfer event; both identities attest the same event.";
        expect(scanText(social).mechanisms).toEqual([]);
    });

    test("does NOT fire on key CUSTODY mentions (sealing is not attesting)", () => {
        const custody =
            "Each node's FROST share is sealed to that node's TPM 2.0, or the Apple Secure Enclave. " +
            "The share is TPM-sealed at rest and never written to disk.";
        expect(scanText(custody).mechanisms).toEqual([]);
    });
});

describe("scanText — root detection", () => {
    test("recognises the vendor roots as roots", () => {
        expect(scanText("chained VCEK -> ASK -> ARK").hasRoot).toBe(true);
        expect(scanText("rooted in the Intel SGX Root CA").hasRoot).toBe(true);
        expect(scanText("the TPM manufacturer's EK certificate").hasRoot).toBe(true);
        expect(scanText("attested boot (root: OEM Platform Key)").hasRoot).toBe(true);
        expect(scanText("this is vendor-rooted").hasRoot).toBe(true);
    });

    // The load-bearing distinction this whole audit encodes.
    test("MUTANT: naming only the verification SERVICE does not count as naming the root", () => {
        // NRAS / KDS / PCS are avoidable distribution+verification services; the root is not.
        expect(scanText("GPU attestation verifies against NVIDIA NRAS").hasRoot).toBe(false);
        expect(scanText("certificates come from AMD's KDS").hasRoot).toBe(false);
        expect(scanText("collateral is fetched from Intel PCS").hasRoot).toBe(false);
    });

    test("MUTANT: naming the vendor's PRODUCT is not naming its root", () => {
        // "AMD SEV-SNP" names a product. Without ARK/trust-root language it must still flag.
        expect(scanText("we use AMD SEV-SNP and Intel TDX").hasRoot).toBe(false);
    });

    // Regression pin. An earlier draft of this audit accepted the generic phrases "trust root" and
    // "root of trust". Measured against the pre-correction versions of three real docs it produced
    // FALSE NEGATIVES in two of them: the sovereign-keys ladder satisfied "root of trust" with a
    // sentence about HSMs, and the code-bound-key doc satisfied "trust root" four times while
    // discussing ace's SOFTWARE signing roots — while both docs' attestation claims sat unqualified.
    // A generic phrase used elsewhere in a long document is not evidence the claim was qualified.
    test("MUTANT: generic 'trust root' / 'root of trust' do NOT discharge the obligation", () => {
        expect(scanText("HSM = per-guard root of trust; FROST = cross-guard threshold").hasRoot).toBe(false);
        expect(scanText("That reuses a trust root that exists; ace trust roots are per-node").hasRoot).toBe(false);
    });

    test("the two real false-negative docs would now be caught", () => {
        const ladderish = "remote attestation heartbeats prove unmodified firmware. HSM = per-guard root of trust.";
        const codeboundish = "PCR-sealed policy, no credential to steal. ace trust roots are per-node, no fleet CA.";
        for (const text of [ladderish, codeboundish]) {
            expect(scanText(text).mechanisms.length).toBeGreaterThan(0);
            expect(scanText(text).hasRoot).toBe(false);
        }
    });
});

describe("auditFiles — the check must actually fail", () => {
    test("clean doc: mechanism + root ⇒ no finding", () => {
        const c = corpus({
            "docs/x.md": "confidential VM via SEV-SNP (root: AMD ARK, self-signed).",
        });
        expect(auditFiles(c.paths, c.read)).toEqual([]);
    });

    // ---- PLANTED MUTANTS: each MUST produce a finding. ----

    test("MUTANT 1 — unqualified SEV-SNP claim is caught", () => {
        const c = corpus({
            "docs/mutant.md": "The FROST coordinator runs inside AMD SEV-SNP, so the host cannot read RAM.",
        });
        const findings = auditFiles(c.paths, c.read);
        expect(findings.length).toBe(1);
        expect(findings[0]?.path).toBe("docs/mutant.md");
        expect(findings[0]?.mechanisms).toContain("SEV-SNP");
    });

    test("MUTANT 2 — unqualified 'remote attestation' claim is caught", () => {
        const c = corpus({
            "docs/mutant.md": "Each guard continuously proves via remote attestation that it runs unmodified firmware.",
        });
        expect(auditFiles(c.paths, c.read).length).toBe(1);
    });

    test("MUTANT 3 — the service-name dodge does not launder a claim past the check", () => {
        const c = corpus({
            "docs/mutant.md": "GPU attestation is verified through NVIDIA NRAS, so the node is genuine.",
        });
        // NRAS is a mechanism term AND not a root term ⇒ must flag.
        expect(auditFiles(c.paths, c.read).length).toBe(1);
    });

    test("MUTANT 4 — a doc that qualifies ONE claim but adds a second unqualified doc still flags the second", () => {
        // This is the precedent that motivated the audit: a correction applied where it was found
        // and never searched for elsewhere. Per-file scope is what catches the other four places.
        const c = corpus({
            "docs/fixed.md": "attested boot (root: OEM Platform Key).",
            "docs/missed.md": "attested boot gates the key release.",
        });
        const findings = auditFiles(c.paths, c.read);
        expect(findings.map((f) => f.path)).toEqual(["docs/missed.md"]);
    });

    test("allowlisted verbatim archives are skipped (others' memory is never edited)", () => {
        const c = corpus({
            "docs/amara-full-conversation/2025-08.md": "we could use SEV-SNP for this",
            "docs/research/ip-questionable/ferry.md": "remote attestation would help",
        });
        expect(auditFiles(c.paths, c.read)).toEqual([]);
    });

    test("MUTANT 5 — allowlist is prefix-scoped and does not leak to sibling paths", () => {
        // A near-miss path must NOT inherit the allowlist.
        const c = corpus({
            "docs/research/ferry.md": "remote attestation would help",
        });
        expect(auditFiles(c.paths, c.read).length).toBe(1);
    });
});
