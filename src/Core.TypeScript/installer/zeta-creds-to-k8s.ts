#!/usr/bin/env bun
// zeta-creds-to-k8s.ts — project USB-restored host credentials into Kubernetes
// Secrets so agent pods can mount the same GitHub / AI-login material the
// control-plane host already has after zeta-creds-restore.
//
// 081M1PWSF56087G0R000FDS3NY. Sibling of zeta-creds-restore.ts, not a Helm
// chart: External Secrets / Vault remain the later hop. This is the first hop
// (host files → namespaced Opaque Secrets) so future agent pods do not wait
// on an unsealed Vault.
//
// Allowlist is load-bearing. WiFi, SSH host keys, operator pubkey,
// install-answers, and USB HSM-talk companions stay on the host. A new
// DEFAULT_MANIFEST id without a classification fails the lock test.
//
// Usage:
//   bun src/Core.TypeScript/installer/zeta-creds-to-k8s.ts \
//     --home /home/zeta \
//     [--namespace zeta-host-creds] \
//     [--persona riven] \
//     [--k3s-bin /run/current-system/sw/bin/k3s] \
//     [--kubeconfig /etc/rancher/k3s/k3s.yaml] \
//     [--dry-run]
//
// Exit codes:
//   0 success or nothing-to-project skip
//   2 arg parse error
//   3 API not ready (unit retries)
//   4 apply failed
//
// Logs names, byte counts, and skip reasons. NEVER logs credential bytes.

import { spawnSync } from "node:child_process";
import { DEFAULT_MAX_BYTES } from "../io/safe-io.ts";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { USB_HSM_COMPANION } from "../cluster/seal-emulator-rung.ts";
import { DEFAULT_MANIFEST, type CredentialEntry } from "./zeta-creds-manifest";

/** Harness / AI-login creds agent pods actually need. */
export const CLUSTER_PROJECTABLE_CRED_IDS: readonly string[] = ["gh-cli", "claude", "gemini", "codex"];

/** Host-only. Never become a Secret — even if the files are sitting on disk. */
export const HOST_ONLY_CRED_IDS: readonly string[] = [
  "ssh-host-keys",
  "ssh-operator-pubkey",
  "wifi",
  "install-answers",
  ...USB_HSM_COMPANION,
];

export const DEFAULT_NAMESPACE = "zeta-host-creds";
export const READER_SERVICE_ACCOUNT = "zeta-agent";
export const READER_ROLE = "zeta-host-cred-reader";

export type CredClass = "projectable" | "host-only" | "unclassified";

export function classifyCredId(id: string): CredClass {
  if (CLUSTER_PROJECTABLE_CRED_IDS.includes(id)) return "projectable";
  if (HOST_ONLY_CRED_IDS.includes(id)) return "host-only";
  return "unclassified";
}

export function secretNameFor(id: string): string {
  return `zeta-host-cred-${id}`;
}

export function resolveHomePath(path: string, home: string): string {
  if (path.startsWith("~/")) return join(home, path.slice(2));
  return path;
}

export interface RestoredFile {
  readonly id: string;
  readonly path: string;
  readonly key: string;
  readonly bytes: Buffer;
}

export interface Skip {
  readonly id: string;
  readonly reason: string;
}

export interface K8sObject {
  readonly apiVersion: string;
  readonly kind: string;
  readonly metadata: {
    readonly name: string;
    readonly namespace?: string;
    readonly labels?: Readonly<Record<string, string>>;
  };
  readonly [key: string]: unknown;
}

export interface ProjectionPlan {
  readonly namespace: string;
  readonly persona: string | null;
  readonly documents: readonly K8sObject[];
  readonly secrets: readonly K8sObject[];
  readonly skipped: readonly Skip[];
  readonly projectedIds: readonly string[];
}

export interface ClusterEffects {
  readonly apiReady: () => boolean;
  readonly applyJson: (json: string) => { readonly ok: true } | { readonly ok: false; readonly error: string };
}

export interface Args {
  readonly home: string;
  readonly namespace: string;
  readonly persona: string | null;
  readonly k3sBin: string;
  readonly kubeconfig: string;
  readonly dryRun: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretDataKey(path: string): string {
  return basename(path);
}

function labelsFor(id: string, persona: string | null): Record<string, string> {
  return {
    "app.kubernetes.io/name": "zeta-host-creds",
    "app.kubernetes.io/part-of": "zeta",
    "zeta.io/cred-id": id,
    "zeta.io/projected-from": "usb-host-restore",
    "zeta.io/persona": persona ?? "none",
  };
}

/**
 * One syscall, one answer. An `existsSync` / `lstatSync` before the read is a
 * check-then-use race (CWE-367 / `js/file-system-race` / this repo's
 * `lint-check-then-use-file-races`): between the check and the use the path
 * can be replaced, deleted, or turned into a directory, so the check's answer
 * is already stale. A miss IS the ENOENT; a directory IS the EISDIR.
 */
export type FileReadOutcome =
  | { readonly kind: "bytes"; readonly bytes: Buffer }
  | { readonly kind: "missing" }
  | { readonly kind: "directory" }
  | { readonly kind: "unreadable" };

export function readRestoredFile(path: string): FileReadOutcome {
  try {
    return { kind: "bytes", bytes: readFileSync(path) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { kind: "missing" };
    if (code === "EISDIR") return { kind: "directory" };
    return { kind: "unreadable" };
  }
}

export function collectRestoredFiles(
  home: string,
  readFile: (path: string) => FileReadOutcome = readRestoredFile,
): { readonly files: readonly RestoredFile[]; readonly skipped: readonly Skip[] } {
  const files: RestoredFile[] = [];
  const skipped: Skip[] = [];

  for (const entry of DEFAULT_MANIFEST.credentials) {
    const kind = classifyCredId(entry.id);
    const path = resolveHomePath(entry.paths[0]!, home);
    if (kind === "host-only") {
      skipped.push({ id: entry.id, reason: "host-only (not cluster-projectable)" });
      continue;
    }
    if (kind === "unclassified") {
      skipped.push({ id: entry.id, reason: "unclassified cred id (refusing to project)" });
      continue;
    }
    const outcome = readFile(path);
    if (outcome.kind === "directory") {
      skipped.push({ id: entry.id, reason: "source is a directory, not a file" });
      continue;
    }
    if (outcome.kind === "missing") {
      skipped.push({ id: entry.id, reason: `missing ${path}` });
      continue;
    }
    if (outcome.kind === "unreadable") {
      skipped.push({ id: entry.id, reason: `unreadable ${path}` });
      continue;
    }
    files.push({ id: entry.id, path, key: secretDataKey(path), bytes: outcome.bytes });
  }

  return { files, skipped };
}

function scaffolding(namespace: string): readonly K8sObject[] {
  return [
    {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: namespace,
        labels: {
          "app.kubernetes.io/name": "zeta-host-creds",
          "pod-security.kubernetes.io/enforce": "restricted",
        },
      },
    },
    {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: { name: READER_SERVICE_ACCOUNT, namespace },
    },
    {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: { name: READER_ROLE, namespace },
      rules: [{ apiGroups: [""], resources: ["secrets"], verbs: ["get", "list", "watch"] }],
    },
    {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: { name: READER_ROLE, namespace },
      subjects: [{ kind: "ServiceAccount", name: READER_SERVICE_ACCOUNT, namespace }],
      roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: READER_ROLE },
    },
  ];
}

function secretObject(file: RestoredFile, namespace: string, persona: string | null): K8sObject {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: secretNameFor(file.id),
      namespace,
      labels: labelsFor(file.id, persona),
    },
    type: "Opaque",
    data: {
      [file.key]: file.bytes.toString("base64"),
    },
  };
}

export function planHostCredDocuments(opts: {
  readonly home: string;
  readonly namespace?: string;
  readonly persona?: string | null;
  readonly files?: readonly RestoredFile[];
  readonly skipped?: readonly Skip[];
}): ProjectionPlan {
  const namespace = opts.namespace ?? DEFAULT_NAMESPACE;
  const persona = opts.persona ?? null;
  const collected =
    opts.files !== undefined ? { files: opts.files, skipped: opts.skipped ?? [] } : collectRestoredFiles(opts.home);
  const secrets = collected.files.map((file) => secretObject(file, namespace, persona));
  const documents = [...scaffolding(namespace), ...secrets];
  return {
    namespace,
    persona,
    documents,
    secrets,
    skipped: collected.skipped,
    projectedIds: collected.files.map((f) => f.id),
  };
}

/** Operator-facing summary. Must never contain credential bytes or base64. */
export function formatSummary(plan: ProjectionPlan): string {
  const lines: string[] = [];
  if (plan.secrets.length === 0) {
    lines.push(`zeta-creds-to-k8s: nothing to project into ${plan.namespace}`);
  } else {
    lines.push(
      `zeta-creds-to-k8s: applying ${plan.secrets.length} secrets in ${plan.namespace}` +
        (plan.persona ? ` (persona ${plan.persona})` : ""),
    );
    for (const secret of plan.secrets) {
      const data = isObject(secret.data) ? secret.data : {};
      const keys = Object.keys(data);
      const bytes = keys.reduce((sum, key) => {
        const encoded = data[key];
        if (typeof encoded !== "string") return sum;
        return sum + Buffer.from(encoded, "base64").length;
      }, 0);
      lines.push(`  Secret ${secret.metadata.name} (${keys.length} keys, ${bytes} bytes)`);
    }
  }
  for (const skip of plan.skipped) {
    lines.push(`  SKIP ${skip.id}: ${skip.reason}`);
  }
  return lines.join("\n");
}

export function applyPlan(
  plan: ProjectionPlan,
  effects: ClusterEffects,
): { readonly ok: true } | { readonly ok: false; readonly code: 3 | 4; readonly error: string } {
  if (!effects.apiReady()) {
    return { ok: false, code: 3, error: "kubernetes API not ready" };
  }
  if (plan.secrets.length === 0) {
    return { ok: true };
  }
  const payload = JSON.stringify({ apiVersion: "v1", kind: "List", items: plan.documents });
  const applied = effects.applyJson(payload);
  if (!applied.ok) return { ok: false, code: 4, error: applied.error };
  return { ok: true };
}

export function parseArgs(argv: readonly string[]): Args | { readonly error: string } {
  let home: string | null = null;
  let namespace = DEFAULT_NAMESPACE;
  let persona: string | null = null;
  let k3sBin = "k3s";
  let kubeconfig = "/etc/rancher/k3s/k3s.yaml";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[++i]!;
    };
    try {
      if (arg === "--home") home = next();
      else if (arg === "--namespace") namespace = next();
      else if (arg === "--persona") persona = next();
      else if (arg === "--k3s-bin") k3sBin = next();
      else if (arg === "--kubeconfig") kubeconfig = next();
      else if (arg === "--dry-run") dryRun = true;
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (!home) return { error: "--home required" };
  if (home.length === 0) return { error: "--home is empty" };
  if (namespace.length === 0) return { error: "--namespace is empty" };
  return { home, namespace, persona, k3sBin, kubeconfig, dryRun };
}

export function kubectlEffects(k3sBin: string, kubeconfig: string): ClusterEffects {
  const run = (args: readonly string[], stdin?: string) =>
    spawnSync(k3sBin, ["kubectl", "--kubeconfig", kubeconfig, ...args], {
      input: stdin,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      // Node's `maxBuffer` default is 1 MiB, and exceeding it KILLS the child
      // with ENOBUFS and returns truncated stdout. Today's callers are small
      // (`get ns`, `apply -f -`, `get secret -o jsonpath`), so this is a guard
      // rather than a fix for an observed truncation -- but it runs DURING THE
      // INSTALL, applying credentials, where a silently truncated reply is the
      // worst possible place to discover the limit. Found by the
      // `uncapped-renderer-spawn` rule added alongside this change, which is
      // the point of having the rule: this site was not on anybody's list.
      maxBuffer: DEFAULT_MAX_BYTES,
    });

  return {
    apiReady: () => {
      const result = run(["get", "ns", "kube-system", "--request-timeout=5s"]);
      return result.status === 0;
    },
    applyJson: (json) => {
      const result = run(["apply", "-f", "-"], json);
      if (result.status === 0) return { ok: true };
      const err = (result.stderr || result.stdout || `kubectl apply exited ${result.status}`).trim();
      return { ok: false, error: err };
    },
  };
}

/** Exported for tests that assert the lock against DEFAULT_MANIFEST. */
export function unclassifiedManifestIds(manifest: {
  readonly credentials: readonly CredentialEntry[];
}): readonly string[] {
  return manifest.credentials.map((c) => c.id).filter((id) => classifyCredId(id) === "unclassified");
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`zeta-creds-to-k8s: ${parsed.error}`);
    return 2;
  }
  const plan = planHostCredDocuments({
    home: parsed.home,
    namespace: parsed.namespace,
    persona: parsed.persona,
  });
  console.log(formatSummary(plan));
  if (parsed.dryRun) return 0;
  const applied = applyPlan(plan, kubectlEffects(parsed.k3sBin, parsed.kubeconfig));
  if (!applied.ok) {
    console.error(`zeta-creds-to-k8s: ${applied.error}`);
    return applied.code;
  }
  if (plan.secrets.length === 0) {
    console.log("zeta-creds-to-k8s: skip (no projectable files on disk)");
  } else {
    console.log(`zeta-creds-to-k8s: applied ${plan.secrets.length} secrets`);
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
