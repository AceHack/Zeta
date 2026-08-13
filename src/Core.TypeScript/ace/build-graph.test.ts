// build-graph.test.ts — the build dependency graph and its affected-set query.
//
// The safety-critical tests are the ones under "fail-safe" and "coverage
// declaration": a selective build is only trustworthy if a target that is
// neither run nor accounted-for is IMPOSSIBLE, and if an unrecognised path
// escalates instead of vanishing.

import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchGlob,
  matchSegmentGlob,
  matchesAny,
  ordinalCompare,
  normalizePath,
  parseChangedFiles,
  classifyPath,
  reverseClosure,
  affectedTargets,
  allTargetIds,
  shouldRunFullBuild,
  verifyCoverage,
  deriveGraph,
  serializeGraph,
  graphsEqual,
  loadGraph,
  parseProjectReferences,
  parseCargoPathDeps,
  resolveRelative,
  GRAPH_PATH,
  type BuildGraph,
} from "./build-graph";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/** A tiny hand-built graph — the semantics tests read against this, not the repo. */
const TOY: BuildGraph = {
  version: 1,
  always: ["ci/**", "toolchain.lock"],
  inert: ["notes/**"],
  targets: [
    { id: "a", kind: "t", sources: ["a/**"], dependsOn: [], legs: ["gate/a"], origin: "declared" },
    { id: "b", kind: "t", sources: ["b/**"], dependsOn: ["a"], legs: ["gate/b"], origin: "declared" },
    { id: "c", kind: "t", sources: ["c/**"], dependsOn: ["b"], legs: ["gate/b"], origin: "declared" },
    { id: "d", kind: "t", sources: ["d/**"], dependsOn: [], legs: [], origin: "declared" },
  ],
};

describe("glob matching", () => {
  test("literal segments match ordinally", () => {
    expect(matchGlob("src/Core/Foo.fs", "src/Core/Foo.fs")).toBe(true);
    expect(matchGlob("src/Core/Foo.fs", "src/core/Foo.fs")).toBe(false);
  });

  test("** absorbs zero or more segments", () => {
    expect(matchGlob("src/**", "src/Core/Deep/Foo.fs")).toBe(true);
    expect(matchGlob("src/**", "src")).toBe(true);
    expect(matchGlob("**/*.md", "README.md")).toBe(true);
    expect(matchGlob("**/*.md", "docs/a/b/c.md")).toBe(true);
    expect(matchGlob("**/*.md", "docs/a/b/c.ts")).toBe(false);
  });

  test("* stays inside one segment", () => {
    expect(matchGlob("src/*.ts", "src/a.ts")).toBe(true);
    expect(matchGlob("src/*.ts", "src/nested/a.ts")).toBe(false);
    expect(matchSegmentGlob("*.test.ts", "build-graph.test.ts")).toBe(true);
    expect(matchSegmentGlob("*.test.ts", "build-graph.ts")).toBe(false);
    expect(matchSegmentGlob("a*b*c", "aXbYc")).toBe(true);
    expect(matchSegmentGlob("a*b*c", "aXc")).toBe(false);
  });

  test("prefix/suffix overlap is not double-counted", () => {
    // "ab" must not satisfy a*a by reusing the same character.
    expect(matchSegmentGlob("a*a", "a")).toBe(false);
    expect(matchSegmentGlob("a*a", "aa")).toBe(true);
  });

  test("matchesAny is an ordinal OR", () => {
    expect(matchesAny(["x/**", "y/**"], "y/z")).toBe(true);
    expect(matchesAny(["x/**", "y/**"], "z/z")).toBe(false);
    expect(matchesAny([], "anything")).toBe(false);
  });
});

describe("path normalization + changed-file parsing", () => {
  test("normalizePath strips ./ and flips separators", () => {
    expect(normalizePath("./src/a.ts")).toBe("src/a.ts");
    expect(normalizePath("src\\a.ts")).toBe("src/a.ts");
  });

  test("parseChangedFiles drops blanks and sorts ordinally (DST-stable)", () => {
    expect(parseChangedFiles("b.ts\n\n a.ts \nc.ts\n")).toEqual(["a.ts", "b.ts", "c.ts"]);
  });
});

describe("classification", () => {
  test("always outranks target and inert", () => {
    expect(classifyPath(TOY, "ci/deploy.yml").kind).toBe("always");
    expect(classifyPath(TOY, "toolchain.lock").kind).toBe("always");
  });

  test("a source hit yields its target(s)", () => {
    const c = classifyPath(TOY, "a/x.ts");
    expect(c.kind).toBe("target");
    if (c.kind === "target") expect(c.targets).toEqual(["a"]);
  });

  test("declared-inert paths drive nothing", () => {
    expect(classifyPath(TOY, "notes/x.md").kind).toBe("inert");
  });

  test("anything else is unknown — never silently ignored", () => {
    expect(classifyPath(TOY, "somewhere/new/file.rs").kind).toBe("unknown");
  });
});

describe("reverse closure — dirty flows toward consumers", () => {
  test("a change to a dirties b and c transitively", () => {
    expect(reverseClosure(TOY, ["a"])).toEqual(["a", "b", "c"]);
  });

  test("a change to a leaf dirties only itself", () => {
    expect(reverseClosure(TOY, ["d"])).toEqual(["d"]);
  });

  test("terminates on a cyclic graph rather than hanging", () => {
    const cyclic: BuildGraph = {
      version: 1,
      always: [],
      inert: [],
      targets: [
        { id: "x", kind: "t", sources: ["x/**"], dependsOn: ["y"], legs: [], origin: "declared" },
        { id: "y", kind: "t", sources: ["y/**"], dependsOn: ["x"], legs: [], origin: "declared" },
      ],
    };
    expect(reverseClosure(cyclic, ["x"])).toEqual(["x", "y"]);
  });
});

describe("affected-set — the fail-safe is the point", () => {
  test("an UNKNOWN path escalates to a full build", () => {
    const d = affectedTargets(TOY, ["a/x.ts", "brand/new/tree/file.zig"]);
    expect(d.mode).toBe("full");
    expect(d.unknownPaths).toEqual(["brand/new/tree/file.zig"]);
    expect(d.affected).toEqual(allTargetIds(TOY));
    expect(d.reason).toContain("fail-safe to full");
  });

  test("an ALWAYS path escalates to a full build", () => {
    const d = affectedTargets(TOY, ["ci/gate.yml"]);
    expect(d.mode).toBe("full");
    expect(d.affected).toEqual(allTargetIds(TOY));
  });

  test("a caller-forced full build is honoured and its reason is carried", () => {
    const d = affectedTargets(TOY, ["a/x.ts"], { full: true, reason: "scheduled sweep" });
    expect(d.mode).toBe("full");
    expect(d.reason).toContain("scheduled sweep");
  });

  test("a known change carves the reachable subgraph and nothing more", () => {
    const d = affectedTargets(TOY, ["a/x.ts"]);
    expect(d.mode).toBe("selective");
    expect(d.affected).toEqual(["a", "b", "c"]);
    expect(d.skipped).toEqual(["d"]);
    expect(d.legs).toEqual(["gate/a", "gate/b"]);
  });

  test("an all-inert change builds nothing and says so", () => {
    const d = affectedTargets(TOY, ["notes/a.md"]);
    expect(d.mode).toBe("selective");
    expect(d.affected).toEqual([]);
    expect(d.legs).toEqual([]);
    expect(d.reason).toContain("declared-inert");
  });

  test("an empty change set is selective-empty, not full", () => {
    expect(affectedTargets(TOY, []).affected).toEqual([]);
  });

  test("the decision is order-independent (commutative over the change set)", () => {
    const a = affectedTargets(TOY, ["a/x.ts", "d/y.ts"]);
    const b = affectedTargets(TOY, ["d/y.ts", "a/x.ts"]);
    expect(a).toEqual(b);
  });

  test("the decision is idempotent under duplicate paths", () => {
    const once = affectedTargets(TOY, ["a/x.ts"]);
    const twice = affectedTargets(TOY, ["a/x.ts", "a/x.ts"]);
    expect(twice.affected).toEqual(once.affected);
    expect(twice.skipped).toEqual(once.skipped);
  });
});

describe("coverage declaration — a green must never be ambiguous", () => {
  test("every target is accounted for in every decision", () => {
    for (const changed of [[], ["a/x.ts"], ["notes/x.md"], ["ci/y.yml"], ["nowhere/z"]]) {
      const d = affectedTargets(TOY, changed);
      expect(verifyCoverage(TOY, d)).toEqual([]);
      expect([...d.affected, ...d.skipped].sort(ordinalCompare)).toEqual([...allTargetIds(TOY)]);
    }
  });

  test("a target present in neither list is reported as unaccounted", () => {
    const d = affectedTargets(TOY, ["a/x.ts"]);
    const tampered = { ...d, skipped: [] as string[] };
    expect(verifyCoverage(TOY, tampered)).toEqual([{ kind: "unaccounted", id: "d" }]);
  });

  test("a target claimed in both lists is reported as double-counted", () => {
    const d = affectedTargets(TOY, ["a/x.ts"]);
    const tampered = { ...d, skipped: ["a", "d"] };
    expect(verifyCoverage(TOY, tampered)).toEqual([{ kind: "double-counted", id: "a" }]);
  });

  test("an id outside the graph is reported", () => {
    const d = affectedTargets(TOY, []);
    const tampered = { ...d, affected: ["ghost"] };
    expect(verifyCoverage(TOY, tampered)).toContainEqual({ kind: "unknown-id", id: "ghost" });
  });
});

describe("full-build policy — exact, integer-only, replayable", () => {
  test("non-PR events always run full (preserves gate.yml's nonpr fast path)", () => {
    for (const ev of ["push", "merge_group", "workflow_dispatch", "schedule"]) {
      expect(shouldRunFullBuild({ eventName: ev, headSha: "deadbeef", sampleEveryN: 1000 }).full).toBe(true);
    }
  });

  test("sampling is disabled at N<=0 and always-on at N=1", () => {
    expect(shouldRunFullBuild({ eventName: "pull_request", headSha: "abc", sampleEveryN: 0 }).full).toBe(false);
    expect(shouldRunFullBuild({ eventName: "pull_request", headSha: "abc", sampleEveryN: 1 }).full).toBe(true);
  });

  test("the same sha always yields the same answer (no clock, no RNG)", () => {
    const p = { eventName: "pull_request", headSha: "0000000000000010ffff", sampleEveryN: 8 };
    const first = shouldRunFullBuild(p);
    for (let i = 0; i < 25; i++) expect(shouldRunFullBuild(p)).toEqual(first);
  });

  test("bucket 0 selects a full build; other buckets do not", () => {
    // 0x0000000000000010 = 16; 16 % 8 == 0 -> sampled.
    expect(shouldRunFullBuild({ eventName: "pull_request", headSha: "0000000000000010", sampleEveryN: 8 }).full).toBe(
      true,
    );
    // 0x0000000000000011 = 17; 17 % 8 == 1 -> not sampled.
    expect(shouldRunFullBuild({ eventName: "pull_request", headSha: "0000000000000011", sampleEveryN: 8 }).full).toBe(
      false,
    );
  });

  test("an unparseable sha fails SAFE (full), never open", () => {
    for (const sha of ["", "   ", "not-hex-at-all", "zzzz"]) {
      const r = shouldRunFullBuild({ eventName: "pull_request", headSha: sha, sampleEveryN: 8 });
      expect(r.full).toBe(true);
      expect(r.reason).toContain("fail-safe");
    }
  });

  test("sampling spreads across buckets rather than pinning one answer", () => {
    let fulls = 0;
    for (let i = 0; i < 64; i++) {
      const sha = i.toString(16).padStart(16, "0");
      if (shouldRunFullBuild({ eventName: "pull_request", headSha: sha, sampleEveryN: 8 }).full) fulls++;
    }
    expect(fulls).toBe(8); // exactly 1-in-8, by construction — no statistics needed
  });
});

describe("manifest parsers — edges come from what the repo already declares", () => {
  test("ProjectReference includes resolve relative to the project dir", () => {
    const xml = `<Project><ItemGroup>
      <ProjectReference Include="..\\Core\\Core.fsproj" />
      <ProjectReference Include="..\\Zeta.Generators\\Zeta.Generators.csproj" OutputItemType="Analyzer" />
    </ItemGroup></Project>`;
    expect(parseProjectReferences(xml, "tests/Tests.CSharp")).toEqual([
      "tests/Core/Core.fsproj",
      "tests/Zeta.Generators/Zeta.Generators.csproj",
    ]);
  });

  test("Cargo path deps resolve and de-duplicate", () => {
    const toml = `[dependencies]
zeta-core-merkle = { path = "../Core.Rust.Merkle" }
[dev-dependencies]
zeta-core-yaml = { path = "../Core.Rust.Yaml" }
zeta-core-merkle = { path = "../Core.Rust.Merkle" }`;
    expect(parseCargoPathDeps(toml, "src/Core.Rust.Blake3")).toEqual(["src/Core.Rust.Merkle", "src/Core.Rust.Yaml"]);
  });

  test("resolveRelative walks .. and drops . segments", () => {
    expect(resolveRelative("src/a/b", "../../c/d")).toBe("src/c/d");
    expect(resolveRelative("src/a", "./x")).toBe("src/a/x");
  });
});

// ── Tests against the REAL checked-in graph ──────────────────────────────

describe("the checked-in repo graph", () => {
  const graph = loadGraph(REPO_ROOT);

  test("ids are unique and ordinally sorted", () => {
    const ids = graph.targets.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort(ordinalCompare)).toEqual(ids);
  });

  test("every dependsOn edge points at a target that exists", () => {
    const ids = new Set(graph.targets.map((t) => t.id));
    const dangling: string[] = [];
    for (const t of graph.targets) {
      for (const d of t.dependsOn) if (!ids.has(d)) dangling.push(`${t.id} -> ${d}`);
    }
    expect(dangling).toEqual([]);
  });

  test("no target is its own dependency", () => {
    for (const t of graph.targets) expect(t.dependsOn).not.toContain(t.id);
  });

  test("DRIFT GATE: regenerating from the repo's manifests reproduces the checked-in graph", () => {
    // The generator IS the error-correcting code: if a project reference, a
    // Cargo path dep, or a Lake package is added/removed without refreshing
    // the graph, this fails. Fix: `bun src/Core.TypeScript/ace/build-graph.ts derive --write`.
    // Content-exact, formatting-agnostic — prettier owns the file's layout.
    expect(serializeGraph(deriveGraph(REPO_ROOT, graph))).toBe(serializeGraph(graph));
    expect(graphsEqual(deriveGraph(REPO_ROOT, graph), graph)).toBe(true);
  });

  test("the checked-in file parses to exactly what loadGraph returns (no lossy fields)", () => {
    const raw = JSON.parse(readFileSync(join(REPO_ROOT, GRAPH_PATH), "utf8")) as BuildGraph;
    expect(serializeGraph(raw)).toBe(serializeGraph(graph));
  });

  test("the real graph carries the .NET reference edges (F# core -> its consumers)", () => {
    const d = affectedTargets(graph, ["src/Core/ZSet.fs"]);
    expect(d.mode).toBe("selective");
    expect(d.affected).toContain("dotnet:src/Core");
    expect(d.affected).toContain("dotnet:tests/Tests.FSharp"); // consumes src/Core
    expect(d.affected).toContain("dotnet:src/Core.CSharp"); // consumes src/Core
    expect(d.legs).toContain("gate/build-and-test");
  });

  test("the real graph carries the Rust path-dep edges", () => {
    const d = affectedTargets(graph, ["src/Core.Rust.Merkle/src/lib.rs"]);
    expect(d.affected).toContain("rust:src/Core.Rust.Merkle");
    expect(d.affected).toContain("rust:src/Core.Rust.Blake3"); // path-dep on Merkle
    expect(d.affected).toContain("rust:src/Core.Rust.Algebra"); // path-dep on Merkle
  });

  test("touching the graph itself forces a full build (self-guard)", () => {
    expect(affectedTargets(graph, [GRAPH_PATH]).mode).toBe("full");
    expect(affectedTargets(graph, ["src/Core.TypeScript/ace/build-graph.ts"]).mode).toBe("full");
  });

  test("toolchain + CI config changes force a full build", () => {
    for (const p of [
      ".github/workflows/gate.yml",
      "Directory.Build.props",
      "Directory.Packages.props",
      "global.json",
      "Zeta.sln",
      ".mise.toml",
      "tools/setup/install.sh",
      "package.json",
      "bun.lock",
      "tsconfig.json",
    ]) {
      expect(affectedTargets(graph, [p]).mode).toBe("full");
    }
  });

  test("PARITY: paths gate.yml treats as docs-only never request a heavy leg", () => {
    // Ported from gate.yml's path-filter allowlist (lines 197-229). Today
    // these yield code=false, so build-and-test's heavy steps and full-verify
    // do not run. The graph must not be MORE permissive than that; markdown
    // and other cheap lint legs are allowed (they run today too).
    const docsOnly = [
      "docs/BACKLOG.md",
      "docs/research/some-note.md",
      "memory/MEMORY.md",
      "openspec/changes/foo/proposal.md",
      ".claude/rules/a-rule.md",
      ".github/ISSUE_TEMPLATE/bug.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".gitignore",
      ".gitattributes",
      "LICENSE",
      "notes.txt",
      "README.md",
      "GOVERNANCE.md",
    ];
    const d = affectedTargets(graph, docsOnly);
    expect(d.mode).toBe("selective");
    expect(d.legs).not.toContain("gate/build-and-test");
    expect(d.legs).not.toContain("gate/full-verify");
    expect(d.legs).not.toContain("gate/cross-verify");
    // Each one individually, so a single bad glob cannot hide behind the batch.
    for (const p of docsOnly) {
      const one = affectedTargets(graph, [p]);
      expect({ p, mode: one.mode }).toEqual({ p, mode: "selective" });
      expect({ p, legs: one.legs.filter((l) => l.includes("build-and-test") || l.includes("verify")) }).toEqual({
        p,
        legs: [],
      });
    }
  });

  test("coverage is complete for every representative change set", () => {
    for (const changed of [
      [],
      ["docs/a.md"],
      ["src/Core/ZSet.fs"],
      ["src/Core.Rust.Merkle/src/lib.rs"],
      ["src/Core.TypeScript/ace/store.ts"],
      ["src/Core.Python/src/zeta/a.py"],
      ["src/Core.TLA/specs/Spine.tla"],
      [".github/workflows/gate.yml"],
      ["totally/unmapped/path.bin"],
    ]) {
      const d = affectedTargets(graph, changed);
      expect({ changed, problems: verifyCoverage(graph, d) }).toEqual({ changed, problems: [] });
    }
  });
});
