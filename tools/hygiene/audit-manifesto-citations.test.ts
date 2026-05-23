#!/usr/bin/env bun
// Tests for audit-manifesto-citations.ts

import { describe, expect, test } from "bun:test";
import { parseArgs, renderReport, scanFile } from "./audit-manifesto-citations.ts";

describe("parseArgs", () => {
    test("defaults", () => {
        const r = parseArgs([]);
        expect(r.kind).toBe("args");
        if (r.kind === "args") {
            expect(r.args.report).toBe(null);
            expect(r.args.json).toBe(false);
        }
    });

    test("--report PATH", () => {
        const r = parseArgs(["--report", "out.md"]);
        if (r.kind !== "args") throw new Error("expected args");
        expect(r.args.report).toBe("out.md");
    });

    test("--json", () => {
        const r = parseArgs(["--json"]);
        if (r.kind !== "args") throw new Error("expected args");
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
            expect(cites[0]!.form).toBe("constraint-N");
        }
    });

    test("constraint-N does NOT match 12+ (manifesto has 11)", () => {
        const cites = scanFile("test.md", "rules", "Constraint 12 does not exist");
        expect(cites.filter((c) => c.form === "constraint-N")).toHaveLength(0);
    });

    test("snippet captures context", () => {
        const cites = scanFile("test.md", "rules", "intro text\nManifesto V1 substrate\ntrailing\n");
        expect(cites[0]!.snippet).toContain("Manifesto V1");
    });

    test("no citations in irrelevant content", () => {
        const cites = scanFile("test.md", "rules", "just some unrelated prose about cats");
        expect(cites).toHaveLength(0);
    });
});

describe("renderReport", () => {
    test("renders zero-state report", () => {
        const r = renderReport(
            {
                surfaces: [],
                totalCitations: 0,
                totalFilesWithCitation: 0,
                totalFilesScanned: 0,
                citations: [],
            },
            new Date("2026-05-23T00:00:00Z"),
        );
        expect(r).toContain("# Manifesto citation audit");
        expect(r).toContain("Generated: 2026-05-23T00:00:00.000Z");
        expect(r).toContain("Files scanned: 0");
        expect(r).toContain("Substrate-honest framing");
    });

    test("renders per-surface breakdown", () => {
        const r = renderReport(
            {
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
            },
            new Date("2026-05-23T00:00:00Z"),
        );
        expect(r).toContain("| `rules` | 50 | 3 | 7 | 2 | 3 | 1 | 1 |");
    });
});
