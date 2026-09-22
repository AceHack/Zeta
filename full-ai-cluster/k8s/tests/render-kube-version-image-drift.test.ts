// render-kube-version-image-drift.test.ts — falsifiers for the offline half of the
// KubeVersion-derived-image checker.
//
// The render itself needs helm and the network (proved live in helm-validate.yml, and by
// hand against the pre-fix spire-install.yaml: DRIFTED at kube-version 1.35.6 vs 1.35.7,
// showing exactly `docker.io/rancher/kubectl:v1.35.6` vs `...v1.35.7`, and clean again once
// the pin landed). What is testable offline is everything upstream of the spawn: the patch
// bump, the image-collection walk, and the Application.yaml Helm-source parse — the same
// places `render-first-boot-charts.test.ts` tests for its own renderer, for the same reason.

import { describe, expect, test } from "bun:test";
import { bumpPatch, collectImages, parseApplicationTarget } from "./render-kube-version-image-drift.ts";

describe("bumpPatch", () => {
  test("increments the patch component only", () => {
    expect(bumpPatch("1.35.6")).toBe("1.35.7");
    expect(bumpPatch("1.35.9")).toBe("1.35.10");
    expect(bumpPatch("0.0.0")).toBe("0.0.1");
  });

  test("refuses a non-X.Y.Z version rather than silently returning it unchanged", () => {
    // A version like "1.35" or "v1.35.6" passed through unbumped would make the two
    // renders identical by construction, which would make the drift check pass VACUOUSLY
    // — the exact failure mode this checker exists to avoid.
    expect(() => bumpPatch("1.35")).toThrow();
    expect(() => bumpPatch("v1.35.6")).toThrow();
    expect(() => bumpPatch("1.35.6+k3s1")).toThrow();
  });
});

describe("collectImages", () => {
  test("collects every string bound to a key literally named `image`, at any depth", () => {
    const doc = {
      kind: "Job",
      spec: {
        template: {
          spec: {
            initContainers: [{ name: "busybox", image: "busybox:1.36" }],
            containers: [
              { name: "kubectl", image: "docker.io/rancher/kubectl:v1.35.6" },
              { name: "app", image: "ghcr.io/spiffe/spire-server:1.11.2" },
            ],
          },
        },
      },
    };
    const images = collectImages(doc);
    expect([...images].sort()).toEqual([
      "busybox:1.36",
      "docker.io/rancher/kubectl:v1.35.6",
      "ghcr.io/spiffe/spire-server:1.11.2",
    ]);
  });

  test("a key named `image` whose value is NOT a string is ignored, not stringified", () => {
    // `image: {}` or `image: null` is not a container reference; collecting it would
    // manufacture a phantom drift when unrelated structure changes between renders.
    const images = collectImages({ image: { repository: "x", tag: "y" }, other: { image: null } });
    expect(images.size).toBe(0);
  });

  test("null and primitive documents do not throw", () => {
    expect(collectImages(null).size).toBe(0);
    expect(collectImages("scalar").size).toBe(0);
    expect(collectImages(42).size).toBe(0);
  });
});

describe("parseApplicationTarget", () => {
  const helmApp = (extra = ""): string => `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: spire
spec:
  source:
    repoURL: https://spiffe.github.io/helm-charts-hardened/
    chart: spire
    targetRevision: 0.24.2
    helm:
      valuesObject:
        spire-server:
          tools:
            kubectl:
              image:
                tag: v1.35.6
${extra}
  destination:
    namespace: spire
`;

  test("extracts chart, repo, version, namespace and valuesObject from a Helm source", () => {
    const target = parseApplicationTarget(helmApp(), "k8s/applications/spire/Application.yaml");
    expect(target?.chart).toBe("spire");
    expect(target?.repoURL).toBe("https://spiffe.github.io/helm-charts-hardened/");
    expect(target?.version).toBe("0.24.2");
    expect(target?.namespace).toBe("spire");
    expect(target?.valuesObject).toMatchObject({
      "spire-server": { tools: { kubectl: { image: { tag: "v1.35.6" } } } },
    });
  });

  test("a directory-source Application (no spec.source.chart) is null, not a chart with undefined fields", () => {
    const dirApp = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform
spec:
  source:
    repoURL: https://github.com/example/repo
    path: some/path
  destination:
    namespace: platform
`;
    expect(parseApplicationTarget(dirApp, "k8s/applications/platform/Application.yaml")).toBeNull();
  });

  test("a non-Application document is null", () => {
    expect(parseApplicationTarget("apiVersion: v1\nkind: Namespace\nmetadata:\n  name: x\n", "x.yaml")).toBeNull();
  });
});
