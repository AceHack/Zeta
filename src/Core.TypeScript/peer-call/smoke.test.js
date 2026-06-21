// smoke.test.ts — minimal smoke tests for all peer-call wrappers.
//
// Implements 081KRA5AR0008QG0R0011ZGRZT acceptance criterion 4: "Add a smoke test to
// tools/peer-call/ that verifies all four wrappers can complete
// a 1-line review." Generalized to all 8 wrappers (claude, grok,
// gemini, codex, kiro, amara, ani, riven) per the post-2026-05-11
// wrapper expansion (081KR2E4K0008QG0R001HQF27C + 081KR2E4K0008QG0R002KNZ29V added kiro + claude).
//
// Scope: VALIDATES WRAPPER PLUMBING, NOT LIVE AI CALLS.
//
// CI runners do not have cursor-agent / gemini / codex-cli / kiro-cli
// installed, so a "live" smoke test that actually invokes the
// external AIs cannot run in CI. This test instead exercises:
//
//   1. Each wrapper file exists at the expected path.
//   2. Each wrapper responds to `--help` with exit 0 and help text.
//      This catches: missing file, syntax error preventing bun
//      from loading, broken argument-parser, missing help branch.
//   3. Each wrapper's help text mentions the wrapper's own name
//      (catches copy-paste-name-mismatch regressions where
//      gemini.ts's help would print "grok").
//   4. Each wrapper accepts `--output-file PATH` followed by
//      `--help` without an argument-parse error (smoke test for
//      the canonical output-capture contract per Class B vera-
//      output-capture-pagination fix). `--help` short-circuits
//      after `--output-file` is consumed, exiting 0 — proves the
//      flag is accepted without invoking any external AI.
//
// What this test does NOT cover (out of scope for smoke test):
//   - Live AI responses (requires external CLI installed)
//   - Output capture pagination behavior with real content
//     (this smoke test only validates flag acceptance, not the
//     full output-file write/tee path)
//   - Input firewall behavior (covered by _firewall.ts itself
//     when its own tests land)
//   - Cross-wrapper BFT-style consensus (separate concern; this
//     suite checks each wrapper individually, not their
//     interactions)
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const PEER_CALL_DIR = dirname(fileURLToPath(import.meta.url));
// The 9 canonical wrappers (per .claude/rules/peer-call-infrastructure.md).
// Each tuple is [filename, expectedSelfReferenceInHelp].
const WRAPPERS = [
    ["claude.ts", "claude.ts"],
    ["grok.ts", "grok.ts"],
    ["grok-build.ts", "grok-build.ts"],
    ["gemini.ts", "gemini.ts"],
    ["codex.ts", "codex.ts"],
    ["kiro.ts", "kiro.ts"],
    ["amara.ts", "amara.ts"],
    ["ani.ts", "ani.ts"],
    ["riven.ts", "riven.ts"],
    ["summon.ts", "summon.ts"],
];
function runWrapper(name, args) {
    const wrapperPath = resolve(PEER_CALL_DIR, name);
    const result = spawnSync("bun", [wrapperPath, ...args], {
        encoding: "utf8",
        timeout: 10_000,
    });
    return {
        status: result.status ?? -1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}
describe("peer-call smoke tests (081KRA5AR0008QG0R0011ZGRZT acceptance #4)", () => {
    for (const [name, selfRef] of WRAPPERS) {
        describe(name, () => {
            test("exists at the canonical path", () => {
                const wrapperPath = resolve(PEER_CALL_DIR, name);
                expect(existsSync(wrapperPath)).toBe(true);
            });
            test("--help exits 0 and prints help text", () => {
                const result = runWrapper(name, ["--help"]);
                expect(result.status).toBe(0);
                expect(result.stdout.length).toBeGreaterThan(0);
                // Help text should mention "Usage" or "usage" — a canonical
                // marker for help output across CLI tools.
                const helpText = result.stdout.toLowerCase();
                expect(helpText.includes("usage")).toBe(true);
            });
            test("help text references its own filename (no copy-paste-name regression)", () => {
                const result = runWrapper(name, ["--help"]);
                expect(result.status).toBe(0);
                // Help text should contain the wrapper's own filename so
                // a copy-paste regression (gemini.ts's help printing
                // grok.ts) gets caught.
                expect(result.stdout.includes(selfRef)).toBe(true);
            });
            test("accepts --output-file PATH flag without arg-parse error", () => {
                // `--output-file <path>` is consumed by classifyFlag(),
                // advancing 2 args. `--help` then short-circuits with
                // exit 0 before any external AI is invoked. If the
                // wrapper rejects --output-file as an unknown flag, the
                // exit would be 1 with a stderr error — this test
                // catches that regression without depending on cursor-
                // agent / gemini / codex-cli / kiro-cli being installed.
                const result = runWrapper(name, [
                    "--output-file",
                    "/tmp/peer-call-smoke-test-output.md",
                    "--help",
                ]);
                expect(result.status).toBe(0);
                // Stderr must not contain the canonical "unknown flag"
                // error from classifyFlag().
                expect(result.stderr.includes("unknown flag")).toBe(false);
            });
        });
    }
    describe("summon.ts specific tests", () => {
        test("gracefully handles missing CLI (fallback to local-LLM or exit 1/2)", () => {
            // Use a persona with a CLI that genuinely doesn't exist
            const result = runWrapper("summon.ts", ["nonexistent-persona-xyz", "design test prompt", "--allow-empty"]);
            // Either fallback to local-LLM (exit 0) or error (exit 1/2). Never crashes.
            expect([0, 1, 2]).toContain(result.status);
        });
        test("fails with exit code 3 when firewall blocks prompt", () => {
            const result = runWrapper("summon.ts", ["soraya", "hi"]);
            expect(result.status).toBe(3);
            expect(result.stderr.includes("REJECTED")).toBe(true);
        });
    });
});
describe("peer-call utility files (NOT wrappers)", () => {
    // Per peer-call-infrastructure rule, these are utility files
    // and should NOT be invoked directly with --help. We just verify
    // they exist so the rule's "11 files = 8 wrappers + 3 utilities"
    // count remains accurate.
    const UTILITIES = ["_firewall.ts", "append-identity-receipt.ts", "register-layers.ts"];
    for (const name of UTILITIES) {
        test(`utility ${name} exists`, () => {
            const utilPath = resolve(PEER_CALL_DIR, name);
            expect(existsSync(utilPath)).toBe(true);
        });
    }
});
