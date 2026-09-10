import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  alloyVersionFromManifest,
  checkVerifierJarProvenance,
  deriveJarProvenance,
  parseFromUrlPins,
  parseRollingReceipts,
  tlcVersionFromManifest,
  type ProvenanceInputs,
} from "./lint-verifier-jar-provenance.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

const TLA = "src/Core.TLA/tla2tools.jar";
const ALLOY = "src/Core.Alloy/alloy.jar";
const TLA_SHA = "71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86";
const ALLOY_SHA = "6b8c1cb5bc93bedfc7c61435c4e1ab6e688a242dc702a394628d9a9801edb78d";
const TLA_VERSION = "2026.05.18.174321 (rev: 8ba1027)";
const ALLOY_VERSION = "6.2.0.202501090817 (rev: 794226d)";
const REMEASURE = "src/Core.TypeScript/formal-verification/run-tlc.ts:--all";
const EVIDENCE = "docs/cross-verify/some-sweep.md";

const ALLOY_ROW =
  `${ALLOY}  https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar  sha256=${ALLOY_SHA}`;

/**
 * The synthetic tree these tests reason over: Alloy on a plain fetched row, TLA
 * COMMITTED. That is not the shipped shape any more -- both jars are fetched
 * today -- and it is kept deliberately, because the committed regime is still
 * reachable (any future row could use it) and these are the only tests that
 * exercise it.
 */
function inputs(over: Partial<ProvenanceInputs> = {}): ProvenanceInputs {
  return {
    manifestText: `# a comment row\n\n${ALLOY_ROW}\n`,
    receiptsText: "# no receipts\n",
    tracked: (rel) => rel === TLA,
    present: () => true,
    hashOf: (rel) => (rel === TLA ? TLA_SHA : ALLOY_SHA),
    versionOf: (rel) => (rel === TLA ? TLA_VERSION : ALLOY_VERSION),
    ...over,
  };
}

const ROLLING_TLA_ROW =
  `${TLA}  https://example.invalid/tla2tools.jar  sha256=${TLA_SHA}` +
  `  rolling=upstream-tag  identity=jar-tlc  remeasure=${REMEASURE}` +
  "  pinsurfaces=registry/tlc-models.json";

const GOOD_RECEIPT =
  `${TLA}  sha256=${TLA_SHA}  measured=2026-09-09  result=pass` +
  `  remeasure=${REMEASURE}  evidence=${EVIDENCE}`;

/** Alloy fetched, TLA fetched-ROLLING with a passing receipt: the shipped shape. */
function rollingInputs(over: Partial<ProvenanceInputs> = {}): ProvenanceInputs {
  return {
    manifestText: `${ALLOY_ROW}\n${ROLLING_TLA_ROW}\n`,
    receiptsText: `# header\n${GOOD_RECEIPT}\n`,
    tracked: () => false,
    present: () => true,
    hashOf: (rel) => (rel === TLA ? TLA_SHA : ALLOY_SHA),
    versionOf: (rel) => (rel === TLA ? TLA_VERSION : ALLOY_VERSION),
    ...over,
  };
}

const ROLLING_DOCS =
  `${TLA} ${TLA_SHA} ${TLA_VERSION}\n${ALLOY} ${ALLOY_SHA} ${ALLOY_VERSION}\n`;

/** Doc reader that also answers for `registry/tlc-models.json`, the pin surface. */
const rollingDocs = (text = ROLLING_DOCS, surface = `pinned ${TLA_SHA}`) =>
  (rel: string) => (rel === "registry/tlc-models.json" ? surface : text);

const docs = (text: string) => () => text;
const GOOD_DOCS = `${TLA} ${TLA_SHA} ${TLA_VERSION}\n${ALLOY} ${ALLOY_SHA} ${ALLOY_VERSION}\n`;

describe("verifier jar provenance — the real tree", () => {
  test("docs state what the jars actually are", () => {
    expect(checkVerifierJarProvenance(repoRoot)).toEqual([]);
  });

  test("the tree assigns each jar exactly one regime", () => {
    const jars = deriveJarProvenance(repoRoot);
    expect(jars).toHaveLength(2);
    expect(jars.find((j) => j.jarPath === ALLOY)?.regime).toBe("fetched");
    expect(jars.find((j) => j.jarPath === TLA)?.regime).toBe("fetched-rolling");
  });
});

describe("rolling regime — a mutable upstream must cite the run that judged it", () => {
  test("a rolling pin with a passing receipt and an intact pin surface is clean", () => {
    expect(checkVerifierJarProvenance(repoRoot, rollingInputs(), rollingDocs())).toEqual([]);
  });

  // THE failure this regime exists for: upstream rebuilds, the tree goes red,
  // and the cheapest green is one new hex string in the manifest.
  test("a digest bumped with no receipt fails and names the re-pin command", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ receiptsText: "# nothing was measured\n" }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("bumped without a recorded re-measure"))).toBe(true);
    expect(failures.some((f) => f.includes("bun tools/setup/repin-rolling.ts " + TLA))).toBe(true);
  });

  test("a receipt recording a FAILED re-measure does not buy the pin", () => {
    const failing = GOOD_RECEIPT.replace("result=pass", "result=fail");
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ receiptsText: `${failing}\n` }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("none that both passed"))).toBe(true);
  });

  test("a receipt earned by a WEAKER command does not buy the pin", () => {
    const weaker = GOOD_RECEIPT.replace(REMEASURE, "src/Core.TypeScript/formal-verification/run-tlc.ts:SmokeCheck");
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ receiptsText: `${weaker}\n` }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("ran the declared remeasure="))).toBe(true);
  });

  test("a receipt for a DIFFERENT digest does not carry over to the new one", () => {
    const other = GOOD_RECEIPT.replace(TLA_SHA, "a".repeat(64));
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ receiptsText: `${other}\n` }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("bumped without a recorded re-measure"))).toBe(true);
  });

  test("a receipt citing evidence that is not in the tree fails", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ present: (rel) => rel !== EVIDENCE }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("which is not in the tree"))).toBe(true);
  });

  // The HALF re-pin: manifest moved, the registry's restatement left behind.
  test("a declared pin surface that lost the digest fails", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs(),
      rollingDocs(ROLLING_DOCS, "pinned 0000"),
    );
    expect(failures.some((f) => f.includes("does not carry sha256="))).toBe(true);
  });

  test("a rolling row with no remeasure= cannot be re-pinned honestly", () => {
    const noRemeasure = ROLLING_TLA_ROW.replace(`  remeasure=${REMEASURE}`, "");
    const failures = checkVerifierJarProvenance(
      repoRoot,
      rollingInputs({ manifestText: `${ALLOY_ROW}\n${noRemeasure}\n` }),
      rollingDocs(),
    );
    expect(failures.some((f) => f.includes("declares no remeasure= command"))).toBe(true);
  });

  // Vacuity control. Without it the rolling checks could be "passing" because
  // they demand a receipt of everything, or of nothing.
  test("a plain fetched row is NOT asked for a receipt", () => {
    expect(checkVerifierJarProvenance(repoRoot, inputs(), docs(GOOD_DOCS))).toEqual([]);
  });
});

describe("receipt parsing", () => {
  test("reads every field and ignores comments", () => {
    const rows = parseRollingReceipts(`# header\n\n${GOOD_RECEIPT}\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dest).toBe(TLA);
    expect(rows[0]?.sha256).toBe(TLA_SHA);
    expect(rows[0]?.result).toBe("pass");
    expect(rows[0]?.remeasure).toBe(REMEASURE);
    expect(rows[0]?.evidence).toBe(EVIDENCE);
  });

  test("a row missing fields parses with nulls rather than throwing", () => {
    const rows = parseRollingReceipts(`${TLA}\n`);
    expect(rows[0]?.sha256).toBeNull();
    expect(rows[0]?.result).toBeNull();
  });
});

describe("rolling attributes on a from-url row", () => {
  test("rolling, identity, remeasure and pinsurfaces are all read", () => {
    const pins = parseFromUrlPins(`${ROLLING_TLA_ROW}\n`);
    expect(pins[0]?.rolling).toBe("upstream-tag");
    expect(pins[0]?.identity).toBe("jar-tlc");
    expect(pins[0]?.remeasure).toBe(REMEASURE);
    expect(pins[0]?.pinSurfaces).toEqual(["registry/tlc-models.json"]);
  });

  test("a row with no rolling= reports null, which is what keeps it a plain pin", () => {
    const pins = parseFromUrlPins(`${ALLOY_ROW}\n`);
    expect(pins[0]?.rolling).toBeNull();
    expect(pins[0]?.pinSurfaces).toEqual([]);
  });
});

describe("version derivation", () => {
  test("the TLC banner is composed from the jar manifest, not hand-typed", () => {
    const manifest = "Build-TimeStamp: 2026-05-18T17:43:21.13Z\nX-Git-ShortRevision: 8ba1027";
    expect(tlcVersionFromManifest(manifest)).toBe(TLA_VERSION);
  });

  // MEASURED: the same v1.8.0 URL served 2026-08-11, and again 2026-09-09 with
  // a third build. One tag, three builds -- why the docs cite the jar, not the tag.
  test("a re-uploaded upstream build derives a different version", () => {
    const manifest = "Build-TimeStamp: 2026-09-09T12:48:04.00Z\nX-Git-ShortRevision: 65fbace";
    expect(tlcVersionFromManifest(manifest)).toBe("2026.09.09.124804 (rev: 65fbace)");
  });

  test("Alloy's identity comes from its OSGi bundle version and source rev", () => {
    const manifest = "Bundle-Version: 6.2.0.202501090817\nGit-Descriptor: 794226d";
    expect(alloyVersionFromManifest(manifest)).toBe(ALLOY_VERSION);
  });
});

describe("from-url pin parsing", () => {
  test("reads dest, url and digest; ignores comments and blanks", () => {
    const pins = parseFromUrlPins(`# header\n\n${ALLOY_ROW}\n`);
    expect(pins).toHaveLength(1);
    expect(pins[0]?.dest).toBe(ALLOY);
    expect(pins[0]?.sha256).toBe(ALLOY_SHA);
  });

  test("a row without sha256= parses with a null digest rather than throwing", () => {
    // The lint has to be able to STATE this finding; throwing here would turn a
    // reportable defect into a crash.
    const pins = parseFromUrlPins(`${ALLOY}  https://example.invalid/a.jar\n`);
    expect(pins[0]?.sha256).toBeNull();
  });
});

describe("the two regimes are mutually exclusive", () => {
  test("a jar that is both tracked AND manifest-pinned fails", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ tracked: () => true }),
      docs(GOOD_DOCS),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("BOTH tracked in git and pinned");
  });

  test("a jar that is neither tracked nor manifest-pinned fails", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ manifestText: "# no rows\n" }),
      docs(GOOD_DOCS),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("neither tracked in git nor pinned");
  });
});

describe("fetched regime — the manifest digest is the pin", () => {
  test("bytes on disk that disagree with the pin fail", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ hashOf: (rel) => (rel === TLA ? TLA_SHA : "0".repeat(64)) }),
      docs(GOOD_DOCS),
    );
    expect(failures.some((f) => f.includes("a different verifier is a different experiment"))).toBe(
      true,
    );
  });

  test("a row with no digest fails even though the bytes are fine", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ manifestText: `${ALLOY}  https://example.invalid/a.jar\n` }),
      docs(GOOD_DOCS),
    );
    expect(failures.some((f) => f.includes("has no valid sha256= pin"))).toBe(true);
  });

  // The point of the fetched regime: an uninstalled jar must not make the lint
  // vacuous. The digest declaration checks still run and still fail.
  test("an absent fetched jar still fails when the docs lack its pinned digest", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ present: (rel) => rel === TLA }),
      docs(`${TLA} ${TLA_SHA} ${TLA_VERSION}\n`),
    );
    expect(failures.some((f) => f.includes("docs/INSTALLED.md lacks the sha256 of " + ALLOY))).toBe(
      true,
    );
  });

  test("an absent fetched jar passes when the docs DO carry its pinned digest", () => {
    expect(
      checkVerifierJarProvenance(
        repoRoot,
        inputs({ present: (rel) => rel === TLA }),
        docs(GOOD_DOCS),
      ),
    ).toEqual([]);
  });
});

describe("committed regime — the bytes are the identity", () => {
  test("a committed jar missing from the tree is a failure, not a skip", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs({ present: (rel) => rel !== TLA }),
      docs(GOOD_DOCS),
    );
    expect(failures.some((f) => f.includes("committed to git but absent from the working tree"))).toBe(
      true,
    );
  });

  test("docs naming the jar but not its derived version fail", () => {
    const failures = checkVerifierJarProvenance(
      repoRoot,
      inputs(),
      docs(`${TLA} ${TLA_SHA} 1.8.0\n${ALLOY} ${ALLOY_SHA} ${ALLOY_VERSION}\n`),
    );
    expect(failures.some((f) => f.includes("but not its derived version: " + TLA_VERSION))).toBe(
      true,
    );
  });
});
