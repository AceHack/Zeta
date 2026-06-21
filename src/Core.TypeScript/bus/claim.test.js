import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const CLAIM_SCRIPT = join(import.meta.dir, "claim.ts");
let TEST_DIR;
function run(...args) {
    const r = spawnSync("bun", [CLAIM_SCRIPT, ...args], {
        encoding: "utf-8",
        env: { ...process.env, ZETA_BUS_DIR: TEST_DIR },
    });
    return {
        stdout: (r.stdout ?? "").trim(),
        stderr: (r.stderr ?? "").trim(),
        exitCode: r.status ?? 1,
    };
}
function cleanTestDir() {
    if (existsSync(TEST_DIR))
        rmSync(TEST_DIR, { recursive: true, force: true });
}
describe("claim.ts — check", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("check reports unclaimed when bus is empty", () => {
        const r = run("check", "--item", "B-0400");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("unclaimed");
    });
    test("check --json exits 0 with claimed:false when empty", () => {
        const r = run("check", "--item", "B-0400", "--json");
        expect(r.exitCode).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.claimed).toBe(false);
        expect(out.itemId).toBe("B-0400");
        expect(out.claims).toHaveLength(0);
    });
    test("check exits 1 and reports claimant after acquire", () => {
        run("acquire", "--from", "otto", "--item", "B-0400");
        const r = run("check", "--item", "B-0400");
        expect(r.exitCode).toBe(1);
        expect(r.stdout).toContain("claimed by otto");
    });
    test("check --json exits 1 with claimed:true after acquire", () => {
        run("acquire", "--from", "vera", "--item", "B-0400");
        const r = run("check", "--item", "B-0400", "--json");
        expect(r.exitCode).toBe(1);
        const out = JSON.parse(r.stdout);
        expect(out.claimed).toBe(true);
        expect(out.claims).toHaveLength(1);
        expect(out.claims[0].from).toBe("vera");
    });
    test("check includes branch info when present", () => {
        run("acquire", "--from", "otto", "--item", "B-0400", "--branch", "feat/my-branch");
        const r = run("check", "--item", "B-0400");
        expect(r.exitCode).toBe(1);
        expect(r.stdout).toContain("feat/my-branch");
    });
    test("check exits 0 after acquire + release", () => {
        run("acquire", "--from", "otto", "--item", "B-0400");
        run("release", "--from", "otto", "--item", "B-0400");
        const r = run("check", "--item", "B-0400");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("unclaimed");
    });
    test("check --item required", () => {
        const r = run("check");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("--item");
    });
});
describe("claim.ts — acquire", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("acquire succeeds on unclaimed item", () => {
        const r = run("acquire", "--from", "otto", "--item", "B-0123");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("claimed by otto");
    });
    test("acquire --json returns acquired:true with messageId", () => {
        const r = run("acquire", "--from", "otto", "--item", "B-0123", "--json");
        expect(r.exitCode).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.acquired).toBe(true);
        expect(typeof out.messageId).toBe("string");
    });
    test("acquire fails when another agent already holds claim", () => {
        run("acquire", "--from", "vera", "--item", "B-0123");
        const r = run("acquire", "--from", "otto", "--item", "B-0123");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("already claimed");
    });
    test("acquire --json exits 1 with acquired:false when blocked", () => {
        run("acquire", "--from", "vera", "--item", "B-0123");
        const r = run("acquire", "--from", "otto", "--item", "B-0123", "--json");
        expect(r.exitCode).toBe(1);
        const out = JSON.parse(r.stdout);
        expect(out.acquired).toBe(false);
        expect(out.claimedBy).toContain("vera");
    });
    test("acquire succeeds after other agent releases", () => {
        run("acquire", "--from", "vera", "--item", "B-0123");
        run("release", "--from", "vera", "--item", "B-0123");
        const r = run("acquire", "--from", "otto", "--item", "B-0123");
        expect(r.exitCode).toBe(0);
    });
    test("same agent can re-acquire its own claim (idempotent)", () => {
        run("acquire", "--from", "otto", "--item", "B-0123");
        const r = run("acquire", "--from", "otto", "--item", "B-0123");
        expect(r.exitCode).toBe(0);
    });
    test("acquire includes branch in output when provided", () => {
        const r = run("acquire", "--from", "riven", "--item", "B-0500", "--branch", "feat/b-0500");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("feat/b-0500");
    });
    test("acquire with invalid sender exits 1", () => {
        const r = run("acquire", "--from", "unknown-bot", "--item", "B-0001");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("unknown sender");
    });
    test("acquire missing --from exits 1", () => {
        const r = run("acquire", "--item", "B-0001");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("required");
    });
    test("acquire missing --item exits 1", () => {
        const r = run("acquire", "--from", "otto");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("required");
    });
    // PR #3037 — multi-surface sender ID coverage
    test("acquire accepts otto-cli surface-tagged sender", () => {
        const r = run("acquire", "--from", "otto-cli", "--item", "B-0444");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts otto-desktop surface-tagged sender", () => {
        const r = run("acquire", "--from", "otto-desktop", "--item", "B-0445");
        expect(r.exitCode).toBe(0);
    });
    test("otto-cli and otto-desktop are DISTINCT senders — same-item claim by second surface is rejected", () => {
        const r1 = run("acquire", "--from", "otto-cli", "--item", "B-0500");
        expect(r1.exitCode).toBe(0);
        // otto-desktop on the SAME item should be REJECTED (otto-cli holds it)
        const r2 = run("acquire", "--from", "otto-desktop", "--item", "B-0500");
        expect(r2.exitCode).toBe(1);
        expect(r2.stderr).toContain("otto-cli");
    });
    // B-0689 (2026-05-21) — Otto-VSCode third foreground surface
    test("acquire accepts otto-vscode surface-tagged sender", () => {
        const r = run("acquire", "--from", "otto-vscode", "--item", "B-0689-a");
        expect(r.exitCode).toBe(0);
    });
    test("otto-vscode is DISTINCT from otto-cli — same-item claim by otto-vscode is rejected when otto-cli holds", () => {
        const r1 = run("acquire", "--from", "otto-cli", "--item", "B-0689-b");
        expect(r1.exitCode).toBe(0);
        const r2 = run("acquire", "--from", "otto-vscode", "--item", "B-0689-b");
        expect(r2.exitCode).toBe(1);
        expect(r2.stderr).toContain("otto-cli");
    });
    test("otto-vscode is DISTINCT from otto-desktop — same-item claim by otto-vscode is rejected when otto-desktop holds", () => {
        const r1 = run("acquire", "--from", "otto-desktop", "--item", "B-0689-c");
        expect(r1.exitCode).toBe(0);
        const r2 = run("acquire", "--from", "otto-vscode", "--item", "B-0689-c");
        expect(r2.exitCode).toBe(1);
        expect(r2.stderr).toContain("otto-desktop");
    });
    test("acquire accepts alexa-cli surface-tagged sender", () => {
        const r = run("acquire", "--from", "alexa-cli", "--item", "B-0501");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts alexa-kiro surface-tagged sender", () => {
        const r = run("acquire", "--from", "alexa-kiro", "--item", "B-0506");
        expect(r.exitCode).toBe(0);
    });
    test("alexa-cli and alexa-kiro are DISTINCT senders — same-item claim by second surface is rejected", () => {
        const r1 = run("acquire", "--from", "alexa-cli", "--item", "B-0507");
        expect(r1.exitCode).toBe(0);
        const r2 = run("acquire", "--from", "alexa-kiro", "--item", "B-0507");
        expect(r2.exitCode).toBe(1);
        expect(r2.stderr).toContain("alexa-cli");
    });
    test("acquire accepts riven-cli surface-tagged sender", () => {
        const r = run("acquire", "--from", "riven-cli", "--item", "B-0502");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts riven-cursor surface-tagged sender", () => {
        const r = run("acquire", "--from", "riven-cursor", "--item", "B-0508");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts lior-antigravity surface-tagged sender", () => {
        const r = run("acquire", "--from", "lior-antigravity", "--item", "B-0503");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts lior-gemini surface-tagged sender", () => {
        const r = run("acquire", "--from", "lior-gemini", "--item", "B-0509");
        expect(r.exitCode).toBe(0);
    });
    test("acquire accepts vera-codex surface-tagged sender", () => {
        const r = run("acquire", "--from", "vera-codex", "--item", "B-0504");
        expect(r.exitCode).toBe(0);
    });
    test("identity-level otto still accepted (back-compat)", () => {
        const r = run("acquire", "--from", "otto", "--item", "B-0505");
        expect(r.exitCode).toBe(0);
    });
});
// B-0444 — worktree field on the claim envelope. Captures per-process operational
// coordinate; surface-tagged sender IDs (PR #3037) already prevent split-brain
// across surfaces, so worktree is for observability, not coordination.
describe("claim.ts — worktree field (B-0444)", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("acquire omits worktree from payload + JSON when --worktree not specified (Copilot review)", () => {
        // Copilot review on PR #3043: defaulting to process.cwd() can record a
        // plausible-looking but misleading coordinate when the caller is in an
        // unrelated directory. New behavior: leave the field absent when omitted.
        const r = run("acquire", "--from", "otto", "--item", "B-0600", "--json");
        expect(r.exitCode).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.acquired).toBe(true);
        expect(out.worktree).toBeUndefined();
    });
    test("acquire surfaces explicit --worktree value in check output", () => {
        const wt = "/tmp/zeta-test-worktree-B-0601";
        run("acquire", "--from", "otto", "--item", "B-0601", "--worktree", wt);
        const r = run("check", "--item", "B-0601");
        expect(r.exitCode).toBe(1);
        expect(r.stdout).toContain("claimed by otto");
        expect(r.stdout).toContain(`[worktree: ${wt}]`);
    });
    test("check --json includes worktree on the claim record", () => {
        const wt = "/tmp/zeta-test-worktree-B-0602";
        run("acquire", "--from", "otto", "--item", "B-0602", "--worktree", wt);
        const r = run("check", "--item", "B-0602", "--json");
        expect(r.exitCode).toBe(1);
        const out = JSON.parse(r.stdout);
        expect(out.claims).toHaveLength(1);
        expect(out.claims[0].worktree).toBe(wt);
    });
    test("acquire combines --branch and --worktree in output", () => {
        const r = run("acquire", "--from", "otto-cli", "--item", "B-0603", "--branch", "feat/b0603-test", "--worktree", "/tmp/zeta-test-worktree-B-0603");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("(feat/b0603-test)");
        expect(r.stdout).toContain("[worktree: /tmp/zeta-test-worktree-B-0603]");
    });
    test("activeClaims returns claim records WITH a worktree field when payload carries one", () => {
        const wt = "/tmp/zeta-test-worktree-shape";
        run("acquire", "--from", "otto", "--item", "B-0604", "--worktree", wt);
        const r = run("check", "--item", "B-0604", "--json");
        expect(r.exitCode).toBe(1);
        const out = JSON.parse(r.stdout);
        expect(out.claims[0].worktree).toBe(wt);
        // Spot-check: branch is absent from the record (we didn't pass --branch)
        expect(out.claims[0].branch).toBeUndefined();
    });
    test("two surfaces of the same identity in different worktrees — surface IDs still arbitrate, worktree is metadata only", () => {
        const r1 = run("acquire", "--from", "otto-cli", "--item", "B-0605", "--worktree", "/tmp/zeta-test-cli-worktree");
        expect(r1.exitCode).toBe(0);
        // otto-desktop on SAME item from a DIFFERENT worktree — REJECTED.
        // Sender-ID surface tag (PR #3037) arbitrates; worktree is observability metadata.
        const r2 = run("acquire", "--from", "otto-desktop", "--item", "B-0605", "--worktree", "/tmp/zeta-test-desktop-worktree");
        expect(r2.exitCode).toBe(1);
        expect(r2.stderr).toContain("otto-cli");
    });
    test("same sender re-acquiring from a different worktree is idempotent (existing behavior preserved)", () => {
        const r1 = run("acquire", "--from", "otto-cli", "--item", "B-0606", "--worktree", "/tmp/A");
        expect(r1.exitCode).toBe(0);
        // Same sender + same item from different worktree: still idempotent re-acquire,
        // matching the pre-B-0444 same-sender behavior. The check filter is on `from`,
        // not on (from, worktree). Substrate-honest design decision recorded in the row.
        const r2 = run("acquire", "--from", "otto-cli", "--item", "B-0606", "--worktree", "/tmp/B");
        expect(r2.exitCode).toBe(0);
    });
    // Codex P2 (PR #3043 review round 1): bare `--worktree` (no value
    // following) used to be encoded by parseArgs as the literal string "true"
    // and would otherwise be recorded as the worktree path. parseArgs now
    // distinguishes bare-flag (boolean true) from explicit string values.
    test("bare --worktree (no value) is rejected with a clear error", () => {
        const r = run("acquire", "--from", "otto", "--item", "B-0607", "--worktree");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("--worktree requires a path argument");
    });
    // Codex P2 (PR #3043 review round 2): explicit `--worktree true` (where
    // the literal string `true` is the intended path value) must NOT be
    // rejected. The bare-flag check is on the boolean sentinel, not on the
    // string content.
    test("explicit --worktree true (literal string) is accepted as a valid path", () => {
        const r = run("acquire", "--from", "otto", "--item", "B-0608", "--worktree", "true", "--json");
        expect(r.exitCode).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.acquired).toBe(true);
        expect(out.worktree).toBe("true");
    });
});
describe("claim.ts — release", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("release publishes successfully", () => {
        run("acquire", "--from", "otto", "--item", "B-0400");
        const r = run("release", "--from", "otto", "--item", "B-0400");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("released by otto");
    });
    test("release --json returns released:true with messageId", () => {
        const r = run("release", "--from", "otto", "--item", "B-0400", "--json");
        expect(r.exitCode).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.released).toBe(true);
        expect(typeof out.messageId).toBe("string");
    });
    test("release without prior acquire still publishes (idempotent best-effort)", () => {
        const r = run("release", "--from", "otto", "--item", "B-0999");
        expect(r.exitCode).toBe(0);
    });
    test("release with invalid sender exits 1", () => {
        const r = run("release", "--from", "bad-agent", "--item", "B-0001");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("unknown sender");
    });
    test("release missing --from exits 1", () => {
        const r = run("release", "--item", "B-0001");
        expect(r.exitCode).toBe(1);
        expect(r.stderr).toContain("required");
    });
});
describe("claim.ts — multi-item isolation", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("claims for different items do not interfere", () => {
        run("acquire", "--from", "otto", "--item", "B-0001");
        run("acquire", "--from", "vera", "--item", "B-0002");
        const r1 = run("check", "--item", "B-0001");
        expect(r1.exitCode).toBe(1);
        expect(r1.stdout).toContain("otto");
        const r2 = run("check", "--item", "B-0002");
        expect(r2.exitCode).toBe(1);
        expect(r2.stdout).toContain("vera");
    });
    test("check returns only claims for the queried item", () => {
        run("acquire", "--from", "otto", "--item", "B-0001");
        run("acquire", "--from", "vera", "--item", "B-0002");
        const r = run("check", "--item", "B-0001", "--json");
        const out = JSON.parse(r.stdout);
        expect(out.claims.every((c) => c.itemId === "B-0001")).toBe(true);
    });
});
describe("claim.ts — unknown command", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("unknown command exits 1", () => {
        const r = run("frobulate");
        expect(r.exitCode).toBe(1);
    });
});
// ── P2: unknown action guard ──────────────────────────────────────────────────
describe("claim.ts — unknown action protection (P2)", () => {
    const BUS_SCRIPT = join(import.meta.dir, "bus.ts");
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("unknown action on claim topic does not clear an existing claim", () => {
        run("acquire", "--from", "otto", "--item", "B-0300");
        // Inject a message with an unknown action to simulate a buggy sender.
        spawnSync("bun", [BUS_SCRIPT, "publish", "--from", "vera", "--to", "*", "--topic", "claim",
            "--payload", JSON.stringify({ action: "relinquish", itemId: "B-0300" })], { encoding: "utf-8", env: { ...process.env, ZETA_BUS_DIR: TEST_DIR } });
        const r = run("check", "--item", "B-0300");
        expect(r.exitCode).toBe(1);
        expect(r.stdout).toContain("claimed by otto");
    });
});
// ── P2: same-timestamp mtime tiebreak ────────────────────────────────────────
describe("claim.ts — same-timestamp mtime tiebreak (P2)", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("release with later mtime wins over claim sharing the same ISO timestamp", () => {
        const claimId = "00000000-0000-0000-0000-aaaaaaaaaaaa";
        const releaseId = "00000000-0000-0000-0000-bbbbbbbbbbbb";
        const ts = new Date().toISOString();
        const exp = new Date(Date.now() + 86_400_000).toISOString();
        const base = new Date();
        const laterMs = new Date(base.getTime() + 50);
        writeFileSync(join(TEST_DIR, `${claimId}.json`), JSON.stringify({
            id: claimId, from: "otto", to: "*", topic: "claim",
            timestamp: ts, expiresAt: exp,
            payload: { action: "claim", itemId: "B-0999" },
        }));
        utimesSync(join(TEST_DIR, `${claimId}.json`), base, base);
        writeFileSync(join(TEST_DIR, `${releaseId}.json`), JSON.stringify({
            id: releaseId, from: "otto", to: "*", topic: "claim",
            timestamp: ts, expiresAt: exp,
            payload: { action: "release", itemId: "B-0999" },
        }));
        utimesSync(join(TEST_DIR, `${releaseId}.json`), laterMs, laterMs);
        const r = run("check", "--item", "B-0999");
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("unclaimed");
    });
});
// ── P1: acquire lock cleanup + stale lock recovery ───────────────────────────
describe("claim.ts — acquire lock cleanup (P1)", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    test("no lock files remain in bus dir after acquire", () => {
        run("acquire", "--from", "otto", "--item", "B-0555");
        const lockFiles = readdirSync(TEST_DIR).filter((f) => f.startsWith("acquire-"));
        expect(lockFiles).toHaveLength(0);
    });
    test("no lock files remain after failed acquire", () => {
        run("acquire", "--from", "vera", "--item", "B-0555");
        run("acquire", "--from", "otto", "--item", "B-0555"); // blocked
        const lockFiles = readdirSync(TEST_DIR).filter((f) => f.startsWith("acquire-"));
        expect(lockFiles).toHaveLength(0);
    });
    test("stale lock (age > 5s) is reclaimed so acquire succeeds", () => {
        // Simulate a lock file left by a crashed process: backdate its mtime AND write a
        // dead PID (0 is never a valid running process so isProcessRunning(0) = false).
        // B-0777 → encodeURIComponent("B-0777") = "B-0777", so lock file is acquire-B-0777.lock.
        const lockPath = join(TEST_DIR, "acquire-B-0777.lock");
        const staleDate = new Date(Date.now() - 10_000); // 10s ago — beyond the 5s threshold
        writeFileSync(lockPath, "0");
        utimesSync(lockPath, staleDate, staleDate);
        const r = run("acquire", "--from", "otto", "--item", "B-0777");
        expect(r.exitCode).toBe(0);
        // Lock must be cleaned up after successful acquire.
        const lockFiles = readdirSync(TEST_DIR).filter((f) => f.startsWith("acquire-"));
        expect(lockFiles).toHaveLength(0);
    });
});
// ── allActiveClaims() ─────────────────────────────────────────────────────────
describe("claim.ts — allActiveClaims()", () => {
    beforeEach(() => { TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-claim-test-")); });
    afterEach(cleanTestDir);
    function evalInBus(code) {
        const r = spawnSync("bun", ["-e", code], {
            encoding: "utf-8",
            env: { ...process.env, ZETA_BUS_DIR: TEST_DIR },
        });
        return { stdout: (r.stdout ?? "").trim(), status: r.status };
    }
    test("returns empty array when bus is empty", () => {
        const r = evalInBus(`
      const { allActiveClaims } = await import(${JSON.stringify(CLAIM_SCRIPT)});
      console.log(JSON.stringify(allActiveClaims()));
    `);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual([]);
    });
    test("returns all active claims across multiple items", () => {
        run("acquire", "--from", "otto", "--item", "B-0400");
        run("acquire", "--from", "vera", "--item", "B-0401");
        const r = evalInBus(`
      const { allActiveClaims } = await import(${JSON.stringify(CLAIM_SCRIPT)});
      console.log(JSON.stringify(allActiveClaims()));
    `);
        expect(r.status).toBe(0);
        const claims = JSON.parse(r.stdout);
        expect(claims).toHaveLength(2);
        const itemIds = claims.map((c) => c.itemId).sort();
        expect(itemIds).toEqual(["B-0400", "B-0401"]);
    });
    test("released items are not included", () => {
        run("acquire", "--from", "otto", "--item", "B-0400");
        run("acquire", "--from", "vera", "--item", "B-0401");
        run("release", "--from", "otto", "--item", "B-0400");
        const r = evalInBus(`
      const { allActiveClaims } = await import(${JSON.stringify(CLAIM_SCRIPT)});
      console.log(JSON.stringify(allActiveClaims()));
    `);
        expect(r.status).toBe(0);
        const claims = JSON.parse(r.stdout);
        expect(claims).toHaveLength(1);
        expect(claims[0].itemId).toBe("B-0401");
    });
});
