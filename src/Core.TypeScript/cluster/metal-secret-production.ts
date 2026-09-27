#!/usr/bin/env bun
// metal-secret-production.ts -- does a FRESH METAL install produce every Secret the
// ArgoCD catalogue names?
//
// ---------------------------------------------------------------------------
// WHY A THIRD CHECK, WHEN TWO ALREADY LOOK AT SECRETS
// ---------------------------------------------------------------------------
//
// `audit-existing-secret-is-minted.ts` asks two questions and neither is this one:
//
//   valuesObject scan  -> is the name minted by the DEV/CI roster?
//   raw-manifest scan  -> is the name minted by a Secret/SealedSecret/ExternalSecret
//                          committed under k8s/applications/?
//
// The metal lane has a third producer those two never read: the k3s first-boot
// seeding Jobs in `k8s/bootstrap/internal-secret-seeding.yaml`, which `kubectl
// create` INTERNAL credentials before ArgoCD exists. And the dev-roster question
// lets an Application that is excluded from the dev lane carry an acknowledgement
// ("temporal is dev-excluded, so no cluster in this lane resolves the name") that
// is true of dev and says nothing about metal -- where that Application IS synced.
//
// Measured on a real USB install (node-5b2dfa, 2026-09-27): ArgoCD `temporal`
// Synced/Degraded, every server pod `CreateContainerConfigError: secret
// "temporal-default-store" not found`, no ExternalSecret anywhere, nothing in the
// seeding manifest. Both existing audits were green on that tree. This one is red.
//
// ---------------------------------------------------------------------------
// WHAT COUNTS AS PRODUCED ON METAL
// ---------------------------------------------------------------------------
//
//   1. a `kubectl create secret generic <name> -n <ns>` step in a seeding Job,
//      matched on (namespace, name) -- a Secret in the wrong namespace is not one
//      the consuming pod can mount;
//   2. a Secret / SealedSecret / ExternalSecret committed in the tree;
//   3. an entry in METAL_NOT_SEEDED below, which is a CLAIM with a reason: the
//      credential is external (operator-supplied), operator-generated at runtime,
//      or mounted `optional: true`. Every entry must still match a reference, or
//      it fails as STALE -- so a lifted exemption forces the question again.
//
// Exit codes: 0 clean, 1 an unproduced Secret or a stale exemption.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import {
  collectRawSecretReferences,
  collectSecretReferences,
  collectTreeMintedSecretNames,
  referenceKey,
  type SecretReference,
} from "./audit-existing-secret-is-minted.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const METAL_SEEDING_RELATIVE_PATH = "full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml";
const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/**
 * `<app>|<secretName>` -> why a fresh metal install legitimately does NOT seed it.
 * Not a to-do list: "someone will add it later" is not a reason, it is the defect.
 */
export const METAL_NOT_SEEDED: ReadonlyMap<string, string> = new Map([
  [
    "hindsight|hindsight-llm-api-key",
    "EXTERNAL: a real LLM provider API key. Operator-supplied; the cluster cannot draw it for itself.",
  ],
  [
    "arc-runner-set|arc-github-app",
    "EXTERNAL: a GitHub App id/installation/private key the maintainer provisions (see the baseline entry in existing-secret-is-minted.baseline.json).",
  ],
  [
    "platform|ghcr-pull",
    "EXTERNAL: a GHCR pull credential; tracked as workitem 081M33TN49G087G0R000X5ZJ75.",
  ],
  [
    "openbao|openbao-unseal-shares",
    "OPTIONAL: mounted `optional: true`; written by the gated init ceremony, never by a first-boot Job.",
  ],
  [
    "kubevirt|kubevirt-operator-certs",
    "OPERATOR-GENERATED: virt-operator creates its own webhook cert Secret at startup.",
  ],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every `<namespace>/<name>` a first-boot seeding Job `kubectl create`s. */
export function collectMetalSeededSecrets(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const text = readFileSync(resolve(repoRoot, METAL_SEEDING_RELATIVE_PATH), "utf8");
  const out = new Set<string>();
  for (const doc of parseAllDocuments(text)) {
    const value = doc.toJS() as unknown;
    if (!isRecord(value) || value.kind !== "Job") continue;
    const podSpec = (value.spec as { template?: { spec?: Record<string, unknown> } } | undefined)?.template?.spec;
    const containers = [
      ...((podSpec?.initContainers as readonly { args?: readonly string[] }[] | undefined) ?? []),
      ...((podSpec?.containers as readonly { args?: readonly string[] }[] | undefined) ?? []),
    ];
    for (const c of containers) {
      const args = c.args ?? [];
      if (args[0] !== "create" || args[1] !== "secret" || args[2] !== "generic") continue;
      const name = args[3];
      const nsIndex = args.indexOf("-n");
      const ns = nsIndex >= 0 ? args[nsIndex + 1] : undefined;
      if (name !== undefined && ns !== undefined) out.add(`${ns}/${name}`);
    }
  }
  return out;
}

/** The namespace an Application's pods run in -- where a referenced Secret must exist. */
export function applicationNamespace(app: string, repoRoot = REPO_ROOT): string | null {
  let text: string;
  try {
    text = readFileSync(join(resolve(repoRoot, APPLICATIONS_DIR), app, "Application.yaml"), "utf8");
  } catch {
    return null;
  }
  for (const doc of parseAllDocuments(text)) {
    const value = doc.toJS() as unknown;
    if (!isRecord(value) || value.kind !== "Application") continue;
    const ns = ((value.spec as Record<string, unknown> | undefined)?.destination as Record<string, unknown> | undefined)
      ?.namespace;
    if (typeof ns === "string" && ns !== "") return ns;
  }
  return null;
}

export interface MetalAudit {
  readonly seeded: readonly SecretReference[];
  readonly treeMinted: readonly SecretReference[];
  readonly exempt: readonly SecretReference[];
  /** Referenced, and nothing on a fresh metal install produces it. */
  readonly unproduced: readonly (SecretReference & { readonly namespace: string | null })[];
  readonly staleExemptions: readonly string[];
}

export function auditMetalSecretProduction(
  repoRoot = REPO_ROOT,
  exemptions: ReadonlyMap<string, string> = METAL_NOT_SEEDED,
): MetalAudit {
  const seededSet = collectMetalSeededSecrets(repoRoot);
  const treeMintedSet = collectTreeMintedSecretNames(repoRoot);
  const references = [...collectSecretReferences(repoRoot), ...collectRawSecretReferences(repoRoot)];
  const seeded: SecretReference[] = [];
  const treeMinted: SecretReference[] = [];
  const exempt: SecretReference[] = [];
  const unproduced: (SecretReference & { namespace: string | null })[] = [];
  const used = new Set<string>();
  for (const r of references) {
    const namespace = applicationNamespace(r.app, repoRoot);
    if (namespace !== null && seededSet.has(`${namespace}/${r.secretName}`)) {
      seeded.push(r);
      continue;
    }
    if (treeMintedSet.has(r.secretName)) {
      treeMinted.push(r);
      continue;
    }
    const key = referenceKey(r.app, r.secretName);
    if (exemptions.has(key)) {
      used.add(key);
      exempt.push(r);
      continue;
    }
    unproduced.push({ ...r, namespace });
  }
  const staleExemptions = [...exemptions.keys()].filter((k) => !used.has(k)).sort();
  return { seeded, treeMinted, exempt, unproduced, staleExemptions };
}

function main(): void {
  const a = auditMetalSecretProduction();
  const lines = ["Secrets the metal catalogue names vs what a fresh metal install produces", ""];
  for (const r of a.unproduced) {
    lines.push(
      `  UNPRODUCED ${r.app} — names Secret \`${String(r.namespace)}/${r.secretName}\` at ${r.field}`,
      `             ${r.manifest}`,
      `             Seed it in ${METAL_SEEDING_RELATIVE_PATH}, commit an ExternalSecret/SealedSecret,`,
      `             or exempt it in METAL_NOT_SEEDED with a reason.`,
      "",
    );
  }
  for (const k of a.staleExemptions) lines.push(`  STALE EXEMPTION ${k} — matches no unproduced reference; delete it`, "");
  lines.push(
    `  seeded (${String(a.seeded.length)}) · tree-minted (${String(a.treeMinted.length)}) · exempt (${String(a.exempt.length)})`,
  );
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exit(a.unproduced.length > 0 || a.staleExemptions.length > 0 ? 1 : 0);
}

if (import.meta.main) main();
