import { describe, expect, test } from "bun:test";
import { extractBody } from "./append-tick-history-row";
import { detectRepeatedTokenRut } from "./detect-repeated-token-rut";
// The append path's rut guard is composed of two pure pieces:
//   extractBody(row)  →  detectRepeatedTokenRut(body)
// We test that composition here (the filesystem append in main() is exercised
// by the live tool; these cover the new guard logic deterministically).
const TS = "2026-06-14T00:00:00Z";
const MODEL = "claude-opus-4-8";
const CRON = "<<autonomous-loop>>";
function row(body, pr = "—", obs = "—") {
    return `| ${TS} | ${MODEL} | ${CRON} | ${body} | ${pr} | ${obs} |`;
}
describe("extractBody", () => {
    test("pulls the 4th pipe field, trimmed", () => {
        expect(extractBody(row("Green. Holding."))).toBe("Green. Holding.");
    });
    test("returns null when the row has too few fields", () => {
        // "| a | b |" → split("|") = ["", " a ", " b ", ""] → length 4 <= BODY_FIELD_INDEX.
        expect(extractBody("| a | b |")).toBeNull();
    });
    test("handles an empty body", () => {
        expect(extractBody(row(""))).toBe("");
    });
});
describe("rut guard composition (extractBody → detect)", () => {
    test("a healthy terse heartbeat body is NOT a rut", () => {
        const body = extractBody(row("Green. Holding."));
        expect(body).not.toBeNull();
        expect(detectRepeatedTokenRut(body).isRut).toBe(false);
    });
    test("a normal prose body is NOT a rut", () => {
        const body = extractBody(row("Merged #8213; gate green; branch in sync with origin main."));
        expect(detectRepeatedTokenRut(body).isRut).toBe(false);
    });
    test("the 'court'×N glitch body IS a rut", () => {
        const body = extractBody(row("court ".repeat(10).trim()));
        const v = detectRepeatedTokenRut(body);
        expect(v.isRut).toBe(true);
        expect(v.reasons).toContain("run");
    });
    test("a repeated-line-collapsed body IS a rut (whitespace mode catches the run)", () => {
        const body = extractBody(row("Holding. Holding. Holding. Holding. Holding. Holding."));
        expect(detectRepeatedTokenRut(body).isRut).toBe(true);
    });
});
