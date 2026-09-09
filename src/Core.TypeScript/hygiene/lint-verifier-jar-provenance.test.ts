import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  alloyVersionFromManifest,
  checkVerifierJarProvenance,
  deriveJarProvenance,
  parseFromUrlPins,
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

const ALLOY_ROW =
  `${ALLOY}  https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar  sha256=${ALLOY_SHA}`;

/** The shipped shape: Alloy fetched, TLA committed, both installed. */
function inputs(over: Partial<ProvenanceInputs> = {}): ProvenanceInputs {
  return {
    manifestText: `# a comment row\n\n${ALLOY_ROW}\n`,
    tracked: (rel) => rel === TLA,
    present: () => true,
    hashOf: (rel) => (rel === TLA ? TLA_SHA : ALLOY_SHA),
    versionOf: (rel) => (rel === TLA ? TLA_VERSION : ALLOY_VERSION),
    ...over,
  };
}

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
    expect(jars.find((j) => j.jarPath === TLA)?.regime).toBe("committed");
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
