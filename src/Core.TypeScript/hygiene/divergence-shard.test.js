import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RECONCILIATION_DECISIONS, detectReviewThreadDisagreement, buildDivergenceShard, divergenceShardRelPath, fileReviewThreadDisagreement, parseReconciliationStatus, shortContentHash, writeDivergenceShard, writeShardAtPath, } from "./divergence-shard";
const TICK = "2026-05-10T11:48:00Z";
const INPUT = {
    tick: TICK,
    loopA: {
        identity: { agent: "otto", model: "claude-opus-4-8", harness: "claude-code" },
        body: "Resolve thread: the finding is a false positive (table double-pipe class).",
    },
    loopB: {
        identity: { agent: "codex-loop", model: "gpt-5.5", harness: "codex" },
        body: "Do not resolve: the finding reproduces under local lint; needs a fix.",
    },
    topic: 'PR #4147 thread PRRT_kwExample — "double-pipe" lint finding',
    disagreementSummary: "Both loops reviewed the same thread; Loop A reads it as a known false-positive class, Loop B reproduces it locally. The observable delta is resolve-vs-fix.",
    operativeAuthorization: 'aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing"',
};
function withTempRoot(fn) {
    const root = mkdtempSync(join(tmpdir(), "diverge-test-"));
    try {
        return fn(root);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
describe("shortContentHash", () => {
    test("is 8 lowercase hex chars", () => {
        expect(shortContentHash("a", "b")).toMatch(/^[0-9a-f]{8}$/);
    });
    test("is deterministic for identical inputs", () => {
        expect(shortContentHash("alpha", "beta")).toBe(shortContentHash("alpha", "beta"));
    });
    test("differs when bodies differ", () => {
        expect(shortContentHash("alpha", "beta")).not.toBe(shortContentHash("alpha", "gamma"));
    });
    test("swapping loop-A/loop-B bodies changes the hash", () => {
        // README spec hashes the bare concatenation (no delimiter): "ab"+"c" vs
        // "c"+"ab" → "abc" vs "cab", which differ. (Bodies that concatenate to the
        // same string — e.g. "x"+"yy" vs "xy"+"y" — do collide; that is the
        // schema's defined behaviour, faithfully reproduced here.)
        expect(shortContentHash("ab", "c")).not.toBe(shortContentHash("c", "ab"));
    });
});
describe("divergenceShardRelPath", () => {
    test("produces the canonical YYYY/MM/DD/HHMMSSZ-<hash>.md shape", () => {
        const p = divergenceShardRelPath(TICK, "a", "b");
        expect(p).toBe(`docs/hygiene-history/divergences/2026/05/10/114800Z-${shortContentHash("a", "b")}.md`);
    });
    test("rejects a tick that is not ISO 8601 UTC seconds precision", () => {
        expect(() => divergenceShardRelPath("2026-05-10T11:48Z", "a", "b")).toThrow(/invalid tick/);
        expect(() => divergenceShardRelPath("not-a-date", "a", "b")).toThrow(/invalid tick/);
    });
});
describe("buildDivergenceShard", () => {
    const md = buildDivergenceShard(INPUT);
    test("has type: divergence frontmatter and both loop identities", () => {
        expect(md).toContain("type: divergence");
        expect(md).toContain("agent: otto");
        expect(md).toContain('model: "claude-opus-4-8"');
        expect(md).toContain("harness: claude-code");
        expect(md).toContain("agent: codex-loop");
        expect(md).toContain('model: "gpt-5.5"');
    });
    test("quotes the tick and topic as YAML strings", () => {
        expect(md).toContain(`tick: "${TICK}"`);
        expect(md).toContain("topic: ");
        // topic contains embedded double-quotes; JSON/YAML escaping must apply
        expect(md).toContain('\\"double-pipe\\"');
    });
    test("carries all four required body sections in order", () => {
        const idxA = md.indexOf("## Loop A perspective");
        const idxB = md.indexOf("## Loop B perspective");
        const idxSummary = md.indexOf("## Disagreement summary");
        const idxRecon = md.indexOf("## Reconciliation");
        expect(idxA).toBeGreaterThanOrEqual(0);
        expect(idxA).toBeLessThan(idxB);
        expect(idxB).toBeLessThan(idxSummary);
        expect(idxSummary).toBeLessThan(idxRecon);
    });
    test("attributes each perspective with agent (model, harness)", () => {
        expect(md).toContain("otto (claude-opus-4-8, claude-code): Resolve thread:");
        expect(md).toContain("codex-loop (gpt-5.5, codex): Do not resolve:");
    });
    test("leaves Reconciliation as a maintainer-fills-in placeholder", () => {
        expect(md).toContain("Leave blank until morning reconciliation");
        expect(md).toContain("accept-loop-a | accept-loop-b | accept-both (explicit divergence) | escalate");
    });
    test("is standalone-readable (no external context: PR/topic + delta present)", () => {
        // AC #3: shard readable as a standalone reconciliation document. The topic
        // is YAML/JSON-escaped in frontmatter, so assert its distinctive substring
        // rather than byte-equality through the escaping layer.
        expect(md).toContain("PR #4147 thread PRRT_kwExample");
        expect(md).toContain("double-pipe");
        expect(md).toContain(INPUT.disagreementSummary);
    });
    test("rejects a malformed tick", () => {
        expect(() => buildDivergenceShard({ ...INPUT, tick: "2026/05/10" })).toThrow(/invalid tick/);
    });
});
describe("detectReviewThreadDisagreement", () => {
    test("returns a divergence input for differing conclusions on the same thread", () => {
        const result = detectReviewThreadDisagreement({
            tick: TICK,
            operativeAuthorization: INPUT.operativeAuthorization,
            loopA: {
                identity: INPUT.loopA.identity,
                prNumber: 4147,
                threadId: "PRRT_kwExample",
                conclusion: "resolve",
                body: "The finding matches the known false-positive table class.",
            },
            loopB: {
                identity: INPUT.loopB.identity,
                prNumber: 4147,
                threadId: "PRRT_kwExample",
                conclusion: "needs-fix",
                body: "The lint finding reproduces locally and should stay open.",
            },
        });
        expect(result.kind).toBe("disagreement");
        if (result.kind !== "disagreement") {
            throw new Error("expected disagreement result");
        }
        expect(result.divergenceInput.topic).toBe("PR #4147 thread PRRT_kwExample");
        expect(result.divergenceInput.disagreementSummary).toContain("otto concluded resolve");
        expect(result.divergenceInput.disagreementSummary).toContain("codex-loop concluded needs-fix");
        expect(result.divergenceInput.loopA.body).toContain("Conclusion: resolve");
        expect(result.divergenceInput.loopB.body).toContain("Conclusion: needs-fix");
    });
    test("does not file a divergence for the same normalized conclusion", () => {
        const result = detectReviewThreadDisagreement({
            tick: TICK,
            operativeAuthorization: INPUT.operativeAuthorization,
            loopA: {
                identity: INPUT.loopA.identity,
                prNumber: 4147,
                threadId: "PRRT_kwExample",
                conclusion: " Resolve ",
                body: "False positive.",
            },
            loopB: {
                identity: INPUT.loopB.identity,
                prNumber: 4147,
                threadId: "PRRT_kwExample",
                conclusion: "resolve",
                body: "Also false positive.",
            },
        });
        expect(result).toEqual({
            kind: "no-disagreement",
            reason: "same-conclusion",
        });
    });
    test("does not compare conclusions from different PR review threads", () => {
        const result = detectReviewThreadDisagreement({
            tick: TICK,
            operativeAuthorization: INPUT.operativeAuthorization,
            loopA: {
                identity: INPUT.loopA.identity,
                prNumber: 4147,
                threadId: "thread-a",
                conclusion: "resolve",
                body: "False positive.",
            },
            loopB: {
                identity: INPUT.loopB.identity,
                prNumber: 4148,
                threadId: "thread-a",
                conclusion: "needs-fix",
                body: "Different PR, so this is not the same review thread.",
            },
        });
        expect(result).toEqual({
            kind: "no-disagreement",
            reason: "different-thread",
        });
    });
    test("rejects blank thread ids, conclusions, and bodies", () => {
        const base = {
            tick: TICK,
            operativeAuthorization: INPUT.operativeAuthorization,
            loopA: {
                identity: INPUT.loopA.identity,
                prNumber: 4147,
                threadId: "thread-a",
                conclusion: "resolve",
                body: "False positive.",
            },
            loopB: {
                identity: INPUT.loopB.identity,
                prNumber: 4147,
                threadId: "thread-a",
                conclusion: "needs-fix",
                body: "Reproduces locally.",
            },
        };
        expect(() => detectReviewThreadDisagreement({
            ...base,
            loopA: { ...base.loopA, threadId: " " },
        })).toThrow(/loopA.threadId/);
        expect(() => detectReviewThreadDisagreement({
            ...base,
            loopA: { ...base.loopA, conclusion: " " },
        })).toThrow(/loopA\.conclusion/);
        expect(() => detectReviewThreadDisagreement({
            ...base,
            loopA: { ...base.loopA, body: " " },
        })).toThrow(/loopA\.body/);
    });
    test("rejects blank conclusion/body even on no-disagreement paths (Copilot #6068)", () => {
        // base is same-thread + same-conclusion (the no-disagreement: same-conclusion
        // branch). Previously a blank body here was silently accepted as clean
        // because body was only validated on the disagreement path.
        const sameConclusion = {
            tick: TICK,
            operativeAuthorization: INPUT.operativeAuthorization,
            loopA: {
                identity: INPUT.loopA.identity,
                prNumber: 4147,
                threadId: "thread-a",
                conclusion: "resolve",
                body: "False positive.",
            },
            loopB: {
                identity: INPUT.loopB.identity,
                prNumber: 4147,
                threadId: "thread-a",
                conclusion: "resolve",
                body: "Also false positive.",
            },
        };
        expect(() => detectReviewThreadDisagreement({
            ...sameConclusion,
            loopB: { ...sameConclusion.loopB, body: " " },
        })).toThrow(/loopB\.body/);
        // different-thread branch returns before the conclusion comparison, so a
        // blank conclusion/body must be rejected by the eager validation, not slip
        // through as a clean different-thread outcome.
        const differentThread = {
            ...sameConclusion,
            loopB: { ...sameConclusion.loopB, prNumber: 9999 },
        };
        expect(() => detectReviewThreadDisagreement({
            ...differentThread,
            loopA: { ...differentThread.loopA, conclusion: " " },
        })).toThrow(/loopA\.conclusion/);
        expect(() => detectReviewThreadDisagreement({
            ...differentThread,
            loopB: { ...differentThread.loopB, body: " " },
        })).toThrow(/loopB\.body/);
    });
});
describe("writeShardAtPath (fail-closed-OR-idempotent)", () => {
    test("writes when the path is free", () => {
        withTempRoot((root) => {
            const p = join(root, "a/b/c/shard.md");
            const r = writeShardAtPath(p, "hello");
            expect(r.status).toBe("written");
            expect(r.absPath).toBe(p);
            expect(readFileSync(p, "utf8")).toBe("hello");
        });
    });
    test("is an idempotent noop when identical content already exists", () => {
        withTempRoot((root) => {
            const p = join(root, "shard.md");
            mkdirSync(dirname(p), { recursive: true });
            writeFileSync(p, "same");
            const r = writeShardAtPath(p, "same");
            expect(r.status).toBe("idempotent-noop");
            expect(r.absPath).toBe(p);
        });
    });
    test("fail-closes to a unique suffix when differing content occupies the path", () => {
        withTempRoot((root) => {
            const p = join(root, "shard.md");
            mkdirSync(dirname(p), { recursive: true });
            writeFileSync(p, "ORIGINAL — must not be overwritten");
            const r = writeShardAtPath(p, "DIFFERENT content");
            expect(r.status).toBe("collision-resolved");
            expect(r.absPath).toBe(join(root, "shard-2.md"));
            // original is preserved (divergence evidence not erased)
            expect(readFileSync(p, "utf8")).toBe("ORIGINAL — must not be overwritten");
            expect(readFileSync(r.absPath, "utf8")).toBe("DIFFERENT content");
        });
    });
    test("collision resolution is itself idempotent on a re-run", () => {
        withTempRoot((root) => {
            const p = join(root, "shard.md");
            mkdirSync(dirname(p), { recursive: true });
            writeFileSync(p, "ORIGINAL");
            const first = writeShardAtPath(p, "SECOND");
            const second = writeShardAtPath(p, "SECOND");
            expect(first.absPath).toBe(join(root, "shard-2.md"));
            expect(second.status).toBe("idempotent-noop");
            expect(second.absPath).toBe(join(root, "shard-2.md"));
        });
    });
});
describe("writeDivergenceShard", () => {
    test("writes to the canonical content-addressed path under repoRoot", () => {
        withTempRoot((root) => {
            const r = writeDivergenceShard(root, INPUT);
            expect(r.status).toBe("written");
            expect(r.relPath).toBe(divergenceShardRelPath(TICK, INPUT.loopA.body, INPUT.loopB.body));
            expect(existsSync(join(root, r.relPath))).toBe(true);
        });
    });
    test("identical re-run is an idempotent noop (content-addressing)", () => {
        withTempRoot((root) => {
            writeDivergenceShard(root, INPUT);
            const again = writeDivergenceShard(root, INPUT);
            expect(again.status).toBe("idempotent-noop");
        });
    });
    test("refuses to file when loop bodies are byte-identical (no divergence)", () => {
        const sameBody = "identical conclusion";
        expect(() => writeDivergenceShard("/tmp/unused", {
            ...INPUT,
            loopA: { ...INPUT.loopA, body: sameBody },
            loopB: { ...INPUT.loopB, body: sameBody },
        })).toThrow(/no divergence to preserve/);
    });
});
describe("fileReviewThreadDisagreement (detect → file glue, AC #2)", () => {
    const DIVERGENCE_DIR = "docs/hygiene-history/divergences";
    const DETECT_INPUT = {
        tick: TICK,
        operativeAuthorization: INPUT.operativeAuthorization,
        loopA: {
            identity: INPUT.loopA.identity,
            prNumber: 4147,
            threadId: "PRRT_kwExample",
            conclusion: "resolve",
            body: "The finding matches the known false-positive table class.",
        },
        loopB: {
            identity: INPUT.loopB.identity,
            prNumber: 4147,
            threadId: "PRRT_kwExample",
            conclusion: "needs-fix",
            body: "The lint finding reproduces locally and should stay open.",
        },
    };
    test("files a shard when conclusions differ on the same thread", () => {
        withTempRoot((root) => {
            const outcome = fileReviewThreadDisagreement(root, DETECT_INPUT);
            expect(outcome.kind).toBe("filed");
            if (outcome.kind !== "filed")
                throw new Error("expected filed outcome");
            expect(outcome.write.status).toBe("written");
            // The shard exists at the content-addressed path and carries both conclusions.
            const abs = join(root, outcome.write.relPath);
            expect(existsSync(abs)).toBe(true);
            const md = readFileSync(abs, "utf8");
            expect(md).toContain("Conclusion: resolve");
            expect(md).toContain("Conclusion: needs-fix");
            expect(outcome.divergenceInput.topic).toBe("PR #4147 thread PRRT_kwExample");
        });
    });
    test("writes no shard when conclusions agree (same-conclusion)", () => {
        withTempRoot((root) => {
            const outcome = fileReviewThreadDisagreement(root, {
                ...DETECT_INPUT,
                loopB: { ...DETECT_INPUT.loopB, conclusion: " Resolve " },
            });
            expect(outcome).toEqual({ kind: "no-disagreement", reason: "same-conclusion" });
            expect(existsSync(join(root, DIVERGENCE_DIR))).toBe(false);
        });
    });
    test("writes no shard when the observations are on different threads", () => {
        withTempRoot((root) => {
            const outcome = fileReviewThreadDisagreement(root, {
                ...DETECT_INPUT,
                loopB: { ...DETECT_INPUT.loopB, prNumber: 4148 },
            });
            expect(outcome).toEqual({ kind: "no-disagreement", reason: "different-thread" });
            expect(existsSync(join(root, DIVERGENCE_DIR))).toBe(false);
        });
    });
    test("re-running the same disagreement is an idempotent-noop filing", () => {
        withTempRoot((root) => {
            const first = fileReviewThreadDisagreement(root, DETECT_INPUT);
            const again = fileReviewThreadDisagreement(root, DETECT_INPUT);
            expect(first.kind).toBe("filed");
            expect(again.kind).toBe("filed");
            if (again.kind !== "filed")
                throw new Error("expected filed outcome");
            expect(again.write.status).toBe("idempotent-noop");
            if (first.kind === "filed") {
                expect(again.write.relPath).toBe(first.write.relPath);
            }
        });
    });
    test("validation throws before any I/O (no divergence dir created)", () => {
        withTempRoot((root) => {
            expect(() => fileReviewThreadDisagreement(root, {
                ...DETECT_INPUT,
                loopA: { ...DETECT_INPUT.loopA, threadId: " " },
            })).toThrow(/loopA\.threadId/);
            // A blank body on a same-conclusion pair must throw before any I/O too,
            // not be silently treated as a clean no-disagreement outcome (#6068).
            expect(() => fileReviewThreadDisagreement(root, {
                ...DETECT_INPUT,
                loopB: { ...DETECT_INPUT.loopB, conclusion: DETECT_INPUT.loopA.conclusion, body: " " },
            })).toThrow(/loopB\.body/);
            expect(existsSync(join(root, DIVERGENCE_DIR))).toBe(false);
        });
    });
    describe("parseReconciliationStatus (read half, AC #4)", () => {
        /** Replace a built shard's Reconciliation section body with `body`. */
        function withReconciliation(shard, body) {
            const idx = shard.indexOf("## Reconciliation");
            if (idx < 0)
                throw new Error("test fixture: built shard had no Reconciliation header");
            return `${shard.slice(0, idx)}## Reconciliation\n\n${body}\n`;
        }
        test("a freshly-built shard reads as unreconciled (round-trip with builder)", () => {
            // The builder writes a placeholder whose HTML comments LIST the four
            // decision keywords. Reading unreconciled here proves comment-stripping
            // happens before the empty-check + keyword scan.
            expect(parseReconciliationStatus(buildDivergenceShard(INPUT))).toEqual({ kind: "unreconciled" });
        });
        test("whitespace-only Reconciliation (no comments) reads as unreconciled", () => {
            expect(parseReconciliationStatus(withReconciliation(buildDivergenceShard(INPUT), "   \n\t"))).toEqual({
                kind: "unreconciled",
            });
        });
        for (const decision of RECONCILIATION_DECISIONS) {
            test(`reads a filled decision: ${decision}`, () => {
                const md = withReconciliation(buildDivergenceShard(INPUT), `${decision} — maintainer chose this.`);
                const status = parseReconciliationStatus(md);
                expect(status.kind).toBe("reconciled");
                if (status.kind !== "reconciled")
                    throw new Error("expected reconciled");
                expect(status.decision).toBe(decision);
                expect(status.note).toContain("maintainer chose this");
            });
        }
        test("matches decision keywords case-insensitively, preserving note case", () => {
            const md = withReconciliation(buildDivergenceShard(INPUT), "Accept-Loop-B: Loop B reproduces it locally.");
            const status = parseReconciliationStatus(md);
            expect(status.kind).toBe("reconciled");
            if (status.kind !== "reconciled")
                throw new Error("expected reconciled");
            expect(status.decision).toBe("accept-loop-b");
            // note preserves original casing
            expect(status.note).toContain("Accept-Loop-B");
        });
        test("earliest-occurring keyword wins, not README list order", () => {
            // "escalate" is LAST in RECONCILIATION_DECISIONS but appears FIRST in the
            // prose; earliest-by-index must win over list order.
            const md = withReconciliation(buildDivergenceShard(INPUT), "escalate for now; we considered accept-both but want more evidence.");
            const status = parseReconciliationStatus(md);
            expect(status.kind).toBe("reconciled");
            if (status.kind !== "reconciled")
                throw new Error("expected reconciled");
            expect(status.decision).toBe("escalate");
        });
        test("filled prose with no recognized keyword reads as reconciled-freeform", () => {
            const md = withReconciliation(buildDivergenceShard(INPUT), "Talked it over; Loop A is right here.");
            const status = parseReconciliationStatus(md);
            expect(status.kind).toBe("reconciled-freeform");
            if (status.kind !== "reconciled-freeform")
                throw new Error("expected reconciled-freeform");
            expect(status.note).toBe("Talked it over; Loop A is right here.");
        });
        test("throws on a shard missing the Reconciliation section", () => {
            expect(() => parseReconciliationStatus("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx")).toThrow(/missing "## Reconciliation" section/);
        });
        test("terminates the section at a following heading (does not bleed into later content)", () => {
            const md = `${withReconciliation(buildDivergenceShard(INPUT), "accept-loop-a — done.")}\n## Notes\n\nescalate appears here but must be ignored.`;
            const status = parseReconciliationStatus(md);
            expect(status.kind).toBe("reconciled");
            if (status.kind !== "reconciled")
                throw new Error("expected reconciled");
            // "escalate" lives in the later ## Notes section, so it must NOT win.
            expect(status.decision).toBe("accept-loop-a");
            expect(status.note).not.toContain("ignored");
        });
    });
});
