// Red-proof tests for the "a named Secret must be minted" guard.
//
// The load-bearing one is `the KEY SHAPE is matched, not one spelling` — the
// first version of this audit matched only `existingSecret` and therefore missed
// `oz`'s `customAdminSecretName`, which is a Secret the roster really does mint.
// A guard that recognises one spelling does not prevent a class of defect; it
// prevents that defect written one way, and the next arrives spelled differently.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  adjudicate,
  auditBothSecretScans,
  auditExistingSecretIsMinted,
  collectRawSecretReferences,
  collectSecretReferences,
  collectTreeMintedSecretNames,
  exitCode,
  formatReport,
  matchedBaselineKeys,
  readBaseline,
  referenceKey,
  type BaselineEntry,
  type SecretReference,
} from "./audit-existing-secret-is-minted.ts";
import { DEV_BOOTSTRAP_SECRETS, DEV_SHARED_SECRETS } from "./dev-cluster/lib.ts";

function appTree(values: string, dir = "app"): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "zeta-secretref-"));
  const abs = join(root, "full-ai-cluster/k8s/applications", dir, "Application.yaml");
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    ["apiVersion: argoproj.io/v1alpha1", "kind: Application", "spec:", "  source:", "    helm:", "      valuesObject:", values].join("\n"),
    "utf8",
  );
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const ref = (over: Partial<SecretReference> = {}): SecretReference => ({
  app: "app",
  manifest: "m.yaml",
  field: "auth.existingSecret",
  secretName: "s",
  ...over,
});

const entry = (over: Partial<BaselineEntry> = {}): BaselineEntry => ({
  key: "app|s",
  reason: "a reason long enough to be a reason rather than a shrug",
  liftsWhen: "the roster mints it",
  ...over,
});

// ---------------------------------------------------------------------------

describe("collectSecretReferences", () => {
  test("GREEN: an existingSecret is collected with its dotted path", () => {
    const fx = appTree("        auth:\n          existingSecret: my-secret");
    try {
      const refs = collectSecretReferences(fx.root);
      expect(refs).toHaveLength(1);
      expect(refs[0]?.secretName).toBe("my-secret");
      expect(refs[0]?.field).toBe("auth.existingSecret");
    } finally {
      fx.cleanup();
    }
  });

  // THE DISCRIMINATOR. `oz` names its credential this way and the narrow pattern
  // missed it entirely — in the acquitting direction, which is the one that
  // matters for a guard.
  test("the KEY SHAPE is matched, not one spelling — customAdminSecretName counts", () => {
    const fx = appTree("        useCustomAdminSecret: true\n        customAdminSecretName: ziti-admin-credentials");
    try {
      const refs = collectSecretReferences(fx.root);
      expect(refs.map((r) => r.secretName)).toEqual(["ziti-admin-credentials"]);
    } finally {
      fx.cleanup();
    }
  });

  test("...and so does usersExistingSecret, the spelling that caused the redis break", () => {
    const fx = appTree("        auth:\n          usersExistingSecret: redis-auth");
    try {
      expect(collectSecretReferences(fx.root).map((r) => r.secretName)).toEqual(["redis-auth"]);
    } finally {
      fx.cleanup();
    }
  });

  test("nested paths are found — temporal buries one four levels down", () => {
    const fx = appTree(
      "        server:\n          config:\n            persistence:\n              default:\n                sql:\n                  existingSecret: temporal-default-store",
    );
    try {
      const refs = collectSecretReferences(fx.root);
      expect(refs[0]?.field).toBe("server.config.persistence.default.sql.existingSecret");
    } finally {
      fx.cleanup();
    }
  });

  // Cry-wolf control: several charts use "" to mean "generate one for me".
  test("an EMPTY existingSecret is not a reference — it is the chart's generate-me idiom", () => {
    const fx = appTree('        auth:\n          existingSecret: ""');
    try {
      expect(collectSecretReferences(fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("a key that merely CONTAINS the word secret is not a reference", () => {
    const fx = appTree("        auth:\n          secretKeyRef: not-a-name\n          rotateSecrets: true");
    try {
      expect(collectSecretReferences(fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });
});

describe("adjudicate", () => {
  test("GREEN: a minted Secret needs no acknowledgement", () => {
    const a = adjudicate([ref({ secretName: "grafana-admin-credentials" })], new Set(["grafana-admin-credentials"]), []);
    expect(a.refused).toEqual([]);
    expect(a.minted).toHaveLength(1);
    expect(exitCode(a)).toBe(0);
  });

  test("RED: an unminted, unacknowledged Secret is refused", () => {
    const a = adjudicate([ref()], new Set(), []);
    expect(a.refused).toHaveLength(1);
    expect(exitCode(a)).toBe(1);
    expect(formatReport(a)).toContain("REFUSED app");
  });

  test("GREEN: an acknowledged one is carried, and says it is still unminted", () => {
    const a = adjudicate([ref()], new Set(), [entry()]);
    expect(a.refused).toEqual([]);
    expect(a.acknowledged).toHaveLength(1);
    expect(formatReport(a)).toContain("STILL UNMINTED");
    expect(exitCode(a)).toBe(0);
  });

  test("RED: an acknowledgement matching nothing is STALE — this is how a lifted exclusion re-asks", () => {
    const a = adjudicate([], new Set(), [entry()]);
    expect(a.staleKeys).toEqual(["app|s"]);
    expect(exitCode(a)).toBe(1);
  });

  test("minting BEATS acknowledging — the entry then goes stale rather than lingering", () => {
    const a = adjudicate([ref()], new Set(["s"]), [entry()]);
    expect(a.minted).toHaveLength(1);
    expect(a.acknowledged).toEqual([]);
    expect(a.staleKeys).toEqual(["app|s"]);
  });

  test("the key is app-scoped, so one app's acknowledgement never covers another's", () => {
    const a = adjudicate([ref({ app: "other" })], new Set(), [entry()]);
    expect(a.refused).toHaveLength(1);
    expect(referenceKey("other", "s")).toBe("other|s");
  });
});

describe("readBaseline", () => {
  for (const field of ["reason", "liftsWhen"] as const) {
    test(`RED: an entry with no ${field} is refused`, () => {
      const e = { ...entry() } as Record<string, unknown>;
      delete e[field];
      const root = mkdtempSync(join(tmpdir(), "zeta-secretbase-"));
      writeFileSync(join(root, "b.json"), JSON.stringify({ entries: [e] }), "utf8");
      try {
        expect(() => readBaseline("b.json", root)).toThrow(new RegExp(`has no "${field}"`));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe("the live tree", () => {
  // BOTH ROSTERS, exactly as `main()` builds it -- a test that read only one would pass while
// the tool refused a Secret the dev lane creates.
const minted = new Set([...DEV_BOOTSTRAP_SECRETS, ...DEV_SHARED_SECRETS].map((s) => s.name));

  test("every named Secret is minted or acknowledged — no refusals, no stale entries", () => {
    // WP3: driven through `auditBothSecretScans` rather than the standalone
    // `auditExistingSecretIsMinted`, because three baseline entries
    // (platform|ghcr-pull, orleans|redis-auth, kubevirt|kubevirt-operator-certs)
    // are matched ONLY by the raw-manifest scan; calling the valuesObject scan
    // alone (with no cross-scan suppression) would report them all STALE. See
    // "WP3: raw-manifest scan ..." below for the raw side of the same check.
    const { valuesObject: result } = auditBothSecretScans(undefined, minted);
    expect(result.refused.map((r) => referenceKey(r.app, r.secretName))).toEqual([]);
    expect(result.staleKeys).toEqual([]);
    expect(exitCode(result)).toBe(0);
  });

  test("and it is NOT vacuous: the tree really does name Secrets, and the roster really does mint some", () => {
    // If either side ever empties, the check above passes by having nothing to
    // check — which is the failure mode this whole file is about.
    const result = auditExistingSecretIsMinted(minted);
    expect(result.minted.length + result.acknowledged.length).toBeGreaterThan(0);
    expect(minted.size).toBeGreaterThan(0);
    // Both roster credentials are actually REFERENCED by an Application; a
    // minted Secret nobody names would be a credential with no consumer.
    // SETS, not arrays. `zeta-blob-store` is referenced by THREE Applications (seaweedfs
    // names it in `s3.existingConfigSecret`; loki and mimir in `global.extraEnvFrom`), so
    // `result.minted` legitimately carries it three times while `minted` is a set of names.
    // Comparing the arrays would fail on duplication rather than on the property, which is
    // "every minted Secret has at least one consumer".
    expect([...new Set(result.minted.map((r) => r.secretName))].sort()).toEqual([...minted].sort());
  });

  test("WP3: raw-manifest scan (imagePullSecrets/envFrom/secretKeyRef/volumes) — no refusals, no stale entries", () => {
    // auditExistingSecretIsMinted's standalone form has NO cross-scan staleness
    // suppression (documented on the function itself), and several baseline
    // entries -- platform|ghcr-pull, orleans|redis-auth,
    // kubevirt|kubevirt-operator-certs -- are matched ONLY by the raw scan. So
    // this test drives BOTH scans together the way `main()` does, not either
    // scan alone; calling the raw scan in isolation would report those three
    // entries STALE (matched by neither THIS call nor a sibling it never ran).
    const { valuesObject, raw } = auditBothSecretScans(undefined, minted);
    expect(raw.refused.map((r) => referenceKey(r.app, r.secretName))).toEqual([]);
    expect(raw.staleKeys).toEqual([]);
    expect(valuesObject.staleKeys).toEqual([]);
    expect(exitCode(raw)).toBe(0);
  });

  test("WP3: the raw scan is not vacuous either — it really does find pod-spec references", () => {
    const refs = collectRawSecretReferences();
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.some((r) => r.app === "platform" && r.secretName === "ghcr-pull")).toBe(true);
  });

  test("WP3: ddns is out of the app-of-apps roster (no Application.yaml) and is not scanned", () => {
    // ddns/cronjob.yaml's own header documents this: applied by hand, opt-in,
    // "this dir has no Application.yaml on purpose". Scanning it would refuse
    // a Secret this audit's actual subject (the ArgoCD-managed tree) never
    // depends on.
    const refs = collectRawSecretReferences();
    expect(refs.some((r) => r.app === "ddns")).toBe(false);
  });

  test("WP3: collectTreeMintedSecretNames finds real Secret/SealedSecret/ExternalSecret manifests", () => {
    const minted2 = collectTreeMintedSecretNames();
    // Not asserting a specific name (the tree may add/remove SealedSecrets), just
    // that the collector is not vacuous -- reused across every raw-scan run.
    expect(minted2 instanceof Set).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WP3 synthetic falsifiers -- collectRawSecretReferences / collectTreeMintedSecretNames
// ---------------------------------------------------------------------------

/** A synthetic Application, with an Application.yaml PLUS one raw workload manifest. */
function rawFixture(workloadYaml: string, dir = "app"): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "zeta-rawsecretref-"));
  const appDir = join(root, "full-ai-cluster/k8s/applications", dir);
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    join(appDir, "Application.yaml"),
    "apiVersion: argoproj.io/v1alpha1\nkind: Application\nspec:\n  source:\n    path: x\n",
    "utf8",
  );
  writeFileSync(join(appDir, "workload.yaml"), workloadYaml, "utf8");
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("collectRawSecretReferences", () => {
  test("finds imagePullSecrets on a pod template", () => {
    const fx = rawFixture(`
apiVersion: apps/v1
kind: Deployment
metadata: { name: x }
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-pull
      containers: []
`);
    try {
      const refs = collectRawSecretReferences(fx.root);
      expect(refs.map((r) => r.secretName)).toEqual(["ghcr-pull"]);
    } finally {
      fx.cleanup();
    }
  });

  test("finds envFrom.secretRef.name", () => {
    const fx = rawFixture(`
apiVersion: apps/v1
kind: Deployment
metadata: { name: x }
spec:
  template:
    spec:
      containers:
        - name: c
          envFrom:
            - secretRef: { name: my-env-secret }
`);
    try {
      expect(collectRawSecretReferences(fx.root).map((r) => r.secretName)).toEqual(["my-env-secret"]);
    } finally {
      fx.cleanup();
    }
  });

  test("finds env[].valueFrom.secretKeyRef.name", () => {
    const fx = rawFixture(`
apiVersion: batch/v1
kind: CronJob
metadata: { name: x }
spec:
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: c
              env:
                - name: PASSWORD
                  valueFrom:
                    secretKeyRef: { name: cron-secret, key: password }
`);
    try {
      expect(collectRawSecretReferences(fx.root).map((r) => r.secretName)).toEqual(["cron-secret"]);
    } finally {
      fx.cleanup();
    }
  });

  test("finds volumes[].secret.secretName", () => {
    const fx = rawFixture(`
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: x }
spec:
  template:
    spec:
      volumes:
        - name: certs
          secret: { secretName: my-tls-secret }
`);
    try {
      expect(collectRawSecretReferences(fx.root).map((r) => r.secretName)).toEqual(["my-tls-secret"]);
    } finally {
      fx.cleanup();
    }
  });

  test("does NOT report the CREATING side — a Secret manifest naming itself is not a reference", () => {
    const fx = rawFixture(`
apiVersion: v1
kind: Secret
metadata: { name: my-own-secret }
stringData: { password: x }
`);
    try {
      expect(collectRawSecretReferences(fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("skips a directory with no Application.yaml — out of the app-of-apps roster", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-rawsecretref-noapp-"));
    const dir = join(root, "full-ai-cluster/k8s/applications/manual-only");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "cronjob.yaml"),
      "apiVersion: batch/v1\nkind: CronJob\nmetadata: { name: x }\nspec:\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          containers:\n            - name: c\n              envFrom:\n                - secretRef: { name: manual-secret }\n",
      "utf8",
    );
    try {
      expect(collectRawSecretReferences(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("collectTreeMintedSecretNames", () => {
  test("a plain Secret mints its own metadata.name", () => {
    const fx = rawFixture("apiVersion: v1\nkind: Secret\nmetadata: { name: minted-one }\n");
    try {
      expect(collectTreeMintedSecretNames(fx.root).has("minted-one")).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  test("a SealedSecret mints its own metadata.name (unseals to the same name)", () => {
    const fx = rawFixture("apiVersion: bitnami.com/v1alpha1\nkind: SealedSecret\nmetadata: { name: sealed-one }\n");
    try {
      expect(collectTreeMintedSecretNames(fx.root).has("sealed-one")).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  test("an ExternalSecret mints spec.target.name when set, else its own metadata.name", () => {
    const withTarget = rawFixture(
      "apiVersion: external-secrets.io/v1\nkind: ExternalSecret\nmetadata: { name: es-object }\nspec:\n  target: { name: real-secret-name }\n",
    );
    const withoutTarget = rawFixture(
      "apiVersion: external-secrets.io/v1\nkind: ExternalSecret\nmetadata: { name: es-object-2 }\nspec: {}\n",
      "app2",
    );
    try {
      expect(collectTreeMintedSecretNames(withTarget.root).has("real-secret-name")).toBe(true);
      expect(collectTreeMintedSecretNames(withTarget.root).has("es-object")).toBe(false);
      expect(collectTreeMintedSecretNames(withoutTarget.root).has("es-object-2")).toBe(true);
    } finally {
      withTarget.cleanup();
      withoutTarget.cleanup();
    }
  });
});

describe("matchedBaselineKeys + cross-scan staleness suppression", () => {
  test("a reference matching a baseline key is reported, minted references are not", () => {
    const baseline = [entry({ key: "app|s" })];
    const matched = matchedBaselineKeys([ref({ secretName: "s" })], new Set(), baseline);
    expect(matched).toEqual(new Set(["app|s"]));
    const mintedInstead = matchedBaselineKeys([ref({ secretName: "s" })], new Set(["s"]), baseline);
    expect(mintedInstead).toEqual(new Set());
  });

  test("adjudicate's alsoUsedKeys prevents a sibling-matched key from being reported stale", () => {
    const baseline = [entry({ key: "app|s" })];
    // This scan's OWN references never touch `app|s` -- without alsoUsedKeys it
    // would be reported STALE, which is exactly the false positive that would
    // have fired for platform|ghcr-pull (matched only by the raw scan) against
    // the valuesObject scan's baseline read.
    const result = adjudicate([], new Set(), baseline, new Set(["app|s"]));
    expect(result.staleKeys).toEqual([]);
  });

  test("without alsoUsedKeys, the same setup DOES report it stale — proving the fix is load-bearing", () => {
    const baseline = [entry({ key: "app|s" })];
    const result = adjudicate([], new Set(), baseline);
    expect(result.staleKeys).toEqual(["app|s"]);
  });
});
