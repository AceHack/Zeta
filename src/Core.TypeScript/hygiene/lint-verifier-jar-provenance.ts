// Says what the two verifier jars ARE, and refuses documentation that says
// otherwise.
//
// TWO REGIMES, AND THE LINT HOLDS BOTH. The original sentence was
// "Committed binary => derive its identity; fetched binary => pin the digest."
// Both halves are now live at once, so the regime is DERIVED per jar rather
// than assumed for the file:
//
//   FETCHED   src/Core.Alloy/alloy.jar -- a digest-pinned row in
//             tools/setup/manifests/from-url. THE MANIFEST DIGEST IS THE PIN.
//             The bytes may be absent (fresh clone, no install yet), so the
//             checks that must still be able to fail are declaration checks:
//             the row carries a sha256, and the docs carry the same one.
//             When the bytes ARE present they are hashed and compared, which
//             is the check the realizer already performs at fetch time and
//             this one repeats at rest.
//
//   COMMITTED src/Core.TLA/tla2tools.jar -- byte-pinned by the diff, so its
//             identity is DERIVED from the bytes: sha256 over the file,
//             provenance out of META-INF/MANIFEST.MF. Absence is a FAILURE
//             here, never a skip: a committed jar that is not on disk is a
//             broken checkout.
//
// The two regimes are mutually exclusive by construction and the lint says so:
// a jar that is both tracked AND manifest-pinned would be fetched over its own
// committed copy, and a jar that is neither would be a path nothing ever puts a
// file at. Either combination fails. That pair is what stops a half-finished
// de-vendoring from reading as green -- delete the row without restoring the
// jar, or commit the jar without deleting the row, and this refuses.
//
// A hand-typed version string next to a binary drifts, and it did: docs claimed
// `tla2tools.jar v1.8.0` while the committed jar reports TLC2 Version
// 2026.05.18.174321. The upstream URL cannot settle it either, because tlaplus
// tags v1.8.0 as a rolling prerelease whose asset is re-uploaded in place --
// measured again 2026-09-09, when that tag began serving 2026.09.09.124804.
//
// 081M001E114087G0R001AZF4KD (derive-the-identity half)
// 081M23AST90087G0R00150MK76 (pin-the-digest half)

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type JarRegime = "fetched" | "committed";

export interface JarProvenance {
  readonly jarPath: string;
  readonly regime: JarRegime;
  /** The manifest pin. Present iff regime is "fetched". */
  readonly pinnedSha256?: string;
  /** sha256 of the bytes on disk. Null when a fetched jar has not been installed. */
  readonly sha256: string | null;
  /** Derived from META-INF/MANIFEST.MF. Null when the bytes are absent. */
  readonly version: string | null;
}

export interface UrlPin {
  readonly dest: string;
  readonly url: string;
  readonly sha256: string | null;
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
const JARS: readonly string[] = [TLA_JAR, ALLOY_JAR];
const FROM_URL_MANIFEST = "tools/setup/manifests/from-url";
const DOCS = ["docs/INSTALLED.md", "docs/dependency-status.md"];
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Rows of the from-url manifest: `<dest>  <url>  sha256=<hex> [k=v ...]`.
 *
 * `sha256` is reported as null rather than thrown on, because a row without a
 * digest is a finding this lint has to be able to STATE. The realizer refuses
 * such a row at install time; that refusal is not reachable from here.
 */
export function parseFromUrlPins(text: string): readonly UrlPin[] {
  const pins: UrlPin[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    const dest = tokens[0];
    const url = tokens[1];
    if (dest === undefined || url === undefined) continue;
    let sha256: string | null = null;
    for (const token of tokens.slice(2)) {
      if (token.startsWith("sha256=")) sha256 = token.slice("sha256=".length).toLowerCase();
    }
    pins.push({ dest, url, sha256 });
  }
  return pins;
}

function derivedVersion(jarPath: string, absPath: string): string {
  const text = jarManifestText(absPath);
  return jarPath === TLA_JAR ? tlcVersionFromManifest(text) : alloyVersionFromManifest(text);
}

/**
 * Tracked-in-git, asked of git rather than inferred from .gitignore -- because
 * .gitignore says what MAY be added and the index says what WAS.
 *
 * A failed `git` is UNKNOWN, never `false`. Returning false on failure would
 * make an absent or sandboxed git report "not tracked" for both jars, and the
 * regime check downstream would then fire "neither tracked nor pinned" -- a
 * loud, confident, entirely wrong finding produced by a probe that did not run.
 */
export function isTracked(repoRoot: string, relPath: string): boolean {
  const proc = Bun.spawnSync(["git", "-C", repoRoot, "ls-files", "--", relPath]);
  if (!proc.success) {
    throw new Error(
      "cannot ask git whether " + relPath + " is tracked (git exited " +
        String(proc.exitCode) + "): " + proc.stderr.toString().trim() +
        " -- that is an UNKNOWN, not a not-tracked",
    );
  }
  return proc.stdout.toString().trim() !== "";
}

export interface ProvenanceInputs {
  readonly manifestText: string;
  readonly tracked: (relPath: string) => boolean;
  readonly present: (relPath: string) => boolean;
  readonly hashOf: (relPath: string) => string;
  readonly versionOf: (relPath: string) => string;
}

function realInputs(repoRoot: string): ProvenanceInputs {
  return {
    manifestText: readFileSync(join(repoRoot, FROM_URL_MANIFEST), "utf8"),
    tracked: (rel) => isTracked(repoRoot, rel),
    present: (rel) => existsSync(join(repoRoot, rel)),
    hashOf: (rel) => jarSha256(join(repoRoot, rel)),
    versionOf: (rel) => derivedVersion(rel, join(repoRoot, rel)),
  };
}

/**
 * Regime + identity per jar. Throws only on a genuinely contradictory tree
 * (both regimes, or neither), because there is no honest provenance to report
 * for such a jar and returning one would be an invention.
 */
export function deriveJarProvenance(
  repoRoot: string,
  inputs: ProvenanceInputs = realInputs(repoRoot),
): readonly JarProvenance[] {
  const pins = parseFromUrlPins(inputs.manifestText);
  const out: JarProvenance[] = [];
  for (const jarPath of JARS) {
    const pin = pins.find((p) => p.dest === jarPath);
    const tracked = inputs.tracked(jarPath);
    if (pin !== undefined && tracked) {
      throw new Error(
        jarPath + " is BOTH tracked in git and pinned in " + FROM_URL_MANIFEST +
          " -- the fetch would overwrite the committed copy. Pick one regime.",
      );
    }
    if (pin === undefined && !tracked) {
      throw new Error(
        jarPath + " is neither tracked in git nor pinned in " + FROM_URL_MANIFEST +
          " -- nothing would ever put a file there.",
      );
    }
    const present = inputs.present(jarPath);
    out.push({
      jarPath,
      regime: pin === undefined ? "committed" : "fetched",
      ...(pin === undefined ? {} : { pinnedSha256: pin.sha256 ?? "" }),
      sha256: present ? inputs.hashOf(jarPath) : null,
      version: present ? inputs.versionOf(jarPath) : null,
    });
  }
  return out;
}

export function checkVerifierJarProvenance(
  repoRoot: string,
  inputs: ProvenanceInputs = realInputs(repoRoot),
  readDoc: (rel: string) => string = (rel) => readFileSync(join(repoRoot, rel), "utf8"),
): string[] {
  const failures: string[] = [];
  let derived: readonly JarProvenance[];
  try {
    derived = deriveJarProvenance(repoRoot, inputs);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  for (const jar of derived) {
    // The digest the docs must carry: the manifest pin for a fetched jar (it is
    // the pin whether or not the bytes are here), the bytes for a committed one.
    if (jar.regime === "fetched") {
      if (jar.pinnedSha256 === undefined || !SHA256_HEX.test(jar.pinnedSha256)) {
        failures.push(
          FROM_URL_MANIFEST + " row for " + jar.jarPath + " has no valid sha256= pin",
        );
        continue;
      }
      if (jar.sha256 !== null && jar.sha256 !== jar.pinnedSha256) {
        failures.push(
          jar.jarPath + " on disk hashes to " + jar.sha256 + ", " + FROM_URL_MANIFEST +
            " pins " + jar.pinnedSha256 + " -- a different verifier is a different experiment",
        );
      }
    } else if (jar.sha256 === null) {
      failures.push(
        jar.jarPath + " is committed to git but absent from the working tree" +
          " -- restore with: git checkout -- " + jar.jarPath,
      );
      continue;
    }

    const expectedSha = jar.regime === "fetched" ? (jar.pinnedSha256 ?? "") : (jar.sha256 ?? "");
    const installed = readDoc("docs/INSTALLED.md");
    if (!installed.includes(expectedSha)) {
      failures.push("docs/INSTALLED.md lacks the sha256 of " + jar.jarPath + ": " + expectedSha);
    }

    // The derived version can only be checked against docs when the bytes are
    // here. Saying so is the point: this is a NAMED gap on a fresh clone, not a
    // silent pass -- the digest checks above still ran and can still fail.
    if (jar.version === null) continue;
    for (const docRel of DOCS) {
      const text = readDoc(docRel);
      const jarName = jar.jarPath.split("/").pop() ?? jar.jarPath;
      if (!text.includes(jarName)) continue;
      if (text.includes(jar.version)) continue;
      failures.push(docRel + " names " + jarName + " but not its derived version: " + jar.version);
    }
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
    const identity =
      jar.version === null
        ? "not installed; pinned sha256=" + String(jar.pinnedSha256)
        : jar.version + " sha256=" + String(jar.sha256);
    process.stdout.write("OK " + jar.jarPath + " [" + jar.regime + "] " + identity + "\n");
  }
}
