/**
 * secret-reference-audit.ts — which Secrets does the metal catalogue REFERENCE,
 * and which does anything actually PRODUCE?
 *
 * B8 in `docs/operations/FIRST-METAL-BRINGUP-FINDINGS.md`: Applications name
 * Secrets that nothing on metal creates. A referenced-but-absent Secret does not
 * fail loudly — the pod waits, ArgoCD reports `Progressing`, and the wave stalls.
 * That is the same shape as the `headscale`/`orleans` crash-loop: an Application
 * that never becomes Healthy and burns the whole health timeout reporting a
 * symptom.
 *
 * This module is the MEASUREMENT, not the fix. It exists so the gap is a number
 * that changes rather than a sentence in a register that ages — the register's
 * own count ("twelve ... against 22 references") was already stale when checked
 * on 2026-09-08, which is exactly the failure a roster has and a check does not.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where a reference was found, for a message that names the file. */
export interface SecretReference {
  readonly secretName: string;
  readonly file: string;
  readonly kind: string;
}

const REFERENCE_PATTERNS: ReadonlyArray<{ readonly rx: RegExp; readonly kind: string }> = [
  { rx: /(?:existingSecret|existingSecretName|secretName)\s*:\s*["']?([a-z0-9][a-z0-9.-]*)/g, kind: "existingSecret" },
  { rx: /secretKeyRef:\s*\n\s*name\s*:\s*["']?([a-z0-9][a-z0-9.-]*)/g, kind: "secretKeyRef" },
  { rx: /secretRef:\s*\n\s*name\s*:\s*["']?([a-z0-9][a-z0-9.-]*)/g, kind: "secretRef" },
  { rx: /imagePullSecrets:\s*\n\s*-\s*name\s*:\s*["']?([a-z0-9][a-z0-9.-]*)/g, kind: "imagePullSecrets" },
];

/** A manifest that CREATES secret material, as opposed to consuming it. */
const PRODUCER_KINDS = /^kind:\s*(Secret|SealedSecret|ExternalSecret|ClusterSecretStore)\s*$/m;

function yamlFilesUnder(root: string): string[] {
  const out: string[] = [];
  // `withFileTypes` rather than readdir-then-stat: the Dirent already knows the
  // kind, so there is no second question to the filesystem and no window in which
  // the answer can change (TOCTOU, CWE-367). `lint-check-then-use-file-races`
  // caught the first draft here, and its refusal printed this exact fix.
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (p.endsWith(".yaml") || p.endsWith(".yml")) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** Every Secret the catalogue under `root` consumes. */
export function secretReferences(root: string): readonly SecretReference[] {
  const found: SecretReference[] = [];
  for (const file of yamlFilesUnder(root)) {
    const text = readFileSync(file, "utf8");
    for (const { rx, kind } of REFERENCE_PATTERNS) {
      for (const m of text.matchAll(rx)) {
        const secretName = m[1];
        if (secretName !== undefined) found.push({ secretName, file, kind });
      }
    }
  }
  return found;
}

/** Every Secret the catalogue under `root` creates. Empty is a finding, not a bug here. */
export function secretProducers(root: string): readonly string[] {
  return yamlFilesUnder(root).filter((f) => PRODUCER_KINDS.test(readFileSync(f, "utf8")));
}

export interface SecretAudit {
  readonly referenced: readonly string[];
  readonly producerFiles: readonly string[];
  /** Secret names an OPERATOR generates from a committed CR (CNPG `Cluster` -> `<name>-app`). */
  readonly operatorGenerated: readonly string[];
  /** Referenced by the catalogue, created by nothing in it. */
  readonly unproduced: readonly string[];
}

/**
 * A CloudNativePG `Cluster` makes its operator write `<metadata.name>-app` (the
 * initdb owner's credentials). Name-level, like the rest of this module; the
 * namespace- and bootstrap-aware version is `collectCnpgClusters` in
 * metal-secret-production.ts, which also requires an Application to apply the CR.
 */
const CNPG_CLUSTER = /^apiVersion:\s*postgresql\.cnpg\.io\/v1\s*\nkind:\s*Cluster\s*\nmetadata:\s*\n\s+name:\s*([a-z0-9][a-z0-9-]*)/gm;

export function operatorGeneratedSecrets(root: string): readonly string[] {
  const out = new Set<string>();
  for (const f of yamlFilesUnder(root)) {
    for (const m of readFileSync(f, "utf8").matchAll(CNPG_CLUSTER)) {
      if (m[1] !== undefined) out.add(`${m[1]}-app`);
    }
  }
  return [...out].sort();
}

export function auditSecrets(root: string): SecretAudit {
  const referenced = [...new Set(secretReferences(root).map((r) => r.secretName))].sort();
  const producerFiles = secretProducers(root);
  // A producer file could name any of them; with zero producer files the
  // unproduced set is simply everything referenced. Kept as a set difference so
  // the moment a producer lands, this narrows on its own.
  const produced = new Set<string>();
  for (const f of producerFiles) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(/^\s*name\s*:\s*["']?([a-z0-9][a-z0-9.-]*)/gm)) {
      const n = m[1];
      if (n !== undefined) produced.add(n);
    }
  }
  const operatorGenerated = operatorGeneratedSecrets(root);
  for (const n of operatorGenerated) produced.add(n);
  return {
    referenced,
    producerFiles,
    operatorGenerated,
    unproduced: referenced.filter((s) => !produced.has(s)),
  };
}
