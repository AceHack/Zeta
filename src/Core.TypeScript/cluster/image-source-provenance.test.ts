// Falsifiers for image-source-provenance.ts.
//
// THE WITNESS IS THE INCIDENT. `full-ai-cluster/k8s/applications/platform/
// blueprints-flowdent.yaml` sat in this public tree for months referencing
// `ghcr.io/flowdent/cloudservice:latest` and `ghcr.io/flowdent/fd-webclient:latest`
// -- images from `Flowdent/fd-core` (private) and `Flowdent/fd-webclient`
// (internal), in an org that reports `public_repos: 0`. An agent wrote to the
// wrong repository in a multi-repo setup and nothing caught it; it was removed
// by hand in #14250, months later.
//
// The first test below reconstructs the two Blueprint documents that carried
// those references and asserts the check goes RED on them. It is the reason
// this module exists, so it is the first thing it must be able to say.
//
// Every case builds a THROWAWAY GIT TREE, because `manifestFiles` derives its
// file set from `git ls-files` -- deliberately, so that an untracked scratch
// file cannot smuggle a reference past the scan, and so that a fixture cannot
// accidentally be exercised against the real repository.

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ACKNOWLEDGED_PRIVATE,
  BUILT_IN_TREE,
  EXCLUDED_PREFIXES,
  LEDGER_PATH,
  OUR_NAMESPACES,
  acknowledgeable,
  audit,
  classify,
  collectImageUses,
  foldAccess,
  refuses,
  remedy,
  repositoryKey,
  toLedgerEntry,
  type Acknowledgement,
  type LedgerEntry,
} from "./image-source-provenance.ts";

// ---------------------------------------------------------------------------
// Fixture plumbing
// ---------------------------------------------------------------------------

// Fixture manifests live under `fixture/k8s/` rather than a real tree path on
// purpose. These cases are about the SCAN, not about any directory, and naming a
// real one couples them to a tree that may move or be deleted --
// `audit-cluster-tree-consumers.ts` refused the first draft of this file for
// exactly that, and it was right to. It also exercises the property that matters:
// the scan is not restricted to declared roots.
interface Fixture {
  readonly root: string;
  readonly dispose: () => void;
}

function makeTree(files: Readonly<Record<string, string>>, entries: readonly LedgerEntry[]): Fixture {
  const root = mkdtempSync(join(tmpdir(), "image-provenance-"));
  const write = (rel: string, body: string): void => {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  };
  for (const [rel, body] of Object.entries(files)) write(rel, body);
  write(LEDGER_PATH, JSON.stringify({ $comment: "fixture", entries }, null, 2) + "\n");
  // `manifestFiles` derives its file set from `git ls-files`, so a fixture is
  // only in scope once it is tracked. Explicit args[] array, never a shell string.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["init", "-q"], { cwd: root });
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["add", "-A"], { cwd: root });
  return {
    root,
    dispose: (): void => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function entry(over: Partial<LedgerEntry> & Pick<LedgerEntry, "repository" | "tags">): LedgerEntry {
  return {
    artifact: foldAccess(over.tags),
    sourceRepo: null,
    sourceEvidence: "none",
    sourceVisibility: "unknown",
    packagePresence: "not-ghcr",
    resolvedAt: "2026-08-23",
    ...over,
  };
}

/**
 * Fixtures pass their OWN rosters. The shipped acknowledgement register and the
 * shipped built-in-tree exemption describe THIS repository; letting them default
 * into a throwaway tree would make every fixture inherit findings about images
 * it has never heard of, and would hide the case each fixture exists to pin.
 */
const hardFindings = (
  root: string,
  acks: ReadonlyMap<string, Acknowledgement> = new Map(),
  built: ReadonlyMap<string, string> = new Map(),
): readonly string[] =>
  audit(root, acks, built)
    .findings.filter((f) => !f.acknowledged)
    .map((f) => `${f.rule}:${f.subject}`);

// ---------------------------------------------------------------------------
// 1. THE INCIDENT. This is the falsifier the whole module answers to.
// ---------------------------------------------------------------------------

/**
 * Reconstructed from the two Blueprint documents deleted in #14250.
 *
 * Requirements only -- the image references, the kind, and enough shape to be
 * valid YAML. The point is the two `spec.image` strings; everything else is
 * scaffolding, and copying the original file wholesale would make the test
 * about the file rather than about the references.
 */
const FLOWDENT_BLUEPRINTS = `apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: opendental-suite
  namespace: zeta-platform
spec:
  category: app
  image: ghcr.io/flowdent/cloudservice:latest
  ports:
    - { name: http, port: 8080 }
---
apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: fd-webapp
  namespace: zeta-platform
spec:
  category: web
  image: ghcr.io/flowdent/fd-webclient:latest
  ports:
    - { name: http, port: 3000, web: true }
`;

describe("the Flowdent incident", () => {
  test("a reconstructed blueprints-flowdent.yaml goes RED, with the REMOVE remedy", () => {
    // Provenance as measured 2026-08-23, the same route the original
    // investigation took: an anonymous manifest request answered 401, and the
    // `Flowdent` org reports public_repos: 0 / owned_private_repos: 9.
    const fx = makeTree(
      { "full-ai-cluster/k8s/applications/platform/blueprints-flowdent.yaml": FLOWDENT_BLUEPRINTS },
      [
        entry({
          repository: "ghcr.io/flowdent/cloudservice",
          tags: { latest: 401 },
          sourceRepo: "Flowdent/fd-core",
          sourceEvidence: "ghcr-package",
          sourceVisibility: "private",
          packagePresence: "found",
        }),
        entry({
          repository: "ghcr.io/flowdent/fd-webclient",
          tags: { latest: 401 },
          sourceRepo: "Flowdent/fd-webclient",
          sourceEvidence: "ghcr-package",
          sourceVisibility: "private",
          packagePresence: "found",
        }),
      ],
    );
    try {
      const result = audit(fx.root, new Map(), new Map());
      const hard = result.findings.filter((f) => !f.acknowledged);
      expect(hard.map((f) => f.rule)).toEqual(["private-source-dependency", "private-source-dependency"]);
      expect(hard.map((f) => f.subject).sort()).toEqual([
        "ghcr.io/flowdent/cloudservice:latest",
        "ghcr.io/flowdent/fd-webclient:latest",
      ]);
      expect(result.byClass.get("foreign-private")).toHaveLength(2);
      // The remedy must be REMOVE, never PUBLISH. Getting this backwards would
      // send someone to open a package they do not own.
      for (const f of hard) {
        expect(f.detail).toContain("REMOVE IT");
        expect(f.detail).not.toContain("PUBLISH IT");
        expect(f.detail).toContain("blueprints-flowdent.yaml");
      }
    } finally {
      fx.dispose();
    }
  });

  test("the incident CANNOT be acknowledged — foreign-closed has no lift condition we control", () => {
    const fx = makeTree({ "full-ai-cluster/k8s/applications/platform/blueprints-flowdent.yaml": FLOWDENT_BLUEPRINTS }, [
      entry({
        repository: "ghcr.io/flowdent/cloudservice",
        tags: { latest: 401 },
        sourceRepo: "Flowdent/fd-core",
        sourceEvidence: "ghcr-package",
        sourceVisibility: "private",
        packagePresence: "found",
      }),
      entry({ repository: "ghcr.io/flowdent/fd-webclient", tags: { latest: 401 }, packagePresence: "found" }),
    ]);
    try {
      const acks = new Map<string, Acknowledgement>([
        [
          "ghcr.io/flowdent/cloudservice",
          { workitem: "081M0QNFBZ0087G0R000N3RXGF", recordedOn: "2026-08-23", reason: "we will fix it later" },
        ],
      ]);
      const rules = hardFindings(fx.root, acks);
      // The acknowledgement is itself a finding, AND the original refusal stands.
      expect(rules).toContain("acknowledgement-out-of-scope:ghcr.io/flowdent/cloudservice");
      expect(rules).toContain("private-source-dependency:ghcr.io/flowdent/cloudservice:latest");
    } finally {
      fx.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Third-party public images must NOT trip it.
// ---------------------------------------------------------------------------

describe("third-party public images pass", () => {
  test("bitnami, weaviate, ich777 and the rest are fine — foreign is not the defect, unobtainable is", () => {
    const manifest = `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      initContainers:
        - name: wait
          image: bitnamilegacy/kubectl:1.32.3
      containers:
        - name: weaviate
          image: cr.weaviate.io/semitechnologies/weaviate:1.28.2
        - name: steam
          image: ghcr.io/ich777/steamcmd:garrysmod
        - name: db
          image: postgres:16-alpine
        - name: kubevirt
          image: quay.io/kubevirt/virt-operator:v1.8.4
`;
    const fx = makeTree({ "fixture/k8s/app.yaml": manifest }, [
      entry({ repository: "registry-1.docker.io/bitnamilegacy/kubectl", tags: { "1.32.3": 200 } }),
      entry({ repository: "cr.weaviate.io/semitechnologies/weaviate", tags: { "1.28.2": 200 } }),
      entry({
        repository: "ghcr.io/ich777/steamcmd",
        tags: { garrysmod: 200 },
        sourceRepo: "ich777/docker-steamcmd-server",
        sourceEvidence: "oci-label",
        packagePresence: "found",
      }),
      entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 } }),
      entry({ repository: "quay.io/kubevirt/virt-operator", tags: { "v1.8.4": 200 } }),
    ]);
    try {
      const result = audit(fx.root, new Map(), new Map());
      expect(result.findings).toEqual([]);
      expect(result.byClass.get("obtainable")).toHaveLength(5);
    } finally {
      fx.dispose();
    }
  });

  test("a missing OCI source label on a PUBLIC image is not a finding — obtainability is the predicate", () => {
    // `postgres`, `busybox`, `grafana/grafana` and `quay.io/kubevirt/*` all
    // publish no `org.opencontainers.image.source`. Measured 2026-08-23. If an
    // absent label were a refusal on its own, this check would fail most of the
    // tree on day one and be deleted on day two.
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: postgres:16-alpine\n" },
      [entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 }, sourceRepo: null })],
    );
    try {
      expect(audit(fx.root, new Map(), new Map()).findings).toEqual([]);
    } finally {
      fx.dispose();
    }
  });

  test("a 404 tag on an OPEN repository is reported, not refused — lane-partition owns broken pins", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/ich777/steamcmd:armareforger\n" },
      [entry({ repository: "ghcr.io/ich777/steamcmd", tags: { armareforger: 404 }, packagePresence: "found" })],
    );
    try {
      const result = audit(fx.root, new Map(), new Map());
      expect(result.findings).toEqual([]);
      expect(result.byClass.get("tag-absent")).toEqual(["ghcr.io/ich777/steamcmd:armareforger"]);
    } finally {
      fx.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Unknown provenance is REFUSED, never admitted.
// ---------------------------------------------------------------------------

describe("unknown provenance does not pass", () => {
  test("no ledger entry at all is a finding, and the message says what to add", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/someone/mystery:v1\n" },
      [],
    );
    try {
      const hard = audit(fx.root, new Map(), new Map()).findings.filter((f) => !f.acknowledged);
      expect(hard).toHaveLength(1);
      const only = hard[0];
      expect(only?.rule).toBe("ledger-entry-missing");
      expect(only?.detail).toContain("UNKNOWN PROVENANCE DOES NOT PASS");
      expect(only?.detail).toContain("org.opencontainers.image.source");
    } finally {
      fx.dispose();
    }
  });

  test("no source label AND an unresolvable package goes red", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/someone/mystery:v1\n" },
      [
        entry({
          repository: "ghcr.io/someone/mystery",
          tags: { v1: 401 },
          sourceRepo: null,
          sourceEvidence: "none",
          sourceVisibility: "unknown",
          packagePresence: "found",
        }),
      ],
    );
    try {
      const hard = audit(fx.root, new Map(), new Map()).findings.filter((f) => !f.acknowledged);
      expect(hard.map((f) => f.rule)).toEqual(["private-source-dependency"]);
      expect(hard[0]?.detail).toContain("REMOVE IT");
    } finally {
      fx.dispose();
    }
  });

  test("a tag the ledger never measured is a finding — a tag bump is a new artifact", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/someone/mystery:v2\n" },
      [entry({ repository: "ghcr.io/someone/mystery", tags: { v1: 200 }, packagePresence: "found" })],
    );
    try {
      expect(hardFindings(fx.root)).toEqual(["ledger-tag-missing:ghcr.io/someone/mystery:v2"]);
    } finally {
      fx.dispose();
    }
  });

  test("a hand-edited verdict that does not fold from its own statuses is refused", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/someone/mystery:v1\n" },
      [
        {
          repository: "ghcr.io/someone/mystery",
          tags: { v1: 401 },
          artifact: "public", // the edit somebody would make
          sourceRepo: null,
          sourceEvidence: "none",
          sourceVisibility: "unknown",
          packagePresence: "found",
          resolvedAt: "2026-08-23",
        },
      ],
    );
    try {
      expect(hardFindings(fx.root)).toEqual(["ledger-access-disagrees:ghcr.io/someone/mystery"]);
    } finally {
      fx.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Ours vs foreign — the two remedies are opposite.
// ---------------------------------------------------------------------------

describe("ours and foreign get opposite remedies", () => {
  test("an OURS private package says PUBLISH and links the Danger Zone", () => {
    const e = entry({
      repository: "ghcr.io/lucent-financial-group/zeta-portal",
      tags: { latest: 401 },
      sourceRepo: "Lucent-Financial-Group/Zeta",
      sourceEvidence: "ghcr-package",
      sourceVisibility: "public",
      packagePresence: "found",
    });
    const cls = classify(e, new Set());
    expect(cls).toBe("ours-private");
    expect(remedy(cls, e)).toContain("PUBLISH IT");
    expect(remedy(cls, e)).toContain("Danger Zone");
    expect(remedy(cls, e)).not.toContain("REMOVE IT");
  });

  test("an OURS package that does not exist says BUILD AND PUSH, not flip visibility", () => {
    const e = entry({
      repository: "ghcr.io/lucent-financial-group/zeta-orleans-silo",
      tags: { latest: 401 },
      packagePresence: "absent",
    });
    const cls = classify(e, new Set());
    expect(cls).toBe("ours-unpublished");
    expect(remedy(cls, e)).toContain("BUILD AND PUSH IT");
    expect(remedy(cls, e)).not.toContain("Danger Zone");
  });

  test("ownership is read from the namespace OR the resolved source owner", () => {
    // Namespace route: no source label at all (a denied artifact has no
    // readable config blob, which is exactly when it matters).
    expect(
      classify(entry({ repository: "ghcr.io/lucent-financial-group/x", tags: { v1: 401 }, packagePresence: "found" }), new Set()),
    ).toBe("ours-private");
    // Source-owner route: a foreign registry namespace, ours by provenance.
    expect(
      classify(
        entry({
          repository: "registry.example.com/team/x",
          tags: { v1: 401 },
          sourceRepo: "Lucent-Financial-Group/Zeta",
          sourceEvidence: "oci-label",
        }),
        new Set(),
      ),
    ).toBe("ours-private");
  });

  test("the ours-namespace roster is not empty — an empty one would classify everything foreign", () => {
    expect(OUR_NAMESPACES.length).toBeGreaterThan(0);
    for (const ns of OUR_NAMESPACES) expect(ns).not.toEndWith("/");
  });
});

// ---------------------------------------------------------------------------
// 5. The register is a register, not an allowlist.
// ---------------------------------------------------------------------------

describe("the acknowledgement register", () => {
  test("an acknowledgement absorbs an ours finding but is still PRINTED", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/lucent-financial-group/x:v1\n" },
      [entry({ repository: "ghcr.io/lucent-financial-group/x", tags: { v1: 401 }, packagePresence: "found" })],
    );
    try {
      const acks = new Map<string, Acknowledgement>([
        ["ghcr.io/lucent-financial-group/x", { workitem: "081M0QNFBZ0087G0R000N3RXGF", recordedOn: "2026-08-23", reason: "LIFTS WHEN: published" }],
      ]);
      const result = audit(fx.root, acks, new Map());
      expect(result.findings.filter((f) => !f.acknowledged)).toEqual([]);
      expect(result.findings.filter((f) => f.acknowledged)).toHaveLength(1);
    } finally {
      fx.dispose();
    }
  });

  test("an acknowledgement whose image became obtainable goes STALE and fails", () => {
    const fx = makeTree(
      { "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/lucent-financial-group/x:v1\n" },
      [entry({ repository: "ghcr.io/lucent-financial-group/x", tags: { v1: 200 }, packagePresence: "found" })],
    );
    try {
      const acks = new Map<string, Acknowledgement>([
        ["ghcr.io/lucent-financial-group/x", { workitem: "081M0QNFBZ0087G0R000N3RXGF", recordedOn: "2026-08-23", reason: "LIFTS WHEN: published" }],
      ]);
      expect(hardFindings(fx.root, acks)).toEqual(["acknowledgement-stale:ghcr.io/lucent-financial-group/x"]);
    } finally {
      fx.dispose();
    }
  });

  test("every SHIPPED acknowledgement is in scope and names a lift condition", () => {
    for (const [key, ack] of ACKNOWLEDGED_PRIVATE) {
      expect(ack.workitem).toMatch(/^[0-9A-Z]{26}$/);
      expect(ack.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ack.reason).toContain("LIFTS WHEN:");
      // In scope by construction: only an ours-* class is acknowledgeable, and
      // every shipped key is under one of our namespaces.
      expect(OUR_NAMESPACES.some((ns) => key.startsWith(`${ns}/`))).toBe(true);
    }
  });

  test("acknowledgeable() covers exactly the ours-* classes", () => {
    expect(acknowledgeable("ours-private")).toBe(true);
    expect(acknowledgeable("ours-unpublished")).toBe(true);
    expect(acknowledgeable("foreign-private")).toBe(false);
    expect(refuses("foreign-private")).toBe(true);
    expect(refuses("tag-absent")).toBe(false);
    expect(refuses("built-in-tree")).toBe(false);
    expect(refuses("obtainable")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. The built-in-tree exemption is CHECKED.
// ---------------------------------------------------------------------------

describe("built-in-tree", () => {
  test("an exempt image with its recipe committed passes", () => {
    const fx = makeTree(
      {
        "agentic-organization/deploy/k8s/30-worker.yaml":
          "kind: Deployment\nspec:\n  template:\n    spec:\n      containers:\n        - image: agentic-org-worker:keepalive\n",
        "agentic-organization/Dockerfile": "FROM oven/bun:1\n",
      },
      [entry({ repository: "registry-1.docker.io/library/agentic-org-worker", tags: { keepalive: 401 } })],
    );
    try {
      const result = audit(fx.root, new Map(), BUILT_IN_TREE);
      expect(result.findings).toEqual([]);
      expect(result.byClass.get("built-in-tree")).toEqual(["agentic-org-worker:keepalive"]);
    } finally {
      fx.dispose();
    }
  });

  test("delete the recipe and the exemption evaporates — it is checked, not asserted", () => {
    const fx = makeTree(
      {
        "agentic-organization/deploy/k8s/30-worker.yaml":
          "kind: Deployment\nspec:\n  template:\n    spec:\n      containers:\n        - image: agentic-org-worker:keepalive\n",
      },
      [entry({ repository: "registry-1.docker.io/library/agentic-org-worker", tags: { keepalive: 401 } })],
    );
    try {
      const rules = hardFindings(fx.root, new Map(), BUILT_IN_TREE);
      expect(rules).toContain("build-recipe-missing:registry-1.docker.io/library/agentic-org-worker");
      // And with the exemption gone the image is refused like any other.
      expect(rules).toContain("private-source-dependency:agentic-org-worker:keepalive");
    } finally {
      fx.dispose();
    }
  });

  test("every SHIPPED exemption names a recipe path inside the repo", () => {
    expect(BUILT_IN_TREE.size).toBeGreaterThan(0);
    for (const recipe of BUILT_IN_TREE.values()) {
      expect(recipe).not.toStartWith("/");
      expect(recipe).not.toContain("..");
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Scan scope, drift, and vacuity.
// ---------------------------------------------------------------------------

describe("scope and drift", () => {
  test("a manifest in a directory nobody declared is STILL scanned", () => {
    // The exclusion-list design, stated as a falsifier: a roster of manifest
    // roots would have missed this file. A new tree fails until it is measured.
    const fx = makeTree(
      { "some/brand/new/place/deploy.yaml": "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/flowdent/cloudservice:latest\n" },
      [],
    );
    try {
      expect(hardFindings(fx.root)).toEqual(["ledger-entry-missing:ghcr.io/flowdent/cloudservice:latest"]);
    } finally {
      fx.dispose();
    }
  });

  test("docs/ and references/ are excluded — prose is never applied to a cluster", () => {
    const body = "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/flowdent/cloudservice:latest\n";
    const fx = makeTree({ "docs/example.yaml": body, "references/prior-art/thing.yaml": body }, []);
    try {
      const result = audit(fx.root, new Map(), new Map());
      // No image findings; the vacuity guard is what fires instead, which is
      // exactly right: a scan that found nothing must say so rather than pass.
      expect(result.findings.map((f) => f.rule)).toEqual(["no-images-found"]);
    } finally {
      fx.dispose();
    }
  });

  test("an UNTRACKED manifest cannot smuggle a reference past the scan or into it", () => {
    const fx = makeTree({ "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: postgres:16-alpine\n" }, [
      entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 } }),
    ]);
    try {
      writeFileSync(join(fx.root, "fixture/k8s/sneaky.yaml"), "kind: Pod\nspec:\n  containers:\n    - image: ghcr.io/flowdent/cloudservice:latest\n");
      // Untracked: not scanned. Recorded so the boundary is a decision, not an
      // accident -- `git add` is what puts a manifest in scope, and CI only
      // ever sees tracked files.
      expect(collectImageUses(fx.root).uses.map((u) => u.image)).toEqual(["postgres:16-alpine"]);
    } finally {
      fx.dispose();
    }
  });

  test("a ledger row for an image the tree no longer references is a finding", () => {
    const fx = makeTree({ "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: postgres:16-alpine\n" }, [
      entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 } }),
      entry({ repository: "ghcr.io/flowdent/cloudservice", tags: { latest: 401 } }),
    ]);
    try {
      expect(hardFindings(fx.root)).toEqual(["ledger-entry-orphaned:ghcr.io/flowdent/cloudservice"]);
    } finally {
      fx.dispose();
    }
  });

  test("an unparseable manifest is a finding, never a skip", () => {
    const fx = makeTree(
      {
        "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: postgres:16-alpine\n",
        // Must mention `image` or the prefilter (correctly) skips it: a file
        // that cannot carry an image reference is not this check's business.
        "fixture/k8s/broken.yaml": "kind: Pod\nspec:\n  image: a: b: c\n  x: [1, 2\n",
      },
      [entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 } })],
    );
    try {
      expect(hardFindings(fx.root)).toEqual(["manifest-unparseable:fixture/k8s/broken.yaml"]);
    } finally {
      fx.dispose();
    }
  });

  test("a file whose bytes never say `image` is skipped — stated, not hidden", () => {
    // The prefilter that takes this check from ~4.5s to ~0.4s on the real tree.
    // Its cost is that a malformed YAML with no image text is not reported, and
    // that is the correct scope rather than a silent gap.
    const fx = makeTree(
      {
        "fixture/k8s/app.yaml": "kind: Pod\nspec:\n  containers:\n    - image: postgres:16-alpine\n",
        "fixture/k8s/not-a-manifest.yaml": "a: [1, 2\n  b: : :\n",
      },
      [entry({ repository: "registry-1.docker.io/library/postgres", tags: { "16-alpine": 200 } })],
    );
    try {
      expect(hardFindings(fx.root)).toEqual([]);
    } finally {
      fx.dispose();
    }
  });

  test("a tree with manifests but no images REFUSES rather than reporting green", () => {
    const fx = makeTree({ "fixture/k8s/app.yaml": "kind: ConfigMap\ndata:\n  a: b\n" }, []);
    try {
      expect(hardFindings(fx.root)).toEqual(["no-images-found:(tree)"]);
    } finally {
      fx.dispose();
    }
  });

  test("the exclusion list is prefixes, and none of them swallow the cluster tree", () => {
    for (const p of EXCLUDED_PREFIXES) expect(p).toEndWith("/");
    for (const p of EXCLUDED_PREFIXES) {
      expect("full-ai-cluster/k8s/applications/platform/blueprints.yaml".startsWith(p)).toBe(false);
      expect("fixture/k8s/bootstrap/initial-orleans.yaml".startsWith(p)).toBe(false);
      expect("agentic-organization/deploy/k8s/30-worker.yaml".startsWith(p)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Reference parsing and the fold.
// ---------------------------------------------------------------------------

describe("keys and folding", () => {
  test("repositoryKey is tag-independent and digest-safe", () => {
    expect(repositoryKey("ghcr.io/flowdent/cloudservice:latest")).toBe("ghcr.io/flowdent/cloudservice");
    expect(repositoryKey("postgres:16-alpine")).toBe("registry-1.docker.io/library/postgres");
    // The case that cost image-footprint.ts 10 of 129 images: tag AND digest.
    expect(repositoryKey("grafana/loki:3.0.0@sha256:" + "0".repeat(64))).toBe("registry-1.docker.io/grafana/loki");
  });

  test("foldAccess: one open tag opens the repository; all-denied closes it", () => {
    expect(foldAccess({ a: 200, b: 404 })).toBe("public");
    expect(foldAccess({ a: 401, b: 403 })).toBe("denied");
    expect(foldAccess({ a: 404 })).toBe("tag-absent");
    expect(foldAccess({ a: 0 })).toBe("unreachable");
    expect(foldAccess({})).toBe("unreachable");
  });

  test("the fold is why one sampled tag cannot decide a repository", () => {
    // Measured on main 2026-08-23: `ghcr.io/ich777/steamcmd` was referenced at
    // three tags, `armareforger` 404ing and the other two 200. Sampling
    // `armareforger` alone would have set the whole repository's verdict. Main
    // has since swapped that tag out, which is why the case is pinned here as a
    // unit rather than left to the tree to keep demonstrating.
    expect(foldAccess({ armareforger: 404, garrysmod: 200, unturned: 200 })).toBe("public");
  });
});

// ---------------------------------------------------------------------------
// 9. The real tree.
// ---------------------------------------------------------------------------

describe("this repository, right now", () => {
  // Computed ONCE. A real-tree audit walks 16k tracked paths and parses 49
  // manifests; running it three times put the suite within a whisker of bun's
  // 5s per-test budget on this laptop, which would be a flake on a slower
  // hosted runner -- and a flaky gate is a gate people switch off.
  let cached: ReturnType<typeof audit> | null = null;
  const realTree = (): ReturnType<typeof audit> => (cached ??= audit());

  test("main is clean of unacknowledged private-source dependencies", () => {
    const hard = realTree().findings.filter((f) => !f.acknowledged);
    expect(hard.map((f) => `${f.rule}:${f.subject}`)).toEqual([]);
  }, 30_000);

  test("the scan actually finds images — a green run must state its own scope", () => {
    const result = realTree();
    expect(result.imageCount).toBeGreaterThan(20);
    expect(result.manifestCount).toBeGreaterThan(50);
    expect((result.byClass.get("obtainable") ?? []).length).toBeGreaterThan(20);
  }, 30_000);

  test("no image in this tree classifies foreign-private — the one-way rule, measured", () => {
    expect(realTree().byClass.get("foreign-private") ?? []).toEqual([]);
  }, 30_000);

  test("the three ours-unpublished references are ACKNOWLEDGED, not silently passed", () => {
    // Pins the current honest state: the check is not green because it found
    // nothing, it is green because three real findings are on the register with
    // a work-item and a lift condition. If one is published, the register goes
    // stale and this repository goes red until the entry is deleted.
    const acked = realTree().findings.filter((f) => f.acknowledged);
    expect(acked.map((f) => f.subject).sort()).toEqual([
      "ghcr.io/lucent-financial-group/hat-system-operator:placeholder",
      "ghcr.io/lucent-financial-group/zeta-orleans-silo:bootstrap",
      "ghcr.io/lucent-financial-group/zeta-orleans-silo:latest",
    ]);
    for (const f of acked) expect(f.detail).toContain("LIFTS WHEN:");
  }, 30_000);
});

// ---------------------------------------------------------------------------
// 10. The refresh half must not manufacture a change out of its own degradation.
// ---------------------------------------------------------------------------

describe("no-downgrade under lost packages access", () => {
  test("an unauthenticated run keeps what an authenticated one measured", () => {
    // Measured in CI on run 32654405529: `${{ github.token }}` is an
    // installation token, `gh api user` fails under it, the packages half
    // reported itself unavailable, and the refresh rewrote all 28 rows from
    // `found`/`absent` to `unreadable`. The lane then said the provenance had
    // moved. It had not — the measurer had. `toLedgerEntry` now preserves the
    // prior value under `unreadable`, and this pins it.
    const prior: LedgerEntry = {
      repository: "ghcr.io/lucent-financial-group/zeta-orleans-silo",
      tags: { latest: 401 },
      artifact: "denied",
      sourceRepo: "Lucent-Financial-Group/Zeta",
      sourceEvidence: "ghcr-package",
      sourceVisibility: "public",
      packagePresence: "absent",
      resolvedAt: "2026-08-23",
    };
    const degraded = toLedgerEntry(
      prior.repository,
      { tags: { latest: 401 }, sourceRepo: null, sourceEvidence: "none" },
      /* ghAvailable */ false,
      "2026-08-24",
      prior,
    );
    expect(degraded.packagePresence).toBe("absent");
    expect(degraded.sourceRepo).toBe("Lucent-Financial-Group/Zeta");
    expect(degraded.sourceVisibility).toBe("public");
    expect(degraded.sourceEvidence).toBe("ghcr-package");
    // and the classification does not flip remedy under degradation
    expect(classify(degraded, new Set())).toBe("ours-unpublished");
  });

  test("the freshly measured half is NEVER preserved — `artifact` always re-measures", () => {
    // The half that decides refusal must come from this run's anonymous pull, or
    // a package that went private would keep reading as public forever.
    const prior: LedgerEntry = {
      repository: "ghcr.io/lucent-financial-group/zeta-portal",
      tags: { latest: 200 },
      artifact: "public",
      sourceRepo: "Lucent-Financial-Group/Zeta",
      sourceEvidence: "oci-label",
      sourceVisibility: "public",
      packagePresence: "found",
      resolvedAt: "2026-08-23",
    };
    const nowPrivate = toLedgerEntry(
      prior.repository,
      { tags: { latest: 401 }, sourceRepo: null, sourceEvidence: "none" },
      false,
      "2026-08-24",
      prior,
    );
    expect(nowPrivate.artifact).toBe("denied");
    expect(classify(nowPrivate, new Set())).toBe("ours-private");
  });

  test("a brand-new row under degradation is `unreadable`, never `absent`", () => {
    const fresh = toLedgerEntry(
      "ghcr.io/someone/brand-new",
      { tags: { v1: 401 }, sourceRepo: null, sourceEvidence: "none" },
      false,
      "2026-08-24",
      undefined,
    );
    expect(fresh.packagePresence).toBe("unreadable");
    // unreadable is not `absent`, so the remedy stays REMOVE rather than
    // inventing "build and push it" for someone else's package.
    expect(classify(fresh, new Set())).toBe("foreign-private");
  });
});
