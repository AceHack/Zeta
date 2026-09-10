import { describe, expect, test } from "bun:test";
import {
  RULES,
  classify,
  compose,
  unclassifiedFraction,
  observabilityPerGenerator,
  descriptionLength,
  MAX_UNCLASSIFIED_FRACTION,
  type TreeEntry,
} from "./measure-triangle-corners.ts";

// The classification table IS the measurement, so these tests pin the calls that are
// arguable rather than the ones that are obvious. If a row below is changed, the number this
// tool reports changes, and that is the intended way to disagree with it.
describe("classification — the arguable calls, pinned", () => {
  test("a test file is a GENERATOR; the baseline it compares against is OBSERVABILITY", () => {
    expect(classify("src/Core.TypeScript/hygiene/audit-x.test.ts").corner).toBe("generator");
    expect(classify("src/Core.TypeScript/hygiene/audit-x.baseline.json").corner).toBe("observability");
  });

  test("golden vectors are observability even though they live beside code", () => {
    expect(classify("tests/cross-verification/golden-vectors-cbor.json").corner).toBe("observability");
    expect(classify("src/wasm-dla/bytelock/testdata/golden-seed-1.json").corner).toBe("observability");
  });

  test("prose is its own corner, never folded into observability", () => {
    expect(classify("docs/research/2026-09-06-anything.md").corner).toBe("prose");
    expect(classify("references/prior-art/some-paper.pdf").corner).toBe("prose");
  });

  test("wiring outranks the residual-JSON sweep", () => {
    expect(classify("src/Core.TypeScript/ci/cross-verify-roster.json").corner).toBe("joins");
    expect(classify("infra/legacy/apps/thing.yaml").corner).toBe("joins");
    expect(classify("package-lock.json").corner).toBe("joins");
  });

  test("vendored binaries and presentation assets are EXCLUDED, not parked in a corner", () => {
    expect(classify("tools/vendor/thing.jar").corner).toBe("excluded");
    expect(classify("docs/design/root-site-iris/style.css").corner).toBe("excluded");
  });
});

describe("first-match-wins is load-bearing, not incidental", () => {
  test("every rule is reachable — no row is shadowed into irrelevance by an earlier one", () => {
    // A rule that can never match is a line of documentation pretending to be a rule. This
    // finds them by construction rather than by review: for each row, a path that the row
    // matches must classify to that row's corner.
    const probes: Record<string, string> = {};
    for (const r of RULES) probes[r.pattern.source] = r.corner;
    const unreachable: string[] = [];
    for (const r of RULES) {
      const sample = sampleFor(r.pattern);
      if (sample === null) continue; // no synthesised sample; covered by the explicit tests above
      if (classify(sample).corner !== r.corner) unreachable.push(`${r.pattern.source} (probe '${sample}' → ${classify(sample).corner})`);
    }
    expect(unreachable).toEqual([]);
  });
});

/** Build a path that the given pattern matches, for the shapes used in RULES. */
function sampleFor(p: RegExp): string | null {
  const s = p.source;
  if (s === "(^|\\/)testdata\\/") return "a/testdata/x.bin";
  if (s === "(^|\\/)__snapshots__\\/") return "a/__snapshots__/x";
  if (s === "\\.snap$") return "a/x.snap";
  if (s === "golden-?vectors?[^/]*\\.json$") return "a/golden-vectors-x.json";
  if (s === "golden-seed[^/]*\\.json$") return "a/golden-seed-1.json";
  if (s === "\\.baseline\\.json$") return "a/x.baseline.json";
  if (s === "BASELINE[^/]*\\.md$") return "a/BASELINE-x.md";
  if (s === "^db\\/") return "db/x.json";
  if (s === "^workitems\\/events\\/") return "workitems/events/2026/x.json";
  if (s === "^docs\\/history\\/") return "docs/history/x.md";
  if (s === "^docs\\/recovered") return "docs/recovered/x.md";
  if (s === "^docs\\/github\\/") return "docs/github/x.json";
  if (s === "^docs\\/observe-events\\/") return "docs/observe-events/x.json";
  if (s === "^docs\\/hygiene-history\\/") return "docs/hygiene-history/x.json";
  if (s === "^data\\/") return "data/x.json";
  if (s === "^memory\\/") return "memory/x.json";
  if (s === "\\.(jsonl|csv|tsv|dot)$") return "a/x.jsonl";
  if (s === "^\\.github\\/workflows\\/") return ".github/workflows/x.yml";
  if (s === "[^/]*roster[^/]*\\.json$") return "a/roster.json";
  if (s === "[^/]*consumers[^/]*\\.json$") return "a/consumers.json";
  if (s === "(^|\\/)(package|bun|cargo|paket)\\.(json|lock|toml)$") return "a/package.json";
  if (s === "\\.(sln|fsproj|csproj|props|targets)$") return "a/x.fsproj";
  if (s === "^infra\\/.*\\.(ya?ml|json)$") return "infra/legacy/x.yaml";
  if (s === "^full-ai-cluster\\/.*\\.(ya?ml|json)$") return "full-ai-cluster/x.yaml";
  if (s === "^flake\\.(nix|lock)$") return "flake.lock";
  if (s === "\\.(lock|lockb)$") return "a/bun.lockb";
  if (s === "\\.ya?ml$") return "a/x.yaml";
  if (s === "^gen\\/") return "gen/x.bin";
  return null;
}

describe("refusal — a tree the rules do not cover is not measured", () => {
  test("the ceiling fires on an uncovered tree, and the mechanism is exercised by a planted control", () => {
    // Keyed to the MECHANISM, not to a defect existing: the covered tree must pass and the
    // uncovered one must trip, so the assertion cannot go green by the ceiling never applying.
    const covered: TreeEntry[] = [
      { path: "src/a.ts", bytes: 1000 },
      { path: "data/b.json", bytes: 1000 },
    ];
    expect(unclassifiedFraction(compose(covered))).toBe(0);
    expect(unclassifiedFraction(compose(covered))).toBeLessThanOrEqual(MAX_UNCLASSIFIED_FRACTION);

    const uncovered: TreeEntry[] = [
      { path: "src/a.ts", bytes: 100 },
      { path: "weird/thing.qqq", bytes: 900 },
    ];
    expect(unclassifiedFraction(compose(uncovered))).toBeGreaterThan(MAX_UNCLASSIFIED_FRACTION);
  });

  test("excluded bytes are outside the denominator — they cannot dilute the coverage check", () => {
    const withExcluded: TreeEntry[] = [
      { path: "src/a.ts", bytes: 100 },
      { path: "weird/thing.qqq", bytes: 900 },
      { path: "vendor/big.jar", bytes: 10_000_000 },
    ];
    // Without the exclusion the fraction would be ~0.00009 and the refusal would never fire.
    expect(unclassifiedFraction(compose(withExcluded))).toBeGreaterThan(MAX_UNCLASSIFIED_FRACTION);
  });
});

describe("the reported numbers", () => {
  test("an undefined ratio is reported as undefined, never as zero", () => {
    expect(observabilityPerGenerator(compose([{ path: "data/x.json", bytes: 10 }]))).toBeNull();
  });

  test("ratio is observability per generator byte", () => {
    const c = compose([
      { path: "src/a.ts", bytes: 100 },
      { path: "data/b.json", bytes: 350 },
    ]);
    expect(observabilityPerGenerator(c)).toBeCloseTo(3.5, 6);
  });

  test("description length is generator + observability, and prose/excluded are not in it", () => {
    const c = compose([
      { path: "src/a.ts", bytes: 100 },
      { path: "data/b.json", bytes: 350 },
      { path: "docs/c.md", bytes: 9_999 },
      { path: "vendor/d.jar", bytes: 9_999 },
    ]);
    expect(descriptionLength(c)).toBe(450);
  });
});
