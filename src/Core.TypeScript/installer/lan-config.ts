/**
 * src/Core.TypeScript/installer/lan-config.ts
 *
 * The install-time settings that are a fact about the LAN the node is plugged
 * into, and the TypeScript oracle the installer's shell twin (the
 * `ZETA-LB-POOL` block in zeta-install.sh) is compared against in
 * `lan-config-shell-parity.test.ts`.
 *
 * Same mechanism as the public domain and the ACME email (public-endpoint.ts,
 * 081M3JG74G0087G0R001XJC837): ESP `/zeta-firstboot.conf` -> prompt -> UNSET,
 * `/etc/zeta/<file>` -> NixOS module at evaluation time -> a separate ArgoCD
 * Application in the k3s auto-deploy roster whose kustomize base carries no
 * value. Nothing new is invented here; this file is the pure half.
 *
 * TWO THINGS, ONE FILE, BECAUSE THEY ARE THE SAME FACT
 * ----------------------------------------------------
 *
 *  1. THE LOAD-BALANCER ADDRESS RANGE (Cilium LB-IPAM).
 *     `k8s/applications/cilium-lb-ipam/ip-pool.yaml` shipped
 *     `192.168.1.240 - 192.168.1.250`, a block that is only meaningful on one
 *     particular home subnet. On any other network Cilium hands every
 *     `type: LoadBalancer` Service (the portal gateway, GitLab) an address no
 *     router knows: the Service reads `Pending`-then-`Ready`, ARP announcements
 *     go out for an off-subnet address, and nothing is reachable. No error
 *     anywhere says so. The range is now install-time config and the repo
 *     carries NO default.
 *
 *  2. DOES THE CLUSTER'S OWN ADDRESS SPACE COLLIDE WITH THE LAN?
 *     The pod /17 and service /19 are derived from the cluster name inside
 *     `10.128.0.0/9` and `10.96.0.0/11` (cluster-cidr.ts). A LAN that already
 *     owns a block of that space - any 10.x site network - makes the node's
 *     own route to its gateway ambiguous with a pod route. Nothing crashes;
 *     pods get addresses and traffic to the colliding LAN hosts goes into the
 *     overlay. Detected here, before the disk is wiped.
 *
 * Pure functions, no IO.
 */

import { cidrBounds, cidrsOverlap, deriveClusterNetwork } from "../cluster/cluster-cidr.ts";

/** ESP-conf / environment name. The shell twin reads exactly this. */
export const LB_POOL_ENV = "ZETA_LB_POOL";

/** The value that asks the installer to derive a range from the detected LAN. */
export const LB_POOL_AUTO = "auto";

/**
 * A range larger than this is a typo (a /16 pasted into a range), not an intent:
 * 256 LoadBalancer Services is already two orders above a home cluster's need.
 */
export const LB_POOL_MAX_ADDRESSES = 256;

/** The inter-node segment a joiner is given an address on (zflash/cluster-address.ts). */
export const CLUSTER_SEGMENT_CIDR = "10.88.0.0/24";

/** The last-octet window proposed inside the node's own /24: `.240` - `.250`. */
export const PROPOSED_POOL_FIRST_HOST = 240;
export const PROPOSED_POOL_LAST_HOST = 250;

export type LbPoolVerdict =
  | "valid"
  | "bad-start"
  | "bad-stop"
  | "reversed"
  | "too-large"
  | "outside-lan"
  | "network-or-broadcast"
  | "contains-node"
  | "contains-gateway"
  | "overlaps-reserved";

/** What the installer measured about the interface that owns the default route. */
export interface LanFacts {
  readonly nodeIp: string;
  readonly prefix: number;
  /** Empty string when the route has no `via` (an on-link default). */
  readonly gateway: string;
}

/** Strict dotted quad: four decimal octets, 0-255, no leading zeros (`010` is octal in some parsers). */
export function parseIpv4(s: string): number | null {
  const m = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(s);
  if (m === null) return null;
  const octets = [m[1], m[2], m[3], m[4]].map((o) => Number.parseInt(o ?? "", 10));
  if (octets.some((o) => !Number.isInteger(o) || o > 255)) return null;
  return ((octets[0]! * 256 + octets[1]!) * 256 + octets[2]!) * 256 + octets[3]!;
}

export function formatIpv4(n: number): string {
  return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join(".");
}

/** `[first, last]` of the subnet containing `ip` at `prefix`, or null for an unusable prefix. */
export function subnetOf(ip: number, prefix: number): { readonly first: number; readonly last: number } | null {
  if (!Number.isInteger(prefix) || prefix < 8 || prefix > 30) return null;
  const size = 2 ** (32 - prefix);
  const first = ip - (ip % size);
  return { first, last: first + size - 1 };
}

function overlapsReserved(start: number, stop: number, reservedCidrs: readonly string[]): boolean {
  return reservedCidrs.some((c) => {
    const b = cidrBounds(c);
    return start <= b.last && b.first <= stop;
  });
}

/**
 * Is `start`-`stop` a LoadBalancer range that can work on THIS LAN? Verdicts are
 * ordered; the first failure wins, and the shell twin reproduces the order.
 */
export function validateLbPool(
  startRaw: string,
  stopRaw: string,
  lan: LanFacts,
  reservedCidrs: readonly string[],
): LbPoolVerdict {
  const start = parseIpv4(startRaw);
  if (start === null) return "bad-start";
  const stop = parseIpv4(stopRaw);
  if (stop === null) return "bad-stop";
  if (start > stop) return "reversed";
  if (stop - start + 1 > LB_POOL_MAX_ADDRESSES) return "too-large";
  const node = parseIpv4(lan.nodeIp);
  const subnet = node === null ? null : subnetOf(node, lan.prefix);
  if (node === null || subnet === null) return "outside-lan";
  if (start < subnet.first || stop > subnet.last) return "outside-lan";
  if (start <= subnet.first || stop >= subnet.last) return "network-or-broadcast";
  if (start <= node && node <= stop) return "contains-node";
  if (lan.gateway !== "") {
    const gw = parseIpv4(lan.gateway);
    if (gw !== null && start <= gw && gw <= stop) return "contains-gateway";
  }
  if (overlapsReserved(start, stop, reservedCidrs)) return "overlaps-reserved";
  return "valid";
}

/** The reserved blocks a LoadBalancer range must stay out of, for a given cluster. */
export function reservedCidrsFor(clusterName: string): readonly string[] {
  const net = deriveClusterNetwork(clusterName);
  if (!net.ok) return [CLUSTER_SEGMENT_CIDR];
  return [net.value.podCidr, net.value.serviceCidr, CLUSTER_SEGMENT_CIDR];
}

/**
 * A range to OFFER, never to apply unasked: `.240`-`.250` of the /24 the node is
 * in. null when the LAN is too small to carry it or the window would not
 * validate - in which case the operator types a range, and nothing is guessed.
 */
export function proposeLbPool(
  lan: LanFacts,
  reservedCidrs: readonly string[],
): { readonly start: string; readonly stop: string } | null {
  const node = parseIpv4(lan.nodeIp);
  if (node === null || lan.prefix > 24) return null;
  const base = node - (node % 256);
  const start = formatIpv4(base + PROPOSED_POOL_FIRST_HOST);
  const stop = formatIpv4(base + PROPOSED_POOL_LAST_HOST);
  return validateLbPool(start, stop, lan, reservedCidrs) === "valid" ? { start, stop } : null;
}

export interface Collision {
  readonly host: string;
  readonly against: "pod" | "service" | "segment";
  readonly cidr: string;
}

/**
 * Which of the host's own networks overlap the cluster's pod CIDR, service CIDR
 * or inter-node segment? Empty means none. Reports the FACT; what to do about it
 * is the installer's refusal text, not this function's.
 */
export function hostNetworkCollisions(hostCidrs: readonly string[], clusterName: string): readonly Collision[] {
  const net = deriveClusterNetwork(clusterName);
  const targets: Array<[Collision["against"], string]> = [["segment", CLUSTER_SEGMENT_CIDR]];
  if (net.ok) {
    targets.unshift(["service", net.value.serviceCidr]);
    targets.unshift(["pod", net.value.podCidr]);
  }
  const out: Collision[] = [];
  for (const host of hostCidrs) {
    for (const [against, cidr] of targets) {
      if (cidrsOverlap(host, cidr)) out.push({ host, against, cidr });
    }
  }
  return out;
}

export interface LbPoolSpec {
  readonly kind: "auto" | "range";
  readonly start?: string;
  readonly stop?: string;
}

export type LbPoolPlan =
  | { readonly ok: true; readonly value: LbPoolSpec | null }
  | { readonly ok: false; readonly error: string };

/** Addresses no LAN hands to a LoadBalancer Service. Flash-time check; the LAN is not known yet. */
function unusableAddress(ip: number): string | null {
  const first = Math.floor(ip / 16777216);
  if (first === 0 || first === 127) return "0.0.0.0/8 and 127.0.0.0/8 are not LAN addresses";
  if (first >= 224) return "multicast and reserved space is not a LAN address";
  if (first === 169 && Math.floor(ip / 65536) % 256 === 254) return "169.254.0.0/16 is link-local";
  return null;
}

/**
 * Parse an optional `--lb-pool` value: `auto`, or `<start>-<stop>`. What the LAN
 * can actually carry is checked by the installer against the interface it measures;
 * what is refused HERE is everything that is wrong on every LAN.
 */
export function planLbPool(raw: string | undefined): LbPoolPlan {
  if (raw === undefined) return { ok: true, value: null };
  if (raw === LB_POOL_AUTO) return { ok: true, value: { kind: "auto" } };
  const m = /^([0-9.]+)-([0-9.]+)$/.exec(raw);
  if (m === null) {
    return {
      ok: false,
      error: `--lb-pool ${JSON.stringify(raw)} is neither "auto" nor <first-ip>-<last-ip> (e.g. 192.168.1.240-192.168.1.250)`,
    };
  }
  const startRaw = m[1] ?? "";
  const stopRaw = m[2] ?? "";
  const start = parseIpv4(startRaw);
  const stop = parseIpv4(stopRaw);
  if (start === null) return { ok: false, error: `--lb-pool first address ${JSON.stringify(startRaw)} is not a dotted-quad IPv4 address` };
  if (stop === null) return { ok: false, error: `--lb-pool last address ${JSON.stringify(stopRaw)} is not a dotted-quad IPv4 address` };
  if (start > stop) return { ok: false, error: `--lb-pool ${raw} runs backwards (first address is above the last)` };
  if (stop - start + 1 > LB_POOL_MAX_ADDRESSES) {
    return { ok: false, error: `--lb-pool ${raw} spans ${stop - start + 1} addresses; the limit is ${LB_POOL_MAX_ADDRESSES}` };
  }
  for (const [label, ip] of [["first", start], ["last", stop]] as const) {
    const why = unusableAddress(ip);
    if (why !== null) return { ok: false, error: `--lb-pool ${label} address ${formatIpv4(ip)}: ${why}` };
  }
  if (overlapsReserved(start, stop, [CLUSTER_SEGMENT_CIDR])) {
    return { ok: false, error: `--lb-pool ${raw} overlaps the inter-node cluster segment ${CLUSTER_SEGMENT_CIDR}` };
  }
  return { ok: true, value: { kind: "range", start: formatIpv4(start), stop: formatIpv4(stop) } };
}

/** The line appended to the ESP `/zeta-firstboot.conf`. The validators admit nothing needing escape. */
export function renderLbPoolConfLine(spec: LbPoolSpec): string {
  const value = spec.kind === "auto" ? LB_POOL_AUTO : `${spec.start ?? ""}-${spec.stop ?? ""}`;
  return `${LB_POOL_ENV}='${value}'\n`;
}
