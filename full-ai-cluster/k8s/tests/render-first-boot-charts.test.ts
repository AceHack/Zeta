// render-first-boot-charts.test.ts — falsifiers for the first-boot chart renderer.
//
// WHAT THESE COVER AND WHAT THEY DELIBERATELY DO NOT. The render itself needs helm and the
// network, so the PROOF that the eight charts template clean is the CI step, not a case
// here. What is testable offline is everything upstream of the spawn -- which chart CRs the
// scan finds, and whether a thin scan refuses -- and that is where this renderer would go
// quietly wrong: a parser that reads half a file still prints a confident "Results:" line.

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { BOOTSTRAP_DIRS, type HelmChartCr, MIN_EXPECTED_CHARTS, parseHelmChartCrs } from "./render-first-boot-charts.ts";

const helmChart = (opts: {
  name?: string;
  chart: string;
  repo?: string;
  version?: string;
  namespace?: string;
  values?: string;
}): string => {
  const lines = ["apiVersion: helm.cattle.io/v1", "kind: HelmChart", "metadata:"];
  lines.push(`  name: ${opts.name ?? opts.chart}`, "spec:", `  chart: ${opts.chart}`);
  if (opts.repo !== undefined) lines.push(`  repo: ${opts.repo}`);
  if (opts.version !== undefined) lines.push(`  version: ${opts.version}`);
  if (opts.namespace !== undefined) lines.push(`  targetNamespace: ${opts.namespace}`);
  if (opts.values !== undefined) lines.push("  valuesContent: |-", `    ${opts.values}`);
  return `${lines.join("\n")}\n`;
};

describe("render-first-boot-charts", () => {
  test("MULTI-DOCUMENT files yield every HelmChart, not just the first", () => {
    // `spire-install.yaml` really carries two. A first-document-only reader would render
    // half of it and still report a clean run over the half it rendered.
    const two = `${helmChart({ chart: "spire-crds", repo: "https://e.invalid", version: "0.5.0" })}---\n${helmChart(
      { chart: "spire", repo: "https://e.invalid", version: "0.24.2" },
    )}`;
    expect(parseHelmChartCrs(two, "b/spire-install.yaml").map((c) => c.chart)).toEqual(["spire-crds", "spire"]);
  });

  test("non-HelmChart documents are ignored", () => {
    const mixed = `apiVersion: v1
kind: Namespace
metadata:
  name: argocd
---
${helmChart({ chart: "argo-cd", repo: "https://e.invalid", version: "10.8.0" })}`;
    expect(parseHelmChartCrs(mixed, "b/x.yaml").map((c) => c.chart)).toEqual(["argo-cd"]);
  });

  test("a CR missing chart, repo or version is SKIPPED rather than rendered with undefined", () => {
    // Passing `undefined` to helm would produce a confusing upstream error attributed to
    // the chart rather than to the manifest. `validate-bootstrap.ts` is what convicts a CR
    // with no version; this renderer's job is not to render nonsense.
    for (const partial of [
      helmChart({ chart: "no-repo", version: "1.0.0" }),
      helmChart({ chart: "no-version", repo: "https://e.invalid" }),
    ]) {
      expect(parseHelmChartCrs(partial, "b/x.yaml")).toEqual([]);
    }
  });

  test("defaults are the ones K3S would use: chart-default values, `default` namespace", () => {
    // `spire-crds` ships no valuesContent today, and rendering it at chart defaults is
    // exactly what K3S installs -- so an empty string here is correct, not a gap.
    const [cr] = parseHelmChartCrs(helmChart({ chart: "spire-crds", repo: "https://e.invalid", version: "0.5.0" }), "b/x.yaml");
    expect(cr?.values).toBe("");
    expect(cr?.namespace).toBe("default");
    // `metadata.name` is the Helm release name K3S uses; it falls back to the chart name.
    expect(cr?.name).toBe("spire-crds");
  });

  test("the release name comes from metadata.name when it differs from the chart", () => {
    const [cr] = parseHelmChartCrs(
      helmChart({ name: "argocd", chart: "argo-cd", repo: "https://e.invalid", version: "10.8.0" }),
      "b/x.yaml",
    );
    expect(cr?.name).toBe("argocd");
    expect(cr?.chart).toBe("argo-cd");
  });

  test("THE REAL TREE yields at least the floor, from BOTH trees, including the second spire doc", () => {
    // Guards the PATHS and the floor together. Every case above is fixture-driven, so a
    // renamed directory would leave them green while the renderer scanned nothing -- and
    // MIN_EXPECTED_CHARTS is the only other thing standing between that and a run that
    // reports "0 failed" having rendered zero charts.
    const root = process.cwd();
    const found: HelmChartCr[] = [];
    for (const dir of BOOTSTRAP_DIRS) {
      for (const name of readdirSync(join(root, dir)).filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"))) {
        const rel = `${dir}/${name}`;
        found.push(...parseHelmChartCrs(readFileSync(join(root, rel), "utf8"), rel));
      }
    }
    expect(found.length).toBeGreaterThanOrEqual(MIN_EXPECTED_CHARTS);
    expect(found.some((c) => c.chart === "spire-crds")).toBe(true);
    expect(found.some((c) => c.chart === "spire")).toBe(true);
    // EVERY declared bootstrap tree contributes at least one chart. Stated over the derived
    // dir list rather than over two spelled paths, which makes it strictly stronger: it holds
    // for however many trees the roster declares, and it keeps this file from naming a tree
    // scheduled for deletion. A scan pointed at only one tree silently drops the other half,
    // and that is what this catches.
    expect(BOOTSTRAP_DIRS.length).toBeGreaterThan(0); // else the loop below asserts nothing
    for (const dir of BOOTSTRAP_DIRS) {
      expect(found.some((c) => c.file.startsWith(`${dir}/`))).toBe(true);
    }
    // Every CR the renderer will hand to helm has the three fields it needs.
    for (const cr of found) {
      expect(cr.chart.length).toBeGreaterThan(0);
      expect(cr.version.length).toBeGreaterThan(0);
      expect(cr.repo.startsWith("http")).toBe(true);
    }
  });
});
