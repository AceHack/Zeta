#!/usr/bin/env bun
// lint-cluster-cidr-agreement.ts — the cluster's pod CIDR is restated on four
// surfaces; a disagreement between any two is a data-plane split.
//
// THE INVARIANT
//
//   Every surface that names the cluster's pod or service CIDR must name the
//   value DERIVED from `clusterName` in `full-ai-cluster/cluster-identity.json`,
//   and no surface may still carry the old hardcoded k3s defaults.
//
// WHY IT MATTERS MORE THAN IT LOOKS. The pod CIDR is a treaty between two
// independent components: k3s (`--cluster-cidr`, which decides what the kubelet
// and the node routes expect) and Cilium (`clusterPoolIPv4PodCIDRList` +
// `ipv4NativeRoutingCIDR`, which decides what addresses pods actually get and
// which ones are routed natively rather than masqueraded). When they disagree,
// nothing crashes: pods come up, get addresses, and their traffic goes nowhere.
// The symptom reads as a network fault — the single hardest class of bug to
// trace back to a config edit.
//
// AND ONE OF THE FOUR SURFACES IS RECONCILED FROM GIT.
// `k8s/applications/cilium/Application.yaml` is an ArgoCD Application with
// selfHeal, so a stale value there is not a one-time disagreement — it is
// re-applied over the bootstrap manifest on every sync, forever. That is the
// same two-owners-disagree shape `k3s-server.nix` already records for Vault
// (two reconcilers, two storage backends, conversion on a loop). This check is
// what stops the CIDR from becoming its second instance.
//
// WHY THIS EXISTS AS WELL AS THE NIX ASSERTIONS.
// `full-ai-cluster/nixos/modules/cluster-network.nix` asserts the same
// agreement at Nix evaluation time — and NO WORKFLOW IN THIS REPOSITORY RUNS
// `nix flake check` ON `full-ai-cluster/flake.nix`. An assertion nothing
// evaluates is a check that never runs. This file is the half CI actually
// executes, via `bun test src/Core.TypeScript/hygiene/`.
//
// SCOPE. Reports FACTS about file contents. It does not edit anything and it
// does not decide what the cluster name should be.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveClusterNetwork } from "../cluster/cluster-cidr";

/** Repo-relative path of the one place the cluster's identity is declared. */
export const CLUSTER_IDENTITY_PATH = "full-ai-cluster/cluster-identity.json";

/**
 * Files that must mention the DERIVED pod CIDR, with what each one is.
 *
 * Enumerated as data so the check walks a roster rather than a hand-written
 * sequence of `if`s that drifts from the tree.
 */
export const POD_CIDR_SURFACES: readonly { readonly path: string; readonly role: string }[] = [
  {
    path: "full-ai-cluster/k8s/bootstrap/cilium-install.yaml",
    role: "Cilium's bootstrap HelmChart — what the CNI hands pods on first boot",
  },
  {
    path: "full-ai-cluster/k8s/applications/cilium/Application.yaml",
    role: "the ArgoCD Application — selfHeal re-applies this over the bootstrap one forever",
  },
];

/**
 * The literals this change replaced. Any surviving occurrence in the surfaces
 * above is a half-applied edit, which is worse than not having started.
 *
 * NOT scanned for repo-wide: `dev-cluster/profiles/ci.cilium.kind-config.yaml`
 * legitimately uses `10.42.0.0/16` because it is a DIFFERENT cluster (a kind
 * cluster in CI) that never federates with this one, and `k3s-server.nix`
 * mentions `10.43.0.1` inside a prose comment about an rpfilter incident.
 * Flagging either would be the cry-wolf failure.
 */
export const RETIRED_LITERALS: readonly string[] = ["10.42.0.0/16", "10.43.0.0/16"];

export interface Finding {
  readonly file: string;
  readonly problem: string;
}

export interface ClusterIdentity {
  readonly clusterName: string;
}

/**
 * Read a file, or `null` if it is not there.
 *
 * ONE syscall, not two. `existsSync` followed by `readFileSync` is a
 * check-then-use race: between the two calls the path can be created, deleted,
 * or replaced, so the answer the check returned is already stale when the use
 * runs — the check reads as defensive and prevents nothing.
 * `lint-check-then-use-file-races.ts` caught exactly that shape in the first
 * draft of this file, twice.
 */
function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function readClusterIdentity(repoRoot: string): ClusterIdentity {
  const path = join(repoRoot, CLUSTER_IDENTITY_PATH);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { clusterName?: unknown }).clusterName !== "string"
  ) {
    throw new Error(`${CLUSTER_IDENTITY_PATH} has no string \`clusterName\``);
  }
  return { clusterName: (parsed as { clusterName: string }).clusterName };
}

/**
 * The audit. Pure over (repoRoot) — the same tree always produces the same
 * findings, which is what lets the test drive it over a fixture.
 */
export function auditClusterCidrAgreement(repoRoot: string): readonly Finding[] {
  const findings: Finding[] = [];

  const identity = readClusterIdentity(repoRoot);
  const derived = deriveClusterNetwork(identity.clusterName);
  if (!derived.ok) {
    return [{ file: CLUSTER_IDENTITY_PATH, problem: derived.error }];
  }
  const { podCidr } = derived.value;

  for (const surface of POD_CIDR_SURFACES) {
    const text = readFileOrNull(join(repoRoot, surface.path));
    if (text === null) {
      // An absent surface is reported, never skipped. A roster entry that
      // silently matches nothing is how a check stops checking.
      findings.push({ file: surface.path, problem: `roster names this file (${surface.role}) and it does not exist` });
      continue;
    }
    if (!text.includes(podCidr)) {
      findings.push({
        file: surface.path,
        problem:
          `does not mention the derived pod CIDR ${podCidr} ` +
          `(cluster ${JSON.stringify(identity.clusterName)}); ${surface.role}`,
      });
    }
    for (const retired of RETIRED_LITERALS) {
      if (text.includes(retired)) {
        findings.push({
          file: surface.path,
          problem: `still carries the retired hardcoded literal ${retired}; ${surface.role}`,
        });
      }
    }
  }

  // The k3s side must NOT carry a literal at all — it reads the derived option.
  const k3sServer = "full-ai-cluster/nixos/modules/k3s-server.nix";
  const k3sText = readFileOrNull(join(repoRoot, k3sServer));
  if (k3sText === null) {
    findings.push({ file: k3sServer, problem: "expected to exist and set --cluster-cidr from zeta.cluster.podCidr" });
  } else {
    const text = k3sText;
    if (!text.includes("--cluster-cidr=${config.zeta.cluster.podCidr}")) {
      findings.push({
        file: k3sServer,
        problem: "does not set --cluster-cidr from config.zeta.cluster.podCidr (the derived value)",
      });
    }
    if (!text.includes("--service-cidr=${config.zeta.cluster.serviceCidr}")) {
      findings.push({
        file: k3sServer,
        problem: "does not set --service-cidr from config.zeta.cluster.serviceCidr (the derived value)",
      });
    }
  }

  return findings;
}

function main(): number {
  const repoRoot = process.cwd();
  let findings: readonly Finding[];
  try {
    findings = auditClusterCidrAgreement(repoRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Exit 2, not 1: a check that could not RUN must never be reported as a
      // check that PASSED, and it must not be reported as one that FAILED
      // either. `.claude/rules` — rc=2 is "the check never ran".
      console.error(`lint-cluster-cidr-agreement: ${CLUSTER_IDENTITY_PATH} not found — run from the repo root.`);
      return 2;
    }
    throw error;
  }
  if (findings.length === 0) {
    const identity = readClusterIdentity(repoRoot);
    const derived = deriveClusterNetwork(identity.clusterName);
    const shown = derived.ok ? `${derived.value.podCidr} / ${derived.value.serviceCidr} (id ${String(derived.value.clusterId)})` : "?";
    console.log(
      `cluster CIDR agreement: OK — cluster ${JSON.stringify(identity.clusterName)} derives ${shown}, ` +
        `and every surface that restates it agrees.`,
    );
    return 0;
  }
  console.error(`cluster CIDR agreement: ${String(findings.length)} disagreement(s):`);
  for (const f of findings) console.error(`  ${f.file}  ${f.problem}`);
  console.error(
    "\nk3s' --cluster-cidr and Cilium's clusterPoolIPv4PodCIDRList/ipv4NativeRoutingCIDR are\n" +
      "one treaty. When they disagree nothing crashes: pods get addresses and their traffic\n" +
      "goes nowhere, which reads as a network fault rather than as a config edit. Derive the\n" +
      "value once (src/Core.TypeScript/cluster/cluster-cidr.ts) and restate it identically.",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
