// audit-tick-shard-relative-paths.test.ts — tests for stripInlineCodeSpans.
//
// The inline-code-span stripper is the load-bearing logic for the audit's
// FP-class fix on tick shards that include markdown-link EXAMPLES inside
// double-backtick wrapped code spans (e.g. `` `[link](docs/foo.md)` ``
// in 2158Z.md). Without the stripper the audit treats the prose example
// as a real link and flags it as broken.
import { describe, expect, test } from "bun:test";
import { stripInlineCodeSpans } from "./audit-tick-shard-relative-paths.js";
describe("stripInlineCodeSpans", () => {
    test("strips single-backtick code spans", () => {
        expect(stripInlineCodeSpans("see `code` example")).toBe("see        example");
    });
    test("strips double-backtick code spans containing single backticks", () => {
        // The 2158Z.md FP-class anchor: double-backtick wrap is the standard
        // pattern for showing a single-backtick example in prose.
        const input = "Inline code spans (`` `[link](docs/foo.md)` ``)";
        const stripped = stripInlineCodeSpans(input);
        expect(stripped).not.toContain("[link](docs/foo.md)");
        expect(stripped).not.toContain("`");
    });
    test("preserves byte offsets via space replacement", () => {
        const input = "before `code` after";
        expect(stripInlineCodeSpans(input).length).toBe(input.length);
    });
    test("leaves text outside backticks intact", () => {
        expect(stripInlineCodeSpans("plain prose")).toBe("plain prose");
        expect(stripInlineCodeSpans("")).toBe("");
    });
    test("unbalanced backticks are emitted literally (don't swallow rest of line)", () => {
        // A single stray backtick must not consume to end-of-line; otherwise the
        // stripper would mask real links downstream of typos.
        const input = "stray ` and [link](docs/real.md)";
        expect(stripInlineCodeSpans(input)).toContain("[link](docs/real.md)");
    });
    test("multiple code spans on one line", () => {
        const input = "a `b` c `d` e";
        expect(stripInlineCodeSpans(input)).toBe("a     c     e");
    });
    test("triple-backtick run requires matching triple-backtick close (CommonMark)", () => {
        const input = "x ``` y `` z ``` w";
        // The opening ``` (run of 3) closes only at the matching ``` (run of 3),
        // so the inner `` (run of 2) is part of the code span.
        const out = stripInlineCodeSpans(input);
        // Preserves length; outer x/w preserved; backticks all stripped.
        expect(out.length).toBe(input.length);
        expect(out[0]).toBe("x");
        expect(out[out.length - 1]).toBe("w");
        expect(out).not.toContain("`");
    });
    test("backticks adjacent to text are stripped correctly", () => {
        expect(stripInlineCodeSpans("`code`text")).toBe("      text");
    });
});
