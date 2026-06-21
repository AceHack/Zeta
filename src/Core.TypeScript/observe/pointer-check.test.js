import { test, expect } from "bun:test";
import { extractTargets, resolveTarget, checkFile } from "./pointer-check";
// B-1016 pointer hygiene — count pointers + detect broken ones (the carved-
// sentence discipline's failure mode: a pointer whose target no longer exists).
test("extractTargets finds markdown links + backtick file paths, deduped", () => {
    const text = "see [a](docs/a.md) and [b](b.md) and `tools/x.ts` and `plain` and [a again](docs/a.md)";
    const t = extractTargets(text);
    expect(t).toContain("docs/a.md");
    expect(t).toContain("b.md");
    expect(t).toContain("tools/x.ts");
    expect(t).not.toContain("plain"); // no extension → not a path
    expect(t.filter((x) => x === "docs/a.md").length).toBe(1); // deduped
});
test("resolveTarget classifies external + anchor as resolved (not file breaks)", () => {
    expect(resolveTarget("https://x.com", "f.md", ".").kind).toBe("external");
    expect(resolveTarget("https://x.com", "f.md", ".").resolved).toBe(true);
    expect(resolveTarget("#section", "f.md", ".").kind).toBe("anchor");
});
test("resolveTarget strips anchors before checking the file", () => {
    // this very test file exists; an anchor on it must still resolve
    const r = resolveTarget("src/Core.TypeScript/observe/pointer-check.test.ts#foo", "x.md", ".");
    expect(r.kind).toBe("file");
    expect(r.resolved).toBe(true);
});
test("checkFile counts pointers and flags the broken file targets", () => {
    const text = "[real](src/Core.TypeScript/observe/pointer-check.ts) and [dead](src/Core.TypeScript/observe/does-not-exist-xyz.md) and [ext](https://x.com)";
    const fp = checkFile("x.md", text, ".");
    expect(fp.total).toBe(3);
    expect(fp.checked).toBe(2); // external excluded
    expect(fp.broken.length).toBe(1);
    expect(fp.broken[0].target).toBe("src/Core.TypeScript/observe/does-not-exist-xyz.md");
});
test("a file with no broken pointers reports zero", () => {
    const fp = checkFile("x.md", "[ok](src/Core.TypeScript/observe/pointer-check.ts)", ".");
    expect(fp.broken.length).toBe(0);
});
