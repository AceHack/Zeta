import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  checkVerifierJarProvenance,
  deriveJarProvenance,
  tlcVersionFromManifest,
} from "./lint-verifier-jar-provenance.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("verifier jar provenance", () => {
  test("docs state what the committed jars actually are", () => {
    expect(checkVerifierJarProvenance(repoRoot)).toEqual([]);
  });

  test("the TLC banner is composed from the jar manifest, not hand-typed", () => {
    const manifest = "Build-TimeStamp: 2026-05-18T17:43:21.13Z\nX-Git-ShortRevision: 8ba1027";
    expect(tlcVersionFromManifest(manifest)).toBe("2026.05.18.174321 (rev: 8ba1027)");
  });

  // The same v1.8.0 URL served this build on 2026-08-11 -- a re-upload under an
  // unchanged tag. Two builds, one tag: why the docs cite the jar, not the tag.
  test("a re-uploaded upstream build derives a different version", () => {
    const manifest = "Build-TimeStamp: 2026-08-11T12:53:11.00Z\nX-Git-ShortRevision: 0894c34";
    expect(tlcVersionFromManifest(manifest)).toBe("2026.08.11.125311 (rev: 0894c34)");
  });

  test("both committed jars hash to a full sha256", () => {
    const jars = deriveJarProvenance(repoRoot);
    expect(jars).toHaveLength(2);
    for (const jar of jars) {
      expect(jar.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
