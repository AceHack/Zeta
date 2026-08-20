#!/usr/bin/env bun
// audit-skill-path-refs.ts — detect stale repo-path pointers in `.claude/skills/**/*.md`
//
// WHY THIS FILE EXISTS
// --------------------
// `audit-rule-cross-refs.ts` (PR #3202) has audited `.claude/rules/*.md` for stale
// pointers since 2026-05. Skills were never in scope. But `.claude/rules/` holds
// *carved sentences* while `.claude/skills/` holds the *procedures agents execute* —
// so a dead pointer in a skill is strictly worse: an agent following step 0 of a
// blueprint silently no-ops and continues as though the step ran.
//
// That is the vacuity class in its executable form: a step that did not run must
// never look like a step that passed.
//
// Found by following one instance (081M0DXM725087G0R002YDM382 — the
// formal-verification-expert blueprint's step 0 cites
// `tools/alignment/concept_registry.ts`; the registry is real and its KNOWN_ANCHORS
// map is exactly what the step describes, but it lives at
// `src/Core.TypeScript/alignment/concept_registry.ts`. The path went stale and
// nothing was looking). First full run: 219 unresolved of 2328 repo-root-anchored
// refs across 291 skill files — 9.4%.
//
// WHY A SEPARATE AUDITOR (not a scope flag on audit-rule-cross-refs.ts)
// --------------------------------------------------------------------
// The rules auditor's resolution model is rules-specific: sibling-rule lookup for
// bare `<name>.md`, `rules/` -> `rules.bak/` archive fallback, rules-relative joins.
// Skills cite REPO-ROOT paths (`src/...`, `docs/...`, `tools/...`), so folding the
// two would either import false positives from the sibling heuristics or dilute
// them. Two honest models beat one tangled one.
//
// SCOPE (deliberately narrow — the frame is the finding)
// -----------------------------------------------------
// Counted: backticked spans that (a) carry a known source/doc extension, (b) contain
// a `/`, and (c) are anchored at a real top-level repo directory. Everything else is
// EXCLUDED, not silently counted as passing:
//   - bare filenames (`SKILL.md`, `install.sh`) — relative or illustrative, no frame
//   - `~`-rooted (user-scope memory, not in the repo)
//   - glob/template/placeholder forms (`*`, `<name>`, `YYYY`)
// A first naive pass over ALL backticked paths reported 447 unresolved; most were
// bare filenames the regex had no business resolving. Reporting 447 would have been
// a numerator with an invented denominator. 219/2328 is the honest frame.
//
// THREE STATES — `archived` is why this is not a boolean
// -----------------------------------------------------
//   live      — resolves as written
//   archived  — does not resolve, but the same basename exists under a known archive
//               dir (`.claude/rules.bak/`). The #6676 sweep moved 96 rules; skills
//               citing them were never updated. Misleading, not missing.
//   stale     — does not resolve anywhere. The real finding.
//
// REGISTER: report-only. Writes markdown; exit code is 0 unless --strict is passed.
// Per the standing move away from blocking checks toward drift checks.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const SKILLS_DIR = ".claude/skills";
const ARCHIVE_DIRS = [".claude/rules.bak"] as const;

const EXTENSIONS =
    "ts|tsx|md|fs|fsx|fsproj|cs|csproj|json|yml|yaml|sh|mjs|cjs|js|tla|als|lean|toml|nix";
const REF_RE = new RegExp("`([A-Za-z0-9_@.\\-/]+\\.(?:" + EXTENSIONS + "))`", "g");

export type RefState = "live" | "archived" | "stale";

export interface SkillRef {
    readonly file: string;
    readonly raw: string;
    readonly state: RefState;
    /** For `archived`: where the basename was actually found. */
    readonly foundAt?: string;
}

function walkMarkdown(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkMarkdown(p));
        else if (entry.isFile() && entry.name.endsWith(".md")) out.push(p);
    }
    return out.sort(); // deterministic: DST gate per typescript.md
}

/**
 * Is this a reference we can fairly resolve? Excluded forms are NOT counted as
 * passing — they are dropped from the denominator entirely.
 */
/**
 * Prose placeholders. A skill writing "e.g. `docs/FOO.md`" is illustrating a shape,
 * not citing an artifact — resolving it would be a false positive. These are dropped
 * from the denominator, never counted as passing.
 *
 * The first pass of this auditor did NOT filter these and reported them among the
 * stale set. That inflates the numerator with things that were never claims. Same
 * error as quoting a rate against an invented denominator.
 */
const PLACEHOLDER_SEGMENTS = new Set([
    "FOO.md", "BAR.md", "BAZ.md", "X.cs", "Y.cs", "MyProof.lean", "notes.md",
]);
const PLACEHOLDER_PATTERNS = [
    /\broundN\b/, /\.\.\./, /\bN\.json$/, /<[^>]*>/,
];

export function isRepoAnchored(raw: string, topLevelDirs: ReadonlySet<string>): boolean {
    if (raw.startsWith("~") || raw.startsWith("http")) return false;
    if (raw.includes("*") || raw.includes("<") || raw.includes("YYYY")) return false;
    if (PLACEHOLDER_SEGMENTS.has(raw.split("/").pop() ?? "")) return false;
    // NOTE: there is deliberately no separate `!raw.includes("/")` guard. It was here
    // and the mutation run showed removing it changed nothing: every ref carries a file
    // extension, so a bare filename's first segment (`SKILL.md`) can never equal a real
    // top-level directory and the check below already rejects it. A guard whose removal
    // no test can detect is a check that cannot fail — the same class this auditor exists
    // to find, so it does not get to live here.
    if (PLACEHOLDER_PATTERNS.some((re) => re.test(raw))) return false;
    const head = raw.split("/")[0];
    return head !== undefined && topLevelDirs.has(head);
}

export function classify(
    raw: string,
    archiveDirs: readonly string[] = ARCHIVE_DIRS,
    exists: (p: string) => boolean = existsSync,
): { state: RefState; foundAt?: string } {
    if (exists(raw)) return { state: "live" };
    const name = basename(raw);
    for (const dir of archiveDirs) {
        const candidate = join(dir, name);
        if (exists(candidate)) return { state: "archived", foundAt: candidate };
    }
    return { state: "stale" };
}

export function auditSkillPathRefs(root: string = SKILLS_DIR): SkillRef[] {
    const topLevelDirs = new Set(
        readdirSync(".", { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name),
    );
    const refs: SkillRef[] = [];
    for (const file of walkMarkdown(root)) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(REF_RE)) {
            const raw = match[1];
            if (raw === undefined) continue;
            if (!isRepoAnchored(raw, topLevelDirs)) continue;
            const { state, foundAt } = classify(raw);
            refs.push(foundAt === undefined ? { file, raw, state } : { file, raw, state, foundAt });
        }
    }
    return refs;
}

function renderReport(refs: readonly SkillRef[]): string {
    const stale = refs.filter((r) => r.state === "stale");
    const archived = refs.filter((r) => r.state === "archived");

    const byPath = new Map<string, string[]>();
    for (const r of stale) {
        const list = byPath.get(r.raw) ?? [];
        list.push(r.file);
        byPath.set(r.raw, list);
    }
    // Ordinal tiebreak, NOT localeCompare: the report is a byte-for-byte diffable
    // artifact and localeCompare is culture-SENSITIVE, so its order varies by the
    // runner's locale. Caught here by the culture-collation ratchet, on this file.
    // Per .claude/rules/culture-invariant-by-default.md.
    const ranked = [...byPath.entries()].sort(
        (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    );

    const lines: string[] = [
        "# Skill path-reference audit",
        "",
        "Repo-root-anchored path references inside `.claude/skills/**/*.md`.",
        "Report-only: a dead pointer in an executable playbook is a step that",
        "silently no-ops. Bare filenames, `~`-rooted, and glob/template forms are",
        "excluded from the denominator rather than counted as passing.",
        "",
        `- refs in frame: **${refs.length}**`,
        `- live: **${refs.length - stale.length - archived.length}**`,
        `- archived (basename found under an archive dir — misleading, not missing): **${archived.length}**`,
        `- stale: **${stale.length}**`,
        "",
    ];

    if (archived.length > 0) {
        lines.push("## Archived — repoint at the archive path", "");
        for (const r of archived) lines.push(`- \`${r.raw}\` → \`${r.foundAt}\`  (${r.file})`);
        lines.push("");
    }

    if (ranked.length > 0) {
        lines.push("## Stale — resolves nowhere", "");
        for (const [raw, files] of ranked) {
            lines.push(`### \`${raw}\` — ${files.length} reference(s)`);
            for (const f of files) lines.push(`- ${f}`);
            lines.push("");
        }
    } else {
        lines.push("No stale references.", "");
    }
    return lines.join("\n");
}

if (import.meta.main) {
    const argv = process.argv.slice(2);
    const reportIdx = argv.indexOf("--report");
    const strict = argv.includes("--strict");

    const refs = auditSkillPathRefs();
    const stale = refs.filter((r) => r.state === "stale").length;
    const archived = refs.filter((r) => r.state === "archived").length;

    const reportPath = reportIdx === -1 ? undefined : argv[reportIdx + 1];
    if (reportPath !== undefined) {
        writeFileSync(reportPath, renderReport(refs), "utf8");
    }

    console.log(
        `skill path refs: ${refs.length} in frame | live ${refs.length - stale - archived} | archived ${archived} | stale ${stale}`,
    );
    if (strict && stale > 0) {
        console.error(`audit-skill-path-refs: ${stale} stale reference(s) (--strict)`);
        process.exit(1);
    }
}
