/**
 * lan-config.test.ts - the pure half of docs/ops/INSTALL-TIME-CONFIG.md rows 3 and 4.
 *
 * Each describe block names the real-world failure it pins and would go red against
 * the behaviour this replaces (a hardcoded 192.168.1.240-250 pool; no check that the
 * cluster's pod/service CIDR collides with the LAN).
 */

import { describe, expect, test } from "bun:test";
import {
  CLUSTER_SEGMENT_CIDR,
  hostNetworkCollisions,
  parseIpv4,
  planLbPool,
  proposeLbPool,
  renderLbPoolConfLine,
  reservedCidrsFor,
  validateLbPool,
  type LanFacts,
  type LbPoolVerdict,
} from "./lan-config.ts";
import { deriveClusterNetwork } from "../cluster/cluster-cidr.ts";

const HOME: LanFacts = { nodeIp: "192.168.1.74", prefix: 24, gateway: "192.168.1.254" };
const RESERVED = reservedCidrsFor("zeta");

describe("parseIpv4 is strict", () => {
  test.each([
    ["192.168.1.1", true],
    ["0.0.0.0", true],
    ["255.255.255.255", true],
    ["256.1.1.1", false],
    ["1.2.3", false],
    ["1.2.3.4.5", false],
    ["010.1.1.1", false], // octal in some parsers: refused, never reinterpreted
    ["1.2.3.04", false],
    ["a.b.c.d", false],
    ["", false],
    [" 1.2.3.4", false],
  ])("%s -> %s", (s, ok) => {
    expect(parseIpv4(s) !== null).toBe(ok);
  });
});

describe("validateLbPool: the old hardcoded range is only right on one subnet", () => {
  test("192.168.1.240-250 is valid on the subnet it was written for", () => {
    expect(validateLbPool("192.168.1.240", "192.168.1.250", HOME, RESERVED)).toBe("valid");
  });

  test("THE DEFECT: the same range on any other LAN is refused, not applied", () => {
    for (const lan of [
      { nodeIp: "192.168.0.10", prefix: 24, gateway: "192.168.0.1" },
      { nodeIp: "10.0.0.5", prefix: 24, gateway: "10.0.0.1" },
      { nodeIp: "172.20.4.9", prefix: 16, gateway: "172.20.0.1" },
    ] satisfies LanFacts[]) {
      expect(validateLbPool("192.168.1.240", "192.168.1.250", lan, RESERVED)).toBe("outside-lan");
    }
  });

  const CASES: ReadonlyArray<readonly [string, string, string, LanFacts, LbPoolVerdict]> = [
    ["bad first", "192.168.1.999", "192.168.1.250", HOME, "bad-start"],
    ["bad last", "192.168.1.240", "nope", HOME, "bad-stop"],
    ["backwards", "192.168.1.250", "192.168.1.240", HOME, "reversed"],
    ["a /16 pasted as a range", "10.0.0.0", "10.0.255.255", { nodeIp: "10.0.0.5", prefix: 16, gateway: "" }, "too-large"],
    ["includes the network address", "192.168.1.0", "192.168.1.10", HOME, "network-or-broadcast"],
    ["includes the broadcast address", "192.168.1.250", "192.168.1.255", HOME, "network-or-broadcast"],
    ["includes this node", "192.168.1.70", "192.168.1.80", HOME, "contains-node"],
    ["includes the gateway", "192.168.1.250", "192.168.1.254", HOME, "contains-gateway"],
    ["straddles the subnet edge", "192.168.1.250", "192.168.2.5", HOME, "outside-lan"],
    ["unusable LAN prefix (/31)", "192.168.1.240", "192.168.1.250", { nodeIp: "192.168.1.74", prefix: 31, gateway: "" }, "outside-lan"],
  ];
  for (const [name, a, b, lan, want] of CASES) {
    test(`${name} -> ${want}`, () => {
      expect(validateLbPool(a, b, lan, RESERVED)).toBe(want);
    });
  }

  test("a range inside the cluster's own pod CIDR is refused (10.x LAN)", () => {
    const net = deriveClusterNetwork("zeta");
    if (!net.ok) throw new Error("zeta must derive");
    // zeta's pod CIDR is 10.143.0.0/17. A LAN that lives inside it:
    const lan: LanFacts = { nodeIp: "10.143.5.10", prefix: 24, gateway: "10.143.5.1" };
    expect(validateLbPool("10.143.5.240", "10.143.5.250", lan, [net.value.podCidr])).toBe("overlaps-reserved");
  });

  test("a range inside the inter-node segment is refused", () => {
    const lan: LanFacts = { nodeIp: "10.88.0.7", prefix: 24, gateway: "" };
    expect(validateLbPool("10.88.0.100", "10.88.0.110", lan, [CLUSTER_SEGMENT_CIDR])).toBe("overlaps-reserved");
  });
});

describe("proposeLbPool offers, never applies", () => {
  test(".240-.250 of the node's /24", () => {
    expect(proposeLbPool(HOME, RESERVED)).toEqual({ start: "192.168.1.240", stop: "192.168.1.250" });
    expect(proposeLbPool({ nodeIp: "10.7.3.20", prefix: 24, gateway: "10.7.3.1" }, RESERVED)).toEqual({
      start: "10.7.3.240",
      stop: "10.7.3.250",
    });
  });
  test("follows the node when the LAN is wider than a /24", () => {
    expect(proposeLbPool({ nodeIp: "172.16.9.20", prefix: 16, gateway: "172.16.0.1" }, RESERVED)).toEqual({
      start: "172.16.9.240",
      stop: "172.16.9.250",
    });
  });
  test("no proposal for a LAN too small to carry it (/25) - the operator types one", () => {
    expect(proposeLbPool({ nodeIp: "192.168.1.74", prefix: 25, gateway: "" }, RESERVED)).toBeNull();
  });
  test("no proposal when the window would contain the node itself", () => {
    expect(proposeLbPool({ nodeIp: "192.168.1.245", prefix: 24, gateway: "192.168.1.1" }, RESERVED)).toBeNull();
  });
  test("no proposal when the window falls in the cluster's own address space", () => {
    expect(proposeLbPool({ nodeIp: "10.143.5.10", prefix: 24, gateway: "" }, RESERVED)).toBeNull();
  });
});

describe("hostNetworkCollisions: the cluster's pod/service CIDR vs the LAN", () => {
  const zeta = deriveClusterNetwork("zeta");
  if (!zeta.ok) throw new Error("zeta must derive");

  test("a home 192.168 network collides with nothing (the derivation avoids it by construction)", () => {
    expect(hostNetworkCollisions(["192.168.1.0/24", "192.168.0.0/16"], "zeta")).toEqual([]);
  });

  test("a 10.x site network INSIDE the pod space is reported against the pod CIDR", () => {
    const c = hostNetworkCollisions(["10.143.100.0/24"], "zeta");
    expect(c).toEqual([{ host: "10.143.100.0/24", against: "pod", cidr: zeta.value.podCidr }]);
  });

  test("a wider network that merely CONTAINS the pod CIDR is also a collision", () => {
    expect(hostNetworkCollisions(["10.128.0.0/9"], "zeta").map((x) => x.against)).toEqual(["pod"]);
    expect(hostNetworkCollisions(["10.0.0.0/8"], "zeta").map((x) => x.against)).toEqual(["pod", "service", "segment"]);
  });

  test("the service CIDR and the inter-node segment are checked too", () => {
    expect(hostNetworkCollisions(["10.99.200.0/24"], "zeta").map((x) => x.against)).toEqual(["service"]);
    expect(hostNetworkCollisions(["10.88.0.0/24"], "zeta")).toEqual([
      { host: "10.88.0.0/24", against: "segment", cidr: CLUSTER_SEGMENT_CIDR },
    ]);
  });

  test("the same LAN is NOT a collision for a differently-named cluster: the answer depends on the name", () => {
    const other = deriveClusterNetwork("zeta-home");
    if (!other.ok) throw new Error("zeta-home must derive");
    expect(hostNetworkCollisions(["10.143.100.0/24"], "zeta-home")).toEqual([]);
    expect(hostNetworkCollisions(["10.228.130.0/24"], "zeta-home").map((x) => x.against)).toEqual(["pod"]);
  });

  test("a name Cilium would refuse checks the inter-node segment only (never throws)", () => {
    expect(hostNetworkCollisions(["10.143.100.0/24"], "Not A Valid Name")).toEqual([]);
    expect(hostNetworkCollisions(["10.88.0.0/24"], "Not A Valid Name").map((x) => x.against)).toEqual(["segment"]);
  });
});

describe("planLbPool: refused at FLASH time for everything wrong on every LAN", () => {
  test("omitted -> unset (a valid state, not a default)", () => {
    expect(planLbPool(undefined)).toEqual({ ok: true, value: null });
  });
  test("auto", () => {
    expect(planLbPool("auto")).toEqual({ ok: true, value: { kind: "auto" } });
  });
  test("a range", () => {
    expect(planLbPool("192.168.50.200-192.168.50.210")).toEqual({
      ok: true,
      value: { kind: "range", start: "192.168.50.200", stop: "192.168.50.210" },
    });
  });
  const REFUSED: ReadonlyArray<readonly [string, RegExp]> = [
    ["", /neither "auto"/],
    ["192.168.1.240", /neither "auto"/],
    ["192.168.1.250-192.168.1.240", /backwards/],
    ["192.168.1.1-192.168.9.1", /limit is 256/],
    ["0.0.0.0-0.0.0.10", /not LAN addresses/],
    ["127.0.0.1-127.0.0.9", /not LAN addresses/],
    ["169.254.1.1-169.254.1.9", /link-local/],
    ["224.0.0.1-224.0.0.9", /multicast/],
    ["10.88.0.10-10.88.0.20", /inter-node cluster segment/],
    ["999.1.1.1-999.1.1.9", /not a dotted-quad/],
    ["$(id)-1.1.1.1", /neither "auto"/],
  ];
  for (const [raw, why] of REFUSED) {
    test(`refused: ${JSON.stringify(raw)}`, () => {
      const p = planLbPool(raw);
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.error).toMatch(why);
    });
  }
  test("the conf line is single-quoted and bash-sourceable", () => {
    expect(renderLbPoolConfLine({ kind: "auto" })).toBe("ZETA_LB_POOL='auto'\n");
    expect(renderLbPoolConfLine({ kind: "range", start: "192.168.50.200", stop: "192.168.50.210" })).toBe(
      "ZETA_LB_POOL='192.168.50.200-192.168.50.210'\n",
    );
  });
});
