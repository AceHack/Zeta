/**
 * src/Core.TypeScript/zflash/cluster-address.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — ADDRESS ASSIGNMENT on the shared
 * cluster segment. The `joining-node-address-assignment` blocker, named in
 * `JoinBlocker` (test-harness/scenarios.ts) while PR #11477 wired the ROLE.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * Role provisioning made a joiner know it is a joiner and gave it a `--server`
 * URL. It did not give either node an ADDRESS, and it did not give the joiner
 * any way to turn that URL's host into one. Verified on `main` rather than
 * assumed:
 *
 *   - `test-harness/multi-vm.ts` puts the two VMs on a bare QEMU socket segment
 *     (`l2-socket-listen` / `l2-socket-connect`). A QEMU socket netdev is a
 *     wire, not a network: no DHCP server, no DNS, no router.
 *   - The only DHCP in the tree is CLIENT-side (`networking.useDHCP`,
 *     NetworkManager in `nixos/modules/common.nix`). `rg dnsmasq` over
 *     `full-ai-cluster/` returns nothing. Nothing serves a lease.
 *   - The only name service on a guest is Avahi/nss-mdns, which answers for
 *     `.local` names ONLY — so `k3s-agent.nix`'s `https://control-plane:6443`
 *     default cannot resolve there.
 *
 * WHY STATIC, AND NOT DHCP OR mDNS
 * --------------------------------
 * Three options were weighed. The repo had already reached this answer and
 * recorded it, which is why it wins rather than merely being first:
 *
 *   `nixos/modules/k3s-server.nix`: *"The robust path is to inject a
 *   `control-plane <cp-ip>` /etc/hosts entry on each worker at install time
 *   (zeta-install.sh) once worker provisioning lands. Tracked separately."*
 *   The same comment records that mDNS was already TRIED and rejected —
 *   `control-plane.zeta.local` "never resolved", and NetBIOS/nss-wins
 *   "did not work in testing".
 *
 *   - **mDNS** is the option that is already on the table and already failing.
 *     It also does not typecheck against the certificate: `k3s-server.nix`
 *     ships exactly one name SAN, `--tls-san=control-plane`. A joiner dialling
 *     `https://control-plane.local:6443` — which is what `multi-vm.ts` had —
 *     presents a name the API server's certificate does not cover. See
 *     {@link CONTROL_PLANE_STABLE_NAME}.
 *   - **DHCP on the control plane** makes the founder an APPOINTED address
 *     authority for the segment (manifesto §1: the defect is appointment), adds
 *     a service and a lease-timing race, and is not testable without booting
 *     something. Lease acquisition is wall-clock-dependent, so it cannot replay
 *     (§7 DST).
 *   - **Static, derived from the role already on the ESP** rides the carrier
 *     that PR #11477 just built, adds no service, and is a total function from
 *     a role to an address — so the whole assignment is a golden vector a unit
 *     test can pin with nothing booted.
 *
 * PURE CORE. No I/O, no network, no QEMU. Same discipline as
 * `firstboot-role.ts`, and for the same reason: the value that decides whether
 * two machines can see each other should be checkable before either exists.
 *
 * Anchors (Beacon): RFC 1918 (Rekhter et al., 1996) private address space;
 * RFC 3927 (Cheshire, Aboba & Guttman, 2005) IPv4 link-local — the fallback
 * this module exists to avoid depending on, because RFC 3927 addresses are
 * chosen pseudo-randomly by each host and are therefore exactly the
 * nondeterminism DST forbids. `/etc/hosts` as the first, protocol-free name
 * source predates DNS itself (RFC 952 HOSTS.TXT, Harrenstien et al., 1985) and
 * is still consulted first via nsswitch — which is why it beats mDNS on both
 * determinism and latency.
 */

/**
 * The cluster segment's IPv4 network, as a /24.
 *
 * Chosen to not collide with anything already in the path:
 *   - QEMU SLIRP user-mode NAT (`net0`, still attached) is `10.0.2.0/24`.
 *   - k3s's default cluster CIDR is `10.42.0.0/16` and service CIDR
 *     `10.43.0.0/16`.
 *   - Home LANs are overwhelmingly `192.168.0.0/16`.
 * `10.88.0.0/24` sits outside all four while staying inside RFC 1918.
 */
export const CLUSTER_SEGMENT_NETWORK_PREFIX = "10.88.0";
export const CLUSTER_SEGMENT_CIDR_SUFFIX = 24;

/**
 * The founder always takes `.1`.
 *
 * Not an aesthetic choice: the joiner must be able to compute the founder's
 * address WITHOUT asking anything, because "ask something" is the capability
 * the segment does not have. A constant is the only derivation that works
 * before any packet has been exchanged.
 */
export const CONTROL_PLANE_HOST_INDEX = 1;

/** First index a joiner may take. `.1` is the founder; `.0` is the network. */
export const FIRST_JOINER_HOST_INDEX = 2;

/** Last usable host index in a /24 (`.255` is the broadcast address). */
export const LAST_HOST_INDEX = 254;

/**
 * The name every node uses for the control plane, and the ONLY name the API
 * server's certificate covers.
 *
 * `nixos/modules/k3s-server.nix` ships `--tls-san=control-plane` and nothing
 * else name-shaped. k3s additionally SANs `127.0.0.1` and the node's own IPs,
 * but no variant carrying a suffix. So `control-plane.local` — the name
 * `multi-vm.ts` dialled before this module — is NOT in the certificate, and a
 * TLS client that verifies hostnames rejects it.
 *
 * CORRECTED 2026-08-21 by reading upstream. This used to read "k3s does not set
 * `InsecureSkipVerify` on the agent bootstrap path", which is FALSE:
 * `pkg/clientaccess/token.go` declares an `insecureClient` with
 * `tls.Config{InsecureSkipVerify: true}` and `getCACerts` uses it for the
 * `/cacerts` download. The conclusion survives the correction, but by a
 * different route — `getCACerts` makes three requests, and the THIRD is
 * `GetHTTPClient(cacerts, "", "")`, which populates `RootCAs` and leaves
 * `InsecureSkipVerify` at its zero value. That request is where a name outside
 * the SAN list fails ("CA cert validation failed"). So hostname verification
 * does happen on the bootstrap path; it simply is not the first thing that
 * happens, and the difference matters — see
 * `firstboot-role.ts` `validateJoinTokenMaterial` for what the unverified first
 * request costs when the token carries no CA hash.
 *
 * That makes the mDNS route wrong twice over: it may not resolve, and if it
 * did resolve the handshake would still fail. Using the bare label keeps the
 * dialled name and the certificate's name the same string.
 *
 * That the verification is REAL and not theoretical is already proven in-tree:
 * `nixos/tests/k3s-agent-join.nix` boots a server and an agent, supplies the
 * name→address mapping as `networking.hosts`, and records that removing
 * `--tls-san=control-plane` from `k3s-server.nix` makes the join "fail on
 * certificate verification". That same test's comment names the gap this
 * module closes: *"On hardware the mapping comes from an installer-injected
 * /etc/hosts entry (still open — see the MULTI-NODE note in k3s-server.nix)"*.
 * So this is not a new design — it is the mechanism the existing two-node test
 * already assumes, moved onto the flash medium.
 *
 * STILL UNVERIFIED, narrowed: that a `.local` name specifically is rejected has
 * not been RUN. It follows from the SAN list plus the third request above, and
 * the one thing that could still make it false is dynamic SAN addition — k3s's
 * supervisor uses rancher/dynamiclistener, which can mint certs covering the
 * requested host. Whether that path reaches the port a joiner dials was not
 * settled here, so the claim stays labelled rather than promoted. What IS
 * checked mechanically is the literal fact that `control-plane.local` appears in
 * no `--tls-san` flag anywhere in `full-ai-cluster/`.
 */
export const CONTROL_PLANE_STABLE_NAME = "control-plane";

/** k3s supervisor/API port — `k3s-server.nix` opens 6443 and 9345. */
export const K3S_API_PORT = 6443;

/**
 * Where `zeta-install.sh` stages each value for evaluation-time pickup by
 * `nixos/modules/injected-cluster-address.nix`. One value per file, matching
 * the `/etc/zeta/cluster-node-id` convention `injected-hostname.nix` reads —
 * a Nix `builtins.readFile` of a single scalar needs no parser, and a parser
 * is a place for a FAT-sourced value to become something else.
 */
export const CLUSTER_NODE_ADDRESS_INSTALLED_PATH = "/etc/zeta/cluster-segment-address";
export const CLUSTER_SEGMENT_MAC_INSTALLED_PATH = "/etc/zeta/cluster-segment-mac";
export const CLUSTER_CONTROL_PLANE_ADDRESS_INSTALLED_PATH = "/etc/zeta/cluster-control-plane-address";

/**
 * A MAC address in the lowercase colon-separated form QEMU emits and
 * NetworkManager matches on.
 */
export const MAC_ADDRESS_REGEX = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/;

/**
 * Which NIC the static address belongs to, identified by MAC.
 *
 * Load-bearing, and the reason this is not just an IP: a scenario-5 guest has
 * TWO NICs (`net0` SLIRP NAT for outbound, `net1` the cluster segment). Kernel
 * interface names are assigned by PCI enumeration order and differ between
 * machine types and QEMU versions, so `ens3`/`enp0s4` is not a stable handle.
 * The MAC is pinned by `multi-vm.ts` on the QEMU command line, so it is the one
 * identifier both sides agree on. Configuring the address against the wrong NIC
 * puts the cluster address on the NAT interface, where the peer cannot see it —
 * a failure that looks like a network problem and is a naming problem.
 */
export interface ClusterSegmentNic {
  readonly mac: string;
}

export type ClusterSegmentRole = "first-control-plane" | "joiner";

export interface ClusterSegmentAssignmentRequest {
  readonly role: ClusterSegmentRole;
  /**
   * Host index within the /24. Omitted, a founder takes
   * {@link CONTROL_PLANE_HOST_INDEX} and a joiner takes
   * {@link FIRST_JOINER_HOST_INDEX}. Supplied explicitly when more than one
   * joiner is on the segment — the caller allocates, because this module
   * cannot see the other nodes and inventing an index it cannot check would be
   * the address-collision bug wearing a default's clothes.
   */
  readonly hostIndex?: number;
  /** The segment NIC's MAC, as pinned on the QEMU command line. */
  readonly segmentNic: ClusterSegmentNic;
}

/** Resolved, validated addressing — every default applied, every value checked. */
export interface ClusterSegmentAssignment {
  readonly role: ClusterSegmentRole;
  /** This node's address on the segment, with prefix length, e.g. `10.88.0.2/24`. */
  readonly nodeAddressCidr: string;
  /** This node's bare address, e.g. `10.88.0.2`. */
  readonly nodeAddress: string;
  /** The founder's bare address. Equal to {@link nodeAddress} on the founder. */
  readonly controlPlaneAddress: string;
  /** The name that maps to {@link controlPlaneAddress} in `/etc/hosts`. */
  readonly controlPlaneName: string;
  /** The MAC of the NIC this address belongs to. */
  readonly segmentMac: string;
}

export type ClusterSegmentAssignmentResult =
  | { readonly ok: true; readonly value: ClusterSegmentAssignment }
  | { readonly ok: false; readonly error: string };

function refuse(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

/** `10.88.0.<index>`. Total over the validated index range. */
export function clusterSegmentAddress(hostIndex: number): string {
  return `${CLUSTER_SEGMENT_NETWORK_PREFIX}.${String(hostIndex)}`;
}

/**
 * Validate a segment MAC.
 *
 * Two checks, and the second is the one that matters. Shape alone would accept
 * `01:00:5e:00:00:01`, a MULTICAST address (least-significant bit of the first
 * octet set). A multicast address is never valid as a NIC's own address — a
 * frame sourced from one is dropped by conforming bridges and switches, so the
 * node would come up looking configured and be invisible on the segment.
 */
export function validateSegmentMac(mac: string): string | null {
  const trimmed = mac.trim();
  if (trimmed.length === 0) {
    return "segment MAC is required";
  }
  if (!MAC_ADDRESS_REGEX.test(trimmed)) {
    return (
      `segment MAC must be six lowercase hex octets separated by colons, got ${JSON.stringify(mac)} ` +
      `(e.g. 52:54:00:7a:f1:01)`
    );
  }
  const firstOctet = Number.parseInt(trimmed.slice(0, 2), 16);
  if ((firstOctet & 0x01) !== 0) {
    return (
      `segment MAC ${trimmed} is a MULTICAST address (low bit of the first octet is set); ` +
      `a NIC's own address must be unicast`
    );
  }
  return null;
}

/**
 * Validate a host index within the /24.
 *
 * `.0` is the network address and `.255` the broadcast address; neither is
 * assignable. Non-integers are refused rather than truncated — `10.88.0.2.5`
 * is not an address and rounding one into existence hides the caller's bug.
 */
export function validateHostIndex(hostIndex: number): string | null {
  if (!Number.isInteger(hostIndex)) {
    return `host index must be an integer, got ${String(hostIndex)}`;
  }
  if (hostIndex < CONTROL_PLANE_HOST_INDEX || hostIndex > LAST_HOST_INDEX) {
    return (
      `host index must be ${String(CONTROL_PLANE_HOST_INDEX)}..${String(LAST_HOST_INDEX)} ` +
      `within ${CLUSTER_SEGMENT_NETWORK_PREFIX}.0/${String(CLUSTER_SEGMENT_CIDR_SUFFIX)}, ` +
      `got ${String(hostIndex)}`
    );
  }
  return null;
}

/**
 * Apply defaults and validate. Total: every rejection is a typed refusal.
 *
 * The refusal worth reading is the collision one. A joiner asking for `.1` is
 * asking for the founder's address, and a duplicate IPv4 address on one L2
 * segment is not a degraded network — it is two nodes answering one ARP query,
 * which resolves differently depending on which reply arrived last. That is
 * both a real outage and a DST violation, so it is refused at the only point
 * where it is still cheap: before anything is written to the medium.
 */
export function resolveClusterSegmentAssignment(
  request: ClusterSegmentAssignmentRequest,
): ClusterSegmentAssignmentResult {
  const macError = validateSegmentMac(request.segmentNic.mac);
  if (macError !== null) {
    return refuse(macError);
  }
  const segmentMac = request.segmentNic.mac.trim();

  const hostIndex =
    request.hostIndex ?? (request.role === "first-control-plane" ? CONTROL_PLANE_HOST_INDEX : FIRST_JOINER_HOST_INDEX);

  const indexError = validateHostIndex(hostIndex);
  if (indexError !== null) {
    return refuse(indexError);
  }

  if (request.role === "joiner" && hostIndex === CONTROL_PLANE_HOST_INDEX) {
    return refuse(
      `host index ${String(CONTROL_PLANE_HOST_INDEX)} is reserved for the control plane; ` +
        `a joiner must take ${String(FIRST_JOINER_HOST_INDEX)}..${String(LAST_HOST_INDEX)}`,
    );
  }
  if (request.role === "first-control-plane" && hostIndex !== CONTROL_PLANE_HOST_INDEX) {
    return refuse(
      `the control plane must take host index ${String(CONTROL_PLANE_HOST_INDEX)} ` +
        `(every joiner derives the founder's address from that constant, having no way to ask), ` +
        `got ${String(hostIndex)}`,
    );
  }

  const nodeAddress = clusterSegmentAddress(hostIndex);
  return {
    ok: true,
    value: {
      role: request.role,
      nodeAddress,
      nodeAddressCidr: `${nodeAddress}/${String(CLUSTER_SEGMENT_CIDR_SUFFIX)}`,
      controlPlaneAddress: clusterSegmentAddress(CONTROL_PLANE_HOST_INDEX),
      controlPlaneName: CONTROL_PLANE_STABLE_NAME,
      segmentMac,
    },
  };
}

/**
 * The k3s `--server` URL a joiner on this segment should dial.
 *
 * The NAME, not the address, because the name is what the API server's
 * certificate covers (`--tls-san=control-plane`). The address is what makes
 * the name resolve, and it travels separately as the `/etc/hosts` entry —
 * so resolution and verification are satisfied by two different values that
 * cannot drift apart, both derived here.
 */
export function clusterJoinServerUrl(): string {
  return `https://${CONTROL_PLANE_STABLE_NAME}:${String(K3S_API_PORT)}`;
}

/**
 * The `/etc/hosts` mapping a joiner needs.
 *
 * Returned as a value rather than written, so the mapping a node will get is
 * assertable in a unit test. Empty on the founder: `k3s-server.nix` already
 * maps `control-plane -> 127.0.0.1` there, and a SECOND line for the same name
 * would not override it — `/etc/hosts` resolution takes the first match, so the
 * result would depend on file ordering. Returning nothing is the honest answer;
 * the founder does not need to resolve itself over the wire.
 */
export function clusterHostsEntries(
  assignment: ClusterSegmentAssignment,
): readonly { readonly address: string; readonly names: readonly string[] }[] {
  if (assignment.role === "first-control-plane") {
    return [];
  }
  return [{ address: assignment.controlPlaneAddress, names: [assignment.controlPlaneName] }];
}
