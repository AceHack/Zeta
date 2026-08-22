// FALSIFIERS for 081M0N90CHX087G0R0034C7NPT — ace could not read the sync-wave
// dependency graph.
//
// Three things are pinned here, and the middle one is the reason the fix is a
// FALLBACK and not a rewrite:
//
//   1. THE CONSTRUCT. `full-ai-cluster/k8s/sync-wave-dependency-graph.yaml` uses
//      folded block scalars (`>-`, 44 of them) and non-empty flow sequences
//      (`dependsOn: [cilium]`, 28). Both are named out-of-subset by the YAML
//      port's operator-locked Decision 2, so the hand-rolled reader declines
//      `UnsupportedConstruct` and ace's `parseYaml` used to throw. These tests
//      fail against the pre-fix code.
//
//   2. THE SUBSET IS STILL THE DEFAULT. In-subset input must still be answered by
//      OUR reader. Without this, "wire the fallback" and "replace the parser with
//      the vendor" are indistinguishable from the outside — and the second would
//      quietly retire the TS oracle of a six-language byte-lock.
//
//   3. AGREEMENT, NOT MERELY SUCCESS. A parse that succeeds and yields a
//      different graph is worse than a clean failure. ace's reading of the file is
//      compared node-for-node and edge-for-edge against the two tools that already
//      route around it. Note this is real evidence and not a tautology: ace's
//      fallback is `Bun.YAML` (a Bun built-in), while `lane-partition.ts` and
//      `derive-sync-waves.ts` use the `yaml` npm package — two independent
//      implementations.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { parse as parseSubset } from "../yaml/dom";
import { parseWithFallback, jsToYamlValue, parseWithVendor } from "../yaml/vendor";
import { loadDependencyGraphFromFile, parseYaml, parseYamlVia } from "./deps";
import { loadGraph, edgeKey } from "../cluster/lane-partition";
import { readDeclaration } from "../cluster/derive-sync-waves";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GRAPH_PATH = "full-ai-cluster/k8s/sync-wave-dependency-graph.yaml";
const GRAPH_ABS = resolve(REPO_ROOT, GRAPH_PATH);

// --------------------------------------------------------------------------
// 1. The construct
// --------------------------------------------------------------------------

describe("081M0N90CHX087G0R0034C7NPT — the out-of-subset constructs the graph uses", () => {
  // A folded block scalar. This is the FIRST decline in the real file (line 94,
  // `      reason: >-`), found by prefix-bisecting the file through the reader.
  const FOLDED = ["spec:", "  reason: >-", "    one two", "    three", ""].join("\n");
  const LITERAL = ["spec:", "  reason: |-", "    one two", "    three", ""].join("\n");
  const FLOW_SEQ = ["spec:", "  dependsOn: [cilium, vault]", ""].join("\n");

  test("the hand-rolled subset reader still DECLINES all three — the subset is not widened", () => {
    for (const text of [FOLDED, LITERAL, FLOW_SEQ]) {
      const res = parseSubset(text);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.feedback).toBe("UnsupportedConstruct");
    }
  });

  test("ace's parseYaml now reads a FOLDED block scalar (fails pre-fix: threw UnsupportedConstruct)", () => {
    const doc = parseYaml(FOLDED) as { spec: { reason: string } };
    expect(doc.spec.reason).toBe("one two three");
  });

  test("ace's parseYaml now reads a LITERAL block scalar", () => {
    const doc = parseYaml(LITERAL) as { spec: { reason: string } };
    expect(doc.spec.reason).toBe("one two\nthree");
  });

  test("ace's parseYaml now reads a NON-EMPTY flow sequence (fails pre-fix)", () => {
    const doc = parseYaml(FLOW_SEQ) as { spec: { dependsOn: string[] } };
    expect(doc.spec.dependsOn).toEqual(["cilium", "vault"]);
  });

  test("both constructs are actually present in the real file, in the counts claimed", () => {
    const lines = readFileSync(GRAPH_ABS, "utf8").split("\n");
    const folded = lines.filter((l) => /:\s*>-?\s*$/.test(l)).length;
    const flowSeq = lines.filter((l) => /:\s*\[[^\]]+\]\s*$/.test(l)).length;
    expect(folded).toBeGreaterThan(0);
    expect(flowSeq).toBeGreaterThan(0);
    // Exact counts as measured 2026-08-22. A change here is a real change to the
    // declaration, not drift — and it should be READ, not silently absorbed.
    expect(folded).toBe(44);
    expect(flowSeq).toBe(28);
  });
});

// --------------------------------------------------------------------------
// 2. The subset is still the default
// --------------------------------------------------------------------------

describe("081M0N90CHX087G0R0034C7NPT — the fallback is a fallback, not a replacement", () => {
  test("in-subset input is answered by OUR reader (via=subset)", () => {
    const inSubset = ["name: zeta", "count: 42", "nested:", "  - a", "  - b", "empty: {}", ""].join("\n");
    const res = parseYamlVia(inSubset);
    expect(res.via).toBe("subset");
    expect(res.value).toEqual({ name: "zeta", count: 42, nested: ["a", "b"], empty: {} });
  });

  test("out-of-subset input is answered by the vendor adapter (via=vendor)", () => {
    const res = parseYamlVia("a: >-\n  folded\n");
    expect(res.via).toBe("vendor");
  });

  test("the real declaration is a VENDOR read — it is out of subset, and that is stated not hidden", () => {
    const res = parseYamlVia(readFileSync(GRAPH_ABS, "utf8"));
    expect(res.via).toBe("vendor");
  });

  // MEASURED 2026-08-22, and the reason the fallback is narrow. `Bun.YAML` accepts
  // a tab in indentation and returns `{a: null, b: 1}`; the `yaml` npm package
  // rejects the same input ("Tabs are not allowed as indentation"), and so does our
  // reader (`TabIndentation`). A blanket "decline => vendor" fallback would have
  // silently traded a correct refusal for a lenient misreading.
  test("a MALFORMED input is still refused — the vendor is not consulted for it", () => {
    const tabbed = "a:\n\tb: 1\n";
    const sub = parseSubset(tabbed);
    expect(sub.ok).toBe(false);
    if (!sub.ok) expect(sub.feedback).toBe("TabIndentation");

    const r = parseWithFallback(tabbed);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.feedback).toBe("TabIndentation");
      expect(r.vendorError).toMatch(/not consulted/);
    }
    expect(() => parseYaml(tabbed)).toThrow(/TabIndentation/);
  });

  test("the vendor's leniency on that input is real — this is what the narrow fallback avoids", () => {
    const lenient = parseWithVendor("a:\n\tb: 1\n");
    expect(lenient.ok).toBe(true);
  });

  // MEASURED 2026-08-22: `Bun.YAML.parse` returns an ARRAY for a multi-document
  // stream, indistinguishable from a single document whose root is a sequence.
  // Converting that to a Seq is a parse that succeeds and is wrong.
  test("a multi-document stream is REFUSED, never flattened into a sequence", () => {
    const stream = "a: 1\n---\nb: 2\n";
    const r = parseWithVendor(stream);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/document marker/);
    expect(() => parseYaml(stream)).toThrow(/document marker/);
  });

  test("the real declaration carries no document marker, so the refusal above does not reach it", () => {
    const lines = readFileSync(GRAPH_ABS, "utf8").split("\n");
    expect(lines.filter((l) => /^(---|\.\.\.)(\s|$)/.test(l)).length).toBe(0);
  });

  test("the vendor adapter refuses a value the port cannot represent, rather than coercing it", () => {
    expect(() => jsToYamlValue(new Date(0))).toThrow(/has no YamlValue form/);
    expect(() => jsToYamlValue(Number.NaN)).toThrow(/non-finite/);
  });

  test("parseWithFallback reports subset for in-subset and does not consult the vendor", () => {
    const r = parseWithFallback("a: 1\n");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBe("subset");
  });

  test("the vendor adapter alone reads the real file", () => {
    const r = parseWithVendor(readFileSync(GRAPH_ABS, "utf8"));
    expect(r.ok).toBe(true);
  });
});

// --------------------------------------------------------------------------
// 3. Three-way agreement
// --------------------------------------------------------------------------

interface FlatGraph {
  nodes: string[];
  edges: string[];
}

function flattenFromNodes(
  declared: ReadonlyArray<{ chart?: string; dependsOn?: readonly string[] }>,
): FlatGraph {
  const nodes = declared.map((n) => n.chart ?? "").filter((n) => n !== "");
  const edges: string[] = [];
  for (const n of declared) {
    for (const to of n.dependsOn ?? []) edges.push(edgeKey(n.chart ?? "", to));
  }
  return { nodes: [...nodes].sort(), edges: [...edges].sort() };
}

describe("081M0N90CHX087G0R0034C7NPT — ace agrees with the two tools that routed around it", () => {
  test("ace loads the declaration at all (fails pre-fix: YAML parse failed: UnsupportedConstruct)", () => {
    const graph = loadDependencyGraphFromFile(GRAPH_ABS);
    expect(graph.kind).toBe("AppDependencyGraph");
    expect(graph.spec.dependsOn.length).toBe(47);
  });

  test("ace, the yaml package, lane-partition and derive-sync-waves read the SAME nodes and edges", () => {
    const viaAce = flattenFromNodes(loadDependencyGraphFromFile(GRAPH_ABS).spec.dependsOn);

    const vendorDoc = parseAllDocuments(readFileSync(GRAPH_ABS, "utf8"))[0];
    expect(vendorDoc).toBeDefined();
    const vendorJs = vendorDoc!.toJS({ maxAliasCount: -1 }) as {
      spec: { dependsOn: Array<{ chart?: string; dependsOn?: string[] }> };
    };
    const viaYamlPkg = flattenFromNodes(vendorJs.spec.dependsOn);

    const lane = loadGraph(REPO_ROOT);
    const viaLane: FlatGraph = {
      nodes: [...lane.nodes].sort(),
      edges: lane.edges.map((e) => edgeKey(e.from, e.to)).sort(),
    };

    const viaDerive = flattenFromNodes(readDeclaration(REPO_ROOT).spec.spec.dependsOn);

    expect(viaAce.nodes.length).toBe(47);
    expect(viaAce.edges.length).toBeGreaterThan(0);

    expect(viaAce).toEqual(viaYamlPkg);
    expect(viaAce).toEqual(viaLane);
    expect(viaAce).toEqual(viaDerive);
  });

  test("ace's whole parsed document is deep-equal to the yaml package's", () => {
    const text = readFileSync(GRAPH_ABS, "utf8");
    const mine: unknown = parseYaml(text);
    const theirs: unknown = parseAllDocuments(text)[0]!.toJS({ maxAliasCount: -1 });
    expect(mine).toEqual(theirs as never);
  });
});
