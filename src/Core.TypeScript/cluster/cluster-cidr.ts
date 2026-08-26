/**
 * src/Core.TypeScript/cluster/cluster-cidr.ts
 *
 * DERIVE a cluster's pod and service CIDRs — and its Cilium ClusterMesh
 * cluster-id — from the cluster's IDENTITY. Pure function, no allocator, no
 * registry, no node that has to be asked (manifesto §1: no central point of
 * coordination).
 *
 * THE DEFECT THIS CLOSES
 * ----------------------
 * `full-ai-cluster/nixos/modules/k3s-server.nix` shipped
 *
 *     "--cluster-cidr=10.42.0.0/16"
 *     "--service-cidr=10.43.0.0/16"
 *
 * as literals, and `k8s/bootstrap/cilium-install.yaml` +
 * `k8s/applications/cilium/Application.yaml` restated `10.42.0.0/16` twice
 * more. Every machine flashed from this tree therefore claimed the SAME pod
 * and service space. Two consequences, and only the second is fixed here:
 *
 *   1. Nodes joining ONE cluster are supposed to share the cluster CIDRs, so
 *      the literal is not what blocks a multi-node cluster. The join path is —
 *      see `nixos/modules/injected-server-join.nix`.
 *   2. Two DISTINCT clusters that may later federate (Cilium ClusterMesh)
 *      must have DISJOINT pod and service CIDRs and distinct cluster ids.
 *      Identical literals make that impossible by construction. That is what
 *      this module fixes.
 *
 * COLLISION-RESISTANT, NOT COLLISION-FREE — AND THE CEILING IS NOT OURS
 * --------------------------------------------------------------------
 * Cilium's ClusterMesh cluster-id is EIGHT BITS (1..255; 0 means unset). So a
 * derivation with no allocator cannot be collision-free: 2^128 identities do
 * not fit in 255 slots, and no hash function repeals the pigeonhole principle.
 * Stating the bound rather than implying safety:
 *
 *   - 255 slots, uniform assignment ⇒ the birthday bound puts the probability
 *     of ANY collision at ~50% around 19 federated clusters, and at ~3.9% at
 *     four clusters (the largest estate this repo has ever described).
 *   - The mitigation is DETECTION, not avoidance: two clusters that federate
 *     must exchange identity anyway, and equal cluster ids or overlapping
 *     CIDRs is a loud refusal at mesh time. `deriveClusterNetwork` is a total
 *     function, so both sides can compute the other's values from its name
 *     alone and compare before a single packet is exchanged.
 *   - An operator who hits a collision RENAMES one cluster. Renaming is the
 *     escape hatch that keeps this allocator-free; an allocator would be an
 *     appointed authority for the whole federation
 *     (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` —
 *     the defect is appointment, not degree).
 *
 * ADDRESS SPACE, AND WHY THESE RANGES
 * -----------------------------------
 * Pod space  `10.128.0.0/9`   carved into 255 usable /17s (128 nodes each at
 *                             Cilium's default /24 per node).
 * Svc space  `10.96.0.0/11`   carved into 255 usable /19s (8190 services).
 *
 * Both avoid every range already in this tree's path, and the avoidance is
 * CHECKED rather than asserted — {@link RESERVED_RANGES} is enumerated below
 * and the test suite walks all 255 slots against it:
 *   - `10.0.2.0/24`  — QEMU SLIRP user-mode NAT in the multi-VM harness.
 *   - `10.42.0.0/16` / `10.43.0.0/16` — k3s's own defaults. Excluded ON
 *     PURPOSE: a node that never got the derivation keeps k3s's defaults, and
 *     those must not silently coincide with a derived cluster's space. A
 *     misconfigured node is then VISIBLY on the wrong network rather than
 *     invisibly on the right one.
 *   - `10.88.0.0/24` — the cluster segment (`zflash/cluster-address.ts`).
 *
 * THAT CHECK IS NOT DECORATION. The first draft of this module put the
 * service space at `10.64.0.0/10`, which is a perfectly reasonable-looking
 * choice and is WRONG: slot 96 lands on `10.88.0.0/18`, which CONTAINS the
 * `10.88.0.0/24` cluster segment every joiner is addressed on. One cluster
 * name in 255 would have made the segment unroutable, and no amount of
 * reading the constant would have shown it. The enumerated reserved list plus
 * an exhaustive walk found it in the first run.
 *
 * PURE CORE. No I/O. Same discipline, and for the same reason, as its
 * neighbour `zflash/cluster-address.ts`: the value that decides whether two
 * clusters can ever see each other should be checkable before either exists.
 *
 * THE NIX TWIN IS BYTE-LOCKED TO THIS FILE.
 * `full-ai-cluster/nixos/modules/cluster-network.nix` reimplements this
 * derivation in Nix (Nix cannot import TypeScript). The two are held together
 * by `full-ai-cluster/nixos/tests/cluster-cidr-golden-vectors.json` — text,
 * diffable, replayable (`.claude/rules/no-binary-in-proof-lineage.md`) — which
 * this module's test suite and `nixos/tests/cluster-cidr-eval-test.nix` each
 * check independently. Edit one side alone and one of them goes red.
 *
 * Anchors (Beacon): RFC 1918 (Rekhter et al., 1996) private address space;
 * RFC 1123 (Braden, 1989) host-name label syntax, which is the shape Cilium
 * requires of a cluster name; Cilium ClusterMesh's `cluster.id` 1..255
 * constraint (Isovalent/Cilium docs, "Setting up Cluster Mesh"); the
 * birthday bound (von Mises, 1939) for the collision figure above.
 */

import { createHash } from "node:crypto";

/** Cilium ClusterMesh reserves 0 for "unset"; ids run 1..255. */
export const MIN_CLUSTER_ID = 1;
export const MAX_CLUSTER_ID = 255;

/** Number of distinct derived slots. Equal to the Cilium cluster-id range. */
export const CLUSTER_SLOT_COUNT = MAX_CLUSTER_ID - MIN_CLUSTER_ID + 1;

/** Pod space `10.128.0.0/9`, carved into /17s. */
export const POD_SPACE_FIRST_SECOND_OCTET = 128;
export const POD_PREFIX_LENGTH = 17;

/** Service space `10.96.0.0/11`, carved into /19s. */
export const SERVICE_SPACE_FIRST_SECOND_OCTET = 96;
export const SERVICE_PREFIX_LENGTH = 19;

/**
 * Ranges no derived CIDR may overlap, with the reason each one is here.
 *
 * Enumerated as DATA so it can be walked exhaustively rather than trusted.
 * See {@link cidrsOverlap} and the test that walks every slot.
 */
export const RESERVED_RANGES: readonly { readonly cidr: string; readonly why: string }[] = [
  { cidr: "10.0.2.0/24", why: "QEMU SLIRP user-mode NAT (zflash multi-VM harness)" },
  { cidr: "10.42.0.0/16", why: "k3s default cluster CIDR — an underived node must look different" },
  { cidr: "10.43.0.0/16", why: "k3s default service CIDR — an underived node must look different" },
  { cidr: "10.88.0.0/24", why: "the cluster segment (zflash/cluster-address.ts)" },
  { cidr: "192.168.0.0/16", why: "home LANs" },
  { cidr: "172.16.0.0/12", why: "docker/podman default bridge pools" },
];

/**
 * Cluster names are RFC-1123 labels, capped at 32 characters.
 *
 * The cap is Cilium's, not ours: the cluster name is embedded in ClusterMesh
 * identities and Cilium refuses names longer than 32 characters. Enforcing it
 * here means a name that would be rejected at mesh time is rejected at
 * derivation time, where the failure costs nothing.
 */
export const CLUSTER_NAME_MAX_LENGTH = 32;
export const CLUSTER_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

export interface ClusterNetwork {
  /** The identity the whole derivation is a function of. */
  readonly clusterName: string;
  /** Cilium ClusterMesh `cluster.id`, 1..255. */
  readonly clusterId: number;
  /** k3s `--cluster-cidr`, e.g. `10.143.0.0/17`. */
  readonly podCidr: string;
  /** k3s `--service-cidr`, e.g. `10.99.96.0/19`. */
  readonly serviceCidr: string;
}

export type ClusterNetworkResult =
  | { readonly ok: true; readonly value: ClusterNetwork }
  | { readonly ok: false; readonly error: string };

/**
 * The 16-bit hash draw the slot is taken from.
 *
 * SHA-256 over the UTF-8 name, first four hex digits. Sixteen bits rather
 * than eight because `65536 = 255 * 257 + 1`: the modulo bias is one extra
 * preimage on a single residue (~0.4%), where an 8-bit draw would put two
 * residues on one slot. Exported because the Nix twin computes the same
 * value and the golden vectors pin it — a hash disagreement should read as a
 * hash disagreement, not as a mysterious CIDR difference.
 */
export function clusterNameHash16(clusterName: string): number {
  const digest = createHash("sha256").update(clusterName, "utf8").digest("hex");
  return Number.parseInt(digest.slice(0, 4), 16);
}

/** Validate a cluster name. Returns the refusal message, or `null` if valid. */
export function validateClusterName(clusterName: string): string | null {
  if (clusterName.length === 0) {
    return "cluster name is required (it is the only input the CIDR derivation has)";
  }
  if (clusterName.length > CLUSTER_NAME_MAX_LENGTH) {
    return (
      `cluster name must be at most ${String(CLUSTER_NAME_MAX_LENGTH)} characters ` +
      `(Cilium embeds it in ClusterMesh identities), got ${String(clusterName.length)}: ` +
      JSON.stringify(clusterName)
    );
  }
  if (!CLUSTER_NAME_REGEX.test(clusterName)) {
    return (
      `cluster name must be a lowercase RFC-1123 label (letters, digits, interior hyphens), ` +
      `got ${JSON.stringify(clusterName)}`
    );
  }
  return null;
}

/**
 * `clusterName -> { clusterId, podCidr, serviceCidr }`. Total: every rejection
 * is a typed refusal, every acceptance is deterministic and replayable.
 */
export function deriveClusterNetwork(clusterName: string): ClusterNetworkResult {
  const nameError = validateClusterName(clusterName);
  if (nameError !== null) {
    return { ok: false, error: nameError };
  }

  const clusterId = MIN_CLUSTER_ID + (clusterNameHash16(clusterName) % CLUSTER_SLOT_COUNT);
  // Slot index 0..254. `clusterId` is what Cilium wants; `slot` is what the
  // address arithmetic wants, and keeping them separate is what stops an
  // off-by-one from silently shifting every cluster's network by one block.
  const slot = clusterId - MIN_CLUSTER_ID;

  // A /17 is half a /16: two per second-octet step, third octet 0 or 128.
  const podSecondOctet = POD_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 2);
  const podThirdOctet = (slot % 2) * 128;

  // A /19 is an eighth of a /16: eight per second-octet step, third octet
  // stepping by 32.
  const serviceSecondOctet = SERVICE_SPACE_FIRST_SECOND_OCTET + Math.floor(slot / 8);
  const serviceThirdOctet = (slot % 8) * 32;

  return {
    ok: true,
    value: {
      clusterName,
      clusterId,
      podCidr: `10.${String(podSecondOctet)}.${String(podThirdOctet)}.0/${String(POD_PREFIX_LENGTH)}`,
      serviceCidr: `10.${String(serviceSecondOctet)}.${String(serviceThirdOctet)}.0/${String(SERVICE_PREFIX_LENGTH)}`,
    },
  };
}

/**
 * Would these two clusters be able to federate?
 *
 * The detection half of "collision-resistant, not collision-free". Reports the
 * FACT (`sameSlot`) rather than a verdict — what to do about a collision is
 * the operator's call, not this function's
 * (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
 */
export function clusterNetworksCollide(a: ClusterNetwork, b: ClusterNetwork): boolean {
  if (a.clusterName === b.clusterName) {
    // Same cluster, not a collision. Two names that are equal are one cluster.
    return false;
  }
  return a.clusterId === b.clusterId;
}

/** Parse a dotted-quad `a.b.c.d/len` into `[firstAddress, lastAddress]` as u32s. */
export function cidrBounds(cidr: string): { readonly first: number; readonly last: number } {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr);
  if (match === null) {
    throw new Error(`not a dotted-quad CIDR: ${JSON.stringify(cidr)}`);
  }
  // Destructured and folded rather than indexed. `noUncheckedIndexedAccess`
  // (tsconfig.json) types every `match[i]` and `octets[i]` as `T | undefined`,
  // and the `match === null` guard above does not narrow them. The regex
  // guarantees all five groups whenever it matches, so the `undefined` branch
  // below is unreachable at runtime; it exists to carry that guarantee into
  // the TYPES rather than to assert it away with `!`, which would suppress the
  // check instead of discharging it.
  const [, a, b, c, d, len] = match;
  if (a === undefined || b === undefined || c === undefined || d === undefined || len === undefined) {
    throw new Error(`not a dotted-quad CIDR: ${JSON.stringify(cidr)}`);
  }
  const octets = [a, b, c, d].map((o) => Number.parseInt(o, 10));
  const prefix = Number.parseInt(len, 10);
  if (octets.some((o) => o > 255) || prefix > 32) {
    throw new Error(`CIDR out of range: ${JSON.stringify(cidr)}`);
  }
  const base = octets.reduce((acc, o) => acc * 256 + o, 0);
  const size = 2 ** (32 - prefix);
  // Masked rather than trusted: `10.42.5.0/16` should compare as `10.42.0.0/16`.
  const first = base - (base % size);
  return { first, last: first + size - 1 };
}

/** Do two CIDRs share any address? */
export function cidrsOverlap(a: string, b: string): boolean {
  const left = cidrBounds(a);
  const right = cidrBounds(b);
  return left.first <= right.last && right.first <= left.last;
}
