// full-ai-cluster/tools/cluster-bringup/probe.test.ts
//
// Run: bun test full-ai-cluster/tools/cluster-bringup/probe.test.ts
//
// The parsers only. The doors (ICMP, TCP, TLS, arp, kubectl) are deliberately untested
// here — they are thin wrappers over external programs, and a test that mocked them would
// pin the mock rather than the behaviour. That limit is stated, not hidden.
//
// Every fixture below is REAL output captured on 2026-08-26 from the live estate.

import { describe, expect, test } from "bun:test";
import { addressesToProbe, nodeNameFromSan, parseArpTable, parseKubeContexts } from "./probe.ts";
import type { NodeRecord } from "./estate.ts";

// Captured verbatim from `openssl x509 -noout -ext subjectAltName` against 192.168.4.152.
const SAN_152 =
  "X509v3 Subject Alternative Name: \n" +
  "    DNS:control-plane, DNS:kubernetes, DNS:kubernetes.default, DNS:kubernetes.default.svc, " +
  "DNS:kubernetes.default.svc.cluster.local, DNS:localhost, DNS:node-ad1efd, " +
  "IP Address:10.43.0.1, IP Address:127.0.0.1, IP Address:192.168.4.152";

// Captured verbatim from 192.168.4.153.
const SAN_153 =
  "X509v3 Subject Alternative Name: \n" +
  "    DNS:control-plane, DNS:kubernetes, DNS:kubernetes.default, DNS:kubernetes.default.svc, " +
  "DNS:kubernetes.default.svc.cluster.local, DNS:localhost, DNS:node-542b91, " +
  "IP Address:10.43.0.1, IP Address:127.0.0.1, IP Address:192.168.4.153";

describe("nodeNameFromSan", () => {
  test("picks the node's own name out of the generic k3s names", () => {
    expect(nodeNameFromSan(SAN_152)).toBe("node-ad1efd");
    expect(nodeNameFromSan(SAN_153)).toBe("node-542b91");
  });

  test("does NOT return `control-plane` — it is on both machines, so it identifies neither", () => {
    // This is the whole point of the generic list. `control-plane` is the flake host name,
    // added by --tls-san to every machine built from that config. Treating it as identity
    // would make two different machines look like one node.
    expect(nodeNameFromSan(SAN_152)).not.toBe("control-plane");
    expect(nodeNameFromSan(SAN_152)).not.toBe(nodeNameFromSan(SAN_153));
  });

  test("returns undefined when the certificate carries only generic names", () => {
    const generic = "X509v3 Subject Alternative Name: \n    DNS:kubernetes, DNS:localhost";
    expect(nodeNameFromSan(generic)).toBeUndefined();
  });

  test("returns undefined on empty input rather than throwing", () => {
    expect(nodeNameFromSan("")).toBeUndefined();
  });
});

describe("parseArpTable", () => {
  // Captured verbatim from `arp -a -n`, including the short-octet spelling.
  const ARP = [
    "? (192.168.4.152) at 90:10:57:6e:7e:72 on en0 ifscope [ethernet]",
    "? (192.168.4.153) at 80:84:89:1:c5:16 on en0 ifscope [ethernet]",
    "? (192.168.4.1) at (incomplete) on en0 ifscope [ethernet]",
  ].join("\n");

  test("reads addresses and NORMALISES the short octets", () => {
    const t = parseArpTable(ARP);
    expect(t.get("192.168.4.152")).toBe("90:10:57:6e:7e:72");
    // 1 -> 01: without this the node is invisible to a recorded-MAC lookup.
    expect(t.get("192.168.4.153")).toBe("80:84:89:01:c5:16");
  });

  test("skips incomplete entries rather than inventing a MAC", () => {
    expect(parseArpTable(ARP).has("192.168.4.1")).toBe(false);
  });
});

describe("parseKubeContexts", () => {
  const RAW = ["kind-zeta-ci-podman\thttps://127.0.0.1:55840", "kind-zeta-local-included\thttps://127.0.0.1:53433"].join(
    "\n",
  );

  test("reads name and server", () => {
    const c = parseKubeContexts(RAW);
    expect(c).toHaveLength(2);
    expect(c[0]?.name).toBe("kind-zeta-ci-podman");
    expect(c[0]?.server).toBe("https://127.0.0.1:55840");
  });

  test("drops lines that carry no server URL", () => {
    expect(parseKubeContexts("broken-context\n\n  \n")).toHaveLength(0);
  });
});

describe("addressesToProbe", () => {
  const records: readonly NodeRecord[] = [
    {
      name: "node-ad1efd",
      hostname: "node-ad1efd",
      mac: "90:10:57:6e:7e:72",
      maintainer: "Addisons820",
      flakeHost: "control-plane",
      sourcePath: "p",
    },
  ];
  const arp = new Map([
    ["192.168.4.152", "90:10:57:6e:7e:72"],
    ["192.168.4.99", "aa:bb:cc:dd:ee:ff"],
  ]);

  test("finds a recorded node by MAC and ignores unrelated neighbours", () => {
    expect(addressesToProbe(records, arp, [])).toEqual(["192.168.4.152"]);
  });

  test("an explicitly supplied address is probed even when it is not in ARP", () => {
    // This is the escape for the stated limit: a powered-on node that has not talked to
    // this workstation is not in ARP, and must be nameable by hand.
    expect(addressesToProbe(records, arp, ["10.0.0.5"])).toEqual(["10.0.0.5", "192.168.4.152"]);
  });

  test("does not duplicate an address that is both explicit and discovered", () => {
    expect(addressesToProbe(records, arp, ["192.168.4.152"])).toEqual(["192.168.4.152"]);
  });
});
