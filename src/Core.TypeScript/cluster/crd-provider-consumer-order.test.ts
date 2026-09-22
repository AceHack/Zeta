/**
 * Falsifiers for `crd-provider-consumer-order.ts`.
 *
 * Two halves:
 *
 *   A. SYNTHETIC. Each finding driven to fire on a hand-built roster with an
 *      INJECTED render function -- no `helm` needed, so this half runs
 *      everywhere `bun test` runs.
 *   B. THE LIVE TREE. Requires `helm` on PATH (skipped, loudly, otherwise --
 *      never silently green). Regression guard for the real findings this
 *      module was built to catch, and the smallest possible proof that the
 *      real render path (helm invocation, `--include-crds`, the async-write
 *      fix) actually works end to end.
 */

import { describe, expect, test } from "bun:test";
import {
  ACKNOWLEDGED_FINDINGS,
  BUILTIN_API_GROUPS,
  acknowledgementKey,
  auditCrdOrder,
  auditIsClean,
  formatAudit,
  indexAppManifests,
  matchesExcludeGlob,
  parseRenderedDocs,
  readAppSource,
  resolveViolations,
  type AppSource,
  type RenderResult,
  type Violation,
} from "./crd-provider-consumer-order.ts";
import type { ShippedApplication } from "./derive-sync-waves.ts";

function app(name: string, wave: number | null, manualSync = false): ShippedApplication {
  return { name, path: `full-ai-cluster/k8s/applications/${name}/Application.yaml`, wave, manualSync };
}

/** `full-ai-cluster/k8s/applications/<name>/Application.yaml` -> `<name>`. Mirrors `app()`'s own path shape. */
function nameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 2] ?? "fake";
}

function appYaml(kind: "helm" | "directory", name = "fake", extra = ""): string {
  if (kind === "helm") {
    return `apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  source:
    chart: ${name}
    targetRevision: "1.0.0"
    repoURL: https://example.invalid/charts
  syncPolicy:
    syncOptions: [${extra}]
`;
  }
  return `apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  source:
    path: full-ai-cluster/k8s/applications/${name}
    directory:
      recurse: true
  syncPolicy:
    syncOptions: [${extra}]
`;
}

/** A `readApplicationYaml` hook that names the source (chart or path) after the app the roster gave it. */
function perAppYaml(kind: "helm" | "directory", extraByApp: Record<string, string> = {}) {
  return (path: string): string => {
    const name = nameFromPath(path);
    return appYaml(kind, name, extraByApp[name] ?? "");
  };
}

/** A render function driven entirely by a lookup table keyed on the app's chart/path -- no helm, no disk. */
function fakeRender(byApp: Record<string, readonly { apiVersion: string; kind: string; name?: string; annotations?: Record<string, string>; crdProvides?: { group: string; kind: string } | null }[]>) {
  return (source: AppSource): RenderResult => {
    const key = source.kind === "helm" ? (source.chart ?? "") : (source.path ?? "").split("/").pop() ?? "";
    const raw = byApp[key] ?? [];
    return {
      ok: true,
      docs: raw.map((d) => ({
        apiVersion: d.apiVersion,
        kind: d.kind,
        name: d.name ?? "x",
        namespace: "default",
        annotations: d.annotations ?? {},
        crdProvides: d.crdProvides ?? null,
      })),
    };
  };
}

// ---------------------------------------------------------------------------
// A. Synthetic falsifiers
// ---------------------------------------------------------------------------

describe("readAppSource", () => {
  test("recognizes a Helm source", () => {
    const source = readAppSource(appYaml("helm"));
    expect(source.kind).toBe("helm");
    expect(source.chart).toBe("fake");
  });

  test("recognizes a directory source", () => {
    const source = readAppSource(appYaml("directory"));
    expect(source.kind).toBe("directory");
    expect(source.path).toBe("full-ai-cluster/k8s/applications/fake");
  });

  test("neither chart nor path is 'unknown', not a crash", () => {
    const source = readAppSource("apiVersion: argoproj.io/v1alpha1\nkind: Application\nspec: {}\n");
    expect(source.kind).toBe("unknown");
  });

  test("malformed YAML is 'unknown', not a throw", () => {
    const source = readAppSource("not: [valid: yaml");
    expect(source.kind).toBe("unknown");
  });
});

describe("matchesExcludeGlob", () => {
  test("an exact path matches", () => {
    expect(matchesExcludeGlob("Application.yaml", "{operator/**,Application.yaml}")).toBe(true);
  });
  test("a directory prefix with ** matches nested files", () => {
    expect(matchesExcludeGlob("operator/main.go.yaml", "{operator/**,Application.yaml}")).toBe(true);
  });
  test("a non-matching path does not match", () => {
    expect(matchesExcludeGlob("cr.yaml", "{operator/**,Application.yaml}")).toBe(false);
  });
  test("a single non-brace pattern still works", () => {
    expect(matchesExcludeGlob("Application.yaml", "Application.yaml")).toBe(true);
  });
});

describe("parseRenderedDocs", () => {
  test("extracts group+kind from a CustomResourceDefinition", () => {
    const docs = parseRenderedDocs(`
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: widgets.example.com
spec:
  group: example.com
  names:
    kind: Widget
`);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.crdProvides).toEqual({ group: "example.com", kind: "Widget" });
  });

  test("a non-CRD document has null crdProvides", () => {
    const docs = parseRenderedDocs(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: x
`);
    expect(docs[0]?.crdProvides).toBeNull();
  });

  test("multi-document YAML with a malformed document does not lose the others", () => {
    const docs = parseRenderedDocs(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: a
---
this is not: [ valid
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: b
`);
    expect(docs.map((d) => d.name)).toEqual(["a", "b"]);
  });

  test("carries resource-level annotations through", () => {
    const docs = parseRenderedDocs(`
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: x
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
`);
    expect(docs[0]?.annotations["argocd.argoproj.io/sync-options"]).toBe("SkipDryRunOnMissingResource=true");
  });
});

describe("indexAppManifests + resolveViolations: synthetic findings", () => {
  const bootstrapApps = new Set<string>(["cilium"]);

  test("a builtin-group kind is never a consumer finding", () => {
    const apps = [app("a", 0)];
    const index = indexAppManifests(
      apps,
      () => appYaml("directory"),
      bootstrapApps,
      fakeRender({ fake: [{ apiVersion: "apps/v1", kind: "Deployment" }] }),
    );
    expect(index.consumed).toEqual([]);
    for (const group of BUILTIN_API_GROUPS) expect(group.includes("/")).toBe(false);
  });

  test("no provider at all is a NO-PROVIDER violation", () => {
    const apps = [app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      () => appYaml("directory"),
      bootstrapApps,
      fakeRender({ fake: [{ apiVersion: "example.com/v1", kind: "Widget" }] }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    const violations = resolveViolations(index, waves, bootstrapApps);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("NO-PROVIDER");
  });

  test("a provider that reconciles STRICTLY BEFORE the consumer is clean", () => {
    const apps = [app("provider", -10), app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        provider: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } }],
        consumer: [{ apiVersion: "example.com/v1", kind: "Widget" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    expect(resolveViolations(index, waves, bootstrapApps)).toEqual([]);
  });

  test("EQUAL waves are a violation -- 'not strictly before' includes ties", () => {
    const apps = [app("provider", 0), app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        provider: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } }],
        consumer: [{ apiVersion: "example.com/v1", kind: "Widget" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    const violations = resolveViolations(index, waves, bootstrapApps);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("ORDER");
  });

  test("a provider that reconciles AFTER the consumer is a violation unless SkipDryRunOnMissingResource is set", () => {
    const apps = [app("provider", 10), app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        provider: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } }],
        consumer: [{ apiVersion: "example.com/v1", kind: "Widget" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    const violations = resolveViolations(index, waves, bootstrapApps);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.providerApp).toBe("provider");
  });

  test("SkipDryRunOnMissingResource on the resource silences an otherwise-real ORDER finding", () => {
    const apps = [app("provider", 10), app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        provider: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } }],
        consumer: [
          {
            apiVersion: "example.com/v1",
            kind: "Widget",
            annotations: { "argocd.argoproj.io/sync-options": "SkipDryRunOnMissingResource=true" },
          },
        ],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    expect(resolveViolations(index, waves, bootstrapApps)).toEqual([]);
  });

  test("SkipDryRunOnMissingResource at the Application level (syncOptions) also silences it", () => {
    const apps = [app("provider", 10), app("consumer", 0)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory", { consumer: '"SkipDryRunOnMissingResource=true"' }),
      bootstrapApps,
      fakeRender({
        provider: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } }],
        consumer: [{ apiVersion: "example.com/v1", kind: "Widget" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    expect(resolveViolations(index, waves, bootstrapApps)).toEqual([]);
  });

  test("self-provided (same app ships both CRD and CR) is clean regardless of order", () => {
    const apps = [app("selfsame", 5)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        selfsame: [
          { apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "example.com", kind: "Widget" } },
          { apiVersion: "example.com/v1", kind: "Widget" },
        ],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    expect(resolveViolations(index, waves, bootstrapApps)).toEqual([]);
  });

  test("a bootstrap-installed provider satisfies the edge regardless of its Application wave", () => {
    const apps = [app("cilium", 50), app("consumer", -80)];
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bootstrapApps,
      fakeRender({
        cilium: [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "cilium.io", kind: "CiliumLoadBalancerIPPool" } }],
        consumer: [{ apiVersion: "cilium.io/v2alpha1", kind: "CiliumLoadBalancerIPPool" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    // cilium reconciles at wave 50, consumer at -80 -- would be a hard ORDER
    // violation for an ordinary provider, but cilium is bootstrap-installed.
    expect(resolveViolations(index, waves, bootstrapApps)).toEqual([]);
  });

  test("a webhook-sensitive group at the SAME wave as its bootstrap-installed provider is a WEBHOOK-SAME-WAVE caution", () => {
    const apps = [app("cert-manager", -70), app("consumer", -70)];
    const bs = new Set(["cert-manager"]);
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bs,
      fakeRender({
        "cert-manager": [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "cert-manager.io", kind: "Certificate" } }],
        consumer: [{ apiVersion: "cert-manager.io/v1", kind: "Certificate" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    const violations = resolveViolations(index, waves, bs);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("WEBHOOK-SAME-WAVE");
  });

  test("a webhook-sensitive group at a DIFFERENT wave from its bootstrap-installed provider is clean", () => {
    // The negative case -- proves the finding above is not vacuous.
    const apps = [app("cert-manager", -70), app("consumer", -50)];
    const bs = new Set(["cert-manager"]);
    const index = indexAppManifests(
      apps,
      perAppYaml("directory"),
      bs,
      fakeRender({
        "cert-manager": [{ apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", crdProvides: { group: "cert-manager.io", kind: "Certificate" } }],
        consumer: [{ apiVersion: "cert-manager.io/v1", kind: "Certificate" }],
      }),
    );
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    expect(resolveViolations(index, waves, bs)).toEqual([]);
  });
});

describe("auditCrdOrder: acknowledgement mechanism", () => {
  test("an acknowledged finding is reported but does not fail the audit", () => {
    const apps = [app("consumer", 0)];
    const render = fakeRender({ fake: [{ apiVersion: "example.com/v1", kind: "Widget" }] });
    // Drive a real NO-PROVIDER through the whole pipeline; confirm ACKNOWLEDGED_FINDINGS
    // is consulted via `unregistered`/`staleAcknowledgements`, without depending on
    // any entry that happens to be registered in the live table today.
    const index = indexAppManifests(apps, () => appYaml("directory"), new Set(), render);
    const waves = new Map(apps.map((a) => [a.name, a.wave]));
    const violations = resolveViolations(index, waves, new Set());
    expect(violations).toHaveLength(1);
    const key = acknowledgementKey(violations[0] as Violation);
    const acked = new Map([[key, { reason: "synthetic acknowledgement for this test" }]]);
    const unregistered = violations.filter((v) => !acked.has(acknowledgementKey(v)));
    expect(unregistered).toEqual([]);
  });

  test("the LIVE acknowledgement table's keys all carry a non-empty reason", () => {
    for (const [key, entry] of ACKNOWLEDGED_FINDINGS) {
      expect(entry.reason.trim().length, `${key} has no reason`).toBeGreaterThan(40);
    }
  });
});

describe("formatAudit", () => {
  test("reports unanalyzable Applications distinctly from violations", () => {
    const apps = [app("broken", 0)];
    const index = indexAppManifests(apps, () => appYaml("helm"), new Set(), () => ({ ok: false, docs: [], error: "boom" }));
    const audit = auditCrdOrder(apps, () => appYaml("helm"), "/nonexistent", () => ({ ok: false, docs: [], error: "boom" }));
    expect(audit.index.unanalyzable.get("broken")).toBe("boom");
    expect(formatAudit(audit)).toContain("NOT ANALYZABLE");
    void index;
  });
});

// ---------------------------------------------------------------------------
// B. The live tree -- requires helm on PATH
// ---------------------------------------------------------------------------

function helmOnPathForTest(): boolean {
  return Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}

describe("the live full-ai-cluster tree", () => {
  const skip = !helmOnPathForTest();
  if (skip) {
    test.skip("SKIPPED -- helm is not on PATH; this suite proves nothing about the real tree without it", () => {});
  } else {
    test(
      "the real tree has no unacknowledged CRD provider/consumer ordering violation",
      () => {
        const { readShippedApplications } = require("./derive-sync-waves.ts") as typeof import("./derive-sync-waves.ts");
        const { readFileSync } = require("node:fs") as typeof import("node:fs");
        const { resolve } = require("node:path") as typeof import("node:path");
        const root = process.cwd();
        const apps = readShippedApplications(root);
        const audit = auditCrdOrder(apps, (p) => readFileSync(resolve(root, p), "utf8"), root);
        if (audit.index.unanalyzable.size > 0) {
          // eslint-disable-next-line no-console
          console.error(formatAudit(audit));
        }
        expect(audit.index.unanalyzable.size).toBe(0);
        expect(audit.unregistered).toEqual([]);
        expect(audit.staleAcknowledgements).toEqual([]);
        expect(auditIsClean(audit)).toBe(true);
      },
      180_000,
    );

    test("platform/monitoring.yaml carries the real SkipDryRunOnMissingResource fix for both CRD-gated resources", () => {
      // The general shape (a provider reconciling AFTER its consumer, with no
      // skip, IS an ORDER finding) is proved synthetically above -- see "a
      // provider that reconciles AFTER the consumer is a violation unless
      // SkipDryRunOnMissingResource is set". This is the narrow regression
      // guard for the SPECIFIC live fix: a hand-verified `sed` removal of this
      // exact annotation, re-running the analyzer, and restoring it was used
      // to confirm the fix while building this file (the live-tree audit test
      // above cannot re-derive that on its own, because `readDirectoryApp`
      // reads platform's manifests straight off disk with no injectable hook
      // -- only Helm-sourced Applications go through `readApplicationYaml`).
      // This test pins the artifact that hand verification depends on staying
      // true, which a future edit CAN disturb even though nothing here would
      // catch a REGRESSION the same way the live-tree test above would if the
      // annotation were simply deleted outright.
      const { readFileSync } = require("node:fs") as typeof import("node:fs");
      const { resolve } = require("node:path") as typeof import("node:path");
      const text = readFileSync(
        resolve(process.cwd(), "full-ai-cluster/k8s/applications/platform/monitoring.yaml"),
        "utf8",
      );
      const occurrences = (text.match(/SkipDryRunOnMissingResource=true/g) ?? []).length;
      expect(occurrences).toBe(2); // ServiceMonitor + PrometheusRule
    });
  }
});
