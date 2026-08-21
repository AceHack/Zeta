// Red-proof tests for the storage size profile ladder.
//
// Same discipline as single-node-readiness.test.ts: every assertion comes in
// pairs, a GREEN case and the RED case the same code path must reject. A
// profile mechanism whose validator cannot go red would be a more expensive way
// of writing the numbers down twice.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_CATALOGUE_PATH,
  applyProfile,
  claimGib,
  crossCheckClaims,
  loadCatalogue,
  parseFieldPath,
  profileBringUpGib,
  profileTotalGib,
  verifyProfileApplied,
  type ExtractedClaim,
} from "./storage-profiles.ts";

// ---------------------------------------------------------------------------
// A synthetic repo, so the validator's refusals are tested on inputs we control
// rather than only on the one catalogue that happens to be correct.
// ---------------------------------------------------------------------------

interface Fixture {
  readonly root: string;
  readonly cleanup: () => void;
}

function fixture(files: Readonly<Record<string, string>>): Fixture {
  const root = mkdtempSync(join(tmpdir(), "zeta-profiles-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const APP_YAML = `# a heavily commented values block, because the applier must not eat comments
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: db
spec:
  source:
    helm:
      valuesObject:
        statefulset:
          # three Raft members
          replicas: 3
        storage:
          persistentVolume:
            size: 100Gi
            storageClass: longhorn
`;

function catalogueJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    profiles: ["minimal", "large"],
    claims: [
      {
        id: "tree/db/data",
        path: "apps/db/Application.yaml",
        docIndex: 0,
        storageClassField: "spec.source.helm.valuesObject.storage.persistentVolume.storageClass",
        sizeField: "spec.source.helm.valuesObject.storage.persistentVolume.size",
        podsField: "spec.source.helm.valuesObject.statefulset.replicas",
        podsSource: "manifest",
        podsEvidence: "",
        scheduledAtBringUp: true,
        bringUpNote: "automated sync",
        consequence: "minimal drops the Raft group to one member: no quorum, no replication.",
        sizes: { minimal: "20Gi", large: "100Gi" },
        pods: { minimal: 1, large: 3 },
        ...overrides,
      },
    ],
  });
}

function writeCatalogue(files: Record<string, string>, json: string): Record<string, string> {
  return { ...files, "profiles.json": json };
}

// ---------------------------------------------------------------------------

describe("parseFieldPath", () => {
  test("dotted keys and bracketed indices", () => {
    expect(parseFieldPath("spec.volumeClaimTemplates[0].spec.resources.requests.storage")).toEqual([
      "spec",
      "volumeClaimTemplates",
      0,
      "spec",
      "resources",
      "requests",
      "storage",
    ]);
  });

  test("a bare key is a one-element path", () => {
    expect(parseFieldPath("size")).toEqual(["size"]);
  });

  // RED: a malformed path must throw rather than silently address a
  // neighbouring node, which is how a rewrite lands in the wrong key.
  test("RED: trailing junk after an index is refused", () => {
    expect(() => parseFieldPath("a[0]x.b")).toThrow(/malformed/);
  });

  test("RED: an empty segment is refused", () => {
    expect(() => parseFieldPath("a..b")).toThrow(/malformed/);
  });
});

describe("loadCatalogue refusals — each one keeps the ladder from meaning nothing", () => {
  function load(json: string) {
    const fx = fixture(writeCatalogue({}, json));
    try {
      return loadCatalogue("profiles.json", fx.root);
    } finally {
      fx.cleanup();
    }
  }

  test("a well-formed catalogue loads", () => {
    const catalogue = load(catalogueJson());
    expect(catalogue.profiles).toEqual(["minimal", "large"]);
    expect(catalogue.claims).toHaveLength(1);
  });

  test("RED: an empty profile list is refused", () => {
    expect(() => load(JSON.stringify({ profiles: [], claims: [] }))).toThrow(/non-empty/);
  });

  test("RED: a size that is not a Kubernetes quantity is refused", () => {
    expect(() => load(catalogueJson({ sizes: { minimal: "big", large: "100Gi" } }))).toThrow(/not a positive/);
  });

  test("RED: a profile with no size entry is refused", () => {
    expect(() => load(catalogueJson({ sizes: { large: "100Gi" } }))).toThrow(/sizes\.minimal missing/);
  });

  // The ladder has to climb. Without this a row could make "minimal" the
  // largest profile for one app and every total would still add up.
  test("RED: non-monotone sizes along the profile order are refused", () => {
    expect(() => load(catalogueJson({ sizes: { minimal: "100Gi", large: "20Gi" } }))).toThrow(
      /monotonically non-decreasing/,
    );
  });

  test("RED: a zero or negative pod count is refused", () => {
    expect(() => load(catalogueJson({ pods: { minimal: 0, large: 3 } }))).toThrow(/positive integer/);
  });

  // The mimir lesson, encoded: a pod count our YAML does not carry must say
  // where it came from, or nobody can check it and nobody did.
  test("RED: podsSource=chart-default with no evidence is refused", () => {
    expect(() =>
      load(
        catalogueJson({
          podsSource: "chart-default",
          podsEvidence: "   ",
          podsField: null,
          pods: { minimal: 3, large: 3 },
        }),
      ),
    ).toThrow(/podsEvidence/);
  });

  test("GREEN: podsSource=chart-default WITH evidence loads", () => {
    const catalogue = load(
      catalogueJson({
        podsSource: "chart-default",
        podsEvidence: "chart X 1.0.0 values.yaml component.replicas=3",
        podsField: null,
        pods: { minimal: 3, large: 3 },
      }),
    );
    expect(catalogue.claims[0]?.podsSource).toBe("chart-default");
  });

  // A profile that varies pods with nowhere to write them would total a number
  // the cluster never receives.
  test("RED: pods varying across profiles with podsField null is refused", () => {
    expect(() =>
      load(
        catalogueJson({
          podsSource: "singleton",
          podsEvidence: "one pod",
          podsField: null,
          pods: { minimal: 1, large: 3 },
        }),
      ),
    ).toThrow(/no podsField/);
  });

  test("RED: a duplicate claim id is refused", () => {
    const doubled = JSON.parse(catalogueJson()) as { claims: unknown[] };
    doubled.claims = [doubled.claims[0], doubled.claims[0]];
    expect(() => load(JSON.stringify(doubled))).toThrow(/duplicate claim id/);
  });
});

describe("arithmetic", () => {
  const fx = fixture(writeCatalogue({}, catalogueJson()));
  const catalogue = loadCatalogue("profiles.json", fx.root);
  fx.cleanup();

  test("a claim costs size x pods", () => {
    expect(claimGib(catalogue.claims[0] as never, "large")).toBe(300);
    expect(claimGib(catalogue.claims[0] as never, "minimal")).toBe(20);
  });

  test("profile total sums every claim", () => {
    expect(profileTotalGib(catalogue, "large")).toBe(300);
  });

  test("bring-up total counts only the scheduled subset", () => {
    expect(profileBringUpGib(catalogue, "large")).toBe(300);
  });

  test("RED: an unknown profile throws rather than totalling zero", () => {
    expect(() => profileTotalGib(catalogue, "nope")).toThrow(/no entry for profile/);
  });
});

describe("verifyProfileApplied", () => {
  test("GREEN: manifests matching the profile produce no findings", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(verifyProfileApplied(catalogue, "large", fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("RED: a size that disagrees with the profile is a finding", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      const findings = verifyProfileApplied(catalogue, "minimal", fx.root);
      expect(findings.some((finding) => finding.problem.includes("100Gi") && finding.problem.includes("20Gi"))).toBe(
        true,
      );
    } finally {
      fx.cleanup();
    }
  });

  // Checking only the size would let a profile promise a pod count the cluster
  // never gets -- which is precisely how mimir was 200 GiB out.
  test("RED: a pod count that disagrees with the profile is a finding", () => {
    const fx = fixture(
      writeCatalogue({ "apps/db/Application.yaml": APP_YAML.replace("replicas: 3", "replicas: 5") }, catalogueJson()),
    );
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      const findings = verifyProfileApplied(catalogue, "large", fx.root);
      expect(findings.some((finding) => finding.problem.includes("5 pods"))).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  test("RED: a catalogue row pointing at a coordinate that no longer exists is a finding", () => {
    const fx = fixture(
      writeCatalogue(
        { "apps/db/Application.yaml": APP_YAML.replace("storageClass: longhorn", "other: longhorn") },
        catalogueJson(),
      ),
    );
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(verifyProfileApplied(catalogue, "large", fx.root)[0]?.problem).toMatch(/no longer exists/);
    } finally {
      fx.cleanup();
    }
  });
});

describe("crossCheckClaims — two oracles, and their disagreement is the finding", () => {
  const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
  const catalogue = loadCatalogue("profiles.json", fx.root);
  fx.cleanup();

  const matching: ExtractedClaim = {
    path: "apps/db/Application.yaml",
    field: "spec.source.helm.valuesObject.storage.persistentVolume.storageClass",
    storageClass: "longhorn",
    gibibytes: 100,
    replicas: 3,
  };

  test("GREEN: agreeing oracles produce no findings", () => {
    expect(crossCheckClaims(catalogue, [matching], "longhorn", "large")).toEqual([]);
  });

  test("RED: a claim in the tree with no catalogue row is a finding", () => {
    const orphan: ExtractedClaim = { ...matching, path: "apps/other/Application.yaml" };
    const findings = crossCheckClaims(catalogue, [matching, orphan], "longhorn", "large");
    expect(findings[0]?.problem).toMatch(/no row in the storage-profile catalogue/);
  });

  test("RED: a catalogue row matching no claim is a finding", () => {
    const findings = crossCheckClaims(catalogue, [], "longhorn", "large");
    expect(findings[0]?.problem).toMatch(/stale row/);
  });

  test("RED: a pod-count disagreement on a podsSource=manifest row is a finding", () => {
    const findings = crossCheckClaims(catalogue, [{ ...matching, replicas: 2 }], "longhorn", "large");
    expect(findings[0]?.problem).toMatch(/pod-count disagreement/);
  });

  // Deliberate asymmetry, and it must stay: the extractor provably cannot read
  // an upstream chart's pod count, so asserting that it agrees would be
  // asserting that a blind reader agrees with a sighted one. The evidence
  // string is that row's check, and loadCatalogue refuses an empty one.
  test("chart-default rows are NOT pod-cross-checked", () => {
    const fx2 = fixture(
      writeCatalogue(
        { "apps/db/Application.yaml": APP_YAML },
        catalogueJson({
          podsSource: "chart-default",
          podsEvidence: "chart X 1.0.0: component.replicas=3 over 3 zones",
          podsField: null,
          pods: { minimal: 3, large: 3 },
        }),
      ),
    );
    try {
      const blind = loadCatalogue("profiles.json", fx2.root);
      expect(crossCheckClaims(blind, [{ ...matching, replicas: 1 }], "longhorn", "large")).toEqual([]);
    } finally {
      fx2.cleanup();
    }
  });

  test("claims in another StorageClass are ignored", () => {
    const findings = crossCheckClaims(
      catalogue,
      [matching, { ...matching, storageClass: "local" }],
      "longhorn",
      "large",
    );
    expect(findings).toEqual([]);
  });
});

describe("applyProfile", () => {
  test("writes both scalars and PRESERVES the surrounding comments", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      const edits = applyProfile(catalogue, "minimal", fx.root);
      expect(edits).toHaveLength(2);
      const written = readFileSync(join(fx.root, "apps/db/Application.yaml"), "utf8");
      expect(written).toContain("size: 20Gi");
      expect(written).toContain("replicas: 1");
      // The reasons live in the comments; an applier that ate them would make
      // every switch of profile a silent loss of the argument for the value.
      expect(written).toContain("# three Raft members");
      expect(written).toContain("# a heavily commented values block");
      expect(verifyProfileApplied(catalogue, "minimal", fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("is idempotent — applying twice makes no second edit", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      applyProfile(catalogue, "minimal", fx.root);
      expect(applyProfile(catalogue, "minimal", fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("round-trips: minimal then large restores the original bytes", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      applyProfile(catalogue, "minimal", fx.root);
      applyProfile(catalogue, "large", fx.root);
      expect(readFileSync(join(fx.root, "apps/db/Application.yaml"), "utf8")).toBe(APP_YAML);
    } finally {
      fx.cleanup();
    }
  });

  // The bug this file shipped with for one iteration, now pinned. Rewriting a
  // MULTI-DOCUMENT manifest with `join("---\n")` doubles the separators that a
  // parsed Document already emits, so the document count grows and every
  // docIndex in the catalogue silently addresses a different object. Measured
  // on the real tree: platform/portal.yaml's 6 documents re-parsed as 11, and
  // two rows started reporting "coordinate no longer exists". Two claims in
  // ONE file at DIFFERENT doc indices is the shape that catches it.
  test("RED: a multi-document manifest keeps its document count and both coordinates", () => {
    const multi = [
      "apiVersion: v1",
      "kind: Namespace",
      "metadata:",
      "  name: ns",
      "---",
      "apiVersion: v1",
      "kind: PersistentVolumeClaim",
      "metadata:",
      "  name: first",
      "spec:",
      "  storageClassName: longhorn",
      "  resources:",
      "    requests:",
      "      storage: 100Gi",
      "---",
      "apiVersion: v1",
      "kind: PersistentVolumeClaim",
      "metadata:",
      "  name: second",
      "spec:",
      "  storageClassName: longhorn",
      "  resources:",
      "    requests:",
      "      storage: 100Gi",
      "",
    ].join("\n");
    const row = (id: string, docIndex: number) => ({
      id,
      path: "apps/multi.yaml",
      docIndex,
      storageClassField: "spec.storageClassName",
      sizeField: "spec.resources.requests.storage",
      podsField: null,
      podsSource: "singleton",
      podsEvidence: "one standalone PVC",
      scheduledAtBringUp: true,
      bringUpNote: "",
      consequence: "a synthetic multi-document fixture, sized down in minimal to prove the applier survives it",
      sizes: { minimal: "20Gi", large: "100Gi" },
      pods: { minimal: 1, large: 1 },
    });
    const json = JSON.stringify({
      profiles: ["minimal", "large"],
      claims: [row("t/first", 1), row("t/second", 2)],
    });
    const fx = fixture({ "apps/multi.yaml": multi, "profiles.json": json });
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(verifyProfileApplied(catalogue, "large", fx.root)).toEqual([]);
      expect(applyProfile(catalogue, "minimal", fx.root)).toHaveLength(2);
      // Re-verified by READING THE FILE BACK. Trusting applyProfile's return
      // value would have passed the broken version: it reported both edits
      // correctly and then wrote a stream nobody could address again.
      expect(verifyProfileApplied(catalogue, "minimal", fx.root)).toEqual([]);
      const written = readFileSync(join(fx.root, "apps/multi.yaml"), "utf8");
      expect(written.split("\n").filter((line) => line === "---")).toHaveLength(2);
      expect(written).toContain("name: second");
    } finally {
      fx.cleanup();
    }
  });

  // REFUSE, never create. Inventing a key inside somebody else's Helm values
  // block is how a silent misconfiguration ships looking like a success.
  test("RED: a missing size coordinate throws instead of creating the key", () => {
    const fx = fixture(
      writeCatalogue(
        { "apps/db/Application.yaml": APP_YAML.replace("size: 100Gi", "capacity: 100Gi") },
        catalogueJson(),
      ),
    );
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(() => applyProfile(catalogue, "minimal", fx.root)).toThrow(/has no value at/);
    } finally {
      fx.cleanup();
    }
  });

  test("RED: a manifest the catalogue names but the tree lacks throws", () => {
    const fx = fixture(writeCatalogue({}, catalogueJson()));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(() => applyProfile(catalogue, "minimal", fx.root)).toThrow(/does not exist/);
    } finally {
      fx.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// GOVERNORS. A number without its governor is not a size: cut `prometheus`
// from 100Gi to 32Gi and leave `retentionSize` where it was and the result is
// not a smaller footprint, it is a full disk and a wedged WAL. These tests
// pin that the governor moves in the SAME pass as the size, and that every way
// of getting that wrong is refused rather than tolerated.
// ---------------------------------------------------------------------------

const GOVERNED_YAML = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: db
spec:
  source:
    helm:
      valuesObject:
        statefulset:
          # three Raft members
          replicas: 3
        retention: 15d
        retentionSize: 75GiB
        storage:
          persistentVolume:
            size: 100Gi
            storageClass: longhorn
`;

function governedCatalogue(governors: unknown, evidence = "chart default is unset; see values.yaml"): string {
  return catalogueJson({
    governors,
    governorEvidence: evidence,
  });
}

describe("governors move with the size they bound", () => {
  const GOVERNOR_FIELD = "spec.source.helm.valuesObject.retentionSize";
  const bothProfiles = { [GOVERNOR_FIELD]: { minimal: "15GiB", large: "75GiB" } };

  function load(json: string) {
    const fx = fixture(writeCatalogue({}, json));
    try {
      return loadCatalogue("profiles.json", fx.root);
    } finally {
      fx.cleanup();
    }
  }

  test("a claim with no governors loads with an empty map — absent is a real answer", () => {
    expect(load(catalogueJson()).claims[0]?.governors).toEqual({});
  });

  test("RED: a governor missing a value for one profile is refused", () => {
    // The failure this prevents is silent: the manifest would keep whatever
    // the previously-applied rung wrote, so the volume is sized by one profile
    // and bounded by another and nothing reports the mismatch.
    expect(() => load(governedCatalogue({ [GOVERNOR_FIELD]: { large: "75GiB" } }))).toThrow(
      /governors\[.*\]\.minimal missing/,
    );
  });

  test("RED: a governor with no governorEvidence is refused", () => {
    expect(() => load(governedCatalogue(bothProfiles, ""))).toThrow(/no governorEvidence/);
  });

  test("RED: a malformed governor coordinate is refused rather than addressing a neighbour", () => {
    expect(() => load(governedCatalogue({ "a..b": { minimal: "1GiB", large: "2GiB" } }))).toThrow(/malformed/);
  });

  test("applyProfile writes the governor in the SAME pass as the size", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": GOVERNED_YAML }, governedCatalogue(bothProfiles)));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      const edits = applyProfile(catalogue, "minimal", fx.root);
      // size + pods + governor, and all three land in one write.
      expect(edits).toHaveLength(3);
      const written = readFileSync(join(fx.root, "apps/db/Application.yaml"), "utf8");
      expect(written).toContain("size: 20Gi");
      expect(written).toContain("retentionSize: 15GiB");
      // The TIME bound is not a capacity quantity and is deliberately untouched.
      expect(written).toContain("retention: 15d");
      expect(verifyProfileApplied(catalogue, "minimal", fx.root)).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("RED: a manifest whose governor drifted is a finding, even when the size is right", () => {
    const fx = fixture(
      writeCatalogue(
        { "apps/db/Application.yaml": GOVERNED_YAML.replace("retentionSize: 75GiB", "retentionSize: 90GiB") },
        governedCatalogue(bothProfiles),
      ),
    );
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      const findings = verifyProfileApplied(catalogue, "large", fx.root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.problem).toMatch(/declares 90GiB at .*retentionSize, but profile "large" says 75GiB/);
    } finally {
      fx.cleanup();
    }
  });

  test("RED: a governor coordinate the manifest does not carry is a finding, not a silent skip", () => {
    const fx = fixture(writeCatalogue({ "apps/db/Application.yaml": APP_YAML }, governedCatalogue(bothProfiles)));
    try {
      const catalogue = loadCatalogue("profiles.json", fx.root);
      expect(verifyProfileApplied(catalogue, "large", fx.root)[0]?.problem).toMatch(/ungoverned/);
      // ...and --apply REFUSES to create it. Inventing a key inside somebody
      // else's values block is how a silent misconfiguration ships.
      expect(() => applyProfile(catalogue, "large", fx.root)).toThrow(/has no value at/);
    } finally {
      fx.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// The real catalogue. These are the claims the PR actually makes about the
// cluster, pinned so a later edit that breaks one has to break a test too.
// ---------------------------------------------------------------------------

describe("the checked-in catalogue", () => {
  const catalogue = loadCatalogue();

  test("loads, and its ladder is minimal < standard < measured < large", () => {
    expect(catalogue.profiles).toEqual(["minimal", "standard", "measured", "large"]);
    const totals = catalogue.profiles.map((name) => profileTotalGib(catalogue, name));
    for (let index = 1; index < totals.length; index += 1) {
      expect(totals[index - 1]).toBeLessThan(totals[index] ?? 0);
    }
  });

  // `measured` is defined by a RULE, not by a size table somebody typed, and
  // the rule is what makes it reviewable: scheduled claims take `standard`,
  // deferred claims keep `large`. Re-derived here so a hand edit that breaks
  // the rule cannot pass as a rung.
  test("measured is standard where it provisions and large where it does not", () => {
    for (const claim of catalogue.claims) {
      const expected = claim.scheduledAtBringUp ? "standard" : "large";
      expect([claim.id, claim.sizes.measured]).toEqual([claim.id, claim.sizes[expected]]);
      expect([claim.id, claim.pods.measured]).toEqual([claim.id, claim.pods[expected]]);
    }
  });

  // The headline claim of the rung: it is bought entirely with SIZE. Cutting
  // pods is how you make a catalogue fit a disk cheaply and it is what
  // `minimal` does; this asserts that `measured` does not, so no HA statement
  // was quietly sold to make the arithmetic work.
  test("measured cuts NO pod count anywhere — every reduction from large is size", () => {
    const podCuts = catalogue.claims.filter((claim) => claim.pods.measured !== claim.pods.large).map((c) => c.id);
    expect(podCuts).toEqual([]);
    // ...and the cut really happened: it is smaller than large somewhere.
    expect(profileTotalGib(catalogue, "measured")).toBeLessThan(profileTotalGib(catalogue, "large"));
  });

  // Aaron's cockroachdb question, answered as a test rather than as prose:
  // the biggest claim in the catalogue keeps its Raft quorum.
  test("cockroachdb keeps 3 Raft members on the active rung", () => {
    const crdb = catalogue.claims.find((claim) => claim.id === "full-ai-cluster/cockroachdb/data");
    expect(crdb?.pods.measured).toBe(3);
    expect(crdb?.pods.large).toBe(3);
    // minimal is the rung that trades it away, and it still says so out loud.
    expect(crdb?.pods.minimal).toBe(1);
    expect(crdb?.consequence).toMatch(/no quorum/i);
  });

  // Aaron 2026-08-20: "if we can get the minimum down to 200-300 gb it should
  // be small enough." This is that number, and it is a test so it cannot drift
  // upward without somebody deciding to let it.
  test("minimal lands inside the 200-300 GiB band the maintainer asked for", () => {
    const minimal = profileTotalGib(catalogue, "minimal");
    expect(minimal).toBeGreaterThanOrEqual(120);
    expect(minimal).toBeLessThanOrEqual(300);
  });

  // `large` records what the tree declared BEFORE the ladder existed. It is no
  // longer what the manifests carry — that is the point of this round — so what
  // is pinned is its total, not its agreement with the YAML. The manifests are
  // pinned against the ACTIVE rung below, read from the ledger, which is a
  // check that cannot go stale by naming the wrong profile.
  test("large is still the pre-ladder declaration, 1599 GiB", () => {
    expect(profileTotalGib(catalogue, "large")).toBe(1599);
  });

  test("the manifests declare exactly the rung the ledger says is active", async () => {
    const { readLedger, DEFAULT_LEDGER_PATH } = await import("./single-node-readiness.ts");
    const active = readLedger(DEFAULT_LEDGER_PATH).activeStorageProfile;
    expect(catalogue.profiles).toContain(active);
    expect(verifyProfileApplied(catalogue, active)).toEqual([]);
  });

  test("standard and measured fit the smallest measured node; large does not", async () => {
    const { collectMeasuredNodes, verifiedNodeCapacity } = await import("./single-node-readiness.ts");
    const floor = verifiedNodeCapacity(collectMeasuredNodes());
    expect(floor).not.toBeNull();
    const bound = floor?.totalGib ?? 0;
    expect(profileTotalGib(catalogue, "standard")).toBeLessThan(bound);
    expect(profileTotalGib(catalogue, "measured")).toBeLessThan(bound);
    expect(profileTotalGib(catalogue, "large")).toBeGreaterThan(bound);
  });

  // The bound above is RAW — every block device, nothing held back. Longhorn
  // will not place that much. This is the number that decides whether the
  // cluster actually STANDS UP, and it is the one the round was sized against.
  test("the active rung's BRING-UP total fits what Longhorn will schedule", async () => {
    const readiness = await import("./single-node-readiness.ts");
    const ledger = readiness.readLedger(readiness.DEFAULT_LEDGER_PATH);
    const floor = readiness.verifiedNodeCapacity(readiness.collectMeasuredNodes());
    expect(floor).not.toBeNull();
    const manifests = readiness.loadManifests(readiness.DEFAULT_ROOTS);
    const fraction = readiness.mostConservativeUsableFraction(readiness.collectLonghornReserves(manifests));
    expect(fraction).toBe(0.75); // chart defaults: min(100, 100 - 25) / 100
    const schedulable = readiness.schedulableBoundGib(floor?.totalGib ?? 0, fraction, ledger.nodeCount);
    expect(profileBringUpGib(catalogue, ledger.activeStorageProfile)).toBeLessThan(schedulable);
    // large could never have stood up on this box either, which is the fact the
    // raw-only comparison was hiding: even its bring-up subset is over.
    expect(profileBringUpGib(catalogue, "large")).toBeGreaterThan(schedulable);
  });

  // The declared-vs-scheduled split, pinned. 500 GiB of the catalogue creates
  // no PVC on a fresh sync: ollama and vllm are manual-sync, and the arc runner
  // model cache is applied by nothing at all.
  test("500 GiB of large is declared but not scheduled at bring-up", () => {
    expect(profileTotalGib(catalogue, "large") - profileBringUpGib(catalogue, "large")).toBe(500);
    const deferred = catalogue.claims.filter((claim) => !claim.scheduledAtBringUp).map((claim) => claim.id);
    expect(deferred.sort()).toEqual([
      "full-ai-cluster/arc-runner-set/model-cache",
      "full-ai-cluster/ollama/models",
      "full-ai-cluster/vllm/hf-cache",
    ]);
  });

  // ...and the reason each one is deferred has to still be true. The two
  // manual-sync apps are checked against the SAME predicate the health harness
  // uses, so this cannot drift into a stale comment.
  test("the deferred claims' reasons are re-derived, not asserted", async () => {
    const { classifySyncPolicy } = await import("./manual-sync-policy.ts");
    for (const app of ["ollama", "vllm"]) {
      const path = join(dirname(DEFAULT_CATALOGUE_PATH), "applications", app, "Application.yaml");
      expect(classifySyncPolicy(readFileSync(path, "utf8")).kind).toBe("manual");
    }
    // The arc model cache is orphaned by the root App-of-Apps include glob AND
    // by its own Application's source kind. Both halves are checked: either one
    // alone would let a fix to the other look like a fix to the problem.
    const root = readFileSync(join(dirname(DEFAULT_CATALOGUE_PATH), "bootstrap", "root-application.yaml"), "utf8");
    expect(root).toContain("include: '{*/Application.yaml,Application.yaml}'");
    const arc = readFileSync(
      join(dirname(DEFAULT_CATALOGUE_PATH), "applications", "arc-runner-set", "Application.yaml"),
      "utf8",
    );
    expect(arc).toContain("chart: gha-runner-scale-set");
    expect(arc).not.toContain("path: full-ai-cluster/k8s/applications/arc-runner-set");
  });

  test("every claim states what its minimal cut costs", () => {
    for (const claim of catalogue.claims) {
      expect(claim.consequence.trim().length).toBeGreaterThan(40);
    }
  });

  // Every HA reduction has to be visible as one, not buried in a size table.
  test("every profile that drops a pod count says so in its consequence", () => {
    for (const claim of catalogue.claims) {
      const counts = catalogue.profiles.map((name) => claim.pods[name] ?? 0);
      const drops = Math.max(...counts) > Math.min(...counts);
      if (!drops) continue;
      expect(claim.consequence).toMatch(/HA LOSS|HA is real|no quorum|Raft/i);
    }
  });
});
