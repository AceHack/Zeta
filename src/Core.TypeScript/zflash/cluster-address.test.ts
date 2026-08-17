/**
 * Tests for cluster-address.ts — the `joining-node-address-assignment` half of
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5.
 *
 * Every test here runs with no network, no QEMU and no filesystem, because the
 * whole point of deriving addressing as a pure function is that the value which
 * decides whether two machines can see each other is checkable before either
 * machine exists.
 */

import { describe, expect, test } from "bun:test";
import {
  CLUSTER_SEGMENT_CIDR_SUFFIX,
  CLUSTER_SEGMENT_NETWORK_PREFIX,
  CONTROL_PLANE_HOST_INDEX,
  CONTROL_PLANE_STABLE_NAME,
  FIRST_JOINER_HOST_INDEX,
  K3S_API_PORT,
  LAST_HOST_INDEX,
  clusterHostsEntries,
  clusterJoinServerUrl,
  clusterSegmentAddress,
  resolveClusterSegmentAssignment,
  validateHostIndex,
  validateSegmentMac,
  type ClusterSegmentAssignment,
} from "./cluster-address";
import { validateJoinServerUrl } from "./firstboot-role";

/** The MACs `test-harness/multi-vm.ts` pins on the QEMU command line. */
const EXISTING_NODE_MAC = "52:54:00:7a:f1:01";
const JOINING_NODE_MAC = "52:54:00:7a:f1:02";

function assignedOrThrow(
  result: ReturnType<typeof resolveClusterSegmentAssignment>,
): ClusterSegmentAssignment {
  if (!result.ok) {
    throw new Error(`expected an assignment, got refusal: ${result.error}`);
  }
  return result.value;
}

describe("clusterSegmentAddress", () => {
  test("composes the /24 host address", () => {
    expect(clusterSegmentAddress(1)).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.1`);
    expect(clusterSegmentAddress(254)).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.254`);
  });

  test("the segment does not collide with anything else on the node", () => {
    // Each of these is a real network the guest carries at the same time; an
    // overlap would make the kernel route cluster traffic somewhere else.
    // 10.0.2.0/24 is QEMU SLIRP NAT (net0), 10.42/10.43 are k3s' pod and
    // service CIDRs.
    for (const conflicting of ["10.0.2", "10.42.0", "10.43.0"]) {
      expect(CLUSTER_SEGMENT_NETWORK_PREFIX).not.toBe(conflicting);
    }
    expect(CLUSTER_SEGMENT_NETWORK_PREFIX.startsWith("10.")).toBe(true);
  });
});

describe("validateSegmentMac", () => {
  test("accepts the MACs the harness actually pins", () => {
    expect(validateSegmentMac(EXISTING_NODE_MAC)).toBeNull();
    expect(validateSegmentMac(JOINING_NODE_MAC)).toBeNull();
  });

  test("refuses an empty or malformed MAC", () => {
    expect(validateSegmentMac("")).toContain("required");
    expect(validateSegmentMac("52:54:00:7a:f1")).toContain("six lowercase hex octets");
    expect(validateSegmentMac("52-54-00-7a-f1-01")).toContain("six lowercase hex octets");
    expect(validateSegmentMac("52:54:00:7a:f1:0g")).toContain("six lowercase hex octets");
  });

  test("refuses an uppercase MAC rather than silently case-folding it", () => {
    // NetworkManager keyfile matching and QEMU both emit lowercase; accepting
    // uppercase here would produce a config that matches no NIC.
    expect(validateSegmentMac("52:54:00:7A:F1:01")).toContain("six lowercase hex octets");
  });

  test("refuses a MULTICAST MAC — a NIC's own address must be unicast", () => {
    // 0x01 has the low bit of the first octet set. Shape-only validation
    // accepts this; a switch drops frames sourced from it, so the node comes
    // up looking configured and is invisible on the segment.
    const error = validateSegmentMac("01:00:5e:00:00:01");
    expect(error).not.toBeNull();
    expect(error).toContain("MULTICAST");
  });

  test("accepts a unicast MAC whose first octet is odd-looking but even-valued", () => {
    // 0x02 = locally administered, unicast. Must pass; a naive "first octet
    // must be 0x52" check would reject every real locally-administered MAC.
    expect(validateSegmentMac("02:00:00:00:00:01")).toBeNull();
  });
});

describe("validateHostIndex", () => {
  test("accepts the usable range and refuses the boundaries", () => {
    expect(validateHostIndex(CONTROL_PLANE_HOST_INDEX)).toBeNull();
    expect(validateHostIndex(LAST_HOST_INDEX)).toBeNull();
    expect(validateHostIndex(0)).toContain("host index must be");
    expect(validateHostIndex(255)).toContain("host index must be");
    expect(validateHostIndex(-1)).toContain("host index must be");
  });

  test("refuses a non-integer rather than truncating it into an address", () => {
    expect(validateHostIndex(2.5)).toContain("integer");
    expect(validateHostIndex(Number.NaN)).toContain("integer");
  });
});

describe("resolveClusterSegmentAssignment", () => {
  test("the founder takes .1 and names itself as the control plane", () => {
    const assignment = assignedOrThrow(
      resolveClusterSegmentAssignment({
        role: "first-control-plane",
        segmentNic: { mac: EXISTING_NODE_MAC },
      }),
    );
    expect(assignment.nodeAddress).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.1`);
    expect(assignment.nodeAddressCidr).toBe(
      `${CLUSTER_SEGMENT_NETWORK_PREFIX}.1/${String(CLUSTER_SEGMENT_CIDR_SUFFIX)}`,
    );
    expect(assignment.controlPlaneAddress).toBe(assignment.nodeAddress);
    expect(assignment.segmentMac).toBe(EXISTING_NODE_MAC);
  });

  test("a joiner takes .2 and derives the founder's address WITHOUT asking", () => {
    // This is the whole blocker in one assertion: the joiner obtains the
    // founder's address from a constant, because the segment provides nothing
    // to ask.
    const assignment = assignedOrThrow(
      resolveClusterSegmentAssignment({
        role: "joiner",
        segmentNic: { mac: JOINING_NODE_MAC },
      }),
    );
    expect(assignment.nodeAddress).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.2`);
    expect(assignment.controlPlaneAddress).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.1`);
    expect(assignment.controlPlaneName).toBe(CONTROL_PLANE_STABLE_NAME);
  });

  test("the founder's address is the same value both roles compute", () => {
    const founder = assignedOrThrow(
      resolveClusterSegmentAssignment({ role: "first-control-plane", segmentNic: { mac: EXISTING_NODE_MAC } }),
    );
    const joiner = assignedOrThrow(
      resolveClusterSegmentAssignment({ role: "joiner", segmentNic: { mac: JOINING_NODE_MAC } }),
    );
    expect(joiner.controlPlaneAddress).toBe(founder.nodeAddress);
  });

  test("REFUSES a joiner asking for the control plane's index", () => {
    // Two nodes on one L2 segment answering one ARP query resolves to
    // whichever reply arrived last — an outage AND a DST violation.
    const result = resolveClusterSegmentAssignment({
      role: "joiner",
      hostIndex: CONTROL_PLANE_HOST_INDEX,
      segmentNic: { mac: JOINING_NODE_MAC },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("reserved for the control plane");
    }
  });

  test("REFUSES a control plane that is not at the derived index", () => {
    // Every joiner computes .1 from a constant. A founder that took .7 would
    // be unreachable by every joiner, with nothing reporting an error.
    const result = resolveClusterSegmentAssignment({
      role: "first-control-plane",
      hostIndex: 7,
      segmentNic: { mac: EXISTING_NODE_MAC },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("must take host index 1");
    }
  });

  test("accepts an explicitly allocated index for a second joiner", () => {
    const assignment = assignedOrThrow(
      resolveClusterSegmentAssignment({
        role: "joiner",
        hostIndex: 3,
        segmentNic: { mac: "52:54:00:7a:f1:03" },
      }),
    );
    expect(assignment.nodeAddress).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.3`);
    expect(assignment.controlPlaneAddress).toBe(`${CLUSTER_SEGMENT_NETWORK_PREFIX}.1`);
  });

  test("refuses a bad MAC before it refuses anything else", () => {
    const result = resolveClusterSegmentAssignment({
      role: "joiner",
      segmentNic: { mac: "not-a-mac" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("six lowercase hex octets");
    }
  });

  test("refuses an out-of-range index", () => {
    for (const hostIndex of [0, 255, 1000]) {
      const result = resolveClusterSegmentAssignment({
        role: "joiner",
        hostIndex,
        segmentNic: { mac: JOINING_NODE_MAC },
      });
      expect(result.ok).toBe(false);
    }
  });

  test("is deterministic — equal requests produce byte-identical assignments (§7 DST)", () => {
    const once = resolveClusterSegmentAssignment({ role: "joiner", segmentNic: { mac: JOINING_NODE_MAC } });
    const twice = resolveClusterSegmentAssignment({ role: "joiner", segmentNic: { mac: JOINING_NODE_MAC } });
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});

describe("clusterJoinServerUrl", () => {
  test("dials the NAME the API certificate covers, not a .local variant", () => {
    // `k3s-server.nix` ships exactly one name SAN: --tls-san=control-plane.
    // `nixos/tests/k3s-agent-join.nix` records that removing it makes the join
    // fail on certificate verification, so the name dialled and the name in
    // the certificate must be the same string.
    expect(clusterJoinServerUrl()).toBe(`https://${CONTROL_PLANE_STABLE_NAME}:${String(K3S_API_PORT)}`);
    expect(clusterJoinServerUrl()).not.toContain(".local");
  });

  test("is accepted by the firstboot config's own URL validator", () => {
    // The URL crosses into a bash-sourced file on a node about to partition a
    // disk. If these two ever disagree, a joiner is provisioned with a URL
    // the medium refuses to carry.
    expect(validateJoinServerUrl(clusterJoinServerUrl())).toBeNull();
  });
});

describe("clusterHostsEntries", () => {
  test("a joiner gets the founder's name mapped to the founder's address", () => {
    const assignment = assignedOrThrow(
      resolveClusterSegmentAssignment({ role: "joiner", segmentNic: { mac: JOINING_NODE_MAC } }),
    );
    expect(clusterHostsEntries(assignment)).toEqual([
      { address: `${CLUSTER_SEGMENT_NETWORK_PREFIX}.1`, names: [CONTROL_PLANE_STABLE_NAME] },
    ]);
  });

  test("the founder gets NO entry — k3s-server.nix already maps it to 127.0.0.1", () => {
    // /etc/hosts resolution takes the FIRST match, so a second line for the
    // same name would not override; it would make the result depend on file
    // ordering. Emitting nothing is the honest answer.
    const assignment = assignedOrThrow(
      resolveClusterSegmentAssignment({ role: "first-control-plane", segmentNic: { mac: EXISTING_NODE_MAC } }),
    );
    expect(clusterHostsEntries(assignment)).toEqual([]);
  });
});

describe("constants the rest of the chain depends on", () => {
  test("the joiner index range starts above the control plane's", () => {
    expect(FIRST_JOINER_HOST_INDEX).toBeGreaterThan(CONTROL_PLANE_HOST_INDEX);
    expect(LAST_HOST_INDEX).toBeGreaterThan(FIRST_JOINER_HOST_INDEX);
  });
});
