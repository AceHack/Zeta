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

// Each entry is an INDEPENDENT route into the corpus, and each carries its own floor
// below — see the per-root tests for why a single total over these is not enough.
// `skills` was here and contributed zero (all markdown, which ALLOWED excludes); it was
// removed in 081M01J3NPE087G0R000KXXQSM. Executable skill surfaces live under
// `.claude/skills`, covered by the `.claude` root.
const SEARCH_ROOTS = [".github", "src/Core.TypeScript", "clis", ".claude"] as const;

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
    const perRoot = new Map<string, readonly string[]>(
        SEARCH_ROOTS.map((root) => [
            root,
            trackedFilesUnder(root).filter((f) => !ALLOWED.some((re) => re.test(f))),
        ]),
    );
    const files = [...perRoot.values()].flat();

    // READ ONCE, MATCH MANY. The first version read every file inside each pattern's test,
    // so ~1700 tracked files were read once PER PATTERN -- four full passes over the tree to
    // answer four questions about the same bytes. Measured 2026-08-14: 4.0s idle-ish, 8.1s
    // under load, against a per-test cap that is really 5000 ms (bunfig's `timeout = 20000`
    // was never honoured -- 081KZZ3JHP1087G0R00027ARRR). That is the load-dependent flake
    // shape: green on a quiet laptop, red on a busy runner, and the author cannot reproduce
    // it. The I/O is hoisted here, where it is charged to collection rather than to any one
    // test, and each assertion below is now a pure regex over memory.
    const sources: ReadonlyArray<{ path: string; text: string }> = files.flatMap((f) => {
        try {
            return [{ path: f, text: readFileSync(f, "utf8") }];
        } catch {
            return []; // unreadable/binary: not an invocation site
        }
    });

    test("the search actually covers something — a vacuous pass is not a pass", () => {
        // Without this, a broken glob would make every assertion below trivially true, and
        // the guard would report green having checked nothing. That failure mode is the
        // reason this file exists at all.
        expect(files.length).toBeGreaterThan(100);
        // Hoisting the reads adds a second way to go vacuous: every read could fail and the
        // patterns would then match nothing. Pin the readable set too.
        expect(sources.length).toBeGreaterThan(100);
    });

    // PER-ROOT, BECAUSE THE AGGREGATE ABOVE CANNOT SEE ONE ROOT GO DARK.
    //
    // The corpus is a UNION of independent `git ls-files <root>` calls, and
    // `src/Core.TypeScript` alone contributes 1678 of the 1763 files. Any other root
    // could be renamed, moved, or emptied and the total would still clear 100 — the
    // aggregate floor sums independent instruments, so it cannot detect the failure of
    // any one. Measured on unmodified main (2026-08-15):
    //
    //   .github 69 · src/Core.TypeScript 1678 · clis 1 · .claude 15
    //
    // The floor is ONE PER ROOT and deliberately not a tuned number. One is the
    // non-vacuity boundary — "this root still contributes" — and it is the only value
    // that is not a guess about how big each root ought to be. `clis` contributes
    // exactly 1 (`clis/Verbs.fs`; the rest is markdown), which is what the honest floor
    // has to tolerate.
    //
    // THIS CHECK ALREADY HAD A DARK ROUTE and the aggregate floor showed green over it:
    // `skills` was in SEARCH_ROOTS and contributed ZERO, because both of its tracked
    // files are `.md` and ALLOWED excludes markdown by design. It is removed rather than
    // floored — a root that can only ever contribute excluded files is not coverage, it
    // is the appearance of coverage — and nothing is lost, because the skills that do
    // carry executable surface live under `.claude/skills`, inside the `.claude` root
    // (2 non-md tracked files there).
    for (const root of SEARCH_ROOTS) {
        test(`root ${root} still contributes to the corpus — a dark root is invisible in a total`, () => {
            expect(perRoot.get(root)?.length ?? 0).toBeGreaterThanOrEqual(1);
        });
    }

    test("every root's files were actually READ — an unreadable root is a dark root too", () => {
        // The read is the second, independent way a root goes dark: `ls-files` can list a
        // root that then fails to read (submodule, symlink farm, permissions). Attribute
        // the readable set back to its root so that failure is named too.
        const readable = new Set(sources.map((s) => s.path));
        const emptyAfterRead = SEARCH_ROOTS.filter(
            (root) => (perRoot.get(root) ?? []).filter((f) => readable.has(f)).length === 0,
        );
        expect(emptyAfterRead).toEqual([]);
    });

    for (const { pattern, why } of FORBIDDEN) {
        test(`no agent-facing file invokes ${String(pattern)} — ${why}`, () => {
            const offenders = sources.filter((s) => pattern.test(s.text)).map((s) => s.path);
            expect(offenders).toEqual([]);
        });
    }
});
