#!/usr/bin/env bun
/**
 * join-endpoint-san-coverage.ts — will the join endpoint an operator typed be covered by the
 * founder's API-server certificate?
 *
 * WHY. `zeta-install.sh:1983` validates the staged join endpoint with a SHAPE check and nothing
 * else:
 *
 *     ^https://[A-Za-z0-9._:-]+$
 *
 * That language is strictly broader than the set of endpoints the founder's certificate actually
 * covers, and the gap is silent: a shape-valid endpoint that is not in the SAN set is written to
 * `/etc/zeta/cluster-join-server-url`, evaluated into `serverAddr`, and fails at the TLS handshake
 * on the joining node — after the disk has been partitioned, at a point where the operator is
 * standing in front of a machine that will not join and no surface says why.
 *
 * WHAT THE FOUNDER ACTUALLY COVERS. Two sources, and only two:
 *
 *   1. `--tls-san=control-plane`, set explicitly in `full-ai-cluster/nixos/modules/k3s-server.nix`.
 *      That is ONE name. Not a suffix, not a wildcard — the literal string.
 *   2. k3s's own defaults: `127.0.0.1`, `localhost`, and the node's IP. The module's comment
 *      asserts this ("127.0.0.1 / the node IP are SAN'd by k3s already"), and this file treats it
 *      as ASSERTED rather than checked — see the honest limits below.
 *
 * So `https://zeta-cp-1.local:6443` passes the installer's regex and is covered by nothing. It is
 * not a corner case; it is the first thing an operator types who has a hostname for the box.
 *
 * WHAT THIS FILE IS NOT. It does not contact anything, does not read a certificate, and does not
 * claim an endpoint WILL work. It classifies what is DECIDABLE FROM THE STRING, which is exactly
 * one useful thing: whether the endpoint is structurally incapable of being covered. A `covered`
 * verdict is "not ruled out here", never "verified".
 *
 * THE HONEST LIMITS, stated because a coverage checker that overstated its reach would be worse
 * than none:
 *
 *   - **Multi-NIC.** k3s SANs the node IP it selects (`--node-ip`, else the default-route
 *     address). On a box with two NICs the operator may dial the OTHER address, which is a real
 *     interface with a real IP that is not in the cert. This file cannot see interfaces, so an IP
 *     literal is `covered-if-node-ip`, never `covered`.
 *   - **A DNS name that RESOLVES to the founder is still not covered.** TLS verifies the name
 *     presented, not the address reached. Resolution succeeding is precisely what makes this
 *     failure confusing: `ping` works, `curl` fails.
 *   - It says nothing about reachability, firewalls, or whether the founder is up.
 *
 * §13 noninterference: a pure function of a string. No clock, no network, no filesystem.
 */

/** What can be decided about an endpoint from its text alone. */
export type SanCoverage =
  /** The literal name carried by `--tls-san=control-plane`. The designed path. */
  | "covered-by-explicit-san"
  /** An IP literal. Covered IF it is the node IP k3s selected — undecidable here. */
  | "covered-if-node-ip"
  /** `127.0.0.1` / `localhost` / `::1`: SAN'd by k3s, but meaningless as a JOIN target. */
  | "loopback-not-a-join-target"
  /** A DNS name that is not `control-plane`. Structurally cannot be in the SAN set. */
  | "not-covered"
  /** Not a shape the installer would even stage. */
  | "malformed";

export interface EndpointVerdict {
  readonly coverage: SanCoverage;
  /** The host portion as parsed, for the message. */
  readonly host: string;
  /** Port as written, or `null` when absent. */
  readonly port: number | null;
  /** One line an operator can act on. */
  readonly why: string;
}

/** The one name `k3s-server.nix` puts in `--tls-san`. A literal, never a pattern. */
export const EXPLICIT_TLS_SAN = "control-plane";

/** The supervisor/API port a join endpoint is expected to name. */
export const K3S_API_PORT = 6443;

/**
 * The installer's accepted language, as a value rather than a copy of a regex in a comment.
 * `join-endpoint-san-coverage.test.ts` reads the literal out of `zeta-install.sh` and asserts it
 * still matches this, so the two cannot drift apart silently.
 */
export const INSTALLER_ENDPOINT_PATTERN = /^https:\/\/[A-Za-z0-9._:-]+$/;

function isIpv4Literal(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/**
 * Split `host[:port]`, IPv6-aware.
 *
 * The installer's pattern admits `:` freely, so `https://::1` and `https://a:b:c` are both
 * shape-valid strings that a naive `split(":")` would mangle into a plausible-looking host. Parsing
 * deliberately rather than splitting is what keeps `malformed` reachable.
 */
function splitHostPort(authority: string): { host: string; port: number | null } | null {
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close < 0) return null;
    const host = authority.slice(1, close);
    const rest = authority.slice(close + 1);
    if (rest === "") return { host, port: null };
    if (!rest.startsWith(":")) return null;
    const port = Number(rest.slice(1));
    return Number.isInteger(port) && port > 0 && port <= 65535 ? { host, port } : null;
  }
  const colons = authority.split(":").length - 1;
  if (colons === 0) return authority.length > 0 ? { host: authority, port: null } : null;
  if (colons > 1) {
    // A bare IPv6 literal with no brackets. Shape-valid to the installer, and not a host:port.
    return { host: authority, port: null };
  }
  const [host = "", portText = ""] = authority.split(":");
  const port = Number(portText);
  if (host.length === 0) return null;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

/** Classify an endpoint. Pure. */
export function classifyJoinEndpoint(endpoint: string): EndpointVerdict {
  const trimmed = endpoint.trim();
  if (!INSTALLER_ENDPOINT_PATTERN.test(trimmed)) {
    return {
      coverage: "malformed",
      host: "",
      port: null,
      why: `'${trimmed}' does not match the installer's accepted shape ${String(INSTALLER_ENDPOINT_PATTERN)} — it would be refused before staging`,
    };
  }
  const parsed = splitHostPort(trimmed.slice("https://".length));
  if (parsed === null) {
    return { coverage: "malformed", host: "", port: null, why: `'${trimmed}' has no parseable host` };
  }
  const { host, port } = parsed;
  const lower = host.toLowerCase();

  if (lower === "localhost" || host === "127.0.0.1" || host === "::1") {
    return {
      coverage: "loopback-not-a-join-target",
      host,
      port,
      why:
        `'${host}' is SAN'd by k3s, so TLS would succeed — and it names the JOINING node, not the ` +
        "founder. A node that joins itself founds its own cluster, which is the failure this looks least like",
    };
  }

  if (isIpv4Literal(host) || host.includes(":")) {
    return {
      coverage: "covered-if-node-ip",
      host,
      port,
      why:
        `'${host}' is an IP literal. k3s SANs the node IP it SELECTED (--node-ip, else the ` +
        "default-route address); on a multi-NIC box the other interface's address is real, reachable, and NOT in the cert",
    };
  }

  if (lower === EXPLICIT_TLS_SAN) {
    return {
      coverage: "covered-by-explicit-san",
      host,
      port,
      why: `'${host}' is the literal name carried by --tls-san=${EXPLICIT_TLS_SAN} in k3s-server.nix`,
    };
  }

  return {
    coverage: "not-covered",
    host,
    port,
    why:
      `'${host}' is a DNS name other than '${EXPLICIT_TLS_SAN}'. The founder's certificate carries ` +
      `--tls-san=${EXPLICIT_TLS_SAN} and k3s' IP/loopback defaults — nothing else. Resolving to the founder does ` +
      "NOT help: TLS verifies the name presented, not the address reached, so ping succeeds and the join fails",
  };
}

/** `true` when the endpoint is structurally incapable of passing TLS against the founder. */
export function isStructurallyUncovered(verdict: EndpointVerdict): boolean {
  return verdict.coverage === "not-covered" || verdict.coverage === "malformed";
}

/** Operator-facing report. The remediation is the point; the classification is how it is reached. */
export function renderEndpointAdvice(endpoint: string): string {
  const v = classifyJoinEndpoint(endpoint);
  const lines = [`join endpoint: ${endpoint}`, `  coverage: ${v.coverage}`, `  why: ${v.why}`];
  if (v.port !== null && v.port !== K3S_API_PORT) {
    lines.push(
      `  NOTE: port ${String(v.port)} is not the k3s API port ${String(K3S_API_PORT)} — deliberate, or a typo?`,
    );
  }
  if (v.port === null) {
    lines.push(`  NOTE: no port. k3s expects :${String(K3S_API_PORT)} on a server join endpoint.`);
  }
  switch (v.coverage) {
    case "not-covered":
      lines.push(
        `  FIX: use https://${EXPLICIT_TLS_SAN}:${String(K3S_API_PORT)} (the designed path — the installer stages an`,
        "       /etc/hosts entry mapping that name to the founder), or the founder's IP literal, or add",
        `       --tls-san=${v.host} on the FOUNDER before flashing this node.`,
      );
      break;
    case "loopback-not-a-join-target":
      lines.push("  FIX: name the FOUNDER, not this node.");
      break;
    case "covered-if-node-ip":
      lines.push(
        "  CHECK: on the founder, confirm this is the address k3s selected — a second NIC's address is",
        "       reachable and not in the certificate.",
      );
      break;
    case "covered-by-explicit-san":
    case "malformed":
      break;
  }
  return lines.join("\n");
}
