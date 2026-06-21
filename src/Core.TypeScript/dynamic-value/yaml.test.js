import { expect, test, describe } from "bun:test";
import { canonicalYaml, fromCanonicalYaml } from "./yaml";
import { parseMarkdown, serializeMarkdown } from "./markdown";
describe("TS YAML dynamic value serialization", () => {
    test("canonicalYaml and fromCanonicalYaml round-trip", () => {
        const sample = {
            t: "obj",
            v: [
                ["a", { t: "int", v: "10" }],
                ["b", { t: "str", v: "hello" }],
                ["n", { t: "null" }],
                ["nested", { t: "arr", v: [{ t: "int", v: "1" }, { t: "bool", v: true }] }],
            ],
        };
        const toRes = canonicalYaml(sample);
        expect(toRes.ok).toBe(true);
        if (toRes.ok) {
            const fromRes = fromCanonicalYaml(toRes.value);
            expect(fromRes.ok).toBe(true);
            if (fromRes.ok) {
                expect(fromRes.value).toEqual(sample);
            }
        }
    });
    test("fromCanonicalYaml rejects non-canonical formatting", () => {
        const nonCanonical = 'a: 10\n';
        const res = fromCanonicalYaml(nonCanonical);
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error).toBe("NonCanonical");
        }
    });
});
describe("TS MarkdownTreaty", () => {
    test("parseMarkdown and serializeMarkdown round-trip", () => {
        const metadata = {
            t: "obj",
            v: [
                ["title", { t: "str", v: "Zeta TS Treaty" }],
                ["version", { t: "int", v: "1" }],
            ],
        };
        const body = "This is the document body.\nLine 2.\n";
        const serRes = serializeMarkdown(metadata, body);
        expect(serRes.ok).toBe(true);
        if (serRes.ok) {
            expect(serRes.value.startsWith("---")).toBe(true);
            const parseRes = parseMarkdown(serRes.value);
            expect(parseRes.ok).toBe(true);
            if (parseRes.ok) {
                expect(parseRes.metadata).toEqual(metadata);
                expect(parseRes.body).toBe(body);
            }
        }
    });
    test("serializeMarkdown handles empty metadata by omitting frontmatter", () => {
        const metadata = { t: "obj", v: [] };
        const body = "Pure markdown document with no frontmatter.\n";
        const serRes = serializeMarkdown(metadata, body);
        expect(serRes.ok).toBe(true);
        if (serRes.ok) {
            expect(serRes.value).toBe(body);
            const parseRes = parseMarkdown(serRes.value);
            expect(parseRes.ok).toBe(true);
            if (parseRes.ok) {
                expect(parseRes.metadata).toEqual(metadata);
                expect(parseRes.body).toBe(body);
            }
        }
    });
});
