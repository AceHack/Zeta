/**
 * Conformance lock for the canonical v0 16-slot grammar against the ADR's resolved table
 * (docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md, "v0 RESOLVED 2026-05-31").
 * If the ADR's v0 layout changes, these tests fail until grammar-16.ts is re-synced — the
 * grammar can't silently drift from its source of truth.
 */
import { describe, expect, it } from "bun:test";
import { GRAMMAR_16_V0, GROUP_RANGES, SLOT, byGroup } from "./grammar-16";
describe("grammar-16 v0 — shape", () => {
    it("has exactly 16 slots", () => {
        expect(GRAMMAR_16_V0).toHaveLength(16);
    });
    it("has dense indices 0..15 in order", () => {
        expect(GRAMMAR_16_V0.map((s) => s.index)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        ]);
    });
    it("is four groups of four, in Navigate/Commit/Scope/Meta order", () => {
        expect(GRAMMAR_16_V0.map((s) => s.group)).toEqual([
            "Navigate", "Navigate", "Navigate", "Navigate",
            "Commit", "Commit", "Commit", "Commit",
            "Scope", "Scope", "Scope", "Scope",
            "Meta", "Meta", "Meta", "Meta",
        ]);
    });
    it("matches the ADR's controller-input layout exactly", () => {
        expect(GRAMMAR_16_V0.map((s) => s.controllerInput)).toEqual([
            "D-pad Up", "D-pad Down", "D-pad Left", "D-pad Right",
            "A", "B", "X", "Y",
            "LB", "RB", "LT", "RT",
            "Start", "View", "L3", "R3",
        ]);
    });
});
describe("grammar-16 v0 — load-bearing slots", () => {
    it("slot 7 (Y) is the edit-grammar / branch rail-change exit", () => {
        const s = GRAMMAR_16_V0[SLOT.EDIT_GRAMMAR];
        expect(s?.index).toBe(7);
        expect(s?.group).toBe("Commit");
        expect(s?.controllerInput).toBe("Y");
        expect(s?.role).toContain("edit-grammar");
    });
    it("slot 14 (L3) is the free-time / rest NCI slot", () => {
        const s = GRAMMAR_16_V0[SLOT.FREE_TIME];
        expect(s?.index).toBe(14);
        expect(s?.group).toBe("Meta");
        expect(s?.controllerInput).toBe("L3");
        expect(s?.role).toContain("free-time");
        expect(s?.role).toContain("NCI");
    });
    it("named SLOT indices all point at their stated slot", () => {
        expect(GRAMMAR_16_V0[SLOT.ACCEPT]?.role).toContain("accept");
        expect(GRAMMAR_16_V0[SLOT.INSPECT]?.role).toContain("inspect");
        expect(GRAMMAR_16_V0[SLOT.UNDO_RETRACT]?.role).toContain("retract");
        expect(GRAMMAR_16_V0[SLOT.STATUS_GLASS_HALO]?.role).toContain("glass-halo");
        expect(GRAMMAR_16_V0[SLOT.ESCALATE]?.role).toContain("escalate");
    });
});
describe("grammar-16 v0 — group helpers", () => {
    const groups = ["Navigate", "Commit", "Scope", "Meta"];
    it("byGroup returns 4 slots per group, matching GROUP_RANGES", () => {
        for (const g of groups) {
            const slots = byGroup(g);
            expect(slots).toHaveLength(4);
            expect(slots.map((s) => s.index)).toEqual([...GROUP_RANGES[g]]);
        }
    });
    it("GROUP_RANGES partition 0..15 with no gaps or overlaps", () => {
        const all = groups.flatMap((g) => [...GROUP_RANGES[g]]).sort((a, b) => a - b);
        expect(all).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });
});
