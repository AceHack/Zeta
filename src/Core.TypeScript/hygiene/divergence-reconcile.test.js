import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildDivergenceShard, divergenceShardRelPath, writeDivergenceShard, } from "./divergence-shard";
import { RECONCILIATION_DECISIONS, fillReconciliation, findPendingShards, isReconciliationDecision, isReconciliationPending, main, parseShardMeta, parseArgs, reconcileDivergenceShard, reconciliationBody, regularShardOpenFlags, scanDivergenceDir, } from "./divergence-reconcile";
// Build fixtures via the WRITER so the reader is tested against exactly what the
// writer emits — a writer<->reader round-trip that catches schema drift between
// the two halves of the protocol.
function inputAt(tick, aBody, bBody) {
    return {
        tick,
        loopA: {
            identity: { agent: "otto", model: "claude-opus-4-8", harness: "claude-code" },
            body: aBody,
        },
        loopB: {
            identity: { agent: "codex-loop", model: "gpt-5.5", harness: "codex" },
            body: bBody,
        },
        topic: `PR #4147 thread <id> — ${aBody.slice(0, 12)}`,
        disagreementSummary: "Loop A and Loop B reached different conclusions on the same thread.",
        operativeAuthorization: 'aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing"',
    };
}
const PENDING_SHARD = buildDivergenceShard(inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B"));
/** Replace the maintainer placeholder with a real decision (reconciled state). */
function reconcile(shard, decision) {
    const idx = shard.indexOf("## Reconciliation");
    return `${shard.slice(0, idx)}## Reconciliation\n\n${decision}\n`;
}
function withTempRoot(fn) {
    const root = mkdtempSync(join(tmpdir(), "reconcile-test-"));
    try {
        return fn(root);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
describe("reconciliationBody", () => {
    test("returns the section text for a writer-emitted shard", () => {
        const body = reconciliationBody(PENDING_SHARD);
        expect(body).not.toBeNull();
        expect(body).toContain("Leave blank until morning reconciliation");
    });
    test("returns null when there is no Reconciliation section", () => {
        expect(reconciliationBody("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx")).toBeNull();
    });
});
describe("isReconciliationPending", () => {
    test("a writer-emitted shard is pending (placeholder comments only)", () => {
        expect(isReconciliationPending(PENDING_SHARD)).toBe(true);
    });
    test("a shard with a filled decision is not pending", () => {
        expect(isReconciliationPending(reconcile(PENDING_SHARD, "accept-loop-b — B reproduces locally. (human maintainer)"))).toBe(false);
    });
    test("a file with no Reconciliation section is not pending", () => {
        expect(isReconciliationPending("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx")).toBe(false);
    });
    test("spliced/nested comments are stripped to a fixpoint, not one pass", () => {
        // A single `.replace(/<!--…-->/g, "")` pass leaves a residual `<!-- -->`
        // here: removing the inner comment splices `<!` + `-- -->` into a fresh
        // comment the pass already scanned past. The fixpoint loop strips it
        // fully, so a comment-only body still reads as pending. (Regression for
        // CodeQL js/incomplete-multi-character-sanitization.)
        const md = "---\ntype: divergence\n---\n\n## Reconciliation\n\n<!<!-- -->-- -->\n";
        expect(isReconciliationPending(md)).toBe(true);
    });
});
describe("parseShardMeta", () => {
    test("extracts tick, topic, and both loop agents from a writer-emitted shard", () => {
        const meta = parseShardMeta(PENDING_SHARD);
        expect(meta).not.toBeNull();
        expect(meta.tick).toBe("2026-05-10T11:48:00Z");
        expect(meta.topic).toContain("PR #4147 thread <id>");
        expect(meta.loopAAgent).toBe("otto");
        expect(meta.loopBAgent).toBe("codex-loop");
    });
    test("returns null for a non-divergence frontmatter (README-style file)", () => {
        expect(parseShardMeta("---\ntitle: not a shard\n---\n\nbody")).toBeNull();
    });
    test("returns null when there is no frontmatter at all", () => {
        expect(parseShardMeta("# just a markdown doc\n\nno frontmatter")).toBeNull();
    });
});
describe("findPendingShards", () => {
    test("returns only pending shards, oldest-first, excluding reconciled + non-shards", () => {
        const newer = buildDivergenceShard(inputAt("2026-05-12T09:00:00Z", "newer A", "newer B"));
        const older = buildDivergenceShard(inputAt("2026-05-09T08:00:00Z", "older A", "older B"));
        const reconciled = reconcile(buildDivergenceShard(inputAt("2026-05-11T07:00:00Z", "done A", "done B")), "accept-loop-a — settled. (human maintainer)");
        const files = [
            { relPath: "d/newer.md", content: newer },
            { relPath: "d/reconciled.md", content: reconciled },
            { relPath: "d/older.md", content: older },
            { relPath: "d/README.md", content: "---\ntitle: x\n---\nnot a shard" },
        ];
        const pending = findPendingShards(files);
        expect(pending.map((p) => p.relPath)).toEqual(["d/older.md", "d/newer.md"]);
        expect(pending[0].tick).toBe("2026-05-09T08:00:00Z");
    });
});
describe("scanDivergenceDir", () => {
    test("returns [] when the divergence directory is absent", () => {
        withTempRoot((root) => {
            expect(scanDivergenceDir(root)).toEqual([]);
        });
    });
    test("surfaces a writer-written shard, then drops it once reconciled", () => {
        withTempRoot((root) => {
            const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
            const { relPath } = writeDivergenceShard(root, input);
            // sanity: writer chose the canonical content-addressed path
            expect(relPath).toBe(divergenceShardRelPath(input.tick, input.loopA.body, input.loopB.body));
            const before = scanDivergenceDir(root);
            expect(before).toHaveLength(1);
            expect(before[0].relPath).toBe(relPath);
            expect(before[0].loopAAgent).toBe("otto");
            expect(before[0].loopBAgent).toBe("codex-loop");
            // Maintainer fills the Reconciliation section in place → no longer pending.
            writeFileSync(join(root, relPath), reconcile(buildDivergenceShard(input), "accept-loop-b — (human maintainer)"));
            expect(scanDivergenceDir(root)).toHaveLength(0);
        });
    });
    test("skips README.md and ignores non-shard markdown", () => {
        withTempRoot((root) => {
            const dir = join(root, "docs/hygiene-history/divergences/2026/05/10");
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(root, "docs/hygiene-history/divergences/README.md"), "# README\n\n## Reconciliation outcomes\n\nprose");
            writeFileSync(join(dir, "stray.md"), "---\ntitle: not a shard\n---\n\n## Reconciliation\n\n");
            writeFileSync(join(dir, "114800Z-deadbeef.md"), PENDING_SHARD);
            const pending = scanDivergenceDir(root);
            expect(pending).toHaveLength(1);
            expect(dirname(pending[0].relPath)).toBe("docs/hygiene-history/divergences/2026/05/10");
        });
    });
    test("skips symlinked markdown entries instead of surfacing them for write-back", () => {
        withTempRoot((root) => {
            const dir = join(root, "docs/hygiene-history/divergences/2026/05/10");
            const outside = join(root, "outside.md");
            mkdirSync(dir, { recursive: true });
            writeFileSync(outside, PENDING_SHARD);
            symlinkSync(outside, join(dir, "114800Z-symlink.md"));
            expect(scanDivergenceDir(root)).toEqual([]);
        });
    });
    test("rejects a symlinked divergence root before scanning", () => {
        withTempRoot((root) => {
            const historyDir = join(root, "docs/hygiene-history");
            const outsideDir = join(root, "outside-divergences");
            mkdirSync(historyDir, { recursive: true });
            mkdirSync(outsideDir, { recursive: true });
            writeFileSync(join(outsideDir, "114800Z-root-symlink.md"), PENDING_SHARD);
            symlinkSync(outsideDir, join(historyDir, "divergences"), "dir");
            expect(() => scanDivergenceDir(root)).toThrow(/symbolic link/);
        });
    });
});
const RECONCILIATION_HEADING = "## Reconciliation";
/** Length of the prefix up to and including the Reconciliation heading. */
function reconciliationPrefixLen(shard) {
    return shard.indexOf(RECONCILIATION_HEADING) + RECONCILIATION_HEADING.length;
}
describe("isReconciliationDecision / RECONCILIATION_DECISIONS", () => {
    test("the four canonical decisions match the README vocabulary, in order", () => {
        expect(RECONCILIATION_DECISIONS).toEqual(["accept-loop-a", "accept-loop-b", "accept-both", "escalate"]);
    });
    test("accepts a canonical decision and rejects anything else", () => {
        expect(isReconciliationDecision("accept-both")).toBe(true);
        expect(isReconciliationDecision("escalate")).toBe(true);
        expect(isReconciliationDecision("accept-loop-c")).toBe(false);
        expect(isReconciliationDecision("")).toBe(false);
        expect(isReconciliationDecision("accept-loop-b — (human maintainer)")).toBe(false);
    });
});
describe("parseArgs", () => {
    test("defaults to the pending-shard list action", () => {
        expect(parseArgs([])).toEqual({ kind: "ok", command: { kind: "list", format: "text" } });
    });
    test("parses machine-readable list mode", () => {
        expect(parseArgs(["--json"])).toEqual({ kind: "ok", command: { kind: "list", format: "json" } });
        expect(parseArgs(["--list", "--json"])).toEqual({ kind: "ok", command: { kind: "list", format: "json" } });
    });
    test("parses a bounded reconcile action with a decision and optional note", () => {
        expect(parseArgs([
            "--reconcile",
            "docs/hygiene-history/divergences/2026/05/10/114800Z-deadbeef.md",
            "--decision",
            "accept-loop-b",
            "--note",
            "B reproduces locally. (human maintainer)",
        ])).toEqual({
            kind: "ok",
            command: {
                kind: "reconcile",
                relPath: "docs/hygiene-history/divergences/2026/05/10/114800Z-deadbeef.md",
                decision: "accept-loop-b",
                note: "B reproduces locally. (human maintainer)",
            },
        });
    });
    test("rejects reconcile without a canonical decision", () => {
        expect(parseArgs(["--reconcile", "docs/hygiene-history/divergences/x.md"])).toEqual({
            kind: "error",
            message: "--decision is required with --reconcile",
        });
        expect(parseArgs(["--reconcile", "docs/hygiene-history/divergences/x.md", "--decision", "accept-loop-c"])).toEqual({
            kind: "error",
            message: 'invalid reconciliation decision "accept-loop-c": expected one of accept-loop-a | accept-loop-b | accept-both | escalate',
        });
    });
    test("keeps list mode separate from the write-back action", () => {
        expect(parseArgs(["--list", "--reconcile", "docs/hygiene-history/divergences/x.md"])).toEqual({
            kind: "error",
            message: "--list cannot be combined with reconciliation arguments",
        });
        expect(parseArgs(["--reconcile", "docs/hygiene-history/divergences/x.md", "--decision", "accept-loop-a", "--json"])).toEqual({
            kind: "error",
            message: "--json can only be used with list mode",
        });
    });
});
describe("fillReconciliation", () => {
    test("fills a pending shard with a decision-only section (no note)", () => {
        const filled = fillReconciliation(PENDING_SHARD, "accept-loop-a");
        expect(isReconciliationPending(filled)).toBe(false);
        expect(reconciliationBody(filled).trim()).toBe("accept-loop-a");
    });
    test("appends an optional note below the decision", () => {
        const filled = fillReconciliation(PENDING_SHARD, "accept-loop-b", "B reproduces locally. (human maintainer)");
        expect(reconciliationBody(filled).trim()).toBe("accept-loop-b\n\nB reproduces locally. (human maintainer)");
        expect(isReconciliationPending(filled)).toBe(false);
    });
    test("treats a blank/whitespace-only note as no note (note is optional)", () => {
        expect(reconciliationBody(fillReconciliation(PENDING_SHARD, "escalate", "   \n\t")).trim()).toBe("escalate");
    });
    test("preserves everything up to and including the heading byte-for-byte", () => {
        const len = reconciliationPrefixLen(PENDING_SHARD);
        const filled = fillReconciliation(PENDING_SHARD, "accept-both");
        expect(filled.slice(0, len)).toBe(PENDING_SHARD.slice(0, len));
    });
    test("preserves a trailing `## ` section after Reconciliation (defensive bounding)", () => {
        const withTail = `${PENDING_SHARD}\n${"## Provenance"}\n\ntrailing section body\n`;
        const filled = fillReconciliation(withTail, "accept-both");
        // The Reconciliation section now carries only the decision...
        expect(reconciliationBody(filled).trim()).toBe("accept-both");
        // ...and the trailing section survives untouched.
        expect(filled).toContain("## Provenance");
        expect(filled).toContain("trailing section body");
    });
    test("rejects an invalid decision (EAGER, before any work — runtime callers pass raw strings)", () => {
        expect(() => fillReconciliation(PENDING_SHARD, "accept-loop-c")).toThrow(/invalid reconciliation decision/);
    });
    test("rejects a shard with no `## Reconciliation` section", () => {
        expect(() => fillReconciliation("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx", "escalate")).toThrow(/no .## Reconciliation. section/);
    });
    test("refuses to overwrite an already-reconciled section (history-preserving)", () => {
        const reconciled = fillReconciliation(PENDING_SHARD, "accept-loop-a", "first decision");
        expect(() => fillReconciliation(reconciled, "accept-loop-b")).toThrow(/already reconciled/);
    });
    test("round-trip: writer files a pending shard, fillReconciliation drops it from the pending scan", () => {
        withTempRoot((root) => {
            const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
            const { relPath } = writeDivergenceShard(root, input);
            expect(scanDivergenceDir(root)).toHaveLength(1);
            // Reconstruct exactly what the writer wrote (writeDivergenceShard == buildDivergenceShard(input)).
            const filled = fillReconciliation(buildDivergenceShard(input), "accept-loop-b", "B reproduces locally. (human maintainer)");
            writeFileSync(join(root, relPath), filled);
            expect(scanDivergenceDir(root)).toHaveLength(0);
        });
    });
});
describe("reconcileDivergenceShard (read → fillReconciliation → write-back, AC #4 'one action')", () => {
    test("fails closed when O_NOFOLLOW is unavailable", () => {
        expect(() => regularShardOpenFlags(0)).toThrow(/O_NOFOLLOW is unavailable/);
        expect(() => regularShardOpenFlags(undefined)).toThrow(/O_NOFOLLOW is unavailable/);
    });
    test("full AC #4 loop: write pending shard → scan finds it → reconcile → scan is empty", () => {
        withTempRoot((root) => {
            const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
            const { relPath } = writeDivergenceShard(root, input);
            // "one read": the reader surfaces the pending shard.
            expect(scanDivergenceDir(root).map((p) => p.relPath)).toEqual([relPath]);
            // "one action": land the decision in place.
            const result = reconcileDivergenceShard(root, relPath, "accept-loop-b", "B reproduces locally. (human maintainer)");
            expect(result).toEqual({ relPath, decision: "accept-loop-b" });
            // The shard is no longer pending, and the on-disk content carries the decision.
            expect(scanDivergenceDir(root)).toHaveLength(0);
            const md = readFileSync(join(root, relPath), "utf8");
            expect(isReconciliationPending(md)).toBe(false);
            expect(reconciliationBody(md).trim()).toBe("accept-loop-b\n\nB reproduces locally. (human maintainer)");
        });
    });
    test("writes a decision-only section when no note is given", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            reconcileDivergenceShard(root, relPath, "escalate");
            expect(reconciliationBody(readFileSync(join(root, relPath), "utf8")).trim()).toBe("escalate");
        });
    });
    test("preserves divergence evidence: only the Reconciliation section changes", () => {
        withTempRoot((root) => {
            const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
            const { relPath } = writeDivergenceShard(root, input);
            const before = readFileSync(join(root, relPath), "utf8");
            reconcileDivergenceShard(root, relPath, "accept-both");
            const after = readFileSync(join(root, relPath), "utf8");
            // Everything up to and including the `## Reconciliation` heading is byte-identical:
            // both loop perspectives + the disagreement summary survive verbatim.
            const len = before.indexOf("## Reconciliation") + "## Reconciliation".length;
            expect(after.slice(0, len)).toBe(before.slice(0, len));
            expect(after).toContain("## Loop A perspective");
            expect(after).toContain("## Loop B perspective");
            expect(after).toContain("## Disagreement summary");
        });
    });
    test("throws (no write) when no shard exists at the path", () => {
        withTempRoot((root) => {
            const relPath = "docs/hygiene-history/divergences/2026/05/10/114800Z-deadbeef.md";
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/no divergence shard at/);
            expect(existsSync(join(root, relPath))).toBe(false);
        });
    });
    test("rejects a relPath that escapes the divergence root (no write)", () => {
        withTempRoot((root) => {
            // A traversal payload and an absolute path both resolve outside
            // docs/hygiene-history/divergences/; the guard rejects before any I/O so
            // a write-back helper can never be steered to clobber unrelated files.
            const victim = "docs/IMPORTANT.md";
            const victimAbs = join(root, victim);
            mkdirSync(dirname(victimAbs), { recursive: true });
            writeFileSync(victimAbs, "do not clobber\n");
            const traversal = "docs/hygiene-history/divergences/../../IMPORTANT.md";
            expect(() => reconcileDivergenceShard(root, traversal, "accept-loop-a")).toThrow(/outside the divergence root/);
            expect(() => reconcileDivergenceShard(root, "/etc/passwd", "accept-loop-a")).toThrow(/outside the divergence root/);
            // Fail-closed: the file the traversal pointed at is untouched.
            expect(readFileSync(victimAbs, "utf8")).toBe("do not clobber\n");
        });
    });
    test("throws (file unchanged) when the target is not a divergence shard", () => {
        withTempRoot((root) => {
            // A markdown file that HAS a `## Reconciliation` heading but is NOT a
            // divergence shard (no type: divergence frontmatter) — a mistyped relPath.
            // Kept inside the divergence root so the "not a shard" guard is what
            // fires (the path-containment guard would otherwise reject it first).
            const relPath = "docs/hygiene-history/divergences/stray.md";
            const abs = join(root, relPath);
            mkdirSync(dirname(abs), { recursive: true });
            const stray = "---\ntitle: not a shard\n---\n\n## Reconciliation\n\n<!-- placeholder -->\n";
            writeFileSync(abs, stray);
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/not a divergence shard/);
            // Fail-closed: the non-shard file is left exactly as it was.
            expect(readFileSync(abs, "utf8")).toBe(stray);
        });
    });
    test("rejects symlinked shard paths before write-back", () => {
        withTempRoot((root) => {
            const dir = join(root, "docs/hygiene-history/divergences/2026/05/10");
            const outside = join(root, "outside.md");
            const relPath = "docs/hygiene-history/divergences/2026/05/10/114800Z-symlink.md";
            const link = join(root, relPath);
            mkdirSync(dir, { recursive: true });
            writeFileSync(outside, PENDING_SHARD);
            symlinkSync(outside, link);
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/symbolic link/);
            expect(readFileSync(outside, "utf8")).toBe(PENDING_SHARD);
        });
    });
    test("rejects symlinked shard ancestor paths before write-back", () => {
        withTempRoot((root) => {
            const insideRoot = join(root, "docs/hygiene-history/divergences");
            const outsideDir = join(root, "outside-divergences");
            const outside = join(outsideDir, "114800Z-symlink-ancestor.md");
            const linkDir = join(insideRoot, "linkdir");
            const relPath = "docs/hygiene-history/divergences/linkdir/114800Z-symlink-ancestor.md";
            mkdirSync(insideRoot, { recursive: true });
            mkdirSync(outsideDir, { recursive: true });
            writeFileSync(outside, PENDING_SHARD);
            symlinkSync(outsideDir, linkDir, "dir");
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/symbolic link/);
            expect(readFileSync(outside, "utf8")).toBe(PENDING_SHARD);
        });
    });
    test("rejects a symlinked divergence root before write-back", () => {
        withTempRoot((root) => {
            const historyDir = join(root, "docs/hygiene-history");
            const outsideDir = join(root, "outside-divergences");
            const outside = join(outsideDir, "114800Z-root-symlink.md");
            const relPath = "docs/hygiene-history/divergences/114800Z-root-symlink.md";
            mkdirSync(historyDir, { recursive: true });
            mkdirSync(outsideDir, { recursive: true });
            writeFileSync(outside, PENDING_SHARD);
            symlinkSync(outsideDir, join(historyDir, "divergences"), "dir");
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/divergence root/);
            expect(readFileSync(outside, "utf8")).toBe(PENDING_SHARD);
        });
    });
    test("rejects a symlinked ancestor ABOVE the divergence root before write-back", () => {
        // lstat follows intermediate path components, so symlinking an ancestor of
        // the root (here docs/hygiene-history -> outside) redirects write-back
        // outside the tree even though the final `divergences` component is real
        // in the symlink target. The full repo-root-through-root walk must reject it.
        withTempRoot((root) => {
            const outsideHistory = join(root, "outside-history");
            const outside = join(outsideHistory, "divergences", "114800Z-ancestor-root-symlink.md");
            const relPath = "docs/hygiene-history/divergences/114800Z-ancestor-root-symlink.md";
            mkdirSync(join(outsideHistory, "divergences"), { recursive: true });
            mkdirSync(join(root, "docs"), { recursive: true });
            writeFileSync(outside, PENDING_SHARD);
            symlinkSync(outsideHistory, join(root, "docs", "hygiene-history"), "dir");
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/symbolic link/);
            expect(readFileSync(outside, "utf8")).toBe(PENDING_SHARD);
        });
    });
    test("rejects non-file paths before write-back", () => {
        withTempRoot((root) => {
            const relPath = "docs/hygiene-history/divergences/2026/05/10";
            mkdirSync(join(root, relPath), { recursive: true });
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-a")).toThrow(/not a regular file/);
        });
    });
    test("re-run on an already-reconciled shard fails closed (prior decision not erased)", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            reconcileDivergenceShard(root, relPath, "accept-loop-a", "first decision");
            const afterFirst = readFileSync(join(root, relPath), "utf8");
            // A second reconcile must throw (via fillReconciliation's already-reconciled guard)...
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-b")).toThrow(/already reconciled/);
            // ...and leave the first decision intact.
            expect(readFileSync(join(root, relPath), "utf8")).toBe(afterFirst);
            expect(afterFirst).toContain("first decision");
        });
    });
    test("rejects an invalid decision before any write (runtime callers pass raw strings)", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            const before = readFileSync(join(root, relPath), "utf8");
            expect(() => reconcileDivergenceShard(root, relPath, "accept-loop-c")).toThrow(/invalid reconciliation decision/);
            // Still pending; file unchanged (validation precedes the write).
            expect(readFileSync(join(root, relPath), "utf8")).toBe(before);
            expect(scanDivergenceDir(root)).toHaveLength(1);
        });
    });
});
describe("main CLI write-back action", () => {
    function writer(target) {
        return {
            write: (chunk) => {
                target.push(String(chunk));
                return true;
            },
        };
    }
    test("prints a stable machine-readable pending-shard list with --json", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            const out = [];
            const err = [];
            const exit = main(["--json"], {
                repoRoot: () => root,
                stdout: writer(out),
                stderr: writer(err),
            });
            expect(exit).toBe(0);
            expect(err).toEqual([]);
            const payload = JSON.parse(out.join(""));
            expect(payload.schemaVersion).toBe(1);
            expect(payload.pending).toHaveLength(1);
            expect(payload.pending[0]).toMatchObject({
                relPath,
                tick: "2026-05-10T11:48:00Z",
                loopAAgent: "otto",
                loopBAgent: "codex-loop",
            });
        });
    });
    test("lands a reconciliation decision through the repo-native CLI action", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            const out = [];
            const err = [];
            const exit = main(["--reconcile", relPath, "--decision", "accept-loop-b", "--note", "B reproduces locally. (human maintainer)"], {
                repoRoot: () => root,
                stdout: writer(out),
                stderr: writer(err),
            });
            expect(exit).toBe(0);
            expect(err).toEqual([]);
            expect(out.join("")).toBe(`Reconciled ${relPath} with accept-loop-b.\n`);
            expect(scanDivergenceDir(root)).toHaveLength(0);
            expect(reconciliationBody(readFileSync(join(root, relPath), "utf8")).trim()).toBe("accept-loop-b\n\nB reproduces locally. (human maintainer)");
        });
    });
    test("returns usage error before writing when argv is incomplete", () => {
        withTempRoot((root) => {
            const { relPath } = writeDivergenceShard(root, inputAt("2026-05-10T11:48:00Z", "A", "B"));
            const before = readFileSync(join(root, relPath), "utf8");
            const out = [];
            const err = [];
            const exit = main(["--reconcile", relPath], {
                repoRoot: () => root,
                stdout: writer(out),
                stderr: writer(err),
            });
            expect(exit).toBe(2);
            expect(out).toEqual([]);
            expect(err.join("")).toContain("--decision is required with --reconcile");
            expect(readFileSync(join(root, relPath), "utf8")).toBe(before);
        });
    });
    test("prints a stable message when a non-Error value is thrown", () => {
        const out = [];
        const err = [];
        const exit = main(["--list"], {
            repoRoot: () => {
                throw "non-error failure";
            },
            stdout: writer(out),
            stderr: writer(err),
        });
        expect(exit).toBe(1);
        expect(out).toEqual([]);
        expect(err.join("")).toBe("error: non-error failure\n");
    });
});
