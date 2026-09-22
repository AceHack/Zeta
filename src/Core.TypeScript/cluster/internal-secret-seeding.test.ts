#!/usr/bin/env bun
// src/Core.TypeScript/cluster/internal-secret-seeding.test.ts
//
// `full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml` is hand-written,
// not generated -- so its Secret names, namespaces and key shapes can drift
// from `dev-cluster/lib.ts`'s `DEV_BOOTSTRAP_SECRETS` / `DEV_SHARED_SECRETS`
// (the single source of truth every consuming Application's valuesObject was
// measured against) without anything noticing. This file is the mechanical
// anti-drift guard: every literal the metal manifest embeds is asserted
// against the SAME constants the dev/CI mint already imports, so a rename on
// either side goes red here instead of surfacing as a fresh
// CreateContainerConfigError on the next real USB install.
//
// It also pins the safety properties the manifest's own header argues for in
// prose: every Secret-creating call uses `create` (never `apply` /
// `replace`, which would overwrite a Secret already in the cluster), every
// RBAC Role grants `create` on `secrets` ONLY -- no `get`, `list`, `update`,
// `delete`, or any other resource -- and (WP16, hardening PR #17505's pod-UID
// entropy source) NO Job draws secret material from its own identity
// (`metadata.uid`/`fieldRef`) or carries a secret value in an argv token or
// env var: entropy is read from `/dev/urandom` inside a `draw-entropy`
// initContainer and passed between containers ONLY via an in-memory
// (`emptyDir: {medium: Memory}`) file that `kubectl create secret` reads
// with `--from-file`.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import {
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_ZITI_ADMIN_SECRET,
  DEV_OPENSEARCH_ADMIN_SECRET,
  DEV_FORGEJO_ADMIN_SECRET,
  DEV_BLOB_STORE_SECRET,
  DEV_REDIS_AUTH_SECRET,
  DEV_HINDSIGHT_LLM_SECRET,
  type DevBootstrapSecretSpec,
} from "./dev-cluster/lib.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const MANIFEST_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml");
const GATEKEEPER_WAIT_PATH = join(
  REPO_ROOT,
  "full-ai-cluster/k8s/applications/hat-system/gatekeeper-crd-wait.yaml",
);

const manifestText = readFileSync(MANIFEST_PATH, "utf-8");
const docs = parseAllDocuments(manifestText);

interface AnyDoc {
  readonly apiVersion?: string;
  readonly kind?: string;
  readonly metadata?: { readonly name?: string; readonly namespace?: string };
  readonly rules?: readonly {
    readonly apiGroups?: readonly string[];
    readonly resources?: readonly string[];
    readonly verbs?: readonly string[];
  }[];
  readonly spec?: {
    readonly template?: {
      readonly spec?: {
        readonly containers?: readonly ContainerDoc[];
        readonly initContainers?: readonly ContainerDoc[];
      };
    };
  };
}

interface ContainerDoc {
  readonly name?: string;
  readonly image?: string;
  readonly args?: readonly string[];
  readonly command?: readonly string[];
  readonly env?: readonly {
    readonly name?: string;
    readonly value?: string;
    readonly valueFrom?: { readonly fieldRef?: { readonly fieldPath?: string } };
  }[];
}

function parsedObjects(): readonly AnyDoc[] {
  for (const d of docs) expect(d.errors).toEqual([]);
  return docs.map((d) => d.toJS() as AnyDoc);
}

const objects = parsedObjects();

function allContainers(): readonly ContainerDoc[] {
  const out: ContainerDoc[] = [];
  for (const o of objects) {
    if (o.kind !== "Job") continue;
    const spec = o.spec?.template?.spec;
    out.push(...(spec?.initContainers ?? []), ...(spec?.containers ?? []));
  }
  return out;
}

/** The ONE container per Job with a shell -- draws entropy, runs `kubectl` nowhere. */
function entropyContainers(): readonly ContainerDoc[] {
  return allContainers().filter((c) => c.name === "draw-entropy");
}

/** Every OTHER container -- these are the ones that run `kubectl create secret`. */
function kubectlContainers(): readonly ContainerDoc[] {
  return allContainers().filter((c) => c.name !== "draw-entropy");
}

describe("internal-secret-seeding.yaml — parses and is well-formed", () => {
  test("every document parses with no YAML errors", () => {
    expect(docs.length).toBeGreaterThan(0);
  });

  test("declares a Namespace object for every namespace a Job's RBAC references", () => {
    const declaredNamespaces = new Set(
      objects.filter((o) => o.kind === "Namespace").map((o) => o.metadata?.name),
    );
    const rbacNamespaces = new Set(
      objects.filter((o) => o.kind === "Role" || o.kind === "RoleBinding").map((o) => o.metadata?.namespace),
    );
    for (const ns of rbacNamespaces) {
      expect(declaredNamespaces.has(ns)).toBe(true);
    }
  });
});

describe("internal-secret-seeding.yaml — RBAC is create-only, secrets-only, per namespace", () => {
  const roles = objects.filter((o) => o.kind === "Role");

  test("at least one Role exists", () => {
    expect(roles.length).toBeGreaterThan(0);
  });

  for (const role of roles) {
    test(`Role ${role.metadata?.namespace}/${role.metadata?.name} grants exactly create on secrets`, () => {
      expect(role.rules?.length).toBe(1);
      const rule = role.rules?.[0];
      expect(rule?.apiGroups).toEqual([""]);
      expect(rule?.resources).toEqual(["secrets"]);
      expect(rule?.verbs).toEqual(["create"]);
    });
  }
});

describe("internal-secret-seeding.yaml — every seed call uses `create`, never `apply`/`replace`", () => {
  const containers = kubectlContainers();

  test("at least one seeding container exists", () => {
    expect(containers.length).toBeGreaterThan(0);
  });

  for (const c of containers) {
    test(`container ${c.name} uses \`kubectl create secret generic\``, () => {
      expect(c.args?.[0]).toBe("create");
      expect(c.args?.[1]).toBe("secret");
      expect(c.args?.[2]).toBe("generic");
      expect(c.args?.some((a) => a.startsWith("apply") || a === "replace")).toBe(false);
    });
  }
});

describe("internal-secret-seeding.yaml — image is the ALREADY-PINNED kubectl image, not a new dependency", () => {
  const gatekeeperText = readFileSync(GATEKEEPER_WAIT_PATH, "utf-8");
  const pinnedImageMatch = /image:\s*(registry\.k8s\.io\/kubectl:v[\d.]+)/.exec(gatekeeperText);

  test("gatekeeper-crd-wait.yaml still pins the image this file assumes (fixture didn't drift)", () => {
    expect(pinnedImageMatch).not.toBeNull();
  });

  const containers = kubectlContainers();
  for (const c of containers) {
    test(`container ${c.name} uses the SAME pinned image as gatekeeper-crd-wait.yaml`, () => {
      expect(c.image).toBe(pinnedImageMatch?.[1]);
    });
  }
});

describe("internal-secret-seeding.yaml — WP16: entropy is drawn by ONE pinned-by-tag-AND-digest image, never kubectl", () => {
  const draws = entropyContainers();

  test("at least one draw-entropy container exists", () => {
    expect(draws.length).toBeGreaterThan(0);
  });

  for (const c of draws) {
    test(`draw-entropy in ${c.name} (image ${String(c.image)}) is pinned by BOTH tag and digest`, () => {
      expect(c.image).toMatch(/^busybox:[\w.]+@sha256:[0-9a-f]{64}$/);
    });

    test(`draw-entropy in ${c.name} is the only kind of container running a shell`, () => {
      expect(c.command).toEqual(["/bin/sh", "-c"]);
    });
  }

  test("every draw-entropy container uses the SAME pinned image (single source of truth)", () => {
    expect(new Set(draws.map((c) => c.image)).size).toBe(1);
  });

  test("no kubectl-running container is the busybox image (kubectl stays shell-less)", () => {
    for (const c of kubectlContainers()) {
      expect(c.image).not.toMatch(/busybox/);
    }
  });
});

describe("internal-secret-seeding.yaml — WP16: no Job draws secret material from its own pod identity", () => {
  test("the manifest text never references metadata.uid or any fieldRef (the WP14 weakness this hardens)", () => {
    expect(manifestText.includes("metadata.uid")).toBe(false);
    expect(manifestText.includes("fieldRef")).toBe(false);
  });

  test("no container's env carries a fieldRef (Downward API) at all", () => {
    for (const c of allContainers()) {
      for (const e of c.env ?? []) {
        expect(e.valueFrom?.fieldRef).toBeUndefined();
      }
    }
  });

  test("no container's args contain a Downward-API/env expansion token `$(...)` (secret never travels as an env var)", () => {
    for (const c of allContainers()) {
      for (const a of c.args ?? []) {
        expect(a).not.toMatch(/\$\([A-Za-z_][A-Za-z0-9_]*\)/);
      }
    }
  });

  test("every kubectl container's secret-bearing args are `--from-file=...`, never `--from-literal=` with a drawn value", () => {
    // The only `--from-literal=` args any kubectl container carries are the STATIC,
    // non-secret usernames (admin-user=admin, username=gitea_admin, username=default) --
    // every password/key/config value crosses via a file read off the shared tmpfs volume.
    const allowedLiterals = new Set([
      "--from-literal=admin-user=admin",
      "--from-literal=username=gitea_admin",
      "--from-literal=username=default",
    ]);
    for (const c of kubectlContainers()) {
      for (const a of c.args ?? []) {
        if (!a.startsWith("--from-literal=")) continue;
        expect(allowedLiterals.has(a)).toBe(true);
      }
    }
  });
});

describe("internal-secret-seeding.yaml — WP16: the entropy volume is in-memory (tmpfs), never disk", () => {
  test("every Job declares an `entropy` volume backed by emptyDir medium Memory", () => {
    const jobs = objects.filter((o) => o.kind === "Job") as readonly {
      readonly spec?: {
        readonly template?: {
          readonly spec?: {
            readonly volumes?: readonly {
              readonly name?: string;
              readonly emptyDir?: { readonly medium?: string };
            }[];
          };
        };
      };
    }[];
    for (const job of jobs) {
      const volumes = job.spec?.template?.spec?.volumes ?? [];
      const entropy = volumes.find((v) => v.name === "entropy");
      expect(entropy).toBeDefined();
      expect(entropy?.emptyDir?.medium).toBe("Memory");
    }
  });
});

// ── Cross-checks against dev-cluster/lib.ts, the single source of truth ────

function assertBootstrapSpecSeeded(spec: DevBootstrapSecretSpec): void {
  const job = objects.find((o) => o.kind === "Job" && o.metadata?.namespace === spec.namespace);
  expect(job).toBeDefined();
  const container = (job?.spec?.template?.spec?.containers ?? [])[0];
  expect(container?.args).toContain(`--from-literal=${spec.userKey}=${spec.user}`);
  expect(container?.args?.some((a) => a === `${spec.namespace}` )).toBe(true);
  expect(
    (job?.spec?.template?.spec?.containers ?? []).some((c) => c.args?.includes(spec.name)),
  ).toBe(true);
  const passwordArg = container?.args?.find((a) => a.startsWith(`--from-file=${spec.passwordKey}=`));
  expect(passwordArg).toBeDefined();
  // Drawn by the pod's own `draw-entropy` initContainer onto the shared in-memory
  // volume -- never a literal, never a Downward-API env-var expansion (WP16).
  expect(passwordArg).toMatch(/^--from-file=\S+=\/work\/\S+$/);
}

describe("internal-secret-seeding.yaml — matches DEV_BOOTSTRAP_SECRETS (name/namespace/keys)", () => {
  for (const spec of [
    DEV_GRAFANA_ADMIN_SECRET,
    DEV_ZITI_ADMIN_SECRET,
    DEV_OPENSEARCH_ADMIN_SECRET,
    DEV_FORGEJO_ADMIN_SECRET,
  ]) {
    test(`${spec.namespace}/${spec.name} is seeded with the same keys dev/CI mints`, () => {
      assertBootstrapSpecSeeded(spec);
    });
  }
});

describe("internal-secret-seeding.yaml — matches DEV_BLOB_STORE_SECRET (shared, 4 namespaces)", () => {
  const placeholderKeys = Object.keys(DEV_BLOB_STORE_SECRET.keys("PLACEHOLDER"));

  test("every DEV_BLOB_STORE_SECRET namespace has a container creating `zeta-blob-store`", () => {
    const containers = allContainers().filter((c) => c.args?.includes("zeta-blob-store"));
    const seededNamespaces = containers.map((c) => {
      const nsIdx = c.args?.indexOf("-n") ?? -1;
      return c.args?.[nsIdx + 1];
    });
    for (const ns of DEV_BLOB_STORE_SECRET.namespaces) {
      expect(seededNamespaces).toContain(ns);
    }
    expect(seededNamespaces.length).toBe(DEV_BLOB_STORE_SECRET.namespaces.length);
  });

  test("every container writes exactly the same key set `keys()` produces", () => {
    const containers = kubectlContainers().filter((c) => c.args?.includes("zeta-blob-store"));
    for (const c of containers) {
      const writtenKeys = (c.args ?? [])
        .filter((a) => a.startsWith("--from-file="))
        .map((a) => a.slice("--from-file=".length).split("=")[0]);
      expect(new Set(writtenKeys)).toEqual(new Set(placeholderKeys));
    }
  });

  test("every container in the shared Job reads the SAME shared entropy file per key (one drawn value)", () => {
    const containers = kubectlContainers().filter((c) => c.args?.includes("zeta-blob-store"));
    const fromFileEntries = containers.map((c) =>
      [...(c.args ?? [])].filter((a) => a.startsWith("--from-file=")).sort(),
    );
    const [first, ...rest] = fromFileEntries;
    if (first === undefined) throw new Error("no zeta-blob-store containers found");
    for (const entries of rest) {
      expect(entries).toEqual(first);
    }
  });
});

describe("internal-secret-seeding.yaml — matches DEV_REDIS_AUTH_SECRET (shared, 2 namespaces)", () => {
  test("every DEV_REDIS_AUTH_SECRET namespace has a container creating `redis-auth`", () => {
    const containers = allContainers().filter((c) => c.args?.includes("redis-auth"));
    const seededNamespaces = containers.map((c) => {
      const nsIdx = c.args?.indexOf("-n") ?? -1;
      return c.args?.[nsIdx + 1];
    });
    for (const ns of DEV_REDIS_AUTH_SECRET.namespaces) {
      expect(seededNamespaces).toContain(ns);
    }
    expect(seededNamespaces.length).toBe(DEV_REDIS_AUTH_SECRET.namespaces.length);
  });

  test("both containers read password from the SAME shared entropy file (one drawn value)", () => {
    const containers = kubectlContainers().filter((c) => c.args?.includes("redis-auth"));
    const passwordArgs = containers.map((c) => (c.args ?? []).find((a) => a.startsWith("--from-file=password=")));
    expect(passwordArgs.every((a) => a !== undefined)).toBe(true);
    expect(new Set(passwordArgs).size).toBe(1);
  });
});

describe("internal-secret-seeding.yaml — never seeds the EXTERNAL (operator-supplied) hindsight key", () => {
  test("hindsight-llm-api-key is absent from this file", () => {
    expect(manifestText.includes(DEV_HINDSIGHT_LLM_SECRET.name)).toBe(false);
  });

  test("no `hindsight` namespace is declared here", () => {
    expect(objects.some((o) => o.kind === "Namespace" && o.metadata?.name === "hindsight")).toBe(false);
  });
});
