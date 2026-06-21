/**
 * src/Core.TypeScript/workflow-engine/grammar.test.ts
 *
 * B-0867.3 minimal parser/composer coverage.
 */
import { describe, expect, it } from "bun:test";
import { composeActionGrammarLine, parseActionGrammarLine } from "./grammar";
import { SEED_ACTION_CATALOG } from "./types";
describe("B-0867.3 action grammar parser/composer", () => {
    it("round-trips every seed action through the v0 line grammar", () => {
        for (const action of SEED_ACTION_CATALOG) {
            const composed = composeActionGrammarLine(action);
            expect(composed.ok).toBe(true);
            if (!composed.ok)
                continue;
            const parsed = parseActionGrammarLine(composed.line);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.action).toEqual(action);
            }
        }
    });
    it("parses a grammar-extension action with explicit review gate", () => {
        const parsed = parseActionGrammarLine("propose-rank | grammar-extension | pr-gated | propose-rank-action | add ranking action | B-0867.3,B-0914 | GrammarExtensionProposed");
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.action.class).toBe("grammar-extension");
            expect(parsed.action.gate).toBe("pr-gated");
            expect(parsed.action.composesWith).toEqual(["B-0867.3", "B-0914"]);
            expect(parsed.action.feedbackVariants).toEqual(["GrammarExtensionProposed"]);
        }
    });
    it("rejects unknown classes and gates as grammar errors", () => {
        expect(parseActionGrammarLine("x | unknown-class | append-only | x | x | B-0867.3 | X")).toEqual({
            ok: false,
            error: "unknown action class: unknown-class",
        });
        expect(parseActionGrammarLine("x | transition | unknown-gate | x | x | B-0867.3 | X")).toEqual({
            ok: false,
            error: "unknown action gate: unknown-gate",
        });
    });
    it("rejects malformed field counts and missing feedback variants", () => {
        expect(parseActionGrammarLine("too | short").ok).toBe(false);
        expect(parseActionGrammarLine("x | transition | append-only | x | x | B-0867.3 | ")).toEqual({
            ok: false,
            error: "feedbackVariants requires at least one item",
        });
    });
    it("rejects empty CSV items instead of silently normalizing ambiguity", () => {
        expect(parseActionGrammarLine("x | transition | append-only | x | x | B-0867.3,,B-0914 | X")).toEqual({
            ok: false,
            error: "composesWith contains an empty item",
        });
        expect(parseActionGrammarLine("x | transition | append-only | x | x | B-0867.3 | X,")).toEqual({
            ok: false,
            error: "feedbackVariants contains an empty item",
        });
    });
    it("composer rejects unsupported delimiters before producing an ambiguous line", () => {
        const invalid = {
            ...SEED_ACTION_CATALOG[0],
            label: "bad | label",
        };
        expect(composeActionGrammarLine(invalid)).toEqual({
            ok: false,
            error: "action field contains an unsupported delimiter",
        });
    });
    it("composer rejects non-canonical whitespace before parse can normalize it", () => {
        const scalarWhitespace = {
            ...SEED_ACTION_CATALOG[0],
            label: " advance ",
        };
        expect(composeActionGrammarLine(scalarWhitespace)).toEqual({
            ok: false,
            error: "action field must be trimmed",
        });
        const listWhitespace = {
            ...SEED_ACTION_CATALOG[0],
            composesWith: ["B-0867.3", " B-0914"],
        };
        expect(composeActionGrammarLine(listWhitespace)).toEqual({
            ok: false,
            error: "composesWith item must be trimmed",
        });
    });
});
