/**
 * full-ai-cluster/nixos/cluster-discovery/advertisement.ts
 *
 * WHAT A ZETA CONTROL PLANE ADVERTISES, AND HOW A PROBE READS IT BACK.
 *
 * 081KSE6WT0008QG0R000CV98PV (mDNS bootstrap-or-join) -- the discovery half of
 * R3 in `docs/design/2026-08-21-the-zeta-bootstrap-usb-full-design-document.md`:
 *
 *   Aaron 2026-05-25: "it knows when it's already a clus-- if it's not a
 *   cluster, it creates a new one, and if it's on a network with a cluster,
 *   it joins it."
 *
 * The JOIN already exists and is proven (`nixos/tests/k3s-agent-join.nix`).
 * What is missing is that sentence's FIRST half -- knowing which case you are
 * in. This file defines the fact that gets published, as a pure value, so
 * every rule about it is unit-testable with no network.
 *
 * WHAT IS ADVERTISED (and, as loudly, what is NOT)
 * -----------------------------------------------
 * Service type `_zeta-k3s._tcp` (DNS-SD, RFC 6763), SRV port 6443 -- the k3s
 * API port a joiner passes to `--server`. The TXT record carries RFC 6763
 * section 6 key/value pairs with `txtvers` first per section 6.7:
 *
 *     txtvers=1                 advertisement schema version
 *     cluster=<64 hex>          sha256 of the cluster's k3s server CA cert
 *     td=<trust domain>         identity namespace this cluster serves
 *     role=control-plane        what the advertiser is
 *     node=<node name>          which control plane, for HA disambiguation
 *
 * NOT ADVERTISED: the k3s node-token, or any other credential, in any form,
 * ever. mDNS is unauthenticated multicast to a link-local group -- every
 * listener on the L2 segment receives every record. The backlog row
 * 081KSE6WT0008QG0R000CV98PV lists "ship token via mDNS TXT (acceptable since
 * the cluster network is trusted)" as an acceptance criterion; that criterion
 * is REFUSED here, and the refusal is part of the design. A k3s node-token is
 * a join credential for the whole cluster, so anything on the segment that can
 * hear 5353/udp -- a guest laptop on the same office switch -- would obtain it
 * by listening. See `decide.ts` for what replaces it: discovery supplies the
 * ADDRESS, the operator's medium supplies the CREDENTIAL, and the two are
 * cross-checked against each other.
 *
 * WHY THE CLUSTER ID IS THE SERVER-CA HASH
 * ----------------------------------------
 * It is public (a CA certificate is the half you hand out), stable for the
 * life of the cluster, distinct between clusters -- and it is already a k3s
 * concept rather than a Zeta invention: k3s's own token format is
 * `K10<sha256-of-server-CA-cert>::<credential>`, so the value a joiner needs
 * in order to VERIFY what it dialled is already inside the token the operator
 * flashed. `clusterIdFromK3sTokenPrefix` reads it out of that PUBLIC prefix
 * and never touches the part after `::`.
 *
 * Anchors (Beacon): Cheshire and Krochmal, RFC 6762 (Multicast DNS) and RFC
 * 6763 (DNS-Based Service Discovery), IETF 2013 -- the `_service._proto`
 * naming, the TXT key/value convention and `txtvers` are theirs, not ours. The
 * trust-domain field follows SPIFFE (CNCF) usage: a trust domain names an
 * identity namespace, which is exactly the thing two adjacent clusters must not
 * share -- and SPIRE is already in this cluster's bootstrap roster
 * (`spire-install`). k3s (Rancher/SUSE) for the CA-hash-in-token format.
 */

/** DNS-SD service type. Ours alone, so a stray non-Zeta k3s never matches. */
export const ZETA_CLUSTER_SERVICE_TYPE = "_zeta-k3s._tcp";

/** The k3s API port a joiner passes to `--server https://host:PORT`. */
export const ZETA_CLUSTER_API_PORT = 6443;

/**
 * Advertisement schema version this build speaks.
 *
 * A probe accepts `txtvers` EQUAL to this and refuses anything else, in both
 * directions. Refusing a NEWER advertisement is the point: a v2 cluster may
 * have changed a field's meaning, and a v1 reader that "ignores what it does
 * not understand" would join it on a misread. Refusing an OLDER one costs an
 * operator a message; joining one on a guess costs a cluster.
 */
export const ZETA_ADVERTISEMENT_TXTVERS = 1;

/** TXT keys as they appear on the wire. Short, per RFC 6763 section 6.1. */
export const TXT_KEY_TXTVERS = "txtvers";
export const TXT_KEY_CLUSTER = "cluster";
export const TXT_KEY_TRUST_DOMAIN = "td";
export const TXT_KEY_ROLE = "role";
export const TXT_KEY_NODE = "node";

/** The only role that advertises. Agents publish nothing. */
export const ADVERTISED_ROLE_CONTROL_PLANE = "control-plane";

/** sha256, lower-case hex, exactly as k3s writes it into its token. */
export const CLUSTER_ID_REGEX = /^[0-9a-f]{64}$/;

/**
 * Trust-domain shape, deliberately narrow: a bare DNS-ish name, no scheme, no
 * path. A `spiffe://` prefix or a `/workload` suffix is refused rather than
 * trimmed, because a silent trim makes two different strings compare equal and
 * telling two clusters apart is this value's entire job.
 */
export const TRUST_DOMAIN_REGEX = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;

/** Node-name shape -- the `node-<6hex>` convention plus ordinary DNS labels. */
export const NODE_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** A resolved, fully-validated advertisement. */
export interface ZetaClusterAdvertisement {
  readonly txtvers: number;
  readonly clusterId: string;
  readonly trustDomain: string;
  readonly role: typeof ADVERTISED_ROLE_CONTROL_PLANE;
  readonly nodeName: string;
  /** Hostname the responder published (e.g. `node-ad1efd.local`). */
  readonly hostname: string;
  /** Address the responder published. */
  readonly address: string;
  readonly port: number;
}

/** Something on our service type that did NOT validate. */
export interface MalformedAdvertisement {
  /** Whatever identity could be recovered, for the operator message. */
  readonly source: string;
  readonly problem: string;
}

/** Raw, pre-validation shape a transport hands in. */
export interface RawAdvertisement {
  readonly txt: Readonly<Record<string, string>>;
  readonly hostname: string;
  readonly address: string;
  readonly port: number;
}

export type AdvertisementResult =
  | { readonly ok: true; readonly value: ZetaClusterAdvertisement }
  | { readonly ok: false; readonly problem: string };

function fail(problem: string): { readonly ok: false; readonly problem: string } {
  return { ok: false, problem };
}

/**
 * Validate a raw advertisement.
 *
 * Total, and refusing rather than repairing: every branch that could "fix up"
 * a field instead reports what was wrong. An advertisement is untrusted input
 * off a multicast group anyone on the segment can write to.
 */
export function validateAdvertisement(raw: RawAdvertisement): AdvertisementResult {
  const txtversRaw = raw.txt[TXT_KEY_TXTVERS];
  if (txtversRaw === undefined) {
    return fail(`TXT record has no ${TXT_KEY_TXTVERS} key`);
  }
  if (!/^[0-9]+$/.test(txtversRaw)) {
    return fail(`${TXT_KEY_TXTVERS} is not a non-negative integer: ${JSON.stringify(txtversRaw)}`);
  }
  const txtvers = Number(txtversRaw);
  if (txtvers !== ZETA_ADVERTISEMENT_TXTVERS) {
    return fail(
      `advertisement schema ${String(txtvers)} is not the schema this node speaks ` +
        `(${String(ZETA_ADVERTISEMENT_TXTVERS)}); refusing rather than guessing which fields moved`,
    );
  }

  const clusterId = raw.txt[TXT_KEY_CLUSTER];
  if (clusterId === undefined) {
    return fail(`TXT record has no ${TXT_KEY_CLUSTER} key`);
  }
  if (!CLUSTER_ID_REGEX.test(clusterId)) {
    return fail(`${TXT_KEY_CLUSTER} is not a lower-case sha256 hex digest: ${JSON.stringify(clusterId)}`);
  }

  const trustDomain = raw.txt[TXT_KEY_TRUST_DOMAIN];
  if (trustDomain === undefined) {
    return fail(`TXT record has no ${TXT_KEY_TRUST_DOMAIN} key`);
  }
  if (!TRUST_DOMAIN_REGEX.test(trustDomain)) {
    return fail(`${TXT_KEY_TRUST_DOMAIN} is not a bare trust-domain name: ${JSON.stringify(trustDomain)}`);
  }

  const role = raw.txt[TXT_KEY_ROLE];
  if (role !== ADVERTISED_ROLE_CONTROL_PLANE) {
    return fail(`${TXT_KEY_ROLE} must be ${ADVERTISED_ROLE_CONTROL_PLANE}, got ${JSON.stringify(role ?? null)}`);
  }

  const nodeName = raw.txt[TXT_KEY_NODE];
  if (nodeName === undefined) {
    return fail(`TXT record has no ${TXT_KEY_NODE} key`);
  }
  if (!NODE_NAME_REGEX.test(nodeName)) {
    return fail(`${TXT_KEY_NODE} is not a DNS label: ${JSON.stringify(nodeName)}`);
  }

  if (!Number.isInteger(raw.port)) {
    return fail(`SRV port is not a TCP port: ${String(raw.port)}`);
  }
  if (raw.port <= 0) {
    return fail(`SRV port is not a TCP port: ${String(raw.port)}`);
  }
  if (raw.port >= 65536) {
    return fail(`SRV port is not a TCP port: ${String(raw.port)}`);
  }
  if (raw.hostname.trim().length === 0) {
    return fail("responder published no hostname");
  }
  if (raw.address.trim().length === 0) {
    return fail("responder published no address");
  }

  return {
    ok: true,
    value: {
      txtvers,
      clusterId,
      trustDomain,
      role: ADVERTISED_ROLE_CONTROL_PLANE,
      nodeName,
      hostname: raw.hostname.trim(),
      address: raw.address.trim(),
      port: raw.port,
    },
  };
}

/**
 * The k3s `--server` URL for an advertisement.
 *
 * The NAME is dialled, not the address, and that is not a stylistic choice:
 * `k3s-server.nix` puts `--tls-san=control-plane` and the node name into the
 * API certificate, so dialling a bare IP resolves and then fails certificate
 * verification -- the failure `injected-cluster-address.nix` already documents.
 * The address travels beside it, for the `/etc/hosts` entry.
 */
export function joinServerUrlFor(advertisement: ZetaClusterAdvertisement): string {
  return `https://${advertisement.hostname}:${String(advertisement.port)}`;
}

export type ClusterIdFromTokenPrefixResult =
  | { readonly ok: true; readonly clusterId: string }
  | { readonly ok: false; readonly problem: string };

/**
 * Read the cluster id out of the PUBLIC prefix of a k3s token.
 *
 * The caller passes only the part BEFORE the `::` separator -- `K10` followed
 * by 64 hex characters. The credential half is never an argument to this
 * function, is never returned by it, and never appears in any message it
 * produces. That split is why this is a function and not a split at the call
 * site: the secret half must not be in scope where messages are written.
 */
export function clusterIdFromK3sTokenPrefix(prefix: string): ClusterIdFromTokenPrefixResult {
  const trimmed = prefix.trim();
  if (!trimmed.startsWith("K10")) {
    return { ok: false, problem: "k3s token prefix does not start with K10 (not a CA-pinned token)" };
  }
  const digest = trimmed.slice("K10".length);
  if (!CLUSTER_ID_REGEX.test(digest)) {
    return { ok: false, problem: "k3s token prefix carries no sha256 hex digest after K10" };
  }
  return { ok: true, clusterId: digest };
}
