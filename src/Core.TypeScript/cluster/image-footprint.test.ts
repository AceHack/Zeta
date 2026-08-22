import { describe, expect, test } from "bun:test";
import {
  appFootprints,
  loadMeasurement,
  measuredFreeDiskGib,
  cohortTotal,
  concentration,
  fitsDeclaredDisk,
  imagesInDocuments,
  parseImageReference,
  type Cohorts,
  type Measurement,
} from "./image-footprint.ts";

const FIXTURE: Measurement = {
  measuredOn: "2026-08-22",
  method: "fixture",
  uncompressedRatio: 2.67,
  ratioEvidence: "fixture",
  images: [
    { reference: "big/app:1", compressedBytes: 9_000_000_000, layers: 14 },
    { reference: "shared/base:1", compressedBytes: 1_000_000_000, layers: 3 },
    { reference: "small/app:1", compressedBytes: 50_000_000, layers: 4 },
    { reference: "private/app:1", compressedBytes: null, layers: null, reason: "manifest HTTP 401" },
  ],
  apps: [
    { appId: "full-ai-cluster/heavy", dir: "heavy", images: ["big/app:1", "shared/base:1"] },
    { appId: "full-ai-cluster/light", dir: "light", images: ["small/app:1", "shared/base:1"] },
    { appId: "full-ai-cluster/opaque", dir: "opaque", images: ["private/app:1"] },
    { appId: "infra/elsewhere", dir: null, images: ["big/app:1"] },
  ],
};

const SETS: Cohorts = {
  all: new Set(["heavy", "light", "opaque"]),
  applied: new Set(["light", "opaque"]),
  asserted: new Set(["light"]),
};

describe("imagesInDocuments", () => {
  test("finds images at any depth, deduplicates and sorts", () => {
    const documents = [
      { spec: { template: { spec: { containers: [{ image: "b:1" }], initContainers: [{ image: "a:1" }] } } } },
      { spec: { image: "b:1" } },
    ];
    expect(imagesInDocuments(documents)).toEqual(["a:1", "b:1"]);
  });

  test("a non-string `image` is not an image reference", () => {
    expect(imagesInDocuments([{ image: { repository: "x", tag: "1" } }])).toEqual([]);
  });
});

describe("parseImageReference", () => {
  // The measured bug: 10 of 129 images read as private because the tag stayed
  // glued to the repository name when a digest was also present.
  test("a reference carrying BOTH a tag and a digest keeps neither in the repository", () => {
    const parsed = parseImageReference("quay.io/cilium/cilium:v1.16.5@sha256:758ca07");
    expect(parsed.host).toBe("quay.io");
    expect(parsed.repository).toBe("cilium/cilium");
    expect(parsed.reference).toBe("sha256:758ca07");
  });

  test("a bare Docker Hub name gets the library/ namespace", () => {
    expect(parseImageReference("redis:7.4")).toEqual({
      host: "registry-1.docker.io",
      repository: "library/redis",
      reference: "7.4",
    });
  });

  test("an explicit docker.io host is normalised to the registry endpoint", () => {
    expect(parseImageReference("docker.io/grafana/alloy:v1.5.1").host).toBe("registry-1.docker.io");
  });

  test("a first segment with a dot is a host; one without is a namespace", () => {
    expect(parseImageReference("ghcr.io/owner/name:1").host).toBe("ghcr.io");
    expect(parseImageReference("owner/name:1").host).toBe("registry-1.docker.io");
    expect(parseImageReference("owner/name:1").repository).toBe("owner/name");
  });

  test("no tag means latest, stated rather than left blank", () => {
    expect(parseImageReference("ghcr.io/owner/name").reference).toBe("latest");
  });
});

describe("cohortTotal", () => {
  test("a shared image is counted ONCE in a cohort", () => {
    const total = cohortTotal(FIXTURE, "all", SETS.all);
    expect(total.distinctImages).toBe(4);
    expect(total.compressedBytes).toBe(9_000_000_000 + 1_000_000_000 + 50_000_000);
  });

  test("an unsized image is counted as unsized, never as zero bytes", () => {
    expect(cohortTotal(FIXTURE, "all", SETS.all).unsized).toBe(1);
  });

  test("an app outside the applications tree is in no cohort", () => {
    // `infra/elsewhere` renders the biggest image and must not inflate any total.
    const total = cohortTotal(FIXTURE, "applied", SETS.applied);
    expect(total.compressedBytes).toBe(1_050_000_000);
  });
});

describe("appFootprints", () => {
  test("ranked by bytes, with the cohort each app is in", () => {
    const rows = appFootprints(FIXTURE, SETS);
    expect(rows.map((row) => row.dir)).toEqual(["heavy", "light", "opaque"]);
    expect(rows[0]?.cohort).toBe("excluded");
    expect(rows[1]?.cohort).toBe("asserted");
  });

  test("per-app rows sum to MORE than the cohort total, because a shared image is in both", () => {
    const rows = appFootprints(FIXTURE, SETS);
    const perApp = rows.reduce((sum, row) => sum + row.compressedBytes, 0);
    expect(perApp).toBeGreaterThan(cohortTotal(FIXTURE, "all", SETS.all).compressedBytes);
  });

  test("an app whose images are all unsized reports 0 bytes AND its unsized list", () => {
    const opaque = appFootprints(FIXTURE, SETS).find((row) => row.dir === "opaque");
    expect(opaque?.compressedBytes).toBe(0);
    expect(opaque?.unsized).toEqual(["private/app:1"]);
  });
});

describe("concentration", () => {
  test("the top-n fraction is of the cohort total that was passed in", () => {
    const rows = appFootprints(FIXTURE, SETS);
    const total = cohortTotal(FIXTURE, "all", SETS.all).compressedBytes;
    const top = concentration(rows, total, 1);
    expect(top.dirs).toEqual(["heavy"]);
    expect(top.fraction).toBeCloseTo(10_000_000_000 / total, 5);
  });

  test("a zero total does not divide by zero", () => {
    expect(concentration([], 0, 5).fraction).toBe(0);
  });
});

describe("fitsDeclaredDisk", () => {
  // The Mars-Climate-Orbiter shape of this measurement: image bytes are summed
  // into DECIMAL GB and disk is reported in BINARY GiB, so "80 GB of images
  // against 77 GiB free" reads as a 3-unit overrun and is a 2.7 GB fit.
  test("80 decimal GB of images FITS 77 binary GiB of disk", () => {
    const verdict = fitsDeclaredDisk(80e9 / 2.67, 2.67, 77);
    expect(verdict.fits).toBe(true);
    expect(verdict.budgetBytes).toBeGreaterThan(82e9);
  });

  test("the same 80 GB does NOT fit a 70 GiB budget", () => {
    expect(fitsDeclaredDisk(80e9 / 2.67, 2.67, 70).fits).toBe(false);
  });

  test("headroom is signed the way the verdict reads", () => {
    expect(fitsDeclaredDisk(1e9, 2, 100).headroomBytes).toBeGreaterThan(0);
    expect(fitsDeclaredDisk(1e12, 2, 1).headroomBytes).toBeLessThan(0);
  });

  test("an exact fit is a fit, not an overrun", () => {
    const budgetBytes = 10 * 1024 ** 3;
    expect(fitsDeclaredDisk(budgetBytes / 2, 2, 10).fits).toBe(true);
  });
});

describe("the checked-in measurement", () => {
  // The coordinator's question, made mechanical: are the stored numbers
  // compressed or extracted? They are COMPRESSED, and the verified pulls are
  // what says so — an image whose stored size equals its pulled EXTRACTED size
  // would mean the file changed meaning under everyone.
  test("stored sizes are COMPRESSED, and every verified pull proves it", () => {
    const measurement = loadMeasurement();
    const pulls = measurement.verifiedPulls ?? [];
    expect(pulls.length).toBeGreaterThan(0);
    for (const pull of pulls) {
      const stored = measurement.images.find((image) => image.reference === pull.reference);
      expect(stored?.compressedBytes).toBe(pull.compressedBytes);
      expect(pull.extractedBytes).toBeGreaterThan(pull.compressedBytes);
    }
  });

  test("the applied 2.67 ratio OVER-estimates both images that dominate", () => {
    const measurement = loadMeasurement();
    for (const pull of measurement.verifiedPulls ?? []) {
      expect(pull.measuredRatio).toBeLessThan(measurement.uncompressedRatio);
    }
  });

  test("the measured free-disk figure is carried, and is not the declared bound", () => {
    const measured = measuredFreeDiskGib();
    expect(measured).not.toBeNull();
    expect(measured).toBeGreaterThan(14);
  });
});
