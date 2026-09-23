import { describe, expect, test } from "bun:test";
import { DOMINATED_RULE, dropTscDominated, parseTscFileList, type Sarif } from "./codeql-drop-tsc-dominated.ts";

const hit = (ruleId: string, uri: string) => ({
  ruleId,
  locations: [{ physicalLocation: { artifactLocation: { uri } } }],
});
const sarifOf = (...results: ReturnType<typeof hit>[]): Sarif => ({ version: "2.1.0", runs: [{ results }] });
const kept = (s: Sarif): number => s.runs?.[0]?.results?.length ?? -1;

describe("drops the dominated rule only where tsc already enforces it", () => {
  const checked = new Set(["src/Core.TypeScript/zflash/lib.ts"]);

  test("the rule on a tsc-checked .ts file is dropped", () => {
    const r = dropTscDominated(sarifOf(hit(DOMINATED_RULE, "src/Core.TypeScript/zflash/lib.ts")), checked);
    expect(kept(r.sarif)).toBe(0);
    expect(r.dropped).toEqual(["src/Core.TypeScript/zflash/lib.ts"]);
  });

  // The premise holds only where tsc looks. Plain JS is checked by nothing else.
  test("the rule on a file tsc does NOT check is kept", () => {
    const r = dropTscDominated(sarifOf(hit(DOMINATED_RULE, "tools/agent.cjs")), checked);
    expect(kept(r.sarif)).toBe(1);
  });

  // A .ts file tsc excludes (e.g. AssemblyScript under src/wasm-dla) must keep it:
  // the decision is membership in tsc's own list, never the extension.
  test("a .ts file outside tsc's list is kept -- extension is not the test", () => {
    const r = dropTscDominated(sarifOf(hit(DOMINATED_RULE, "src/wasm-dla/assembly/index.ts")), checked);
    expect(kept(r.sarif)).toBe(1);
  });

  test("every OTHER rule on a tsc-checked file is kept", () => {
    const r = dropTscDominated(sarifOf(hit("js/log-injection", "src/Core.TypeScript/zflash/lib.ts")), checked);
    expect(kept(r.sarif)).toBe(1);
  });

  test("the rule id is also read from rule.id", () => {
    const s: Sarif = { runs: [{ results: [{ rule: { id: DOMINATED_RULE }, locations: [{ physicalLocation: { artifactLocation: { uri: "src/Core.TypeScript/zflash/lib.ts" } } }] }] }] };
    expect(kept(dropTscDominated(s, checked).sarif)).toBe(0);
  });

  test("percent-encoded uris are decoded before matching", () => {
    const enc = new Set(["docs/a b.ts"]);
    expect(kept(dropTscDominated(sarifOf(hit(DOMINATED_RULE, "docs/a%20b.ts")), enc).sarif)).toBe(0);
  });

  test("a result with no location is kept", () => {
    const s: Sarif = { runs: [{ results: [{ ruleId: DOMINATED_RULE }] }] };
    expect(kept(dropTscDominated(s, checked).sarif)).toBe(1);
  });
});

describe("tsc's own file list is the authority", () => {
  test("absolute paths become repo-relative; node_modules and outside paths are ignored", () => {
    const set = parseTscFileList(
      ["/r/src/a.ts", "/r/node_modules/x/index.d.ts", "/elsewhere/lib.d.ts", "", "/r/tools/b.ts"].join("\n"),
      "/r",
    );
    expect([...set].sort()).toEqual(["src/a.ts", "tools/b.ts"]);
  });
});
