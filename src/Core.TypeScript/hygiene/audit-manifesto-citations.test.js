#!/usr/bin/env bun
// Tests for audit-manifesto-citations.ts
import { describe, expect, test } from "bun:test";
import { computeDelta, parseArgs, renderDelta, renderReport, scanFile, signedNum, snapshotDate, snapshotPath, toSnapshot, } from "./audit-manifesto-citations.js";
describe("parseArgs", () => {
    test("defaults", () => {
        const r = parseArgs([]);
        expect(r.kind).toBe("args");
        if (r.kind === "args") {
            expect(r.args.report).toBe(null);
            expect(r.args.json).toBe(false);
            expect(r.args.snapshot).toBe(false);
            expect(r.args.delta).toBe(false);
            expect(r.args.date).toBe(null);
        }
    });
    test("--snapshot flag", () => {
        const r = parseArgs(["--snapshot"]);
        if (r.kind !== "args")
            throw new Error("expected args");
        expect(r.args.snapshot).toBe(true);
    });
    test("--delta flag", () => {
        const r = parseArgs(["--delta"]);
        if (r.kind !== "args")
            throw new Error("expected args");
        expect(r.args.delta).toBe(true);
    });
    test("--date YYYY-MM-DD", () => {
        const r = parseArgs(["--date", "2026-05-23"]);
        if (r.kind !== "args")
            throw new Error("expected args");
        expect(r.args.date).toBe("2026-05-23");
    });
    test("--date rejects non-YYYY-MM-DD", () => {
        const r = parseArgs(["--date", "May 23"]);
        expect(r.kind).toBe("error");
    });
    test("--date without value errors", () => {
        const r = parseArgs(["--date"]);
        expect(r.kind).toBe("error");
    });
    test("--snapshot + --delta are mutually exclusive (Copilot P1 PR #4750)", () => {
        const r = parseArgs(["--snapshot", "--delta"]);
        expect(r.kind).toBe("error");
        if (r.kind === "error")
            expect(r.message).toContain("mutually exclusive");
    });
    test("--report incompatible with --snapshot (Copilot P1 PR #4750)", () => {
        const r = parseArgs(["--snapshot", "--report", "out.md"]);
        expect(r.kind).toBe("error");
        if (r.kind === "error")
            expect(r.message).toContain("not compatible");
    });
    test("--report incompatible with --delta (Copilot P1 PR #4750)", () => {
        const r = parseArgs(["--delta", "--report", "out.md"]);
        expect(r.kind).toBe("error");
    });
    test("--report PATH", () => {
        const r = parseArgs(["--report", "out.md"]);
        if (r.kind !== "args")
            throw new Error("expected args");
        expect(r.args.report).toBe("out.md");
    });
    test("--json", () => {
        const r = parseArgs(["--json"]);
        if (r.kind !== "args")
            throw new Error("expected args");
        expect(r.args.json).toBe(true);
    });
    test("unknown argument errors", () => {
        const r = parseArgs(["--bogus"]);
        expect(r.kind).toBe("error");
    });
    test("--report without value errors", () => {
        const r = parseArgs(["--report"]);
        expect(r.kind).toBe("error");
    });
});
describe("scanFile", () => {
    test("path-form citation detected", () => {
        const cites = scanFile("test.md", "rules", "see `docs/governance/MANIFESTO.md` for details");
        expect(cites.length).toBeGreaterThanOrEqual(1);
        expect(cites.some((c) => c.form === "path")).toBe(true);
    });
    test("version-tag citation detected", () => {
        const cites = scanFile("test.md", "rules", "per Manifesto V2.1 constitutional substrate");
        expect(cites.length).toBeGreaterThanOrEqual(1);
        expect(cites.some((c) => c.form === "version-tag")).toBe(true);
    });
    test("constraint-N citation detected", () => {
        const cites = scanFile("test.md", "rules", "Constraint 8 already operates as a rule");
        expect(cites.length).toBeGreaterThanOrEqual(1);
        expect(cites.some((c) => c.form === "constraint-N")).toBe(true);
    });
    test("name citation detected", () => {
        const cites = scanFile("test.md", "rules", "the manifesto names this discipline");
        expect(cites.length).toBeGreaterThanOrEqual(1);
        expect(cites.some((c) => c.form === "name")).toBe(true);
    });
    test("overlapping path + name + version-tag — path wins for overlap", () => {
        const content = "see Manifesto V2 at `docs/governance/MANIFESTO.md` paragraph 3";
        const cites = scanFile("test.md", "rules", content);
        // Should detect both: path (MANIFESTO.md) + version-tag (Manifesto V2)
        const forms = cites.map((c) => c.form).sort();
        expect(forms).toContain("path");
        expect(forms).toContain("version-tag");
    });
    test("constraint-N matches 1 through 11", () => {
        for (const n of [1, 5, 8, 10, 11]) {
            const cites = scanFile("test.md", "rules", `Constraint ${n} applies`);
            expect(cites.length).toBeGreaterThanOrEqual(1);
            expect(cites[0].form).toBe("constraint-N");
        }
    });
    test("constraint-N does NOT match 12+ (manifesto has 11)", () => {
        const cites = scanFile("test.md", "rules", "Constraint 12 does not exist");
        expect(cites.filter((c) => c.form === "constraint-N")).toHaveLength(0);
    });
    test("snippet captures context", () => {
        const cites = scanFile("test.md", "rules", "intro text\nManifesto V1 substrate\ntrailing\n");
        expect(cites[0].snippet).toContain("Manifesto V1");
    });
    test("no citations in irrelevant content", () => {
        const cites = scanFile("test.md", "rules", "just some unrelated prose about cats");
        expect(cites).toHaveLength(0);
    });
});
describe("renderReport", () => {
    test("renders zero-state report", () => {
        const r = renderReport({
            surfaces: [],
            totalCitations: 0,
            totalFilesWithCitation: 0,
            totalFilesScanned: 0,
            citations: [],
        }, new Date("2026-05-23T00:00:00Z"));
        expect(r).toContain("# Manifesto citation audit");
        expect(r).toContain("Generated: 2026-05-23T00:00:00.000Z");
        expect(r).toContain("Files scanned: 0");
        expect(r).toContain("Substrate-honest framing");
    });
    test("renders per-surface breakdown", () => {
        const r = renderReport({
            surfaces: [
                {
                    surface: "rules",
                    filesScanned: 50,
                    filesWithCitation: 3,
                    citationCount: 7,
                    byForm: { path: 2, name: 3, "version-tag": 1, "constraint-N": 1 },
                },
            ],
            totalCitations: 7,
            totalFilesWithCitation: 3,
            totalFilesScanned: 50,
            citations: [],
        }, new Date("2026-05-23T00:00:00Z"));
        expect(r).toContain("| `rules` | 50 | 3 | 7 | 2 | 3 | 1 | 1 |");
    });
});
describe("signedNum", () => {
    test("positive shows +", () => {
        expect(signedNum(5)).toBe("+5");
    });
    test("zero shows 0 (no sign)", () => {
        expect(signedNum(0)).toBe("0");
    });
    test("negative shows -", () => {
        expect(signedNum(-3)).toBe("-3");
    });
});
describe("snapshotDate / snapshotPath", () => {
    test("snapshotDate strips time component", () => {
        expect(snapshotDate(new Date("2026-05-23T18:42:01.123Z"))).toBe("2026-05-23");
    });
    test("snapshotPath joins dir + date.json", () => {
        const p = snapshotPath("2026-05-23");
        expect(p).toContain("manifesto-citations");
        expect(p).toContain("2026-05-23.json");
    });
});
describe("toSnapshot", () => {
    test("strips citations[] (keeps only summary)", () => {
        const snap = toSnapshot({
            surfaces: [
                {
                    surface: "rules",
                    filesScanned: 10,
                    filesWithCitation: 2,
                    citationCount: 5,
                    byForm: { path: 2, name: 1, "version-tag": 1, "constraint-N": 1 },
                },
            ],
            totalCitations: 5,
            totalFilesWithCitation: 2,
            totalFilesScanned: 10,
            citations: [
                { file: "x.md", surface: "rules", form: "path", snippet: "snip" },
            ],
        }, "2026-05-23");
        expect(snap.date).toBe("2026-05-23");
        expect(snap.totalCitations).toBe(5);
        expect(snap.surfaces).toHaveLength(1);
        // Snapshot should NOT carry the heavy citations[] array
        expect(snap.citations).toBeUndefined();
    });
});
describe("computeDelta", () => {
    const baseSurface = (overrides) => ({
        surface: "rules",
        filesScanned: 10,
        filesWithCitation: overrides.files ?? 1,
        citationCount: overrides.cites ?? 1,
        byForm: {
            path: overrides.path ?? 0,
            name: overrides.name ?? 0,
            "version-tag": overrides["version-tag"] ?? 0,
            "constraint-N": overrides["constraint-N"] ?? 0,
        },
    });
    test("computes positive deltas", () => {
        const prior = {
            date: "2026-05-22",
            totalCitations: 100,
            totalFilesWithCitation: 20,
            totalFilesScanned: 1000,
            surfaces: [baseSurface({ files: 2, cites: 5, path: 2, name: 3 })],
        };
        const current = {
            date: "2026-05-23",
            totalCitations: 150,
            totalFilesWithCitation: 30,
            totalFilesScanned: 1000,
            surfaces: [baseSurface({ files: 5, cites: 12, path: 5, name: 7 })],
        };
        const d = computeDelta(prior, current);
        expect(d.totalCitationsDelta).toBe(50);
        expect(d.totalFilesWithCitationDelta).toBe(10);
        expect(d.surfaceDeltas[0].filesWithCitationDelta).toBe(3);
        expect(d.surfaceDeltas[0].citationCountDelta).toBe(7);
        expect(d.surfaceDeltas[0].byFormDelta.path).toBe(3);
        expect(d.surfaceDeltas[0].byFormDelta.name).toBe(4);
    });
    test("missing-in-CURRENT surface shows as negative delta (Copilot P1 PR #4750)", () => {
        const prior = {
            date: "2026-05-22",
            totalCitations: 10,
            totalFilesWithCitation: 2,
            totalFilesScanned: 50,
            surfaces: [
                baseSurface({ files: 1, cites: 5, path: 3 }),
                { ...baseSurface({ files: 1, cites: 5, path: 5 }), surface: "old-removed-surface" },
            ],
        };
        const current = {
            date: "2026-05-23",
            totalCitations: 5,
            totalFilesWithCitation: 1,
            totalFilesScanned: 50,
            surfaces: [baseSurface({ files: 1, cites: 5, path: 3 })],
        };
        const d = computeDelta(prior, current);
        // Removed surface must appear as negative delta, not be silently dropped
        const removed = d.surfaceDeltas.find((s) => s.surface === "old-removed-surface");
        expect(removed).toBeDefined();
        expect(removed.filesWithCitationDelta).toBe(-1);
        expect(removed.citationCountDelta).toBe(-5);
        expect(removed.byFormDelta.path).toBe(-5);
    });
    test("missing-in-prior surface treats as zero", () => {
        const prior = {
            date: "2026-05-22",
            totalCitations: 0,
            totalFilesWithCitation: 0,
            totalFilesScanned: 0,
            surfaces: [],
        };
        const current = {
            date: "2026-05-23",
            totalCitations: 5,
            totalFilesWithCitation: 1,
            totalFilesScanned: 10,
            surfaces: [baseSurface({ files: 1, cites: 5, path: 5 })],
        };
        const d = computeDelta(prior, current);
        expect(d.surfaceDeltas[0].filesWithCitationDelta).toBe(1);
        expect(d.surfaceDeltas[0].byFormDelta.path).toBe(5);
    });
});
describe("renderDelta", () => {
    test("renders delta with signed numbers", () => {
        const out = renderDelta({
            priorDate: "2026-05-22",
            currentDate: "2026-05-23",
            totalCitationsDelta: 15,
            totalFilesWithCitationDelta: 2,
            surfaceDeltas: [
                {
                    surface: "trajectories",
                    filesWithCitationDelta: 2,
                    citationCountDelta: 15,
                    byFormDelta: { path: 4, name: 4, "version-tag": 0, "constraint-N": 7 },
                },
                {
                    surface: "agents",
                    filesWithCitationDelta: 0,
                    citationCountDelta: 0,
                    byFormDelta: { path: 0, name: 0, "version-tag": 0, "constraint-N": 0 },
                },
            ],
        });
        expect(out).toContain("# Manifesto citation delta");
        expect(out).toContain("Prior: 2026-05-22");
        expect(out).toContain("Current: 2026-05-23");
        expect(out).toContain("Citations delta: +15");
        expect(out).toContain("`trajectories`");
        expect(out).toContain("+15");
        expect(out).toContain("`agents`");
    });
});
