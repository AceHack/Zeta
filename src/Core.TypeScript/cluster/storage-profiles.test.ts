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
  applicationDirs,
  applyResourceProfile,
  auditEnvelopeAgainstMachine,
  auditRunnerBudget,
  crossCheckResourceCoverage,
  devLaneAppliedDirs,
  envelopeBudget,
  loadResourceCatalogue,
  measureRunner,
  pinnedChartVersion,
  resourceTotal,
  verifyResourceProfileApplied,
  type ExtractedClaim,
  type ResourceCatalogue,
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
        renderedApp: "tree/db",
        renderedPvcPattern: "^data/db$",
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

  // A row with no rendered coordinate is a row `rendered-storage-claims.ts`
  // cannot check — and an uncheckable row that still contributes GiB to the
  // profile total is exactly the shape this catalogue exists to refuse.
  test("RED: a claim with no renderedApp is refused", () => {
    expect(() => load(catalogueJson({ renderedApp: undefined }))).toThrow(/renderedApp/);
  });

  test("RED: a claim with no renderedPvcPattern is refused", () => {
    expect(() => load(catalogueJson({ renderedPvcPattern: undefined }))).toThrow(/renderedPvcPattern/);
  });

  test("RED: a renderedPvcPattern that does not compile is refused at load, not at use", () => {
    expect(() => load(catalogueJson({ renderedPvcPattern: "^data/[unclosed" }))).toThrow(
      /renderedPvcPattern is not a valid regular expression/,
    );
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
      renderedApp: "t/multi",
      renderedPvcPattern: "^data/multi$",
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

// ===========================================================================
// The CPU / memory ladder. Same discipline: every green case is paired with
// the red case the same code path must reject, and the checked-in catalogue is
// pinned to the numbers that were actually measured.
// ===========================================================================

const RESOURCE_APP = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: svc
spec:
  source:
    repoURL: https://example.invalid/charts
    chart: svc
    targetRevision: 1.2.3
    helm:
      valuesObject:
        # the comment has to survive the applier
        replicaCount: 1
`;

function resourceCatalogueJson(patch: {
  claim?: Record<string, unknown>;
  ungoverned?: readonly Record<string, unknown>[];
  envelope?: Record<string, unknown>;
  acknowledged?: readonly string[];
  profiles?: readonly string[];
}): string {
  return JSON.stringify({
    resourceProfiles: patch.profiles ?? ["dev", "metal"],
    runnerEnvelope: {
      runner: "test runner",
      cpuMillis: 4000,
      memoryMib: 15360,
      freeDiskGib: 14,
      reservedCpuMillis: 1500,
      reservedMemoryMib: 6144,
      reservedDiskGib: 4,
      reservationEvidence: "a fixture, not a machine",
      ...patch.envelope,
    },
    resourceClaims: [
      {
        id: "tree/svc/api",
        dir: "svc",
        path: "full-ai-cluster/k8s/applications/svc/Application.yaml",
        docIndex: 0,
        requestsField: "spec.source.helm.valuesObject.api.resources.requests",
        pods: 1,
        metalSource: "chart-default",
        evidence: "svc 1.2.3 values.yaml api.resources.requests = 400m / 1024Mi",
        consequence:
          "At 128Mi the api pod is OOMKilled under load rather than running slower, which is a crash and not a slowdown.",
        cpuMillis: { dev: 100, metal: 400 },
        memoryMib: { dev: 128, metal: 1024 },
        ...patch.claim,
      },
    ],
    ungovernedRequests: patch.ungoverned ?? [],
    acknowledgedUnmeasuredRequests: patch.acknowledged ?? [],
  });
}

function resourceFixture(patch: Parameters<typeof resourceCatalogueJson>[0] = {}): Fixture {
  return fixture({
    "profiles.json": resourceCatalogueJson(patch),
    "full-ai-cluster/k8s/applications/svc/Application.yaml": RESOURCE_APP,
  });
}

describe("loadResourceCatalogue refusals — each one keeps a rung from meaning nothing", () => {
  test("a well-formed catalogue loads", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(catalogue.profiles).toEqual(["dev", "metal"]);
      expect(catalogue.claims).toHaveLength(1);
      expect(envelopeBudget(catalogue.envelope)).toEqual({ cpuMillis: 2500, memoryMib: 9216, diskGib: 10 });
    } finally {
      fix.cleanup();
    }
  });

  test("refuses a rung that CLIMBS DOWN — the ladder must be smallest-first", () => {
    const fix = resourceFixture({ claim: { cpuMillis: { dev: 900, metal: 400 } } });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/monotonically non-decreasing/);
    } finally {
      fix.cleanup();
    }
  });

  test("refuses a chart-default row with no evidence — an unsourced number is an assertion", () => {
    const fix = resourceFixture({ claim: { evidence: "  " } });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/assertion wearing a number/);
    } finally {
      fix.cleanup();
    }
  });

  test("refuses a multiplied pod count with no evidence, even when the value is ours", () => {
    const fix = resourceFixture({ claim: { metalSource: "manifest", evidence: "", pods: 3 } });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/assertion wearing a number/);
    } finally {
      fix.cleanup();
    }
  });

  test("a manifest row with ONE pod needs no evidence — the bar is only where a debt is owed", () => {
    const fix = resourceFixture({ claim: { metalSource: "manifest", evidence: "", pods: 1 } });
    try {
      expect(loadResourceCatalogue("profiles.json", fix.root).claims).toHaveLength(1);
    } finally {
      fix.cleanup();
    }
  });

  // The rule that makes this ladder different from a table of numbers: a cut
  // below the working set is an OOMKill with a nicer name.
  test("refuses a row that CUTS a request without pricing the cut", () => {
    const fix = resourceFixture({ claim: { consequence: "smaller" } });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/turns a Pending pod into an OOMKill/);
    } finally {
      fix.cleanup();
    }
  });

  test("...but a row that cuts NOTHING needs no price", () => {
    const fix = resourceFixture({
      claim: { consequence: "not cut", cpuMillis: { dev: 400, metal: 400 }, memoryMib: { dev: 1024, metal: 1024 } },
    });
    try {
      expect(loadResourceCatalogue("profiles.json", fix.root).claims).toHaveLength(1);
    } finally {
      fix.cleanup();
    }
  });

  test("refuses an envelope that reserves everything it declares", () => {
    const fix = resourceFixture({ envelope: { reservedMemoryMib: 15360 } });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/reserves everything it declares/);
    } finally {
      fix.cleanup();
    }
  });

  test("refuses a half-measured ungoverned row — both numbers or neither", () => {
    const fix = resourceFixture({
      ungoverned: [{ dir: "other", cpuMillis: 100, memoryMib: null, evidence: "half" }],
    });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/half-measured/);
    } finally {
      fix.cleanup();
    }
  });

  test("refuses a directory counted twice — once governed, once ungoverned", () => {
    const fix = resourceFixture({
      ungoverned: [{ dir: "svc", cpuMillis: 0, memoryMib: 0, evidence: "duplicate" }],
    });
    try {
      expect(() => loadResourceCatalogue("profiles.json", fix.root)).toThrow(/counted twice/);
    } finally {
      fix.cleanup();
    }
  });

  test("a zero request is legal and is NOT the same as a missing one", () => {
    const fix = resourceFixture({
      claim: {
        consequence: "not cut",
        cpuMillis: { dev: 0, metal: 0 },
        memoryMib: { dev: 128, metal: 128 },
      },
    });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(catalogue.claims[0]?.cpuMillis.dev).toBe(0);
    } finally {
      fix.cleanup();
    }
  });
});

describe("resource arithmetic and the runner budget", () => {
  test("a claim's cost is its rung value times its pod count", () => {
    const fix = resourceFixture({ claim: { pods: 3, metalSource: "manifest" } });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(resourceTotal(catalogue, "dev", ["svc"])).toEqual({
        cpuMillis: 300,
        memoryMib: 384,
        unmeasured: [],
      });
    } finally {
      fix.cleanup();
    }
  });

  // The hole this closes: a total summed only over the apps we chose to shrink
  // is exactly what "it fits" would be claimed from.
  test("a cohort member the catalogue does not cover is REPORTED, never skipped", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(resourceTotal(catalogue, "dev", ["svc", "ghost"]).unmeasured).toEqual(["ghost"]);
    } finally {
      fix.cleanup();
    }
  });

  test("an UNMEASURED ungoverned row does not silently count as zero", () => {
    const fix = resourceFixture({
      ungoverned: [{ dir: "other", cpuMillis: null, memoryMib: null, evidence: "chart 404s at its pin" }],
    });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(resourceTotal(catalogue, "dev", ["other"]).unmeasured).toEqual(["other"]);
    } finally {
      fix.cleanup();
    }
  });

  test("coverage is cross-checked in BOTH directions against the tree", () => {
    const fix = fixture({
      "profiles.json": resourceCatalogueJson({
        ungoverned: [{ dir: "gone", cpuMillis: 0, memoryMib: 0, evidence: "stale" }],
      }),
      "full-ai-cluster/k8s/applications/svc/Application.yaml": RESOURCE_APP,
      "full-ai-cluster/k8s/applications/uncovered/Application.yaml": RESOURCE_APP,
    });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const findings = crossCheckResourceCoverage(catalogue, fix.root);
      expect(findings.map((finding) => finding.claimId).sort()).toEqual(["uncovered", "ungovernedRequests.gone"]);
    } finally {
      fix.cleanup();
    }
  });

  test("auditRunnerBudget convicts when a rung does not fit, and is silent when it does", () => {
    // 20 pods: metal is 8000m / 20480Mi (over the 2500m / 9216Mi budget in both
    // dimensions), dev is 2000m / 2560Mi (under it in both). One fixture, both verdicts.
    const fix = resourceFixture({ claim: { pods: 20, metalSource: "manifest" } });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const over = auditRunnerBudget(catalogue, "metal", fix.root);
      expect(over.some((finding) => finding.problem.includes("of CPU across"))).toBe(true);
      expect(over.some((finding) => finding.problem.includes("of memory across"))).toBe(true);
      expect(auditRunnerBudget(catalogue, "dev", fix.root)).toEqual([]);
    } finally {
      fix.cleanup();
    }
  });

  test("a rung that does not exist REFUSES rather than reporting agreement", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const findings = auditRunnerBudget(catalogue, "nonexistent", fix.root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.problem).toMatch(/must never read as "checked"/);
    } finally {
      fix.cleanup();
    }
  });
});

describe("verifyResourceProfileApplied — absent means chart default, not 'applied'", () => {
  test("an absent coordinate IS the metal rung for a chart-default row", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      expect(verifyResourceProfileApplied(catalogue, "metal", fix.root)).toEqual([]);
    } finally {
      fix.cleanup();
    }
  });

  test("...and is DRIFT for any smaller rung — a rung nobody applied must not read as applied", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const findings = verifyResourceProfileApplied(catalogue, "dev", fix.root);
      expect(findings).toHaveLength(2);
      expect(findings[0]?.problem).toMatch(/has no value at .*\.cpu/);
    } finally {
      fix.cleanup();
    }
  });

  test("a zero request must be an ABSENT key, never `cpu: 0`", () => {
    const fix = fixture({
      "profiles.json": resourceCatalogueJson({
        claim: {
          consequence: "not cut",
          cpuMillis: { dev: 0, metal: 0 },
          memoryMib: { dev: 128, metal: 128 },
        },
      }),
      "full-ai-cluster/k8s/applications/svc/Application.yaml": `apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  source:
    helm:
      valuesObject:
        api:
          resources:
            requests:
              cpu: 0
              memory: 128Mi
`,
    });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const findings = verifyResourceProfileApplied(catalogue, "dev", fix.root);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.problem).toMatch(/a zero request is an ABSENT key/);
    } finally {
      fix.cleanup();
    }
  });
});

describe("applyResourceProfile", () => {
  test("CREATES the coordinate a chart-default row names, and keeps the comments", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const edits = applyResourceProfile(catalogue, "dev", fix.root);
      expect(edits.map((edit) => edit.from)).toEqual(["(absent)", "(absent)"]);
      const written = readFileSync(join(fix.root, "full-ai-cluster/k8s/applications/svc/Application.yaml"), "utf8");
      expect(written).toContain("cpu: 100m");
      expect(written).toContain("memory: 128Mi");
      expect(written).toContain("# the comment has to survive the applier");
      expect(verifyResourceProfileApplied(catalogue, "dev", fix.root)).toEqual([]);
    } finally {
      fix.cleanup();
    }
  });

  test("round-trips: dev then metal leaves the tree agreeing with metal again", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      applyResourceProfile(catalogue, "dev", fix.root);
      applyResourceProfile(catalogue, "metal", fix.root);
      expect(verifyResourceProfileApplied(catalogue, "metal", fix.root)).toEqual([]);
    } finally {
      fix.cleanup();
    }
  });

  test("never writes `cpu: 0` for a zero request", () => {
    const fix = resourceFixture({
      claim: {
        consequence: "not cut",
        cpuMillis: { dev: 0, metal: 0 },
        memoryMib: { dev: 128, metal: 128 },
      },
    });
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      applyResourceProfile(catalogue, "dev", fix.root);
      const written = readFileSync(join(fix.root, "full-ai-cluster/k8s/applications/svc/Application.yaml"), "utf8");
      // `not.toContain("cpu: 0")` was NOT enough and the mutation check caught
      // it: formatCpu(0) is the string "0", which the YAML writer emits QUOTED
      // as `cpu: "0"` -- so the substring assertion passed on the exact output
      // it existed to reject. The key must simply not be there at all.
      expect(written).not.toMatch(/cpu:/);
      expect(written).toContain("memory: 128Mi");
    } finally {
      fix.cleanup();
    }
  });

  test("--dry-run leaves the file alone", () => {
    const fix = resourceFixture();
    try {
      const catalogue = loadResourceCatalogue("profiles.json", fix.root);
      const path = join(fix.root, "full-ai-cluster/k8s/applications/svc/Application.yaml");
      const before = readFileSync(path, "utf8");
      expect(applyResourceProfile(catalogue, "dev", fix.root, false)).toHaveLength(2);
      expect(readFileSync(path, "utf8")).toBe(before);
    } finally {
      fix.cleanup();
    }
  });
});

describe("the runner envelope's own falsifier", () => {
  test("a machine SMALLER than the envelope convicts", () => {
    const fix = resourceFixture();
    try {
      const { envelope } = loadResourceCatalogue("profiles.json", fix.root);
      const findings = auditEnvelopeAgainstMachine(envelope, { cpuMillis: 2000, memoryMib: 4096 });
      expect(findings).toHaveLength(2);
      expect(findings[0]?.problem).toMatch(/too generous/);
    } finally {
      fix.cleanup();
    }
  });

  test("a BIGGER machine is slack, not a defect", () => {
    const fix = resourceFixture();
    try {
      const { envelope } = loadResourceCatalogue("profiles.json", fix.root);
      expect(auditEnvelopeAgainstMachine(envelope, { cpuMillis: 8000, memoryMib: 32768 })).toEqual([]);
    } finally {
      fix.cleanup();
    }
  });

  // The whole point of this comparator: an unread one must not read as passing.
  test("an unreadable machine is a REFUSAL, never a pass", () => {
    const fix = resourceFixture();
    try {
      const { envelope } = loadResourceCatalogue("profiles.json", fix.root);
      const findings = auditEnvelopeAgainstMachine(envelope, null);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.problem).toMatch(/an unread comparator is an absent check/);
    } finally {
      fix.cleanup();
    }
  });

  test("measureRunner refuses a platform with no /proc rather than guessing", () => {
    expect(measureRunner(join(tmpdir(), "definitely-not-a-proc-filesystem"))).toBeNull();
  });
});

describe("the checked-in resource ladder", () => {
  const catalogue = loadResourceCatalogue();

  test("covers every Application in the tree, in both directions", () => {
    expect(crossCheckResourceCoverage(catalogue)).toEqual([]);
    const covered = new Set([
      ...catalogue.claims.map((claim) => claim.dir),
      ...catalogue.ungoverned.map((app) => app.dir),
    ]);
    expect(covered.size).toBe(applicationDirs().length);
  });

  // The dev lane's applied set comes from ports.ts's excludeGlob, so this
  // number moves only when that constant does -- and it just did. #13343
  // ("boot 3 of the 12 deferred ArgoCD Applications") dropped deepseek-coder,
  // qwen-coder and orleans from the glob after measuring them Synced+Healthy,
  // taking the applied set from 33 to 36, but left this pin at 33. main has
  // been red on this test since that merge; the PIN is stale, not the glob.
  //
  // Corrected here rather than filed, because a red `plan + unit tests` job
  // SKIPS every live job behind it -- so a stale number in this file stops the
  // kind lane from running at all, which is exactly the shape where a check
  // that did not run looks like a check that passed.
  //
  // 45 -> 46 and 36 -> 37 on 2026-08-22: the `spire-crds` Application joined the
  // tree, and it is applied by the dev lane (it is in no excludeGlob). Both
  // numbers move together because a new Application that is not glob-excluded is
  // BOTH shipped and applied; if only one of them had needed to move, that would
  // itself have been the finding.
  //
  // 46 -> 47 and 37 -> 38 on 2026-08-22, and NOTHING WAS ADDED TO THE TREE.
  // `applicationDirs` was depth-1 and the App-of-Apps root's include glob is
  // not path-segment bounded, so `game-hosting/gmod` had always been applied
  // and had never been counted. It requests a literal `cpu: "1", memory: "2Gi"`.
  // Both counts move together for the same reason as spire-crds: an Application
  // no exclude covers is BOTH shipped and applied.
  test("the dev lane applies 38 of the 47 Applications", () => {
    expect(applicationDirs()).toHaveLength(47);
    expect(devLaneAppliedDirs()).toHaveLength(38);
    expect(applicationDirs()).toContain("game-hosting/gmod");
  });

  // MEASURED 2026-08-21 by `helm pull` at each pinned targetRevision followed
  // by `helm template` against that Application's own valuesObject. These are
  // pinned so the ladder cannot drift away from what was actually rendered.
  //
  // THE `all` PAIR MOVED 2026-08-22, 9856m/23528Mi -> 8106m/19752Mi, and the
  // dev-lane pair did NOT. Nothing was shrunk: `temporal` was UNRENDERABLE, so
  // its ungoverned row carried 3000m/6144Mi measured from CHART DEFAULTS, and
  // 3000m of that was the bundled elasticsearch-master StatefulSet its own
  // valuesObject had always set `enabled: false`. Wiring its datastore to
  // CockroachDB made the chart template, and the four governed rows that
  // replaced it total 1250m/2368Mi -- the first temporal numbers ever taken
  // from the values we actually ship. The dev-lane pair is unchanged because
  // `temporal/**` is in ports.ts's excludeGlob and was never in that cohort.
  //
  // ALL FOUR NUMBERS MOVED 2026-08-22 by exactly gmod's 1000m / 2048Mi, and
  // again nothing was added and nothing was measured differently: the
  // enumerator started seeing an Application the cluster had always applied.
  // 4231 -> 5231, 11427 -> 13475, 8106 -> 9256, 19752 -> 21810. All four are
  // now cross-checked against a full render of every chart at this rung by
  // `rendered-resource-requests.ts`, which agrees to the millicore.
  test("metal is exactly what the manifests render today", () => {
    expect(verifyResourceProfileApplied(catalogue, "metal")).toEqual([]);
    const lane = resourceTotal(catalogue, "metal", devLaneAppliedDirs());
    expect(lane.cpuMillis).toBe(5231);
    expect(lane.memoryMib).toBe(13475);
    const all = resourceTotal(catalogue, "metal", applicationDirs());
    expect(all.cpuMillis).toBe(9256);
    expect(all.memoryMib).toBe(21810);
  });

  // Aaron 2026-08-20: "make things small enough to fit for disk and ram on the
  // runners." This is that, and it is a test so it cannot drift upward without
  // somebody deciding to let it.
  //
  // THIS TEST HAS INVERTED TWICE AND BOTH INVERSIONS ARE KEPT IN THE NAME,
  // because the sequence is the finding and a quietly-rewritten assertion would
  // erase it.
  //
  //   originally  `dev` FITS       1906m against 2500m, 594m of spare
  //   2026-08-22  NEITHER FITS     2906m -- `game-hosting/gmod` was applied by
  //                                the dev root all along and a depth-1
  //                                enumerator could not see it. 406m OVER.
  //   2026-08-23  `dev` FITS AGAIN 1081m -- and NOT by excluding gmod or by
  //                                widening the envelope. Three git-path
  //                                Applications whose requests no rung could
  //                                reach are now governed rows, so the `dev`
  //                                rung reaches them. THREE, not five: `cdi`
  //                                and `kubevirt` are reachable by the same
  //                                mechanism and are deliberately left alone,
  //                                because their manifests are vendored
  //                                byte-for-byte and `--apply` would rewrite
  //                                them. 120m was available there and refused.
  //
  // The 2026-08-22 comment said "No rung reaches gmod: it is a git-path source
  // with no valuesObject, so `applyResourceProfile` cannot express it". The
  // first half was true and the second half was FALSE ABOUT ITS OWN MODULE:
  // `applyResourceProfile` addresses `path` + `docIndex` + `requestsField` as a
  // dotted path into an ARBITRARY manifest and always could write into
  // statefulset.yaml. Only the render-side reader (`overlayRung`) demanded the
  // `spec.source.helm.valuesObject.` prefix.
  //
  // `metal` IS UNCHANGED THROUGHOUT and that is asserted below, because the
  // whole point of a rung is that shrinking one does not touch the other.
  test("`dev` FITS AGAIN at 1081m — the rung reaches the raw manifests, and the governed rows are floored", () => {
    const budget = envelopeBudget(catalogue.envelope);
    const dev = resourceTotal(catalogue, "dev", devLaneAppliedDirs());
    expect(dev.cpuMillis).toBe(1081);
    expect(dev.memoryMib).toBe(8255);
    expect(dev.cpuMillis).toBeLessThan(budget.cpuMillis);
    expect(dev.memoryMib).toBeLessThan(budget.memoryMib);

    // THE REGISTER IS EMPTY, and it is empty because the arithmetic moved --
    // not because anyone deleted a row they found inconvenient.
    expect(catalogue.acknowledgedLaneBudgetShortfall).toEqual([]);
    expect(auditRunnerBudget(catalogue, "dev")).toEqual([]);

    // An acknowledgement re-added now would be STALE: it describes a shortfall
    // that no longer exists, and outliving its defect is how a baseline becomes
    // a lie. This is the falsifier for the deletion above.
    const revived = {
      ...catalogue,
      acknowledgedLaneBudgetShortfall: [
        { key: "dev cpu 2906>2500", reason: "r".repeat(60), liftsWhen: "LIFTS WHEN: never" },
      ],
    };
    expect(auditRunnerBudget(revived, "dev").some((finding) => finding.problem.includes("outlived"))).toBe(true);

    // `metal` still does not fit, and MUST NOT have moved. The dev-rung cuts
    // are rung-scoped; a change that shrank both rungs would have quietly
    // re-sized the hardware this rung exists to describe.
    expect(auditRunnerBudget(catalogue, "metal").length).toBeGreaterThan(0);
    const metal = resourceTotal(catalogue, "metal", devLaneAppliedDirs());
    expect(metal.cpuMillis).toBe(5231);
    expect(metal.memoryMib).toBe(13475);

    // gmod is still COUNTED -- reachability is not exclusion. It contributes
    // 100m at `dev` where it used to contribute 1000m, and 1000m at `metal`
    // where it always did.
    const withoutGmod = devLaneAppliedDirs().filter((dir) => dir !== "game-hosting/gmod");
    expect(dev.cpuMillis - resourceTotal(catalogue, "dev", withoutGmod).cpuMillis).toBe(100);
    expect(metal.cpuMillis - resourceTotal(catalogue, "metal", withoutGmod).cpuMillis).toBe(1000);
  });

  // Stated because it is the honest answer to the question that was asked, and
  // a test is the only place it cannot quietly stop being true.
  test("ALL 46 do not fit, at either rung — CPU runs out before memory does", () => {
    const budget = envelopeBudget(catalogue.envelope);
    for (const rung of catalogue.profiles) {
      const all = resourceTotal(catalogue, rung, applicationDirs());
      expect(all.cpuMillis).toBeGreaterThan(budget.cpuMillis);
      expect(all.memoryMib).toBeGreaterThan(budget.memoryMib);
    }
    expect(resourceTotal(catalogue, "metal", applicationDirs()).cpuMillis).toBeGreaterThan(
      catalogue.envelope.cpuMillis,
    );
  });

  // THE REGISTER IS EMPTY, and how it emptied is the whole lesson.
  //
  // It held TWO entries. Both were the same defect wearing two names: a
  // targetRevision no registry had ever published, so nothing could pull the
  // chart, so nobody could measure the app, so it was acknowledged.
  //
  //   forgejo@9.0.6  left 2026-08-21. Correcting the pin to 17.1.5 moved the key
  //                  and invalidated the acknowledgement exactly as designed —
  //                  and the answer to that was to MEASURE the app, not to
  //                  re-key it to `forgejo@17.1.5`.
  //   oz@1.4.5       left 2026-08-21, the same way. `ziti-controller` 1.4.5 was
  //                  never published (that repository's 1.x line ends at 1.3.4;
  //                  `1.4.x` exists there only as an appVersion). The pin is now
  //                  3.1.1 and the chart renders `resources: {}` — 0m/0Mi, which
  //                  is a MEASUREMENT that the container reserves nothing, not a
  //                  missing value.
  //
  // Re-keying either one would have preserved a "we cannot measure this" claim
  // that had stopped being true — an acknowledgement outliving its own defect.
  // Neither was re-keyed. Nothing in this tree is excused from measurement now.
  test("nothing is acknowledged as unmeasurable any more — the register is empty", () => {
    const lane = resourceTotal(catalogue, "dev", devLaneAppliedDirs());
    expect(lane.unmeasured).toEqual([]);
    expect([...catalogue.acknowledgedUnmeasured]).toEqual([]);
    expect(pinnedChartVersion("oz")).toBe("3.1.1");
    const oz = catalogue.ungoverned.find((app) => app.dir === "oz");
    expect(oz?.cpuMillis).toBe(0);
    expect(oz?.memoryMib).toBe(0);
  });

  // forgejo is the worked example of the register releasing an app: it is now
  // pinned to a published chart, measured, and carries NO acknowledgement.
  test("forgejo left the acknowledged set by being measured, not by being re-keyed", () => {
    expect(pinnedChartVersion("forgejo")).toBe("17.1.5");
    expect(catalogue.acknowledgedUnmeasured.some((key) => key.startsWith("forgejo@"))).toBe(false);
    const row = catalogue.ungoverned.find((app) => app.dir === "forgejo");
    expect(row).toBeDefined();
    // The pod's effective request is max(highest init request, sum of app-container
    // requests) because init containers run sequentially — 100m/128Mi, not the
    // 300m/384Mi a naive sum over all four containers would report.
    expect(row?.cpuMillis).toBe(100);
    expect(row?.memoryMib).toBe(128);
    expect(resourceTotal(catalogue, "dev", ["forgejo"]).unmeasured).toEqual([]);
  });

  test("the pin is read from the PARSED document, so a comment cannot change it", () => {
    // The falsifier for the 2026-08-21 correction. The old line-scanner probed
    // the six lines nearest `chart:` and returned "" once anything longer than
    // that sat between the two keys -- a wrong answer that propagates into the
    // acknowledgement key `<dir>@<pin>` rather than an error that stops.
    // oz/Application.yaml now carries ~35 lines of comment there, on purpose.
    expect(pinnedChartVersion("oz")).toBe("3.1.1");
    expect(pinnedChartVersion("arc-runner-set")).toBe("0.12.1");
    // A git-path source has no chart version, and "" is the RIGHT answer there.
    expect(pinnedChartVersion("orleans")).toBe("");
    expect(pinnedChartVersion("no-such-application-dir")).toBe("");
  });

  test("an acknowledgement whose pin has moved stops applying", () => {
    // Synthesised now that the live register is empty: an app whose measurement
    // is genuinely unknown (null), acknowledged at a pin that is NOT the one the
    // tree carries. The acknowledgement must not reach it.
    const unmeasurable: ResourceCatalogue = {
      ...catalogue,
      ungoverned: [
        ...catalogue.ungoverned.filter((app) => app.dir !== "oz"),
        { dir: "oz", cpuMillis: null, memoryMib: null, evidence: "UNMEASURED: synthesised for this test." },
      ],
      acknowledgedUnmeasured: ["oz@9.9.9"],
    };
    const findings = auditRunnerBudget(unmeasurable, "dev");
    expect(findings.some((finding) => finding.claimId === "oz")).toBe(true);
    // ...and the SAME catalogue acknowledged at the pin the tree really carries
    // does cover it, so the test above fails for the pin and not for the shape.
    const covered: ResourceCatalogue = { ...unmeasurable, acknowledgedUnmeasured: ["oz@3.1.1"] };
    expect(auditRunnerBudget(covered, "dev").some((finding) => finding.claimId === "oz")).toBe(false);
  });

  // The other direction, and it is the one that just fired on forgejo: an
  // acknowledgement for an app the total no longer reports as unmeasured is
  // stale, and stale is a finding rather than a silent no-op.
  test("an acknowledgement for an app that IS measured is reported stale", () => {
    const stale: ResourceCatalogue = {
      ...catalogue,
      acknowledgedUnmeasured: ["forgejo@17.1.5"],
    };
    const findings = auditRunnerBudget(stale, "dev");
    expect(findings.some((finding) => finding.claimId === "forgejo@17.1.5")).toBe(true);
  });

  test("every row that cuts a request states what the cut costs", () => {
    for (const claim of catalogue.claims) {
      const cuts =
        (claim.cpuMillis.dev ?? 0) < (claim.cpuMillis.metal ?? 0) ||
        (claim.memoryMib.dev ?? 0) < (claim.memoryMib.metal ?? 0);
      if (!cuts) continue;
      expect(claim.consequence.trim().length).toBeGreaterThan(60);
    }
  });

  // A cut whose price is "it gets OOMKilled" has to say so out loud, because
  // that is the failure this whole mechanism can cause and not prevent.
  //
  // Scoped to rows reserving 256Mi or more on metal, and the scope is the
  // claim: a container with a real working set is one this ladder can starve,
  // so its row owes a named failure mode. A 64Mi sidecar that idles on a
  // one-node kind cluster does not, and demanding the vocabulary there would
  // buy keyword-stuffing rather than a reason.
  test("every memory cut on a container with a real working set names the failure mode it buys", () => {
    const cutters = catalogue.claims.filter(
      (claim) => (claim.memoryMib.dev ?? 0) < (claim.memoryMib.metal ?? 0) && (claim.memoryMib.metal ?? 0) >= 256,
    );
    expect(cutters.length).toBeGreaterThan(5);
    for (const claim of cutters) {
      expect(claim.consequence).toMatch(/OOMKill|crash|latency|re-fetch|rejected|pushed back|stall/i);
    }
  });

  test("every chart-default number cites the chart, and every multiplied count cites its formula", () => {
    for (const claim of catalogue.claims) {
      if (claim.metalSource === "manifest" && claim.pods === 1) continue;
      expect(claim.evidence.trim().length).toBeGreaterThan(30);
    }
    for (const app of catalogue.ungoverned) {
      expect(app.evidence.trim().length).toBeGreaterThan(20);
    }
  });
});
