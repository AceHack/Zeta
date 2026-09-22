// audit-argocd-pin-parity.test.ts — the falsifiers for the five-site ArgoCD pin check.
//
// The check exists because PROSE did not hold the roster together: four files carry a
// paragraph saying "All FOUR pin sites move together", and there were five. So these
// cases are weighted toward the two ways a parity check goes quietly useless — parsing
// the wrong thing, and auditing fewer sites than exist.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  APPLICATION_HEALTH_LUA_KEY,
  APPLICATION_PIN_FILE,
  checkPins,
  DEV_CLUSTER_PIN_FILE,
  EXPECTED_DEV_CLUSTER_PINS,
  HELMCHART_PIN_FILES,
  parseApplicationHealthLua,
  parseApplicationTargetRevision,
  parseDevClusterPins,
  parseHelmChartHealthLua,
  parseHelmChartVersion,
} from "./audit-argocd-pin-parity.ts";

/** A well-formed, non-empty lua body -- content does not matter to the parity check, only equality. */
const VALID_LUA = 'hs = {}\nhs.status = "Healthy"\nreturn hs';

// Fixtures default to a VALID, AGREEING lua on every site so the pre-existing
// version-parity cases (which say nothing about the lua) do not spuriously
// fail the new health-lua check. `lua: null` opts a fixture OUT of the key
// entirely, for the tests that exercise a missing key.
const HELM_CHART = (version: string, lua: string | null = VALID_LUA): string => `apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: argocd
  namespace: kube-system
spec:
  chart: argo-cd
  repo: https://argoproj.github.io/argo-helm
  version: ${version}
  targetNamespace: argocd
  valuesContent: |-
    configs:
      params:
        server.insecure: true${
          lua === null
            ? ""
            : `
      cm:
        ${APPLICATION_HEALTH_LUA_KEY}: |
          ${lua.split("\n").join("\n          ")}`
        }
`;

const APPLICATION = (version: string, lua: string | null = VALID_LUA): string => `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argocd
spec:
  source:
    repoURL: https://argoproj.github.io/argo-helm
    chart: argo-cd
    targetRevision: ${version}
    helm:
      valuesObject:
        configs:
          params:
            server.insecure: true${
              lua === null
                ? ""
                : `
          cm:
            ${APPLICATION_HEALTH_LUA_KEY}: |
              ${lua.split("\n").join("\n              ")}`
            }
`;

const DEV_CLUSTER = (...versions: readonly string[]): string =>
  versions
    .map(
      (version) => `    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      // a comment where the incident write-up lives
      version: "${version}",
      namespace: "argocd",
    });
`,
    )
    .join("\n");

// The two HelmChart sites, bound once. They are DERIVED from the tree roster now, so indexing
// yields `string | undefined`; binding here with a runtime check keeps the fixtures typed AND
// makes the suite's own assumption explicit — it is written for exactly two declared trees, and
// will say so rather than silently testing one when that changes.
const [HELM_A, HELM_B] = HELMCHART_PIN_FILES;
if (HELM_A === undefined || HELM_B === undefined) {
  throw new Error(
    `this suite assumes two HelmChart pin sites; the roster declares ${HELMCHART_PIN_FILES.length}`,
  );
}

const helmTexts = (a: string, b: string): Record<string, string> => ({
  [HELM_A]: HELM_CHART(a),
  [HELM_B]: HELM_CHART(b),
});

describe("argocd-pin-parity", () => {
  test("control: five agreeing sites pass, and say how many they checked", () => {
    const findings = checkPins(helmTexts("10.8.0", "10.8.0"), APPLICATION("10.8.0"), DEV_CLUSTER("10.8.0", "10.8.0"));
    expect(findings.every((finding) => finding.ok)).toBe(true);
    // The COUNT is asserted, not just the pass. A check that silently audited two sites
    // and said "all agree" is exactly the shape that let the fifth site drift.
    expect(findings[0]?.message).toContain("all 5");
  });

  test("RED when the infra bootstrap lags — the real 2026-09-06 finding", () => {
    const findings = checkPins(helmTexts("10.8.0", "7.7.10"), APPLICATION("10.8.0"), DEV_CLUSTER("10.8.0", "10.8.0"));
    const failures = findings.filter((finding) => !finding.ok);
    expect(failures.length).toBeGreaterThan(0);
    const message = failures.map((finding) => finding.message).join("\n");
    expect(message).toContain("DISAGREE");
    expect(message).toContain("7.7.10");
    // NAMES THE SITE. A parity failure that says "they disagree" without saying which
    // file is behind sends the reader to five files to find out.
    expect(message).toContain(HELM_B);
  });

  test("RED when either dev-cluster site lags — both are checked, not just the first", () => {
    for (const versions of [
      ["7.7.10", "10.8.0"],
      ["10.8.0", "7.7.10"],
    ] as const) {
      const findings = checkPins(
        helmTexts("10.8.0", "10.8.0"),
        APPLICATION("10.8.0"),
        DEV_CLUSTER(versions[0], versions[1]),
      );
      expect(findings.some((finding) => !finding.ok && finding.message.includes("DISAGREE"))).toBe(true);
    }
  });

  test("RED when the Application itself lags behind its bootstraps", () => {
    const findings = checkPins(helmTexts("10.8.0", "10.8.0"), APPLICATION("7.7.10"), DEV_CLUSTER("10.8.0", "10.8.0"));
    const message = findings
      .filter((finding) => !finding.ok)
      .map((finding) => finding.message)
      .join("\n");
    expect(message).toContain("DISAGREE");
    expect(message).toContain(APPLICATION_PIN_FILE);
  });

  test("REFUSES when the dev-cluster roster changes, instead of auditing whatever it found", () => {
    // THE IMPORTANT ONE. The roster is what drifted -- twice. A check that audits the
    // sites it happens to see would pass a tree where a third install site was added at
    // a different version, which is the defect wearing a green tick.
    const three = checkPins(
      helmTexts("10.8.0", "10.8.0"),
      APPLICATION("10.8.0"),
      DEV_CLUSTER("10.8.0", "10.8.0", "10.8.0"),
    );
    const message = three
      .filter((finding) => !finding.ok)
      .map((finding) => finding.message)
      .join("\n");
    expect(message).toContain(`expected ${String(EXPECTED_DEV_CLUSTER_PINS)}`);
    expect(message).toContain("found 3");

    const none = checkPins(helmTexts("10.8.0", "10.8.0"), APPLICATION("10.8.0"), "// no installs here");
    expect(none.some((finding) => !finding.ok && finding.message.includes("found 0"))).toBe(true);
  });

  test("the dev-cluster scan is anchored on the chart name, not on any `version:` line", () => {
    // The file installs several charts. A bare `version:` scan would return cilium's pin
    // and compare it to ArgoCD's, which fails LOUDLY on a correct tree -- the worst kind
    // of check, because it gets deleted rather than fixed.
    const mixed = `    packages.install({
      release: "cilium",
      chart: "cilium/cilium",
      version: "1.20.1",
      namespace: "kube-system",
    });

    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      version: "10.8.0",
      namespace: "argocd",
    });
`;
    expect(parseDevClusterPins(mixed)).toEqual(["10.8.0"]);
  });

  test("a missing or non-string pin is reported, never treated as agreement", () => {
    const noVersion = `apiVersion: helm.cattle.io/v1
kind: HelmChart
spec:
  chart: argo-cd
`;
    expect(parseHelmChartVersion(noVersion)).toBeNull();
    expect(parseApplicationTargetRevision("spec:\n  source:\n    chart: argo-cd\n")).toBeNull();

    const findings = checkPins(
      { [HELM_A]: HELM_CHART("10.8.0"), [HELM_B]: noVersion },
      APPLICATION("10.8.0"),
      DEV_CLUSTER("10.8.0", "10.8.0"),
    );
    expect(findings.some((finding) => !finding.ok && finding.message.includes("cannot check parity"))).toBe(true);
    // And it must NOT also claim the survivors agree -- a partial audit reporting success
    // is how a broken parser reads as a green tree.
    expect(findings.some((finding) => finding.ok)).toBe(false);
  });

  test("RED when a HelmChart site has no health-check lua at all", () => {
    const findings = checkPins(
      { [HELM_A]: HELM_CHART("10.8.0"), [HELM_B]: HELM_CHART("10.8.0", null) },
      APPLICATION("10.8.0"),
      DEV_CLUSTER("10.8.0", "10.8.0"),
    );
    const message = findings
      .filter((finding) => !finding.ok)
      .map((finding) => finding.message)
      .join("\n");
    expect(message).toContain(APPLICATION_HEALTH_LUA_KEY);
    expect(message).toContain(HELM_B);
  });

  test("RED when the Application has no health-check lua", () => {
    const findings = checkPins(helmTexts("10.8.0", "10.8.0"), APPLICATION("10.8.0", null), DEV_CLUSTER("10.8.0", "10.8.0"));
    const message = findings
      .filter((finding) => !finding.ok)
      .map((finding) => finding.message)
      .join("\n");
    expect(message).toContain(APPLICATION_PIN_FILE);
    expect(message).toContain(APPLICATION_HEALTH_LUA_KEY);
  });

  test("RED when the lua CONTENT disagrees across sites, even though all three are present", () => {
    const findings = checkPins(
      { [HELM_A]: HELM_CHART("10.8.0", VALID_LUA), [HELM_B]: HELM_CHART("10.8.0", "hs = {}\nreturn hs") },
      APPLICATION("10.8.0", VALID_LUA),
      DEV_CLUSTER("10.8.0", "10.8.0"),
    );
    const message = findings
      .filter((finding) => !finding.ok)
      .map((finding) => finding.message)
      .join("\n");
    expect(message).toContain("DISAGREES");
  });

  test("parseHelmChartHealthLua reads the nested valuesContent document, not the outer one", () => {
    // YAML's `|` block scalar keeps a trailing newline; trimmed for comparison
    // since the parity check only needs the two sides to agree with EACH
    // OTHER, which a shared trailing newline does not disturb.
    expect(parseHelmChartHealthLua(HELM_CHART("10.8.0", VALID_LUA))?.trim()).toBe(VALID_LUA);
    expect(parseHelmChartHealthLua(HELM_CHART("10.8.0", null))).toBeNull();
    // valuesContent absent entirely
    expect(
      parseHelmChartHealthLua("apiVersion: helm.cattle.io/v1\nkind: HelmChart\nspec:\n  chart: argo-cd\n"),
    ).toBeNull();
  });

  test("parseApplicationHealthLua reads valuesObject directly, no nested parse", () => {
    expect(parseApplicationHealthLua(APPLICATION("10.8.0", VALID_LUA))?.trim()).toBe(VALID_LUA);
    expect(parseApplicationHealthLua(APPLICATION("10.8.0", null))).toBeNull();
  });

  test("THE REAL TREE agrees, and the parser reaches all five files on disk", () => {
    // Guards the paths themselves. Every case above is fixture-driven, so a renamed or
    // moved file would leave them all green while the audit read nothing.
    const root = process.cwd();
    const helm: Record<string, string> = {};
    for (const site of HELMCHART_PIN_FILES) helm[site] = readFileSync(join(root, site), "utf8");
    const findings = checkPins(
      helm,
      readFileSync(join(root, APPLICATION_PIN_FILE), "utf8"),
      readFileSync(join(root, DEV_CLUSTER_PIN_FILE), "utf8"),
    );
    expect(findings.filter((finding) => !finding.ok)).toEqual([]);
    expect(findings[0]?.message).toContain("all 5");
  });
});
