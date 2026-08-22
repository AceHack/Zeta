// Derives what the committed verifier jars ARE and refuses documentation that
// says otherwise.
//
// The jars are committed to git (#8053), so the toolchain is byte-pinned by the
// diff -- but a hand-typed version string next to a binary drifts, and it did:
// docs claimed `tla2tools.jar v1.8.0` while the committed jar reports
// TLC2 Version 2026.05.18.174321. The upstream URL cannot settle it either,
// because tlaplus tags v1.8.0 as a rolling prerelease whose asset is
// re-uploaded in place. So the jar itself is the only authority, and this lint
// reads it: sha256 over the bytes, provenance out of META-INF/MANIFEST.MF.
//
// Distinct from install-pinned-smt.ts, which pins z3/cvc5 off checksummed
// GitHub releases because apt's ambient version is too old. Committed
// binary => derive its identity; fetched binary => pin the digest.
//
// 081M001E114087G0R001AZF4KD

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface JarProvenance {
  readonly jarPath: string;
  readonly sha256: string;
  readonly version: string;
}

export function jarSha256(absPath: string): string {
  const bytes = readFileSync(absPath);
  return createHash("sha256").update(bytes).digest("hex");
}

export function jarManifestText(absPath: string): string {
  const proc = Bun.spawnSync(["unzip", "-p", absPath, "META-INF/MANIFEST.MF"]);
  if (!proc.success) {
    throw new Error("cannot read META-INF/MANIFEST.MF from " + absPath);
  }
  return proc.stdout.toString();
}

function manifestField(text: string, key: string): string {
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(key + ": ")) return line.slice(key.length + 2).trim();
  }
  throw new Error("jar manifest has no " + key + " field");
}

// TLC composes its banner from the build timestamp and the short git rev:
// Build-TimeStamp 2026-05-18T17:43:21.13Z + X-Git-ShortRevision 8ba1027
// becomes "2026.05.18.174321 (rev: 8ba1027)" -- byte-identical to what
// `java -cp tla2tools.jar tlc2.TLC` prints, but derived without a JVM.
export function tlcVersionFromManifest(text: string): string {
  const stamp = manifestField(text, "Build-TimeStamp");
  const rev = manifestField(text, "X-Git-ShortRevision");
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(stamp);
  if (parts === null) {
    throw new Error("unparsable Build-TimeStamp: " + stamp);
  }
  const date = parts.slice(1, 4).join(".");
  const time = parts.slice(4, 7).join("");
  return date + "." + time + " (rev: " + rev + ")";
}

// Alloy stamps an OSGi bundle version and the source rev it was cut from.
export function alloyVersionFromManifest(text: string): string {
  const bundle = manifestField(text, "Bundle-Version");
  const rev = manifestField(text, "Git-Descriptor");
  return bundle + " (rev: " + rev + ")";
}

const TLA_JAR = "src/Core.TLA/tla2tools.jar";
const ALLOY_JAR = "src/Core.Alloy/alloy.jar";
const DOCS = ["docs/INSTALLED.md", "docs/dependency-status.md"];

export function deriveJarProvenance(repoRoot: string): JarProvenance[] {
  const tlaAbs = join(repoRoot, TLA_JAR);
  const alloyAbs = join(repoRoot, ALLOY_JAR);
  const tla = {
    jarPath: TLA_JAR,
    sha256: jarSha256(tlaAbs),
    version: tlcVersionFromManifest(jarManifestText(tlaAbs)),
  };
  const alloy = {
    jarPath: ALLOY_JAR,
    sha256: jarSha256(alloyAbs),
    version: alloyVersionFromManifest(jarManifestText(alloyAbs)),
  };
  return [tla, alloy];
}

export function checkVerifierJarProvenance(repoRoot: string): string[] {
  const failures: string[] = [];
  const derived = deriveJarProvenance(repoRoot);
  for (const docRel of DOCS) {
    const text = readFileSync(join(repoRoot, docRel), "utf8");
    for (const jar of derived) {
      const jarName = jar.jarPath.split("/").pop() ?? jar.jarPath;
      if (!text.includes(jarName)) continue;
      if (text.includes(jar.version)) continue;
      failures.push(docRel + " names " + jarName + " but not its derived version: " + jar.version);
    }
  }
  const installed = readFileSync(join(repoRoot, "docs/INSTALLED.md"), "utf8");
  for (const jar of derived) {
    if (installed.includes(jar.sha256)) continue;
    failures.push("docs/INSTALLED.md lacks the sha256 of " + jar.jarPath + ": " + jar.sha256);
  }
  return failures;
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const failures = checkVerifierJarProvenance(repoRoot);
  for (const failure of failures) {
    process.stderr.write("FAIL " + failure + "\n");
  }
  if (failures.length > 0) process.exit(1);
  for (const jar of deriveJarProvenance(repoRoot)) {
    process.stdout.write("OK " + jar.jarPath + " " + jar.version + " sha256=" + jar.sha256 + "\n");
  }
}
