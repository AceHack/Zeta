import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { ALL_DOMAINS, classify, domainsForPath, toGithubOutput, type Domain } from "./path-domains.ts";

describe("fail-closed", () => {
  test("an unrecognised extension forces EVERY domain on", () => {
    const v = classify(["src/Core/Thing.newlang"]);
    expect(v.unrecognised).toEqual(["src/Core/Thing.newlang"]);
    for (const d of ALL_DOMAINS) expect(v.touched[d]).toBe(true);
  });

  test("an unrecognised path among inert ones still forces everything on", () => {
    const v = classify(["docs/a.md", "src/weird.qqq", "docs/b.md"]);
    for (const d of ALL_DOMAINS) expect(v.touched[d]).toBe(true);
  });

  test("`null` is distinguishable from `every domain` — a caller cannot confuse them", () => {
    expect(domainsForPath("src/x.unknown")).toBeNull();
    expect(domainsForPath(".github/workflows/gate.yml")).not.toBeNull();
  });

  test("an empty diff touches nothing — and that is not a licence to skip the FLOOR", () => {
    const v = classify([]);
    for (const d of ALL_DOMAINS) expect(v.touched[d]).toBe(false);
  });
});

describe("the label is never the authority", () => {
  test("PR-title markers are not inputs — only paths are", () => {
    // If a title could turn a check off, the gate would be self-certifying.
    // classify() takes paths only; these read as unrecognised paths, which
    // FAIL CLOSED rather than exempting anything.
    const v = classify(["[skip-review]", "[telemetry-flush]"]);
    for (const d of ALL_DOMAINS) expect(v.touched[d]).toBe(true);
  });
});

describe("the measured case: PR #17264", () => {
  const FILES = [
    "docs/github/prs/shards/017/08000000000000007803000000004368.json",
    "docs/github/prs/shards/017/0800000000000000780300000000436c.json",
    "docs/history/pr-reviews/PR-17256-feat-setup-pin-the-codeql-cli.md",
    "docs/history/pr-reviews/PR-17260-research-developer-tooling.md",
  ];

  test("a telemetry flush touches markdown and NOTHING else", () => {
    const v = classify(FILES);
    expect(v.unrecognised).toEqual([]);
    expect(v.touched.markdown).toBe(true);
    for (const d of ALL_DOMAINS.filter((x) => x !== "markdown")) {
      expect(v.touched[d]).toBe(false);
    }
  });

  test("the three jobs measured at 155s/116s/79s would not have run", () => {
    const v = classify(FILES);
    expect(v.touched.csharp).toBe(false);
    expect(v.touched.rust).toBe(false);
    expect(v.touched.shell).toBe(false);
  });
});

describe("a workflow file is shell too", () => {
  test("`run:` blocks are shell that no extension announces", () => {
    const d = domainsForPath(".github/workflows/gate.yml");
    expect(d).toContain("workflows");
    expect(d).toContain("shell");
    expect(d).toContain("yaml");
  });
});

describe("whole-tree falsifier — no file escapes its own language", () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n").filter((l) => l.length > 0);

  const EXT_MUST_IMPLY: ReadonlyArray<readonly [string, Domain]> = [
    [".cs", "csharp"], [".fs", "fsharp"], [".fsproj", "fsharp"],
    [".rs", "rust"], [".go", "go"], [".py", "python"],
    [".sh", "shell"], [".ts", "typescript"], [".md", "markdown"],
  ];

  for (const [ext, domain] of EXT_MUST_IMPLY) {
    test(`every tracked ${ext} file classifies into ${domain} (or forces everything on)`, () => {
      const offenders = tracked
        .filter((f) => f.endsWith(ext))
        .filter((f) => {
          const d = domainsForPath(f);
          return d !== null && !d.includes(domain);
        });
      // A file of this language that classifies WITHOUT its own domain would
      // be silently exempted from its own lint. That is the failure this
      // whole file exists to make impossible.
      expect(offenders.slice(0, 10)).toEqual([]);
    });
  }

  test("classifying the entire tree turns every domain on", () => {
    const v = classify(tracked);
    for (const d of ALL_DOMAINS) expect(v.touched[d]).toBe(true);
  });
});

describe("emission", () => {
  test("output is ordinal-ordered and complete", () => {
    const out = toGithubOutput(classify(["a.rs"]));
    const names = out.split("\n").map((l) => l.split("=")[0]);
    expect(names).toEqual([...names].sort());
    expect(names.length).toBe(ALL_DOMAINS.length);
    expect(out).toContain("rust=true");
    expect(out).toContain("csharp=false");
  });
});
