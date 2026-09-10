// nci-witness-receipt.ts — finite NciNonUrgency witness receipt only.
//
// Design reminder: this module admits one byte-pinned bounded TLC outcome. It is
// not an NCI floor, policy scorer, consent verifier, consensus protocol, or
// authority grant. On any mismatch it refuses/deferes rather than selecting work.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const MODEL_ID = "NciNonUrgency";
const MODEL_PATH = "src/Core.TLA/specs/NciNonUrgency.tla";
const CONFIG_PATH = "src/Core.TLA/specs/NciNonUrgency.cfg";
const REGISTRY_PATH = "registry/tlc-models.json";
const JAR_PATH = "src/Core.TLA/tla2tools.jar";
const BANNER = "TLC2 Version 2026.05.18.174321 (rev: 8ba1027)";
const COMPLETION = "Model checking completed. No error has been found";
const CANONICAL_ARGV =
  "cd src/Core.TLA/specs && java -Xms64m -Xmx4g -XX:+UseSerialGC -cp ../tla2tools.jar " +
  "tlc2.TLC -metadir <ephemeral-directory> -workers 1 -config NciNonUrgency.cfg NciNonUrgency";

export const PIN = {
  modelSha256: "3444cb6e66904406460143a27fc8932f30aac4b4d78ad37d09f59dfc0822319f",
  configSha256: "98e80eeef8949ffd598cd29cc7ad44dc70eae1636dea6f3cf2b7954bc62340b9",
  registrySha256: "44f1ca2feb2c7ba9cab47f06d2fcd60c097ef6d55ed602299f0e1a645791de54",
  jarSha256: "71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86",
} as const;

export interface NciWitnessReceipt {
  readonly schema: "zeta.nci-witness/v1";
  readonly modelId: "NciNonUrgency";
  readonly modelSha256: string;
  readonly configSha256: string;
  readonly registrySha256: string;
  readonly jarSha256: string;
  readonly banner: string;
  readonly argv: string;
  readonly expect: "valid";
  readonly exitCode: 0;
  readonly completion: string;
  readonly distinctStates: 512;
  readonly checkedInvariants: readonly ["TypeOK", "NoCoercion"];
  readonly checkedProperties: readonly ["Responsive"];
  readonly scope: "bounded-three-traveler-event-budget-one-fairness-conditioned";
  readonly verdict: "witness-observed";
}

export type NciWitnessOutcome =
  | { readonly kind: "witness-observed"; readonly receipt: string }
  | { readonly kind: "defer-checker-did-not-run"; readonly detail: string }
  | { readonly kind: "refuse-verdict-mismatch"; readonly detail: string };

function fail(message: string): never {
  throw new Error(message);
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readPinned(repoRoot: string, relativePath: string, expected: string): void {
  const sourcePath = join(repoRoot, relativePath);
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(sourcePath);
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      fail(`refuse-identity-mismatch: missing ${relativePath}`);
    }
    throw error;
  }
  const actual = sha256Bytes(bytes);
  if (actual !== expected) {
    fail(`refuse-identity-mismatch: ${relativePath} SHA-256 ${actual}, expected ${expected}`);
  }
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`refuse-registry-mismatch: ${name} is not an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, name: string): string {
  if (typeof value !== "string") fail(`refuse-registry-mismatch: ${name} is not a string`);
  return value;
}

function asNumber(value: unknown, name: string): number {
  if (typeof value !== "number") fail(`refuse-registry-mismatch: ${name} is not a number`);
  return value;
}

/** Validates the actual pinned registry entry, not merely its enclosing digest. */
export function verifyPinnedSubject(repoRoot: string): void {
  readPinned(repoRoot, MODEL_PATH, PIN.modelSha256);
  readPinned(repoRoot, CONFIG_PATH, PIN.configSha256);
  readPinned(repoRoot, REGISTRY_PATH, PIN.registrySha256);
  readPinned(repoRoot, JAR_PATH, PIN.jarSha256);

  const registry = asRecord(JSON.parse(readFileSync(join(repoRoot, REGISTRY_PATH), "utf8")), "registry");
  const invocation = asRecord(registry.invocation, "registry.invocation");
  const toolchain = asRecord(registry.toolchain, "registry.toolchain");
  const models = registry.models;
  if (!Array.isArray(models)) fail("refuse-registry-mismatch: registry.models is not an array");
  const model = models.find((entry) => asRecord(entry, "registry.models[]").id === MODEL_ID);
  if (model === undefined) fail("refuse-unknown-witness: NciNonUrgency is unclaimed");
  const entry = asRecord(model, "NciNonUrgency registry entry");

  if (
    asString(entry.module, "module") !== MODEL_ID ||
    asString(entry.config, "config") !== "NciNonUrgency.cfg" ||
    asString(entry.expect, "expect") !== "valid" ||
    asNumber(entry.exitCode, "exitCode") !== 0 ||
    asString(entry.tier, "tier") !== "gate" ||
    asString(entry.deadlock, "deadlock") !== "off-cfg" ||
    asNumber(entry.distinctStates, "distinctStates") !== 512 ||
    asNumber(invocation.workers, "registry.invocation.workers") !== 1 ||
    asString(toolchain.jar, "registry.toolchain.jar") !== JAR_PATH ||
    asString(toolchain.jarSha256, "registry.toolchain.jarSha256") !== PIN.jarSha256 ||
    asString(toolchain.versionBanner, "registry.toolchain.versionBanner") !== BANNER
  ) {
    fail("refuse-registry-mismatch: NciNonUrgency registry pin differs");
  }
}

export function canonicalReceipt(repoRoot: string): NciWitnessReceipt {
  verifyPinnedSubject(repoRoot);
  return {
    schema: "zeta.nci-witness/v1",
    modelId: "NciNonUrgency",
    modelSha256: PIN.modelSha256,
    configSha256: PIN.configSha256,
    registrySha256: PIN.registrySha256,
    jarSha256: PIN.jarSha256,
    banner: BANNER,
    argv: CANONICAL_ARGV,
    expect: "valid",
    exitCode: 0,
    completion: COMPLETION,
    distinctStates: 512,
    checkedInvariants: ["TypeOK", "NoCoercion"],
    checkedProperties: ["Responsive"],
    scope: "bounded-three-traveler-event-budget-one-fairness-conditioned",
    verdict: "witness-observed",
  };
}

export function renderCanonicalReceipt(repoRoot: string): string {
  return `${JSON.stringify(canonicalReceipt(repoRoot))}\n`;
}

/** Rejects stale, reordered, incomplete, or merely well-formed receipt JSON. */
export function verifyReceipt(repoRoot: string, receipt: string): void {
  const expected = renderCanonicalReceipt(repoRoot);
  if (receipt !== expected) fail("refuse-receipt-mismatch: receipt bytes differ from the pinned canonical witness");
}

function checkerNeverRan(output: string): boolean {
  return [
    "Could not reserve enough space for object heap",
    "Error occurred during initialization of VM",
    "Unable to access jarfile",
    "OutOfMemoryError",
  ].some((marker) => output.includes(marker));
}

/**
 * Runs the existing registry-owned TLC CLI. This function only produces a
 * finite witness after the pinned subject is admitted and the existing TLC
 * judge returns successfully; it does not produce a policy decision.
 */
export function runNciWitness(repoRoot: string): NciWitnessOutcome {
  verifyPinnedSubject(repoRoot);
  const result = spawnSync(process.execPath, ["src/Core.TypeScript/formal-verification/run-tlc.ts", MODEL_ID], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const output = String(result.stdout) + String(result.stderr);
  if (checkerNeverRan(output)) return { kind: "defer-checker-did-not-run", detail: output.trim() };
  if (result.status !== 0) return { kind: "refuse-verdict-mismatch", detail: output.trim() };
  return { kind: "witness-observed", receipt: renderCanonicalReceipt(repoRoot) };
}

if (import.meta.main) {
  const repoRoot = process.cwd();
  const outcome = runNciWitness(repoRoot);
  if (outcome.kind !== "witness-observed") {
    console.error(`${outcome.kind}: ${outcome.detail}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(outcome.receipt);
  }
}
