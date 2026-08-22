/**
 * The Nix publisher and the TypeScript reader are one contract in two
 * languages, and nothing but a test can hold them together: Nix cannot import
 * TypeScript, so a rename on either side would produce a control plane that
 * advertises and a joiner that never recognises it -- silence that looks
 * exactly like an empty network.
 *
 * This reads the module as text and checks the record it emits, including the
 * one property that is a security property rather than a compatibility one:
 * NO TXT RECORD MAY CARRY A CREDENTIAL.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseBrowseOutput } from "./avahi-browse-parse";
import {
  ADVERTISED_ROLE_CONTROL_PLANE,
  TXT_KEY_CLUSTER,
  TXT_KEY_NODE,
  TXT_KEY_ROLE,
  TXT_KEY_TRUST_DOMAIN,
  TXT_KEY_TXTVERS,
  ZETA_ADVERTISEMENT_TXTVERS,
  ZETA_CLUSTER_API_PORT,
  ZETA_CLUSTER_SERVICE_TYPE,
} from "./advertisement";

const MODULE_PATH = fileURLToPath(new URL("../modules/cluster-discovery-advertise.nix", import.meta.url));
const MODULE_TEXT = readFileSync(MODULE_PATH, "utf8");

/** Every `<txt-record>...</txt-record>` the module emits, keys only. */
function advertisedTxtKeys(): readonly string[] {
  const matches = MODULE_TEXT.match(/<txt-record>([^<]*)<\/txt-record>/g) ?? [];
  return matches.map((item) => {
    const body = item.replace("<txt-record>", "").replace("</txt-record>", "");
    const eq = body.indexOf("=");
    return eq === -1 ? body : body.slice(0, eq);
  });
}

describe("the published record matches what the reader parses", () => {
  test("the service type is the one the parser filters on", () => {
    expect(MODULE_TEXT).toContain(`<type>${ZETA_CLUSTER_SERVICE_TYPE}</type>`);
  });

  test("the advertised schema version is the one the validator accepts", () => {
    expect(MODULE_TEXT).toContain(`<txt-record>${TXT_KEY_TXTVERS}=${String(ZETA_ADVERTISEMENT_TXTVERS)}</txt-record>`);
  });

  test("the default SRV port is the k3s API port the join dials", () => {
    expect(MODULE_TEXT).toContain(`default = ${String(ZETA_CLUSTER_API_PORT)};`);
  });

  test("every key the validator requires is advertised", () => {
    const keys = advertisedTxtKeys();
    for (const required of [TXT_KEY_TXTVERS, TXT_KEY_CLUSTER, TXT_KEY_TRUST_DOMAIN, TXT_KEY_ROLE, TXT_KEY_NODE]) {
      expect(keys).toContain(required);
    }
  });

  test("the advertised role is the only role the validator accepts", () => {
    expect(MODULE_TEXT).toContain(`<txt-record>${TXT_KEY_ROLE}=${ADVERTISED_ROLE_CONTROL_PLANE}</txt-record>`);
  });
});

describe("no credential may ever reach the multicast group", () => {
  const forbidden = ["token", "secret", "password", "passwd", "credential", "privkey", "private-key", "k10"];

  test("no TXT record key or value names a credential", () => {
    const records = MODULE_TEXT.match(/<txt-record>([^<]*)<\/txt-record>/g) ?? [];
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const lowered = record.toLowerCase();
      for (const word of forbidden) {
        expect(lowered).not.toContain(word);
      }
    }
  });

  test("the publisher never reads the k3s token file", () => {
    // Comment lines are excluded on purpose: the header DISCUSSES the node-token
    // at length in order to say it is never published, and a guard that could
    // not tell an explanation from an instruction would force the explanation
    // out of the file.
    const code = MODULE_TEXT.split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toContain("server/token");
    expect(code).not.toContain("node-token");
    expect(code).not.toContain("agent/token");
  });

  test("the only k3s file it reads is the PUBLIC CA certificate", () => {
    expect(MODULE_TEXT).toContain("server/tls/server-ca.crt");
  });
});

describe("publisher output round-trips through the reader", () => {
  test("the record this module publishes is one the parser accepts", () => {
    const records = (MODULE_TEXT.match(/<txt-record>([^<]*)<\/txt-record>/g) ?? []).map((item) =>
      item.replace("<txt-record>", "").replace("</txt-record>", ""),
    );
    const clusterId = "d".repeat(64);
    const txt = records
      .map((record) =>
        record
          .replace("@CLUSTER_ID@", clusterId)
          .replace("@NODE@", "node-ad1efd")
          .replace("${cfg.trustDomain}", "zeta.local"),
      )
      .map((record) => `"${record}"`)
      .join(" ");
    const line = `=;eth0;IPv4;node-ad1efd;${ZETA_CLUSTER_SERVICE_TYPE};local;node-ad1efd.local;10.88.0.1;${String(ZETA_CLUSTER_API_PORT)};${txt}`;
    const parsed = parseBrowseOutput(line);
    expect(parsed.malformed).toEqual([]);
    expect(parsed.advertisements.length).toBe(1);
    expect(parsed.advertisements[0]?.clusterId).toBe(clusterId);
    expect(parsed.advertisements[0]?.trustDomain).toBe("zeta.local");
  });
});

describe("the cluster id is only published when it is the id k3s would compute", () => {
  // VERIFIED against k3s's own source rather than assumed. pkg/clientaccess/token.go
  // hashCA(): with a SINGLE certificate in the bundle the hash is taken over the
  // literal bytes of the file -- what `sha256sum` computes -- but with MORE THAN
  // ONE certificate k3s hashes the DER of the ROOT cert in the chain instead, and
  // the file digest silently diverges from the K10 prefix.
  //
  // A wrong cluster id is worse than no advertisement: joiners that pin the value
  // refuse every join while the record still looks healthy on the wire. That is
  // the "check that did not run looking like one that passed" shape, so the
  // publisher must REFUSE rather than publish an id it cannot compute correctly.

  test("a multi-certificate bundle refuses to publish instead of guessing", () => {
    expect(MODULE_TEXT).toContain("BEGIN CERTIFICATE");
    // The refusal must exit non-zero, not merely warn.
    const guard = MODULE_TEXT.slice(MODULE_TEXT.indexOf("certs="));
    const digestAt = guard.indexOf("sha256sum");
    expect(digestAt).toBeGreaterThan(0);
    // `exit 1` has to come BEFORE the digest is computed, or the guard is decorative.
    const exitAt = guard.indexOf("exit 1");
    expect(exitAt).toBeGreaterThan(0);
    expect(exitAt).toBeLessThan(digestAt);
  });

  test("a stale advertisement is withdrawn on that refusal, not left on the wire", () => {
    // Refusing to publish while an old service file remains would keep announcing
    // a cluster id nobody can join -- the failure this guard exists to prevent,
    // simply persisted from the previous boot.
    const guard = MODULE_TEXT.slice(MODULE_TEXT.indexOf("certs="));
    const region = guard.slice(0, guard.indexOf("sha256sum"));
    expect(region).toContain("rm -f");
  });

  test("the k3s source that licenses the single-cert case is cited in the module", () => {
    // The anchor must be checkable by a reader, not folklore. If this citation is
    // removed the next maintainer has no way to know the digest choice was verified.
    expect(MODULE_TEXT).toContain("pkg/clientaccess/token.go");
  });
});
