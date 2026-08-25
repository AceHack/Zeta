/**
 * FALSIFIERS for audit-agentic-org-manifests.ts.
 *
 * A validator nobody has watched fail is a validator nobody has evidence for.
 * Every case below copies the REAL manifest tree to a scratch directory, breaks
 * exactly one thing, runs the CLI as a SUBPROCESS, and asserts BOTH that it exits
 * 1 AND that the specific expected check fired. Asserting the exit code alone
 * would pass for a validator that failed for an unrelated reason.
 *
 * Three cases exist to catch the opposite failure -- a validator that is simply
 * always red:
 *   - the UNMUTATED control asserts exit 0 on the real tree;
 *   - the EMPTY-DIRECTORY case asserts exit 1, because discovering no manifests
 *     is a check that did not run, not a clean bill of health;
 *   - the NO-DOCUMENTS case asserts exit 1 for the same reason.
 *
 * The mutations are applied by string replacement against a required anchor, and
 * every helper asserts the anchor was actually present -- a mutation that silently
 * failed to apply would otherwise "prove" the validator red on an unmutated tree.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_DIR,
  IMAGE_EXCEPTIONS,
  imageRepository,
  isLocallyBuiltImage,
  parseCpuMilli,
  parseMemoryMi,
} from "./audit-agentic-org-manifests.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const TOOL = "src/Core.TypeScript/cluster/audit-agentic-org-manifests.ts";

type Run = { readonly code: number; readonly out: string };

function runAudit(dir: string): Run {
  const r = spawnSync("bun", [TOOL, "--dir", dir], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    // No pipe, no shell: the exit code we read is the tool's own.
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Copy the real tree to scratch so a mutation never touches the working copy. */
function scratchTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "agentic-org-manifests-"));
  cpSync(join(REPO_ROOT, DEFAULT_DIR), dir, { recursive: true });
  return dir;
}

/** Replace `anchor` in `file`, asserting the anchor exists. A no-op mutation is a false proof. */
function mutate(dir: string, file: string, anchor: string, replacement: string): void {
  const path = join(dir, file);
  const before = readFileSync(path, "utf8");
  if (!before.includes(anchor)) {
    throw new Error(`PATTERN NOT FOUND in ${file}: ${anchor.slice(0, 80)}`);
  }
  const after = before.replace(anchor, replacement);
  if (after === before) throw new Error(`mutation was a no-op in ${file}`);
  writeFileSync(path, after);
}

/** One mutation, one expected check. Asserts exit 1 AND the reason. */
function expectRed(mutateFn: (dir: string) => void, expectedCheck: string): void {
  const dir = scratchTree();
  try {
    mutateFn(dir);
    const r = runAudit(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain(expectedCheck);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("control — the validator is not simply always red", () => {
  test("the real, unmutated tree passes with exit 0", () => {
    const r = runAudit(DEFAULT_DIR);
    expect(r.out).toContain("Results: 0 findings.");
    expect(r.code).toBe(0);
  });

  test("an unmutated COPY of the real tree also passes", () => {
    const dir = scratchTree();
    try {
      expect(runAudit(dir).code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("vacuity guards — an empty run is not a clean run", () => {
  test("a directory with no kubectl-visible files FAILS rather than reporting 0 findings", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentic-org-empty-"));
    try {
      const r = runAudit(dir);
      expect(r.code).toBe(1);
      expect(r.out).toContain("refusing to report success");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a directory whose only .yaml parses to no documents FAILS", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentic-org-nodocs-"));
    try {
      writeFileSync(join(dir, "empty.yaml"), "# just a comment\n");
      const r = runAudit(dir);
      expect(r.code).toBe(1);
      expect(r.out).toContain("refusing to report success");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a nonexistent directory FAILS rather than passing vacuously", () => {
    const r = runAudit(join(tmpdir(), "definitely-not-a-real-directory-9a7f"));
    expect(r.code).toBe(1);
  });
});

describe("CHECK A — a template in the apply set", () => {
  test("a .example.yaml in the directory is caught, because kubectl applies it", () => {
    expectRed((dir) => {
      writeFileSync(
        join(dir, "99-thing.example.yaml"),
        "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: thing\n  namespace: agentic-org\ndata: {}\n",
      );
    }, "apply-set-contains-template");
  });

  test("the exact pre-fix filename is still caught — this is the defect that shipped", () => {
    expectRed((dir) => {
      cpSync(
        join(REPO_ROOT, "agentic-organization/deploy/k8s-templates/31-work-provider-secret.example.yaml"),
        join(dir, "31-work-provider-secret.example.yaml"),
      );
    }, "apply-set-contains-template");
  });

  test("a .yaml.example file is NOT caught — the marker alone is not the defect", () => {
    const dir = scratchTree();
    try {
      writeFileSync(join(dir, "99-thing.yaml.example"), "apiVersion: v1\nkind: ConfigMap\n");
      expect(runAudit(dir).code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CHECK B/C — Services that resolve to nothing", () => {
  test("a Service selector matching no workload is caught", () => {
    expectRed(
      (dir) =>
        mutate(dir, "43-loki.yaml", "  selector: { app: loki }\n  ports:", "  selector: { app: loki-typo }\n  ports:"),
      "service-selector-matches-nothing",
    );
  });

  test("a Service with no selector at all is caught", () => {
    expectRed(
      (dir) => mutate(dir, "43-loki.yaml", "  selector: { app: loki }\n  ports:", "  ports:"),
      "service-without-selector",
    );
  });

  test("a named targetPort no container declares is caught — schema-valid, silently dead", () => {
    expectRed(
      (dir) => mutate(dir, "43-loki.yaml", "targetPort: http }", "targetPort: htttp }"),
      "service-named-targetport-undeclared",
    );
  });

  test("the otel-collector's named targetPort is load-bearing too", () => {
    expectRed(
      (dir) => mutate(dir, "40-otel-collector.yaml", "targetPort: otlp-http }", "targetPort: otlp }"),
      "service-named-targetport-undeclared",
    );
  });
});

describe("CHECK D — references that go nowhere", () => {
  test("an env var naming a port the Service does not expose is caught", () => {
    expectRed(
      (dir) =>
        mutate(dir, "30-worker.yaml", 'value: "http://otel-collector:4318"', 'value: "http://otel-collector:4319"'),
      "reference-to-unexposed-service-port",
    );
  });

  test("a ConfigMap-embedded exporter endpoint is checked, not just env vars", () => {
    expectRed(
      (dir) => mutate(dir, "40-otel-collector.yaml", "endpoint: http://tempo:4318", "endpoint: http://tempo:4321"),
      "reference-to-unexposed-service-port",
    );
  });

  test("a Grafana datasource URL is checked — the dashboard is a manifest too", () => {
    expectRed(
      (dir) => mutate(dir, "44-grafana.yaml", "url: http://mimir:9009/prometheus", "url: http://mimir:9010/prometheus"),
      "reference-to-unexposed-service-port",
    );
  });

  test("the worker's NATS and Cockroach URLs are checked", () => {
    expectRed(
      (dir) => mutate(dir, "30-worker.yaml", 'value: "nats://nats:4222"', 'value: "nats://nats:4223"'),
      "reference-to-unexposed-service-port",
    );
    expectRed(
      (dir) =>
        mutate(dir, "30-worker.yaml", "postgresql://root@cockroach:26257/", "postgresql://root@cockroach:26258/"),
      "reference-to-unexposed-service-port",
    );
  });

  test("a Service moved to another namespace is caught", () => {
    expectRed(
      (dir) =>
        mutate(
          dir,
          "41-tempo.yaml",
          "kind: Service\nmetadata:\n  name: tempo\n  namespace: agentic-org",
          "kind: Service\nmetadata:\n  name: tempo\n  namespace: elsewhere",
        ),
      "reference-to-service-in-other-namespace",
    );
  });
});

describe("CHECK E/F — mounts and envFrom the apply set cannot satisfy", () => {
  test("a volume naming a ConfigMap nothing creates is caught", () => {
    expectRed(
      (dir) => mutate(dir, "41-tempo.yaml", "            name: tempo-config", "            name: tempo-conf"),
      "volume-configmap-missing",
    );
  });

  test("a subPath key absent from the ConfigMap is caught — the mount is silently empty", () => {
    expectRed(
      (dir) => mutate(dir, "44-grafana.yaml", "subPath: datasources.yaml }", "subPath: datasource.yaml }"),
      "volumemount-subpath-key-missing",
    );
  });

  test("dropping `optional: true` from the work-provider secretRef is caught", () => {
    expectRed(
      (dir) =>
        mutate(
          dir,
          "30-worker.yaml",
          "                name: work-provider-secrets\n                optional: true",
          "                name: work-provider-secrets",
        ),
      "envfrom-secret-missing",
    );
  });
});

describe("CHECK G — images that will not pull on a fresh node", () => {
  test("an unregistered :latest image is caught", () => {
    expectRed(
      (dir) => mutate(dir, "41-tempo.yaml", "image: grafana/tempo:2.5.0", "image: grafana/tempo:latest"),
      "image-unpinned",
    );
  });

  test("an untagged image is caught", () => {
    expectRed(
      (dir) => mutate(dir, "41-tempo.yaml", "image: grafana/tempo:2.5.0", "image: grafana/tempo"),
      "image-unpinned",
    );
  });

  test("a locally-built image outside the exception register is caught", () => {
    expectRed(
      (dir) => mutate(dir, "41-tempo.yaml", "image: grafana/tempo:2.5.0", "image: agentic-org-worker:other-tag"),
      "image-local-only",
    );
  });

  test("an official single-component library image is NOT flagged — no crying wolf", () => {
    const dir = scratchTree();
    try {
      mutate(dir, "41-tempo.yaml", "image: grafana/tempo:2.5.0", "image: redis:7.2.4");
      expect(runAudit(dir).code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CHECK H — BestEffort containers", () => {
  test("removing cockroach's requests reproduces the exact pre-fix defect", () => {
    expectRed(
      (dir) => mutate(dir, "10-cockroach.yaml", '            requests: { cpu: "100m", memory: "512Mi" }\n', ""),
      "container-without-requests",
    );
  });

  test("removing nats's requests is caught too", () => {
    expectRed(
      (dir) => mutate(dir, "20-nats.yaml", '            requests: { cpu: "50m", memory: "128Mi" }\n', ""),
      "container-without-requests",
    );
  });
});

describe("CHECK I — a stale exception is a false sentence", () => {
  test("deleting the manifest an exception covers makes the AUDIT fail, not pass", () => {
    expectRed((dir) => {
      rmSync(join(dir, "35-hindsight.yaml"));
    }, "stale-image-exception");
  });

  test("pinning hindsight (i.e. the day the exception is earned back) also fails until the entry is removed", () => {
    expectRed(
      (dir) =>
        mutate(
          dir,
          "35-hindsight.yaml",
          "image: ghcr.io/vectorize-io/hindsight:latest",
          "image: ghcr.io/vectorize-io/hindsight:1.2.3",
        ),
      "stale-image-exception",
    );
  });
});

describe("malformed input", () => {
  test("unparseable YAML is reported, not swallowed", () => {
    expectRed((dir) => {
      writeFileSync(join(dir, "98-broken.yaml"), "apiVersion: v1\nkind: ConfigMap\n  bad: [unclosed\n\ttab: yes\n");
    }, "yaml-parse-error");
  });
});

describe("unit — resource and image parsing", () => {
  test("CPU quantities", () => {
    expect(parseCpuMilli("250m")).toBe(250);
    expect(parseCpuMilli("2")).toBe(2000);
    expect(parseCpuMilli(undefined)).toBe(0);
  });

  test("memory quantities", () => {
    expect(parseMemoryMi("128Mi")).toBe(128);
    expect(parseMemoryMi("1Gi")).toBe(1024);
    expect(parseMemoryMi(undefined)).toBe(0);
  });

  test("image repository extraction ignores registry ports", () => {
    expect(imageRepository("ghcr.io/vectorize-io/hindsight:latest")).toBe("ghcr.io/vectorize-io/hindsight");
    expect(imageRepository("localhost:5000/thing")).toBe("localhost:5000/thing");
    expect(imageRepository("nats:2.14.1-alpine")).toBe("nats");
  });

  test("only rostered repositories count as locally built", () => {
    expect(isLocallyBuiltImage("agentic-org-worker:keepalive")).toBe(true);
    expect(isLocallyBuiltImage("nats:2.14.1-alpine")).toBe(false);
    expect(isLocallyBuiltImage("cockroachdb/cockroach:v26.2.1")).toBe(false);
  });

  test("every exception states a reason and a lift condition — an empty one would be a licence", () => {
    for (const e of IMAGE_EXCEPTIONS) {
      expect(e.reason.length).toBeGreaterThan(40);
      expect(e.liftsWhen.length).toBeGreaterThan(20);
    }
  });
});

/** Keep the scratch root tidy if a case throws before its finally. */
mkdirSync(tmpdir(), { recursive: true });
