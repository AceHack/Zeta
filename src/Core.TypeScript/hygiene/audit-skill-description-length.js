#!/usr/bin/env bun
// audit-skill-description-length.ts — durable gate for B-0347 carved-sentence
// skill descriptions. Replicates the `/doctor` per-entry-cap check in
// deterministic Rule-0 TS so the carved-sentence invariant survives drift.
//
// Origin: B-0347.4 — the carving pass shipped (all 257 descriptions ≤150 chars,
// single-line, boilerplate-free as of 2026-05-29); this tool locks that in so
// descriptions cannot silently grow back over the routing budget and get
// dropped from the skill listing (the failure mode the row was filed against).
//
// Rule 0: TS over .sh for non-install-graph scripts. Pure functions are
// exported for `bun:test`; the CLI side-effect is guarded by import.meta.main.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
/** Hard cap: descriptions over this are dropped/truncated from the listing. */
export const MAX_CHARS = 150;
/** Preferred ceiling (B-0347 rule 1): over this warns but does not fail. */
export const PREFERRED_CHARS = 120;
/**
 * Boilerplate the carved sentence must not carry (B-0347 rules 3-5). Belongs in
 * the skill body, not the routing description.
 */
export const FORBIDDEN_BOILERPLATE = [
    { label: 'Capability skill ("hat") preamble', re: /\bcapability skill\b/i },
    { label: '"(hat)" boilerplate', re: /\(\s*"?hat"?\s*\)/i },
    { label: '"Owns the…" preamble', re: /^owns the\b/i },
    { label: '"Covers the…" preamble', re: /^covers the\b/i },
    { label: '"Wear this when…" usage note', re: /\bwear this when\b/i },
    { label: '"Defers to…" hand-off note', re: /\bdefers to\b/i },
];
/**
 * Extract the `description:` field from a SKILL.md frontmatter block.
 * Returns null when there is no frontmatter or no description key.
 */
export function parseFrontmatterDescription(text) {
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm || fm[1] === undefined)
        return null;
    const lines = fm[1].split("\n");
    // Line-based parse: a folded YAML value continues onto indented lines until
    // the next top-level `key:` line or a blank line. A regex with `/m` would
    // stop at the first newline (the `$` trap), undercounting multi-line values.
    const startIdx = lines.findIndex((l) => /^description:/.test(l));
    if (startIdx === -1)
        return null;
    const collected = [lines[startIdx].replace(/^description:[ \t]*/, "")];
    for (let i = startIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (/^[A-Za-z_][\w-]*:/.test(l))
            break; // next top-level key
        if (l.trim() === "")
            break; // blank line ends the value
        collected.push(l);
    }
    const multiline = collected.length > 1;
    const value = collected.join(" ").replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
    return { value, multiline };
}
/** Apply the B-0347 carved-sentence rules to one description. */
export function auditDescription(skill, field) {
    const out = [];
    if (field === null) {
        out.push({ skill, severity: "error", message: "missing description: frontmatter field" });
        return out;
    }
    const { value, multiline } = field;
    if (value.length > MAX_CHARS) {
        out.push({
            skill,
            severity: "error",
            message: `description is ${value.length} chars (> ${MAX_CHARS} cap — gets dropped from listing)`,
        });
    }
    else if (value.length > PREFERRED_CHARS) {
        out.push({
            skill,
            severity: "warn",
            message: `description is ${value.length} chars (> ${PREFERRED_CHARS} preferred)`,
        });
    }
    if (multiline) {
        out.push({ skill, severity: "error", message: "description spans multiple lines — carve to one sentence" });
    }
    for (const { label, re } of FORBIDDEN_BOILERPLATE) {
        if (re.test(value)) {
            out.push({ skill, severity: "error", message: `description carries ${label} — belongs in the skill body` });
        }
    }
    return out;
}
/** Audit every `<dir>/<skill>/SKILL.md` description. Filesystem-reading. */
export function auditSkillsDir(dir) {
    const violations = [];
    let checked = 0;
    if (!existsSync(dir))
        return { checked, violations };
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const p = join(dir, entry.name, "SKILL.md");
        if (!existsSync(p))
            continue;
        checked++;
        violations.push(...auditDescription(entry.name, parseFrontmatterDescription(readFileSync(p, "utf8"))));
    }
    return { checked, violations };
}
function repoRoot() {
    try {
        return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    }
    catch {
        return process.cwd();
    }
}
if (import.meta.main) {
    const skillsDir = join(repoRoot(), ".claude/skills");
    const { checked, violations } = auditSkillsDir(skillsDir);
    const errors = violations.filter((v) => v.severity === "error");
    const warns = violations.filter((v) => v.severity === "warn");
    for (const v of errors)
        process.stderr.write(`ERROR  ${v.skill}: ${v.message}\n`);
    for (const v of warns)
        process.stderr.write(`warn   ${v.skill}: ${v.message}\n`);
    process.stderr.write(`\nchecked ${checked} skill descriptions; ${errors.length} errors, ${warns.length} warnings\n`);
    if (errors.length > 0) {
        process.stderr.write("\nPer B-0347: each skill description is one carved routing sentence " +
            `(≤${MAX_CHARS} chars, single-line, no "capability skill"/"owns the"/"defers to" boilerplate).\n` +
            "Over-cap descriptions get dropped from the skill listing and go invisible to cold-start agents.\n");
        process.exit(1);
    }
    process.exit(0);
}
