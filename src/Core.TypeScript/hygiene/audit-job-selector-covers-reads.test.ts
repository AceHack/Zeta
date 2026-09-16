import { describe, expect, test } from "bun:test";
import {
  classifyReads,
  expandScripts,
  legSourceIndex,
  slugOfLeg,
  sourceCovers,
} from "./audit-job-selector-covers-reads.ts";

const allExist = (): boolean => true;

describe("sourceCovers", () => {
  test("a prefix glob covers everything beneath it", () => {
    expect(sourceCovers("src/Core.TypeScript/hygiene/**", "src/Core.TypeScript/hygiene/x.ts")).toBe(true);
  });

  // THE DEFECT THIS TOOL EXISTS FOR: the job scans `corporate`, the selector names `hygiene`.
  test("a sibling subtree is NOT covered — the #17403 shape", () => {
    expect(sourceCovers("src/Core.TypeScript/hygiene/**", "src/Core.TypeScript/corporate")).toBe(false);
  });

  // Scanning a PARENT of the selector's subtree is partial coverage, which is the thing being
  // surfaced: a change anywhere else under that parent selects nothing.
  test("scanning the parent of the selector's subtree is NOT covered", () => {
    expect(sourceCovers("src/Core.TypeScript/hygiene/**", "src/Core.TypeScript")).toBe(false);
  });

  test("an extension glob covers a file with that extension", () => {
    expect(sourceCovers("**/*.yaml", "full-ai-cluster/k8s/app.yaml")).toBe(true);
    expect(sourceCovers("**/*.yaml", "full-ai-cluster/k8s/kubernetes-version.json")).toBe(false);
  });

  // THE FIRST FALSE POSITIVE: a scanned DIRECTORY judged against an extension glob. Comparing
  // the directory's own name says "uncovered" while every yaml inside it selects the job fine.
  test("a scanned DIRECTORY is covered by an extension glob when it holds such a file", () => {
    const under = (d: string): readonly string[] => (d === "deploy" ? ["a.yaml", "readme.md"] : []);
    expect(sourceCovers("**/*.yaml", "deploy", under)).toBe(true);
    expect(sourceCovers("**/*.yaml", "elsewhere", under)).toBe(false);
  });

  test("`**` covers everything", () => {
    expect(sourceCovers("**", "anything/at/all.ts")).toBe(true);
  });
});

describe("classifyReads — the tool is not the subject", () => {
  // Folding these together buried the real finding under 11 hits of jobs reading their own
  // implementation. The first path after `bun` is EXECUTED; the rest are SCANNED.
  test("the executed file is a tool, its arguments are subjects", () => {
    const r = classifyReads("bun src/Core.TypeScript/hygiene/lint-x.ts src/Core.TypeScript/corporate", allExist);
    expect(r.find((x) => x.path === "src/Core.TypeScript/hygiene/lint-x.ts")?.kind).toBe("tool");
    expect(r.find((x) => x.path === "src/Core.TypeScript/corporate")?.kind).toBe("subject");
  });

  test("a path that is a subject anywhere stays a subject", () => {
    const script = ["bun src/tools/a.ts", "bun src/other.ts src/tools/a.ts"].join("\n");
    expect(classifyReads(script, allExist).find((x) => x.path === "src/tools/a.ts")?.kind).toBe("subject");
  });

  test("a path that does not exist is not a read at all", () => {
    expect(classifyReads("bun src/nope.ts src/also-nope", () => false)).toEqual([]);
  });

  test("trailing punctuation and a trailing slash do not make two reads of one path", () => {
    const r = classifyReads("bun t.ts src/Core.TypeScript/corporate/ (src/Core.TypeScript/corporate)", allExist);
    expect(r.filter((x) => x.path === "src/Core.TypeScript/corporate").length).toBe(1);
  });
});

describe("expandScripts — the indirection that hid the real gap", () => {
  // 30 gate steps run `bun run <script>`. A reader that stops there sees NO paths and reports
  // the tree clean — the same false negative this whole tool is about, inside the tool.
  test("a bun run script contributes its own paths", () => {
    const out = expandScripts("bun run hygiene:orphans", { "hygiene:orphans": "bun ./src/h/lint.ts src/Core.TypeScript/corporate" });
    expect(out).toContain("src/Core.TypeScript/corporate");
  });

  test("an unknown script is left exactly as it was", () => {
    expect(expandScripts("bun run nope", {})).toBe("bun run nope");
  });
});

describe("leg plumbing", () => {
  test("the graph's leg id maps to gate.yml's slug", () => {
    expect(slugOfLeg("gate/lint-bash-retirement-inventory")).toBe("gate_lint_bash_retirement_inventory");
  });

  test("a leg claimed by two targets unions their sources", () => {
    const idx = legSourceIndex([
      { legs: ["gate/x"], sources: ["a/**"] },
      { legs: ["gate/x"], sources: ["b/**"] },
    ]);
    expect(idx.get("gate/x")).toEqual(["a/**", "b/**"]);
  });
});
