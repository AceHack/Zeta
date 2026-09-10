#!/usr/bin/env bun
// audit-k3s-manifests-reach-a-server.ts — a manifest declared on an agent is never applied.
//
// WHY THIS FILE EXISTS
// --------------------
// `services.k3s.manifests` writes each entry as a flat `<name>.yaml` into
// `/var/lib/rancher/k3s/server/manifests`, and the k3s DEPLOY CONTROLLER submits them. That
// controller runs on a k3s SERVER. On an agent the files are written and nothing reads them —
// no error, no warning, no applied resource.
//
// MEASURED 2026-09-07 by evaluating the flake, which is how this audit came to exist:
//
//   nixosConfigurations.worker-gpu.config.services.k3s.role      => "agent"
//   nixosConfigurations.worker-gpu.config.services.k3s.manifests => [ local-path-provisioner,
//                                                                    nvidia-device-plugin ]
//   nixosConfigurations.control-plane.config.services.k3s.manifests => 12 entries,
//                                                                      nvidia-device-plugin NOT among them
//
// So the NVIDIA device-plugin DaemonSet is declared exactly once, on the one node that cannot
// apply it, and `gpu-device-plugin.nix` says in its own comment that the K3S-manifest path is
// the only route ("a future k8s/applications/gpu-device-plugin/ Application could take over
// ... but it doesn't exist yet"). There is no such Application. The consequence is not subtle:
// GPUs are never advertised to the scheduler, so a GPU pod stays Pending forever — and every
// check in the tree passes, because nothing was ever wired to notice.
//
// WHAT IT CHECKS
// --------------
// For every host configuration: if it imports a module that sets `services.k3s.manifests`, the
// host must also import a module that sets `role = "server"`. Static and cheap — no `nix`
// required, so it runs in the ordinary TypeScript lane rather than needing an evaluator.
//
// HONEST LIMIT, stated because a check that overstates its reach is worse than none: this reads
// IMPORT LISTS, not evaluated configuration. A module reached transitively (a module importing
// another module) is followed one level; a `role` set by an option default rather than by an
// imported module is not seen. It is a proxy for the eval, chosen because it can run everywhere.
// The eval above is the ground truth and is quoted in the finding so a reader can re-run it.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const HOSTS_DIR = "full-ai-cluster/nixos/hosts";
export const MODULES_DIR = "full-ai-cluster/nixos/modules";

const MANIFEST_SETTER = /services\.k3s\.manifests\s*=/u;
const SERVER_ROLE = /role\s*=\s*"server"/u;

export interface HostFacts {
  readonly host: string;
  readonly imports: readonly string[];
  readonly manifestModules: readonly string[];
  readonly declaresServer: boolean;
}

/** Module basenames imported by a host file, in declaration order. */
export function parseImports(text: string): readonly string[] {
  const block = /imports\s*=\s*\[([\s\S]*?)\]/u.exec(text);
  if (block?.[1] === undefined) return [];
  return [...block[1].matchAll(/([A-Za-z0-9._-]+)\.nix/gu)].map((m) => `${m[1]}.nix`);
}

export function moduleSetsManifests(dir: string, name: string): boolean {
  const t = readOrNull(join(dir, name));
  return t !== null && MANIFEST_SETTER.test(t);
}

export function moduleDeclaresServer(dir: string, name: string): boolean {
  const t = readOrNull(join(dir, name));
  return t !== null && SERVER_ROLE.test(t);
}

/** Read a file, or null when it is not there. ONE syscall — no check-then-use window. */
function readOrNull(p: string): string | null {
  try {
    return readFileSync(p, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "ENOTDIR") {
      return null;
    }
    throw e;
  }
}

export function auditHosts(root: string): readonly HostFacts[] {
  const hostsDir = join(root, HOSTS_DIR);
  const modulesDir = join(root, MODULES_DIR);
  let entries: readonly { name: string; isDirectory: () => boolean }[];
  try {
    entries = readdirSync(hostsDir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: HostFacts[] = [];
  for (const host of entries) {
    if (!host.isDirectory()) continue;
    const texts = ["configuration.nix", "default.nix"].map((c) => readOrNull(join(hostsDir, host.name, c)));
    const text = texts.find((t) => t !== null);
    if (text === undefined || text === null) continue;
    const imports = parseImports(text);
    out.push({
      host: host.name,
      imports,
      manifestModules: imports.filter((m) => moduleSetsManifests(modulesDir, m)),
      declaresServer: imports.some((m) => moduleDeclaresServer(modulesDir, m)),
    });
  }
  return out.sort((a, b) => (a.host < b.host ? -1 : a.host > b.host ? 1 : 0));
}

export function findings(facts: readonly HostFacts[]): readonly string[] {
  return facts
    .filter((f) => f.manifestModules.length > 0 && !f.declaresServer)
    .map(
      (f) =>
        `${f.host}: imports ${f.manifestModules.join(", ")} — which set services.k3s.manifests — ` +
        `but imports no module setting role = "server". k3s writes those entries to ` +
        `/var/lib/rancher/k3s/server/manifests, where only a SERVER's deploy controller reads ` +
        `them. On this host they are written and never applied.`,
    );
}

/** A tree with no hosts is not a passing tree — it is an audit that did not run. */
export const MIN_EXPECTED_HOSTS = 2;

/**
 * Hosts whose defect is KNOWN, ACKNOWLEDGED and not yet fixed.
 *
 * Not an exemption: the entry carries the consequence and the lift condition, and a host that
 * STOPS being broken fails the audit too, so the baseline can only shrink. The fix is deferred
 * on purpose — it turns on whether the device plugin becomes a server-declared cluster concern
 * or an ArgoCD Application, and that choice belongs with the role-composability redesign Aaron
 * opened on 2026-09-07 ("control plane and gpu, not just one or the other"), not with the audit
 * that found it.
 */
export const ACKNOWLEDGED: ReadonlyMap<string, string> = new Map([
  [
    "worker-gpu",
    "local-path-provisioner only, and it is DEAD WEIGHT rather than a gap: the same manifest " +
      "is declared on control-plane (role=server), where it is actually applied. The real " +
      "defect this audit was built for — nvidia-device-plugin declared ONLY here, on an agent, " +
      "so GPUs were never advertised to the scheduler — is FIXED in this same change: the " +
      "DaemonSet is now declared on the control plane, whose deploy controller can apply it, " +
      "and its nodeSelector places it on the GPU nodes. " +
      "LIFTS WHEN local-storage.nix is split into its node-level half (systemd.tmpfiles, needed " +
      "on every node) and its cluster-level half (the manifest, server-only) — the same " +
      "node/cluster split this whole class comes from.",
  ],
  [
    "worker-template",
    "Same single remaining entry as worker-gpu, for the same reason — this is the cookie-cutter " +
      "it is copied from. LIFTS WITH worker-gpu.",
  ],
]);

function main(): number {
  const facts = auditHosts(process.cwd());
  if (facts.length < MIN_EXPECTED_HOSTS) {
    console.error(
      `REFUSED: found ${String(facts.length)} host configuration(s) under ${HOSTS_DIR}, expected at ` +
        `least ${String(MIN_EXPECTED_HOSTS)}. An empty scan passes vacuously; that is not a green.`,
    );
    return 2;
  }
  const all = findings(facts);
  const unacknowledged = all.filter((f) => !ACKNOWLEDGED.has(f.split(":")[0] ?? ""));
  const fixed = [...ACKNOWLEDGED.keys()].filter(
    (h) => !all.some((f) => f.startsWith(`${h}:`)) && facts.some((x) => x.host === h),
  );
  const found = unacknowledged;
  for (const f of facts) {
    console.log(
      `  ${f.host.padEnd(18)} server=${String(f.declaresServer).padEnd(5)} manifest-modules=[${f.manifestModules.join(" ")}]`,
    );
  }
  if (fixed.length > 0) {
    console.error(
      `\nFAIL: ${String(fixed.length)} acknowledged host(s) no longer have the defect — the ` +
        `baseline must shrink with the fix, or it starts describing a tree that no longer exists:\n  ` +
        fixed.join("\n  "),
    );
    return 1;
  }
  if (found.length === 0) {
    if (ACKNOWLEDGED.size > 0) {
      console.log(
        `\nOK: no UNACKNOWLEDGED host declares unappliable manifests. ` +
          `${String(ACKNOWLEDGED.size)} acknowledged: ${[...ACKNOWLEDGED.keys()].join(", ")}`,
      );
    } else {
      console.log(`\nOK: every manifest-declaring host is a k3s server (${String(facts.length)} hosts).`);
    }
    return 0;
  }
  console.error(`\nFAIL: ${String(found.length)} host(s) declare k3s manifests that nothing will apply:\n`);
  for (const f of found) console.error(`  - ${f}\n`);
  console.error(
    `Ground truth, re-runnable:\n` +
      `  cd full-ai-cluster && nix eval .#nixosConfigurations.<host>.config.services.k3s.role\n` +
      `  cd full-ai-cluster && nix eval .#nixosConfigurations.<host>.config.services.k3s.manifests --apply builtins.attrNames\n`,
  );
  return 1;
}

if (import.meta.main) process.exit(main());
