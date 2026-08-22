/**
 * Falsifiers for the avahi-browse parser.
 *
 * The fixtures are the shapes the field produces and a lab does not: the same
 * service resolved on two interfaces, a record on our type with a TXT field
 * that does not validate, an unresolved announce line, and a foreign service
 * type sharing the segment.
 */

import { describe, expect, test } from "bun:test";

import { parseBrowseOutput, parseTxtField, splitAvahiFields } from "./avahi-browse-parse";

const CLUSTER = "a".repeat(64);
const TXT = `"txtvers=1" "cluster=${CLUSTER}" "td=zeta.home" "role=control-plane" "node=node-ad1efd"`;
const RESOLVED = `=;eth0;IPv4;node-ad1efd;_zeta-k3s._tcp;local;node-ad1efd.local;10.88.0.1;6443;${TXT}`;

describe("parseBrowseOutput", () => {
  test("a resolved line on our service type becomes one advertisement", () => {
    const parsed = parseBrowseOutput(RESOLVED);
    expect(parsed.advertisements.length).toBe(1);
    expect(parsed.malformed.length).toBe(0);
    expect(parsed.advertisements[0]?.clusterId).toBe(CLUSTER);
    expect(parsed.advertisements[0]?.hostname).toBe("node-ad1efd.local");
    expect(parsed.advertisements[0]?.port).toBe(6443);
  });

  test("the same service resolved on two interfaces is ONE advertisement", () => {
    const second = RESOLVED.replace(";eth0;IPv4;", ";eth1;IPv4;");
    const parsed = parseBrowseOutput(`${RESOLVED}\n${second}`);
    expect(parsed.advertisements.length).toBe(1);
    expect(parsed.resolvedLines).toBe(2);
  });

  test("an announce line with no resolution contributes nothing", () => {
    const parsed = parseBrowseOutput("+;eth0;IPv4;node-ad1efd;_zeta-k3s._tcp;local");
    expect(parsed.advertisements.length).toBe(0);
    expect(parsed.malformed.length).toBe(0);
  });

  test("a foreign service type on the same segment is ignored, not counted", () => {
    const foreign = RESOLVED.replace("_zeta-k3s._tcp", "_workstation._tcp");
    const parsed = parseBrowseOutput(foreign);
    expect(parsed.resolvedLines).toBe(0);
    expect(parsed.malformed.length).toBe(0);
  });
});

function txtOf(pairs: Readonly<Record<string, string>>): string {
  return Object.entries(pairs)
    .map(([key, value]) => `"${key}=${value}"`)
    .join(" ");
}

function resolvedLine(txt: string): string {
  return `=;eth0;IPv4;node-ad1efd;_zeta-k3s._tcp;local;node-ad1efd.local;10.88.0.1;6443;${txt}`;
}

const GOOD_PAIRS = {
  txtvers: "1",
  cluster: CLUSTER,
  td: "zeta.home",
  role: "control-plane",
  node: "node-ad1efd",
};

describe("something claiming to be us and failing is MALFORMED, never filtered away", () => {
  test("a newer schema version is refused rather than read on a guess", () => {
    const parsed = parseBrowseOutput(resolvedLine(txtOf({ ...GOOD_PAIRS, txtvers: "2" })));
    expect(parsed.advertisements.length).toBe(0);
    expect(parsed.malformed.length).toBe(1);
    expect(parsed.malformed[0]?.problem).toContain("schema");
  });

  test("a missing cluster id is malformed", () => {
    const { cluster: _dropped, ...withoutCluster } = GOOD_PAIRS;
    const parsed = parseBrowseOutput(resolvedLine(txtOf(withoutCluster)));
    expect(parsed.malformed.length).toBe(1);
  });

  test("a cluster id that is not a sha256 digest is malformed", () => {
    const parsed = parseBrowseOutput(resolvedLine(txtOf({ ...GOOD_PAIRS, cluster: "not-a-digest" })));
    expect(parsed.malformed.length).toBe(1);
  });

  test("an advertiser claiming a role other than control-plane is malformed", () => {
    const parsed = parseBrowseOutput(resolvedLine(txtOf({ ...GOOD_PAIRS, role: "worker" })));
    expect(parsed.malformed.length).toBe(1);
  });

  test("a trust domain carrying a scheme is refused rather than trimmed", () => {
    const parsed = parseBrowseOutput(resolvedLine(txtOf({ ...GOOD_PAIRS, td: "spiffe://zeta.home" })));
    expect(parsed.malformed.length).toBe(1);
  });
});

describe("field and TXT decoding", () => {
  test("an escaped separator inside a name does not split the record", () => {
    const fields = splitAvahiFields(String.raw`=;eth0;IPv4;odd\;name;_zeta-k3s._tcp;local`);
    expect(fields[3]).toBe("odd;name");
    expect(fields.length).toBe(6);
  });

  test("a duplicated TXT key keeps the first, per RFC 6763", () => {
    const txt = parseTxtField(String.raw`"txtvers=1" "txtvers=9"`);
    expect(txt.txtvers).toBe("1");
  });

  test("a TXT item with no equals sign is dropped, not treated as a key", () => {
    const txt = parseTxtField(String.raw`"lonely" "role=control-plane"`);
    expect(Object.keys(txt)).toEqual(["role"]);
  });
});
