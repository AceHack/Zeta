// build-graph.test.ts — the build dependency graph and its affected-set query.
//
// The safety-critical tests are the ones under "fail-safe" and "coverage
// declaration": a selective build is only trustworthy if a target that is
// neither run nor accounted-for is IMPOSSIBLE, and if an unrecognised path
// escalates instead of vanishing.

import { expect, test, describe } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
  quorumSize,
  tierRank,
  maxTier,
  globSpecificity,
  finestTargetsCovering,
  consumerClosure,
  requiredQuorumForTargets,
  requiredQuorumForChange,
  computeQuorums,
  TIER_FAULT_MODEL,
  EVIDENCE_RULES,
  DEFAULT_TIER,
  oracleOutputReviewerClass,
  DERIVATION_INPUT_GLOBS,
  DERIVER_PATH,
  DERIVE_FIX_COMMAND,
  derivationInputsTouched,
  type BuildGraph,
  type QuorumTier,
  type RequiredQuorum,
} from "./build-graph";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/** A target's quorum, written the short way for the toy fixtures. */
function toyQuorum(tier: QuorumTier, reviewerClasses: readonly string[] = ["reviewer:t"]): RequiredQuorum {
  return { tier, faultModel: TIER_FAULT_MODEL[tier], reviewerClasses, evidence: [] };
}

/** A tiny hand-built graph — the semantics tests read against this, not the repo. */
const TOY: BuildGraph = {
  version: 1,
  always: ["ci/**", "toolchain.lock"],
  inert: ["notes/**"],
  targets: [
    {
      id: "a",
      kind: "t",
      sources: ["a/**"],
      dependsOn: [],
      legs: ["gate/a"],
      origin: "declared",
      requiredQuorum: toyQuorum("T3", ["reviewer:rust"]),
    },
    {
      id: "b",
      kind: "t",
      sources: ["b/**"],
      dependsOn: ["a"],
      legs: ["gate/b"],
      origin: "declared",
      requiredQuorum: toyQuorum("T1", ["reviewer:fsharp"]),
    },
    {
      id: "c",
      kind: "t",
      sources: ["c/**"],
      dependsOn: ["b"],
      legs: ["gate/b"],
      origin: "declared",
      requiredQuorum: toyQuorum("T2"),
    },
    {
      id: "d",
      kind: "t",
      sources: ["d/**"],
      dependsOn: [],
      legs: [],
      origin: "declared",
      requiredQuorum: toyQuorum("T1"),
    },
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
        {
          id: "x",
          kind: "t",
          sources: ["x/**"],
          dependsOn: ["y"],
          legs: [],
          origin: "declared",
          requiredQuorum: toyQuorum("T1"),
        },
        {
          id: "y",
          kind: "t",
          sources: ["y/**"],
          dependsOn: ["x"],
          legs: [],
          origin: "declared",
          requiredQuorum: toyQuorum("T1"),
        },
      ],
    };
    expect(reverseClosure(cyclic, ["x"])).toEqual(["x", "y"]);
    // The evidence walk uses the same edges and must not hang either.
    expect(consumerClosure(cyclic, "x")).toEqual(["y"]);
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
    // deriveGraph walks every manifest in the repo, so it is derived ONCE and both
    // properties are asserted against that one result. Calling it per-expect cost ~2.6s
    // under whole-suite load against a 5000 ms per-test cap -- half of it re-deriving an
    // identical graph. Slow BY ACCIDENT, so made fast rather than given a timeout
    // (081KZZ3JHP1087G0R00027ARRR).
    const derived = deriveGraph(REPO_ROOT, graph);
    // The assertion below fails with a whole-file JSON diff and no instruction,
    // so the fix is printed FIRST. Three PRs hit this gate on 2026-08-14 and each
    // was fixed by this one command; a reader of the CI log should not have to
    // come here to find it. `::error::` also annotates the run.
    if (!graphsEqual(derived, graph)) {
      console.error(`::error::${GRAPH_PATH} has drifted. Run: ${DERIVE_FIX_COMMAND}`);
    }
    expect(serializeGraph(derived)).toBe(serializeGraph(graph));
    expect(graphsEqual(derived, graph)).toBe(true);
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

// ── Required quorum ──────────────────────────────────────────────────────
//
// The safety-critical tests here are "aggregation is monotone" and "the drift
// gate covers the quorum". The rest is arithmetic; those two are the properties
// an attacker — or an impatient agent — would go after.

describe("fault model — a count is never separable from what it survives", () => {
  test("quorumSize is the ONLY route to a number, and it is exact", () => {
    expect(quorumSize({ faultClass: "none", f: 0 })).toBe(1);
    expect(quorumSize({ faultClass: "omission", f: 0 })).toBe(1);
    expect(quorumSize({ faultClass: "omission", f: 1 })).toBe(2);
    expect(quorumSize({ faultClass: "omission", f: 2 })).toBe(3);
    // 3f+1 — Pease/Shostak/Lamport 1980, PBFT 1999.
    expect(quorumSize({ faultClass: "byzantine", f: 1 })).toBe(4);
    expect(quorumSize({ faultClass: "byzantine", f: 2 })).toBe(7);
  });

  test("a corrupt f can never yield a fractional or negative requirement", () => {
    for (const f of [-5, -1, 0.5, 1.9, Number.NaN]) {
      const n = quorumSize({ faultClass: "byzantine", f });
      expect({ f, integer: Number.isInteger(n), atLeastOne: n >= 1 }).toEqual({ f, integer: true, atLeastOne: true });
    }
  });

  test("`none` is a WITNESS and says so — it is not a one-member quorum", () => {
    // vocab/words/quorum.md exists precisely so these two are not confused.
    expect(TIER_FAULT_MODEL.T0).toEqual({ faultClass: "none", f: 0 });
    expect(quorumSize(TIER_FAULT_MODEL.T0)).toBe(1);
  });

  test("tier order is total, and size is monotone in it", () => {
    const ascending: readonly (readonly [QuorumTier, QuorumTier])[] = [
      ["T0", "T1"],
      ["T1", "T2"],
      ["T2", "T3"],
    ];
    for (const [lo, hi] of ascending) {
      expect(tierRank(hi)).toBeGreaterThan(tierRank(lo));
      expect(quorumSize(TIER_FAULT_MODEL[hi])).toBeGreaterThanOrEqual(quorumSize(TIER_FAULT_MODEL[lo]));
      expect(maxTier(lo, hi)).toBe(hi);
      expect(maxTier(hi, lo)).toBe(hi);
    }
  });

  test("only the cross-oracle tier claims a Byzantine model", () => {
    // 3f+1 is proved about AGREEMENT. It is used for the one tier whose verdict
    // genuinely is an agreement claim across independent oracles; applying it to
    // "did you read the diff" would be borrowing an anchor's authority.
    expect(TIER_FAULT_MODEL.T3.faultClass).toBe("byzantine");
    expect(TIER_FAULT_MODEL.T1.faultClass).toBe("omission");
    expect(TIER_FAULT_MODEL.T2.faultClass).toBe("omission");
  });
});

describe("quorum aggregation — max, and why not the others", () => {
  test("max over the affected targets", () => {
    expect(requiredQuorumForTargets(TOY, ["b"]).tier).toBe("T1");
    expect(requiredQuorumForTargets(TOY, ["b", "c"]).tier).toBe("T2");
    expect(requiredQuorumForTargets(TOY, ["a", "b", "c", "d"]).tier).toBe("T3");
    expect(requiredQuorumForTargets(TOY, ["a", "b", "c", "d"]).size).toBe(4);
  });

  test("MONOTONE: adding files can never lower the requirement", () => {
    // The security property. Averaging fails it, which is why averaging is not
    // an option: bundle one byte-locked edit with ninety trivial ones and the
    // mean — hence the gate — falls exactly when the change got broader.
    const high = requiredQuorumForTargets(TOY, ["a"]);
    for (const extra of [["b"], ["c"], ["d"], ["b", "c", "d"]]) {
      const wider = requiredQuorumForTargets(TOY, ["a", ...extra]);
      expect({ extra, ok: wider.size >= high.size && tierRank(wider.tier) >= tierRank(high.tier) }).toEqual({
        extra,
        ok: true,
      });
    }
    // The number an "average" would have produced, pinned so the temptation is
    // visible rather than theoretical.
    const sizes = ["a", "b", "c", "d"].map((id) => requiredQuorumForTargets(TOY, [id]).size);
    const mean = Math.trunc(sizes.reduce((x, y) => x + y, 0) / sizes.length);
    expect(mean).toBeLessThan(requiredQuorumForTargets(TOY, ["a", "b", "c", "d"]).size);
  });

  test("NOT sum: reviewers are not consumed per target", () => {
    const all = requiredQuorumForTargets(TOY, ["a", "b", "c", "d"]);
    const summed = ["a", "b", "c", "d"].reduce((n, id) => n + requiredQuorumForTargets(TOY, [id]).size, 0);
    expect(all.size).toBeLessThan(summed);
    expect(all.size).toBe(quorumSize(TIER_FAULT_MODEL.T3));
  });

  test("reviewer classes UNION — 'different reviewers per language' is a union", () => {
    expect(requiredQuorumForTargets(TOY, ["a", "b"]).reviewerClasses).toEqual(["reviewer:fsharp", "reviewer:rust"]);
  });

  test("an empty affected set is a WITNESS, never zero observers", () => {
    const q = requiredQuorumForTargets(TOY, []);
    expect({ tier: q.tier, faultClass: q.faultModel.faultClass, size: q.size }).toEqual({
      tier: "T0",
      faultClass: "none",
      size: 1,
    });
  });

  test("`drivenBy` names the targets accountable for the tier", () => {
    expect(requiredQuorumForTargets(TOY, ["a", "b", "c"]).drivenBy).toEqual(["a"]);
  });

  test("unknown paths escalate to full, and full carries the max tier — no special case", () => {
    const d = affectedTargets(TOY, ["totally/unmapped.bin"]);
    expect(d.mode).toBe("full");
    expect(requiredQuorumForChange(TOY, d).tier).toBe("T3");
  });

  test("a declared-inert change gets a witness, not a quorum", () => {
    const d = affectedTargets(TOY, ["notes/thoughts.md"]);
    expect(d.mode).toBe("selective");
    expect(requiredQuorumForChange(TOY, d).size).toBe(1);
  });

  test("ids not in the graph are ignored rather than silently sizing the quorum", () => {
    expect(requiredQuorumForTargets(TOY, ["nope"]).tier).toBe("T0");
    expect(requiredQuorumForTargets(TOY, ["nope", "c"]).tier).toBe("T2");
  });
});

describe("evidence attribution", () => {
  test("consumerClosure walks dependsOn upward, not downward", () => {
    // a is consumed by b, b by c. Evidence must reach a from c and must NOT
    // reach c from a — otherwise every sample app inherits the tier of the
    // library it links, which is the bug this direction was chosen to avoid.
    expect(consumerClosure(TOY, "a")).toEqual(["b", "c"]);
    expect(consumerClosure(TOY, "c")).toEqual([]);
    expect(consumerClosure(TOY, "d")).toEqual([]);
  });

  test("glob specificity counts leading literal segments", () => {
    expect(globSpecificity("**/*.md")).toBe(0);
    expect(globSpecificity("**")).toBe(0);
    expect(globSpecificity("src/Core.Rust.Merkle/**")).toBe(2);
    expect(globSpecificity("tests/cross-verification/**")).toBe(2);
    expect(globSpecificity("src/Core.TypeScript/ace/**")).toBe(3);
    // A repo-wide extension glob loses to any path-scoped one — that is the
    // whole point of the ranking.
    expect(globSpecificity("**/*.ts")).toBeLessThan(globSpecificity("tests/cross-verification/**"));
  });

  test("evidence attaches to the finest covering target only", () => {
    const g: BuildGraph = {
      version: 1,
      always: [],
      inert: [],
      targets: [
        {
          id: "lint",
          kind: "t",
          sources: ["**/*.md"],
          dependsOn: [],
          legs: [],
          origin: "declared",
          requiredQuorum: toyQuorum("T1"),
        },
        {
          id: "harness",
          kind: "t",
          sources: ["tests/x/**"],
          dependsOn: [],
          legs: [],
          origin: "declared",
          requiredQuorum: toyQuorum("T1"),
        },
      ],
    };
    expect(finestTargetsCovering(g, "tests/x/README.md")).toEqual(["harness"]);
    // No path-scoped target covers this one, so the lint leg IS the finest
    // thing covering it and does own the evidence.
    expect(finestTargetsCovering(g, "docs/other.md")).toEqual(["lint"]);
  });

  test("oracle-output filenames name their reviewer class, and an unknown one is LOUD", () => {
    expect(oracleOutputReviewerClass("tests/cross-verification/zset/fsharp-output.json")).toBe("reviewer:fsharp");
    expect(oracleOutputReviewerClass("tests/cross-verification/zset/cs-output.json")).toBe("reviewer:csharp");
    // A new oracle language must show up in the derived JSON, never silently
    // narrow the reviewer set — the same stance as unknown→full, one level up.
    expect(oracleOutputReviewerClass("tests/cross-verification/zset/zig-output.json")).toBe("reviewer:unknown:zig");
    expect(oracleOutputReviewerClass("src/Core/Foo.fs")).toBe("");
  });

  test("every evidence rule is a path pattern with a tier above the floor", () => {
    for (const r of EVIDENCE_RULES) {
      expect({ id: r.id, paths: r.paths.length > 0, above: tierRank(r.tier) > tierRank(DEFAULT_TIER) }).toEqual({
        id: r.id,
        paths: true,
        above: true,
      });
    }
  });
});

describe("the checked-in repo graph — quorum", () => {
  const graph = loadGraph(REPO_ROOT);

  test("EVERY target carries a fault model consistent with its tier", () => {
    for (const t of graph.targets) {
      expect({ id: t.id, model: t.requiredQuorum.faultModel }).toEqual({
        id: t.id,
        model: TIER_FAULT_MODEL[t.requiredQuorum.tier],
      });
    }
  });

  test("EVERY target names at least one reviewer class", () => {
    for (const t of graph.targets) {
      expect({ id: t.id, named: t.requiredQuorum.reviewerClasses.length > 0 }).toEqual({ id: t.id, named: true });
    }
  });

  test("a tier above the floor always carries the evidence that put it there", () => {
    // The auditability property: no target is elevated by assertion.
    for (const t of graph.targets) {
      if (tierRank(t.requiredQuorum.tier) <= tierRank(DEFAULT_TIER)) continue;
      expect({ id: t.id, evidenced: t.requiredQuorum.evidence.length > 0 }).toEqual({ id: t.id, evidenced: true });
    }
  });

  test("every recorded witness file still exists — evidence rots loudly", () => {
    for (const t of graph.targets) {
      for (const e of t.requiredQuorum.evidence) {
        expect({ id: t.id, witness: e.witness, exists: existsSync(join(REPO_ROOT, e.witness)) }).toEqual({
          id: t.id,
          witness: e.witness,
          exists: true,
        });
      }
    }
  });

  test(".NET targets are split by LANGUAGE, not lumped as one toolchain", () => {
    // Aaron: "likely we want different reviewers per language." `dotnet` is a
    // toolchain; F# and C# are what a reviewer actually reads.
    const dotnet = graph.targets.filter((t) => t.kind === "dotnet");
    expect(dotnet.length).toBeGreaterThan(0);
    for (const t of dotnet) {
      expect({ id: t.id, classes: t.requiredQuorum.reviewerClasses }).not.toEqual({
        id: t.id,
        classes: ["reviewer:dotnet"],
      });
    }
  });

  test("the tiers DISCRIMINATE — this is not a constant wearing a function's clothes", () => {
    const tiers = new Set(graph.targets.map((t) => t.requiredQuorum.tier));
    expect(tiers.size).toBeGreaterThanOrEqual(3);
    for (const tier of tiers) {
      const n = graph.targets.filter((t) => t.requiredQuorum.tier === tier).length;
      expect({ tier, swallowsTheGraph: n * 5 > graph.targets.length * 4 }).toEqual({ tier, swallowsTheGraph: false });
    }
  });

  test("worked cases: the tier matches evidence a reader can go and open", () => {
    const byId = new Map(graph.targets.map((t) => [t.id, t] as const));
    // A Rust crate with single-oracle golden vectors and no cross-verify.
    expect(byId.get("rust:src/Core.Rust.Braid")?.requiredQuorum.tier).toBe("T2");
    // The N-oracle byte-lock harness itself.
    expect(byId.get("ts:cross-verification")?.requiredQuorum.tier).toBe("T3");
    // A sample app: consumed by nothing, so no byte-lock runs when it changes.
    expect(byId.get("dotnet:samples/CrmSample")?.requiredQuorum.tier).toBe("T1");
    // The harness declares its own oracles by filename, so its reviewer set is
    // derived from the tree rather than guessed.
    const harness = byId.get("ts:cross-verification")?.requiredQuorum.reviewerClasses ?? [];
    expect(harness).toContain("reviewer:rust");
    expect(harness).toContain("reviewer:fsharp");
    expect(harness).toContain("reviewer:csharp");
  });

  test("a real byte-lock change demands the Byzantine quorum", () => {
    const q = requiredQuorumForChange(
      graph,
      affectedTargets(graph, ["src/Core.Rust.Merkle/tests/golden-vectors-merkle.json"]),
    );
    expect({ tier: q.tier, size: q.size }).toEqual({ tier: "T3", size: 4 });
    expect(q.reviewerClasses).toContain("reviewer:rust");
  });

  test("a sample-app change does NOT", () => {
    const q = requiredQuorumForChange(graph, affectedTargets(graph, ["samples/CrmSample/Program.fs"]));
    expect({ tier: q.tier, size: q.size }).toEqual({ tier: "T1", size: 2 });
  });

  test("BLAST RADIUS: an ordinary change never demands the Byzantine quorum", () => {
    // The test above samples ONE path, and a repo-wide over-promotion is invisible
    // from one sample -- it looks like that path being special.
    //
    // Added 2026-08-19 after exactly that happened: a new `leg:tree-structure`
    // target with `sources: ["**"]` became a covering target for every file, so it
    // absorbed byte-lock evidence, went T3, and -- being affected by every change
    // -- took the required quorum for a README edit from T1/2 to T3/4. Repo-wide.
    // The single-sample test caught it only because `.fs` happened to be in the
    // sampled path's extension set.
    //
    // This is the property that test was reaching for: over-review is ignored
    // review, so the quorum must DISCRIMINATE across ordinary edits, not merely
    // across one of them.
    for (const path of [
      "README.md",
      "docs/research/some-note.md",
      "memory/some-note.md",
      "samples/CrmSample/Program.fs",
      "samples/QuickStart/Program.cs",
    ]) {
      const q = requiredQuorumForChange(graph, affectedTargets(graph, [path]));
      expect({ path, tier: q.tier }).not.toEqual({ path, tier: "T3" });
    }

    // ...and the gate is not vacuous: a real byte-lock artifact still demands T3.
    const locked = requiredQuorumForChange(
      graph,
      affectedTargets(graph, ["src/Core.Rust.Merkle/tests/golden-vectors-merkle.json"]),
    );
    expect(locked.tier).toBe("T3");
  });

  test("DRIFT GATE: a hand-edited tier contradicting the derivation fails derive", () => {
    // The same guard the declared edges already get. Pick a target the
    // derivation does NOT place at T3 and hand-promote it.
    const victim = graph.targets.find((t) => t.requiredQuorum.tier !== "T3");
    expect(victim).toBeDefined();
    const tampered: BuildGraph = {
      ...graph,
      targets: graph.targets.map((t) =>
        t.id === victim?.id
          ? { ...t, requiredQuorum: { ...t.requiredQuorum, tier: "T3", faultModel: TIER_FAULT_MODEL.T3 } }
          : t,
      ),
    };
    expect(graphsEqual(deriveGraph(REPO_ROOT, tampered), tampered)).toBe(false);
    // ...and the untampered graph is in sync, so the gate is not simply always red.
    expect(graphsEqual(deriveGraph(REPO_ROOT, graph), graph)).toBe(true);
    // Two repo-wide derivations, both load-bearing: one must fail, one must pass, and
    // dropping either makes the gate vacuous. Slow BY NATURE (~2.5s standalone) against a
    // real 5000 ms cap -- explicit timeout, see 081KZZ3JHP1087G0R00027ARRR.
  }, 30_000);

  test("DRIFT GATE: a hand-invented reviewer class fails derive", () => {
    const tampered: BuildGraph = {
      ...graph,
      targets: graph.targets.map((t, i) =>
        i === 0 ? { ...t, requiredQuorum: { ...t.requiredQuorum, reviewerClasses: ["reviewer:whoever-is-free"] } } : t,
      ),
    };
    expect(graphsEqual(deriveGraph(REPO_ROOT, tampered), tampered)).toBe(false);
  });

  // Slow BY NATURE: proving determinism REQUIRES deriving twice, so the second walk is the
  // assertion and cannot be optimised away. Measured ~2.6s standalone against a real 5000 ms
  // cap (081KZZ3JHP1087G0R00027ARRR) -- too close to survive a loaded runner, so it carries
  // an explicit timeout at the call site where a reader can see it.
  test("derivation is DETERMINISTIC — same tree, same quorums, every run", () => {
    const a = computeQuorums(REPO_ROOT, graph);
    const b = computeQuorums(REPO_ROOT, graph);
    expect(JSON.stringify([...a.entries()])).toBe(JSON.stringify([...b.entries()]));
  }, 30_000);
});

// The trigger in front of the drift gate: `drift-check` derives nothing unless the
// change touches one of these paths, so a MISS here is silent — the guard stays
// quiet and the author learns about the drift from CI, which is the exact failure
// this trigger exists to remove. Every test below is therefore about the trigger
// being unable to miss, not about it being tidy.
describe("derivation input trigger (drift-check's predicate)", () => {
  const graph = loadGraph(REPO_ROOT);

  test("fires on every path the three 2026-08-14 drift PRs added", () => {
    // Real paths from #10769, #10799, #10808 — the priced, repeating failure this
    // guard was built for. If a rewrite of the rules stops covering these, the
    // guard has silently regressed to covering nothing that has ever happened.
    const historical = [
      "tests/Tests.FSharp/Collation.CrossOracleTreaty.Tests.fs", // #10769
      "tests/Tests.FSharp/Tests.FSharp.fsproj", // #10769
      "tests/cross-verification/lcg32_glibc/_gen/gen.py", // #10799
      "tests/cross-verification/lcg64_mmix/python-output.json", // #10799
      "tests/cross-verification/zeta-id/gen-layout-drift.ts", // #10808
    ];
    expect([...derivationInputsTouched(historical)].sort()).toEqual([...historical].sort());
  });

  test("stays silent on a change that cannot move the graph", () => {
    // The other half of the same claim: a trigger that fires on everything is a
    // full derive on every push, which is the guard that gets deleted.
    expect(
      derivationInputsTouched([
        "docs/research/2026-08-15-some-note.md",
        "memory/feedback_something.md",
        "src/Core/Collation.fs",
        "README.md",
        ".github/workflows/gate.yml",
      ]),
    ).toEqual([]);
  });

  test("COMPLETENESS: every path the checked-in graph cites as evidence is a trigger", () => {
    // Derived from the artifact itself, so it cannot go stale by hand: every
    // witness in build-graph.json is a real tracked file whose presence sets a
    // tier. Add an evidence rule and forget the trigger, and the new rule's
    // witnesses land here and fail — the guard cannot lose coverage quietly.
    const witnesses = [...new Set(graph.targets.flatMap((t) => t.requiredQuorum.evidence.map((e) => e.witness)))];
    expect(witnesses.length).toBeGreaterThan(0);
    const missed = witnesses.filter((w) => derivationInputsTouched([w]).length === 0);
    expect(missed).toEqual([]);
  });

  test("COMPLETENESS: every evidence-rule glob is part of the trigger set", () => {
    // The rules are SPREAD into DERIVATION_INPUT_GLOBS rather than transcribed;
    // this pins that. A second, hand-copied source of truth is how the trigger
    // and the derivation drift apart.
    for (const rule of EVIDENCE_RULES) {
      for (const p of rule.paths) expect(DERIVATION_INPUT_GLOBS).toContain(p);
    }
  });

  test("the manifest classes the deriver actually reads are all triggers", () => {
    const forcing = [
      "src/Core.CSharp/Core.CSharp.csproj", // deriveDotnetTargets + dotnetReviewerClasses
      "tests/Tests.FSharp/Tests.FSharp.fsproj",
      "src/Core.Rust.Merkle/Cargo.toml", // deriveRustTargets
      "src/Core.Lean4/lakefile.toml", // deriveLeanTargets
      "tests/cross-verification/zeta-id/rust-output.json", // oracleOutputReviewerClass
      GRAPH_PATH, // the base rows, `always`, `inert`
      DERIVER_PATH, // the derivation function itself
    ];
    expect([...derivationInputsTouched(forcing)].sort()).toEqual([...forcing].sort());
  });

  test("the fix command names the deriver that actually exists", () => {
    // Requirement 2 of this guard, pinned: the message must name a command a
    // reader can paste. A moved deriver with a stale instruction is worse than
    // no instruction, because it costs the reader a search to find that out.
    expect(DERIVE_FIX_COMMAND).toBe("bun src/Core.TypeScript/ace/build-graph.ts derive --write");
    expect(DERIVE_FIX_COMMAND).toContain(DERIVER_PATH);
    expect(existsSync(join(REPO_ROOT, DERIVER_PATH))).toBe(true);
  });
});
