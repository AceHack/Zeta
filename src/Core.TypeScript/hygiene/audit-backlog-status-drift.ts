#!/usr/bin/env bun
// audit-backlog-status-drift.ts — detect `status: open` backlog rows whose
// primary artifacts have all shipped, indicating substrate drift.
//
// Per docs/backlog/P3/081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md
// and memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md.
//
// What this does:
//
//   - Enumerate docs/backlog/P*/B-*.md rows
//   - For each `status: open` row, parse the body to extract primary-artifact
//     paths from the **Acceptance / Proposed mechanization / Scope** sections
//     ONLY (NOT composes_with: frontmatter, NOT `## Composes with` body section,
//     NOT Origin / Source / Why P? / Non-goals / Resolution)
//   - Existence-check every primary-artifact path on disk
//   - Report rows where ALL primary-artifact paths exist (drift candidates)
//
// Section-aware parsing is the load-bearing detail per 081KRQ1AB0008QG0R000QYJFZE's empirical
// false-positive catalog: a naive `grep -oE 'tools/[a-z0-9_/-]+\.ts'` over the
// whole body had a 4-of-4 false-positive rate because it matched composes_with
// cross-refs as primary artifacts.
//
// Out of scope (next slice):
//
//   - `--prune-claims`: release any matching bus claim entries
//   - `--open-close-pr`: auto-open close-row PRs
//   - Partial-vs-drift verification (the tool flags candidates; human/agent
//     verifies each acceptance bullet shipped before close-row PR)
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-backlog-status-drift.ts            # markdown report
//   bun src/Core.TypeScript/hygiene/audit-backlog-status-drift.ts --json     # JSON output
//
// Exit codes:
//
//   0   no candidates found (or candidates reported in detect-only mode)
//   64  argument error

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Detect the repo root. Strategy (in order of preference):
 *
 *   1. `git rev-parse --show-toplevel` from cwd — works when invoked from
 *      anywhere inside a git worktree.
 *   2. Derive from this file's own location (`import.meta.dir`) — works
 *      when invoked from outside any git repo (e.g., `cd /tmp && bun
 *      /path/to/tools/hygiene/audit-backlog-status-drift.ts`). The tool
 *      lives at `<repo>/tools/hygiene/`, so the repo root is two levels
 *      up from this file.
 *
 * Invariant: relative-path reads inside this tool resolve against the repo
 * root regardless of where the tool was invoked from — including from
 * outside any git repo.
 *
 * Per 081KRQ1AB0008QG0R003DYANMC slice 3 (initial via git rev-parse) + this fix (true
 * cwd-independence via import.meta.dir fallback).
 */
export function detectRepoRoot(): string {
    try {
        return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
    } catch {
        // Fallback: this file lives at <repo>/src/Core.TypeScript/hygiene/<name>.ts;
        // resolve three levels up to reach the repo root. import.meta.dir is
        // Bun-native and gives the directory containing THIS module file.
        return resolve(import.meta.dir, "../../..");
    }
}

type PrimarySectionMatcher = RegExp;

// Sections where path mentions count as primary-artifact references.
const PRIMARY_SECTIONS: readonly PrimarySectionMatcher[] = [
    /^##\s+Acceptance(\s|$)/i,
    /^##\s+Acceptance criteria/i,
    /^##\s+Proposed mechanization/i,
    /^##\s+Scope(\s|$)/i,
] as const;

// Sections that mention paths as cross-references, NOT primary artifacts.
const SKIP_SECTIONS: readonly RegExp[] = [
    /^##\s+Composes with/i,
    /^##\s+Origin/i,
    /^##\s+Source/i,
    /^##\s+Why P[0-9]/i,
    /^##\s+Non-goals/i,
    /^##\s+Substrate-honest framing/i,
    /^##\s+Resolution/i,
    /^##\s+Background/i,
    /^##\s+Problem/i,
    /^##\s+Problem statement/i,
    /^##\s+Problem class/i,
    /^##\s+Empirical anchor/i,
    /^##\s+Alternative mitigations/i,
    /^##\s+Wire-up/i,
] as const;

// Path classes we treat as primary artifacts when mentioned in primary sections.
const PATH_REGEX =
    /(?<![A-Za-z0-9])(?:tools|\.claude|docs)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:tsx|ts|fsi|fs|yaml|yml|md|cs|sh|json)/g;

// Inline cross-reference patterns. Even inside an Acceptance / Proposed
// mechanization / Scope section, a line matching these patterns is a
// cross-reference, not a deliverable. Discovered empirically in 081KRHWGX0008QG0R001BHXH0M
// (Sharpening 4's "Composes with `.claude/rules/encoding-rules-without-
// mechanizing.md`" bullet — a sibling reference inside a primary
// sub-section, not a deliverable).
//
// See `memory/feedback_audit_backlog_status_drift_second_false_positive_class_inline_composes_with_otto_cli_2026_05_16.md`
// for full reasoning + regression-test spec.
const INLINE_CROSSREF_PATTERNS: readonly RegExp[] = [
    /\bcomposes[\s-]?with\b/i,
    /\bsister\s+(?:mechanism|rule|tool|module|process)/i,
    /\bcross[\s-]?reference/i,
    /\bsee\s+(?:also\s+)?[`\[]/i,
    /\bper\s+[`\[]/i,
    /\b(?:references?|cites?)\s+[`\[]/i,
] as const;

export interface BacklogRow {
    readonly id: string;
    readonly path: string;
    readonly status: string;
    readonly primaryArtifacts: readonly string[];
}

export function parseFrontmatter(body: string): Record<string, string> {
    const match = body.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const fm: Record<string, string> = {};
    for (const line of (match[1] ?? "").split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        fm[key] = value;
    }
    return fm;
}

/**
 * Extract primary-artifact paths from the row body.
 *
 * A primary-artifact path is a tools/ / .claude/ / docs/ path mentioned in
 * an Acceptance / Proposed mechanization / Scope section. Path mentions in
 * `Composes with` / Origin / Source / Why P? / Non-goals are treated as
 * cross-references and skipped.
 *
 * Paths under docs/backlog/ are always skipped (they're row cross-refs, not
 * deliverables).
 */
export function extractPrimaryArtifacts(body: string): string[] {
    const lines = body.split("\n");
    const artifacts = new Set<string>();
    type SectionMode = "primary" | "skip" | "other";
    let sectionMode: SectionMode = "other";

    for (const line of lines) {
        const isH2 = /^## \S/.test(line);
        const isH3 = /^### \S/.test(line);

        if (isH2) {
            // H2: tri-state classification — PRIMARY_SECTIONS gate extraction,
            // SKIP_SECTIONS are explicitly recognised cross-reference sections,
            // everything else is "other" (no extraction). Making SKIP_SECTIONS
            // load-bearing per github-code-quality finding on PR #3758.
            if (PRIMARY_SECTIONS.some((re) => re.test(line))) {
                sectionMode = "primary";
            } else if (SKIP_SECTIONS.some((re) => re.test(line))) {
                sectionMode = "skip";
            } else {
                sectionMode = "other";
            }
            continue;
        }
        if (isH3) {
            // H3: per Codex P2 on PR #3758. Two cases:
            // (1) `### Acceptance criteria` as top-level heading (no ## parent)
            //     — must enter primary mode, else systematic false negatives.
            // (2) `### Sharpening N` nested inside `## Acceptance criteria` —
            //     must NOT reset mode (parent already set primary). Inherit.
            // Strategy: rewrite ### → ## for pattern matching; if pattern
            // matches, switch mode; else KEEP current mode (inherit parent).
            const asH2 = line.replace(/^### /, "## ");
            if (PRIMARY_SECTIONS.some((re) => re.test(asH2))) {
                sectionMode = "primary";
            } else if (SKIP_SECTIONS.some((re) => re.test(asH2))) {
                sectionMode = "skip";
            }
            // else: keep current mode (nested H3 inherits parent's classification)
            continue;
        }
        const inPrimarySection = sectionMode === "primary";
        if (!inPrimarySection) continue;

        // Mixed-bullet handling per 081KRQ1AB0008QG0R003DYANMC slice 4: extract paths from the
        // segment BEFORE the first inline cross-reference keyword. Pure
        // cross-ref bullets ("Composes with X") naturally produce an empty
        // pre-cutoff segment; mixed bullets ("Add `tools/foo.ts` per [X]")
        // extract the deliverable while ignoring the citation.
        let cutoffIndex = line.length;
        for (const re of INLINE_CROSSREF_PATTERNS) {
            const m = line.match(re);
            if (m && typeof m.index === "number" && m.index < cutoffIndex) {
                cutoffIndex = m.index;
            }
        }
        const extractableSegment = line.slice(0, cutoffIndex);

        for (const match of extractableSegment.matchAll(PATH_REGEX)) {
            const candidate = match[0];
            // Skip backlog-row cross-references (these are siblings, not deliverables).
            if (candidate.startsWith("docs/backlog/")) continue;
            artifacts.add(candidate);
        }
    }

    return [...artifacts];
}

export function enumerateOpenRows(backlogDir: string = "docs/backlog"): BacklogRow[] {
    const rows: BacklogRow[] = [];
    for (const priority of ["P0", "P1", "P2", "P3", "P4"]) {
        const dir = join(backlogDir, priority);
        if (!existsSync(dir)) continue;
        let files: string[];
        try {
            files = readdirSync(dir);
        } catch (err) {
            // Per 081KRQ1AB0008QG0R003DYANMC slice 2 (Copilot P1 on PR #3758): don't let one
            // unreadable directory abort the whole audit. Warn and continue.
            process.stderr.write(
                `audit-backlog-status-drift: unable to read directory ${dir}: ${(err instanceof Error ? err.message : String(err))}\n`,
            );
            continue;
        }
        for (const file of files) {
            if (!file.startsWith("B-") || !file.endsWith(".md")) continue;
            const path = join(dir, file);
            let body: string;
            try {
                body = readFileSync(path, "utf-8");
            } catch (err) {
                // Per 081KRQ1AB0008QG0R003DYANMC slice 2: don't let one unreadable row file abort
                // the whole audit. Warn and skip the row.
                process.stderr.write(
                    `audit-backlog-status-drift: unable to read ${path}: ${(err instanceof Error ? err.message : String(err))}\n`,
                );
                continue;
            }
            const fm = parseFrontmatter(body);
            if (fm.status !== "open") continue;
            const id = fm.id || file.replace(/^(B-\d+(?:\.\d+)?).*/, "$1");
            rows.push({
                id,
                path,
                status: fm.status,
                primaryArtifacts: extractPrimaryArtifacts(body),
            });
        }
    }
    return rows;
}

export function findDriftCandidates(rows: readonly BacklogRow[]): BacklogRow[] {
    return rows.filter((row) => {
        if (row.primaryArtifacts.length === 0) return false;
        return row.primaryArtifacts.every((p) => existsSync(p));
    });
}

function reportMarkdown(candidates: readonly BacklogRow[]): void {
    if (candidates.length === 0) {
        console.log("No substrate-drift candidates found.");
        return;
    }

    console.log("# Backlog status-drift candidates\n");
    console.log(
        "Rows with `status: open` where ALL primary-artifact paths exist on disk.\n",
    );
    console.log("| Row | Path | Primary artifacts |");
    console.log("|---|---|---|");
    for (const row of candidates) {
        const artifacts = row.primaryArtifacts.map((a) => `\`${a}\``).join(", ");
        console.log(`| ${row.id} | \`${row.path}\` | ${artifacts} |`);
    }
    console.log();
    console.log(
        "**Reminder**: Each candidate requires manual verification before close-row — every Acceptance bullet must have a corresponding merged PR, not just the file present. See `.claude/rules/backlog-item-start-gate.md` step 0 for the partial-vs-drift discriminator.",
    );
}

function reportJson(candidates: readonly BacklogRow[]): void {
    const payload = candidates.map((r) => ({
        id: r.id,
        path: r.path,
        primaryArtifacts: r.primaryArtifacts,
    }));
    console.log(JSON.stringify(payload, null, 2));
}

function main(): number {
    // chdir to repo root so subsequent relative-path reads/existence-checks
    // work regardless of invocation cwd. Per 081KRQ1AB0008QG0R003DYANMC slice 3.
    try {
        process.chdir(detectRepoRoot());
    } catch (err) {
        process.stderr.write(
            `audit-backlog-status-drift: unable to chdir to repo root: ${(err as Error).message}\n`,
        );
        return 64;
    }

    const args = process.argv.slice(2);

    const KNOWN_FLAGS = new Set(["--json", "--check", "--help", "-h"]);
    for (const arg of args) {
        if (!KNOWN_FLAGS.has(arg)) {
            console.error(`Unknown argument: ${arg}`);
            console.error(
                "Usage: bun src/Core.TypeScript/hygiene/audit-backlog-status-drift.ts [--json] [--check]",
            );
            return 64;
        }
    }

    if (args.includes("--help") || args.includes("-h")) {
        console.log(
            "Usage: bun src/Core.TypeScript/hygiene/audit-backlog-status-drift.ts [--json] [--check]\n\n" +
                "Detects `status: open` backlog rows whose primary-artifact paths all\n" +
                "exist on disk (substrate drift candidates).\n\n" +
                "Options:\n" +
                "  --json    Emit JSON instead of markdown table\n" +
                "  --check   Exit non-zero (65) when candidates found (for CI use)\n" +
                "  --help    Show this help",
        );
        return 0;
    }

    const candidates = findDriftCandidates(enumerateOpenRows());

    if (args.includes("--json")) {
        reportJson(candidates);
    } else {
        reportMarkdown(candidates);
    }

    // --check mode: exit non-zero when any candidates found, so CI/cron jobs
    // can fail the build and force human review. Per 081KRQ1AB0008QG0R003DYANMC finding 4.
    if (args.includes("--check") && candidates.length > 0) {
        return 65;
    }
    return 0;
}

if (import.meta.main) {
    process.exit(main());
}
