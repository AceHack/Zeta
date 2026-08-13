import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// WHY THIS EXISTS. On 2026-08-13 the `CI Gate` ruleset gained a bypass actor
// (`RepositoryRole:5`, `bypass_mode: pull_request`) so that PRs touching
// `.github/workflows/**` could merge at all — `gate` never schedules for them, so that
// whole class was permanently unmergeable while looking merely pending.
//
// The security review of that change found the real cost, and it is worth stating plainly
// rather than filing away:
//
//   Before, `bypass_actors: []` meant `--admin` FAILED FOR EVERYONE. Injected text could
//   say "merge it" and the platform said no. That was a TECHNICAL control. After, it is a
//   BEHAVIOURAL one ("agents shouldn't use --admin") — and behavioural controls are
//   exactly what prompt injection defeats.
//
// This test converts it back into a technical control. The `gh` credential in an agent
// clone carries admin (`repos/.../permissions` → `{"admin": true}`), so any agent shelling
// `gh` IS `RepositoryRole:5`. A single injected instruction is now the distance between
// "agent read a PR body" and "unverified code on main". A grep that fails the build is a
// cheap thing to trade for that.
//
// Scope note: this checks the REPO's own agent-facing surfaces. It cannot constrain what a
// human types, and it is not meant to — it removes the *automated* path.

const SEARCH_ROOTS = [".github", "src/Core.TypeScript", "clis", "skills", ".claude"] as const;

/**
 * Forbidden INVOCATIONS, with why each matters.
 *
 * These match command shapes, not mentions. The first draft matched the bare string
 * `bypass_actors` and fired on three files that merely EXPLAIN the ruleset in comments —
 * all correct, none an invocation. A guard that fires on prose is a guard someone disables,
 * and a disabled guard is worse than none: it reads as coverage while checking nothing.
 * So precision matters more than breadth here.
 */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string }> = [
    {
        pattern: /gh\s+pr\s+merge[^\n]*--admin\b/,
        why: "merges past the required gate — the exact capability the 2026-08-13 bypass unlocked",
    },
    {
        pattern: /--admin\b[^\n]*\bpr\s+merge/,
        why: "same, with the flag written before the subcommand",
    },
    {
        pattern: /-X\s*(PUT|PATCH|POST|DELETE)[^\n]*rulesets/,
        why: "mutates a repository ruleset — a settings change must never be automated",
    },
    {
        pattern: /rulesets\/\d+[^\n]*--input/,
        why: "writes a ruleset payload by id",
    },
];

/** Files that legitimately DISCUSS these without invoking them (docs, this test). */
const ALLOWED = [/\.md$/, /no-agent-gate-bypass\.test\.ts$/] as const;

function trackedFilesUnder(root: string): readonly string[] {
    try {
        return execFileSync("git", ["ls-files", root], { encoding: "utf8" })
            .split("\n")
            .filter((f) => f.trim() !== "");
    } catch {
        return [];
    }
}

describe("no automated path can bypass the required gate", () => {
    const files = SEARCH_ROOTS.flatMap(trackedFilesUnder).filter(
        (f) => !ALLOWED.some((re) => re.test(f)),
    );

    test("the search actually covers something — a vacuous pass is not a pass", () => {
        // Without this, a broken glob would make every assertion below trivially true, and
        // the guard would report green having checked nothing. That failure mode is the
        // reason this file exists at all.
        expect(files.length).toBeGreaterThan(100);
    });

    for (const { pattern, why } of FORBIDDEN) {
        test(`no agent-facing file invokes ${String(pattern)} — ${why}`, () => {
            const offenders = files.filter((f) => {
                let text: string;
                try {
                    text = readFileSync(f, "utf8");
                } catch {
                    return false; // unreadable/binary: not an invocation site
                }
                return pattern.test(text);
            });
            expect(offenders).toEqual([]);
        });
    }
});
