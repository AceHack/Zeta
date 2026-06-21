/**
 * Eval-set fixture regression tests for substrate-claim-checker (B-0170).
 *
 * Each test runs an existing `check-*.ts` against a frozen historical
 * drift fixture under `fixtures/` and asserts that the checker still
 * detects the empirical drift that prompted the fixture's capture.
 *
 * Run with `bun test tools/substrate-claim-checker/fixtures.test.ts`.
 *
 * Adding fixtures: see `fixtures/README.md`.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkFile as checkConvention } from "./check-convention.js";
import { checkFile as checkCounts } from "./check-counts.js";
import { checkFile as checkCrossSurface } from "./check-cross-surface.js";
import { checkFile as checkExistence } from "./check-existence.js";
import { checkFile as checkPathForms } from "./check-path-forms.js";
const fixtures = join(import.meta.dir, "fixtures");
describe("eval-set fixtures / count drift", () => {
    test("count-drift-9-vs-15.md — claim '9 drift instances' vs 15-row table is detected", () => {
        const result = checkCounts(join(fixtures, "count-drift-9-vs-15.md"));
        expect(result.ok).toBe(true);
        // Per PR #3611 review threads (chatgpt-codex-connector + copilot):
        // assert exact finding count and pin the body claim's line so a
        // regression in body-claim detection cannot be masked by an
        // HTML-comment match. The fixture's provenance comment is
        // intentionally worded to not restate the `<number> <noun>` pair
        // from the body claim.
        expect(result.findings.length).toBe(1);
        const finding = result.findings[0];
        expect(finding.line).toBe(24);
        expect(finding.claimedCount).toBe(9);
        expect(finding.actualCount).toBe(15);
        expect(finding.claim).toContain("drift instances");
        expect(finding.claimIsMinimum).toBe(false);
    });
});
describe("eval-set fixtures / existence drift", () => {
    test("existence-drift-missing-doc.md — backtick-quoted path that doesn't exist anywhere is detected", () => {
        const result = checkExistence(join(fixtures, "existence-drift-missing-doc.md"));
        expect(result.ok).toBe(true);
        // Same PR #3611 discipline applied to existence-drift: exact count
        // and pin the body claim's line so a regression in body-claim
        // detection cannot be masked by an HTML-comment match. The fixture
        // path is intentionally synthetic (won't be created accidentally),
        // so the test stays stable across substrate evolution.
        expect(result.findings.length).toBe(1);
        const finding = result.findings[0];
        expect(finding.line).toBe(24);
        expect(finding.pathClaim).toBe("docs/_fixture_existence_drift_target_b0170_2026_05_15.md");
        expect(finding.severity).toBe("drift");
    });
});
describe("eval-set fixtures / cross-surface count drift", () => {
    test("cross-surface-drift-9-vs-15.md — frontmatter '9 drift instances' vs 15-row body table is detected", () => {
        const result = checkCrossSurface(join(fixtures, "cross-surface-drift-9-vs-15.md"));
        expect(result.ok).toBe(true);
        // Same PR #3611 discipline applied to cross-surface drift:
        // pin exact finding count + claim shape so a regression in
        // frontmatter-claim extraction or any-table satisfaction logic
        // cannot pass silently. The fixture's body holds a single
        // 15-row table; the frontmatter claims 9 — no table satisfies.
        expect(result.findings.length).toBe(1);
        const finding = result.findings[0];
        expect(finding.field).toBe("description");
        expect(finding.claimedCount).toBe(9);
        expect(finding.claimIsMinimum).toBe(false);
        expect(finding.claim).toContain("drift instances");
        expect(finding.actualCounts).toEqual([15]);
    });
});
describe("eval-set fixtures / path-form drift", () => {
    test("path-form-drift-bare-vs-qualified.md — same file referenced as bare basename and fully-qualified path is detected", () => {
        const result = checkPathForms(join(fixtures, "path-form-drift-bare-vs-qualified.md"));
        expect(result.ok).toBe(true);
        // PR #3611 discipline applied to path-form drift: pin exact count
        // and exact body-claim line so a regression in body-claim detection
        // cannot be masked by an HTML-comment match. The fixture targets
        // check-counts.ts (a sibling that ships with the checker), so the
        // 3-root resolution (fileDir / parentDir / repoRoot) collapses both
        // forms onto the same absolute path without depending on any
        // synthetic file.
        expect(result.findings.length).toBe(1);
        const finding = result.findings[0];
        // Pin to body-claim line for the synthetic exemplar.
        // Historical anchor: verify-then-claim memo instance #15 / PR #1256
        // (path-form drift: fully-qualified vs bare paths in adjacent ADR citations,
        // path-form sub-class #6 of the 7-class list). This fixture covers the
        // sub-class via a synthetic exemplar; instance #15's literal substance
        // is captured in a follow-on fixture (B-0170.4.1).
        expect(finding.line).toBe(28);
        expect(finding.resolvedPath).toBe("src/Core.TypeScript/substrate-claim-checker/check-counts.ts");
        const forms = finding.forms.map((f) => f.path).sort();
        expect(forms).toEqual([
            "check-counts.ts",
            "src/Core.TypeScript/substrate-claim-checker/check-counts.ts",
        ]);
    });
});
describe("eval-set fixtures / convention drift", () => {
    test("convention-drift-no-reciprocal-marker.md — Supersedes-ADR claim with target lacking reciprocal '**Superseded by**' marker is detected", () => {
        const result = checkConvention(join(fixtures, "convention-drift-no-reciprocal-marker.md"));
        expect(result.ok).toBe(true);
        // PR #3611 discipline applied to convention drift: pin exact
        // finding count + claim line + target so a regression in either
        // claim extraction or reciprocal-marker scanning cannot pass
        // silently. The fixture pair is self-contained — the predecessor
        // ADR support file lives as a sibling under fixtures/ so the
        // 3-root resolution (fileDir / parentDir / repoRoot) finds it via
        // fileDir without depending on any real repo ADR pair.
        expect(result.findings.length).toBe(1);
        const finding = result.findings[0];
        // Body claim is on the line carrying `Supersedes ADR \`...\`` in
        // the fixture; pinning the line catches regressions where the
        // checker's logical-line scanner drifts off the physical line.
        expect(finding.line).toBe(36);
        expect(finding.target).toBe("src/Core.TypeScript/substrate-claim-checker/fixtures/_convention-drift-target-adr.md");
        expect(finding.reason).toContain("not reciprocated");
        expect(finding.reason).toContain("Superseded by");
    });
});
