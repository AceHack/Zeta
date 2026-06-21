import { test, expect } from "bun:test";
import { readEvents, tryReadEvents } from "./reader";
// The shared cross-language fixture is the authority. Drive one bun:test case per
// canonical vector so the unit suite and the cross-verify oracle share exactly the
// same expected event arrays (fixture-is-JSON, no YAML-in-YAML bootstrap hazard).
const fixturePath = new URL("../../../tests/cross-verification/yaml/vectors.json", import.meta.url);
const fixture = (await Bun.file(fixturePath).json());
for (const vector of fixture.vectors) {
    test(`reader vector: ${vector.id}`, () => {
        const events = readEvents(vector.yaml);
        expect(events).toEqual(vector.expected);
    });
}
// Decline-path cases: the typed YamlFeedback channel (Result over throw).
test("decline: tab in indentation -> TabIndentation", () => {
    const result = tryReadEvents("a:\n\tb: 1\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("TabIndentation");
});
test("decline: tab at start of first line indentation -> TabIndentation", () => {
    const result = tryReadEvents("\tx: 1\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("TabIndentation");
});
test("decline: unterminated double quote -> UnterminatedQuote", () => {
    const result = tryReadEvents('a: "unterminated\n');
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnterminatedQuote");
});
test("decline: unterminated single quote -> UnterminatedQuote", () => {
    const result = tryReadEvents("a: 'unterminated\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnterminatedQuote");
});
test("decline: anchor value -> UnsupportedConstruct", () => {
    const result = tryReadEvents("a: &anchor\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnsupportedConstruct");
});
test("decline: flow mapping value -> UnsupportedConstruct", () => {
    const result = tryReadEvents("a: { x: 1 }\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnsupportedConstruct");
});
test("decline: flow sequence value -> UnsupportedConstruct", () => {
    const result = tryReadEvents("a: [1, 2]\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnsupportedConstruct");
});
test("decline: block scalar literal value -> UnsupportedConstruct", () => {
    const result = tryReadEvents("a: |\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnsupportedConstruct");
});
test("decline: document separator --- -> UnsupportedConstruct", () => {
    const result = tryReadEvents("---\na: 1\n");
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnsupportedConstruct");
});
test("decline: unknown double-quote escape -> UnexpectedCharacter", () => {
    const result = tryReadEvents('a: "bad \\x escape"\n');
    expect(result.ok).toBe(false);
    if (!result.ok)
        expect(result.feedback).toBe("UnexpectedCharacter");
});
test("tryReadEvents ok path mirrors readEvents", () => {
    const result = tryReadEvents("name: zeta\n");
    expect(result.ok).toBe(true);
    if (result.ok)
        expect(result.events).toEqual(readEvents("name: zeta\n"));
});
test("readEvents throws on decline (eager wrapper over the Result core)", () => {
    expect(() => readEvents("\tx: 1\n")).toThrow();
});
