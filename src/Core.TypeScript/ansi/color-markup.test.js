/**
 * src/Core.TypeScript/ansi/color-markup.test.ts — text-carried color round-trip.
 *
 * The load-bearing property: markup → ANSI → markup is the IDENTITY for the three
 * color forms (named / 256-index / hex), so color survives the plain-text channel.
 */
import { describe, expect, test } from "bun:test";
import { renderToAnsi, parseFromAnsi, caretToEsc, stripAnsi } from "./color-markup";
const ESC = "\x1b";
describe("color-markup — render markup → ANSI", () => {
    test("hex foreground → truecolor SGR", () => {
        expect(renderToAnsi("{c:#ff5555}hi{/c}")).toBe(`${ESC}[0;38;2;255;85;85mhi${ESC}[0m`);
    });
    test("256-index foreground", () => {
        expect(renderToAnsi("{c:203}hi{/c}")).toBe(`${ESC}[0;38;5;203mhi${ESC}[0m`);
    });
    test("named foreground (basic SGR)", () => {
        expect(renderToAnsi("{c:red}hi{/c}")).toBe(`${ESC}[0;31mhi${ESC}[0m`);
    });
    test("background", () => {
        expect(renderToAnsi("{bg:blue}hi{/bg}")).toBe(`${ESC}[0;44mhi${ESC}[0m`);
    });
    test("plain text passes through untouched", () => {
        expect(renderToAnsi("just text")).toBe("just text");
    });
    test("unknown spec is left as literal markup (no fabricated color)", () => {
        expect(renderToAnsi("{c:notacolor}x{/c}")).toBe("{c:notacolor}x{/c}");
    });
    test("nested fg+bg both render and unwind", () => {
        // open bg(black=40), open fg(cyan=36)+bg, close fg → bg-only, close bg → reset
        expect(renderToAnsi("{bg:black}{c:cyan}x{/c}{/bg}")).toBe(`${ESC}[0;40m${ESC}[0;36;40mx${ESC}[0;40m${ESC}[0m`);
    });
});
describe("color-markup — parse ANSI → markup", () => {
    test("truecolor → hex markup", () => {
        expect(parseFromAnsi(`${ESC}[38;2;255;85;85mhi${ESC}[0m`)).toBe("{c:#ff5555}hi{/c}");
    });
    test("256-index → markup", () => {
        expect(parseFromAnsi(`${ESC}[38;5;203mhi${ESC}[0m`)).toBe("{c:203}hi{/c}");
    });
    test("basic 31 → named", () => {
        expect(parseFromAnsi(`${ESC}[31mhi${ESC}[0m`)).toBe("{c:red}hi{/c}");
    });
    test("cat -v caret notation is accepted", () => {
        expect(parseFromAnsi("^[[38;5;203mhi^[[0m")).toBe("{c:203}hi{/c}");
    });
    test("non-color SGR (bold) is dropped", () => {
        expect(parseFromAnsi(`${ESC}[1m${ESC}[32mok${ESC}[0m`)).toBe("{c:green}ok{/c}");
    });
    test("selective fg reset (39) closes just the fg span", () => {
        expect(parseFromAnsi(`${ESC}[31mhi${ESC}[39mthere${ESC}[0m`)).toBe("{c:red}hi{/c}there");
    });
    test("selective bg reset (49) closes just the bg span", () => {
        expect(parseFromAnsi(`${ESC}[41mhi${ESC}[49mthere${ESC}[0m`)).toBe("{bg:red}hi{/bg}there");
    });
    test("39 leaves bg open; 49 leaves fg open (independent resets)", () => {
        // fg+bg open, then 39 closes only fg → bg stays open until final reset
        expect(parseFromAnsi(`${ESC}[31m${ESC}[44mx${ESC}[39my${ESC}[0m`)).toBe("{c:red}{bg:blue}x{/c}y{/bg}");
    });
});
describe("color-markup — exact round-trip (markup → ANSI → markup = identity)", () => {
    test.each(["{c:#ff5555}hi{/c}", "{c:203}hi{/c}", "{c:red}hi{/c}", "plain {c:green}go{/c} plain {c:#00aaff}blue{/c}"])("round-trips %s", (markup) => {
        expect(parseFromAnsi(renderToAnsi(markup))).toBe(markup);
    });
});
describe("color-markup — utilities", () => {
    test("caretToEsc converts ^[ to real ESC", () => {
        expect(caretToEsc("^[[31m")).toBe(`${ESC}[31m`);
    });
    test("stripAnsi removes color (real + caret)", () => {
        expect(stripAnsi(`${ESC}[31mhi${ESC}[0m`)).toBe("hi");
        expect(stripAnsi("^[[38;5;46mhi^[[0m")).toBe("hi");
    });
});
