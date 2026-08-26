// full-ai-cluster/tools/cluster-bringup/probe.ts
//
// THE IO HALF. Every door the ladder needs, and nothing else. All of it is READ-ONLY:
// ICMP, a TCP connect, a TLS handshake, the local ARP table, and `kubectl config view`.
// Nothing here writes a file, mutates a cluster, or holds a credential.
//
// The parsers are exported separately from the doors so they can be tested without a
// network — the doors are thin, the judgement is pure.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { normaliseMac, parseNodeRecord, type NodeRecord, type ObservedNode } from "./estate.ts";

const SPAWN_MAX_BUFFER = 8 * 1024 * 1024;

interface Ran {
  readonly status: number;
  readonly stdout: string;
}

function run(program: string, argv: readonly string[], timeoutMs = 12_000): Ran {
  const r = spawnSync(program, [...argv], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout: timeoutMs,
    // No shell: every argument is passed as a literal, so an address from a record can
    // never become a command.
    shell: false,
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? "" };
}

// ---------------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------------

/** Names k3s puts in EVERY API server certificate regardless of which machine it is.
 *  They identify the service, never the node, so they cannot answer "who is this?". */
export const GENERIC_SAN_NAMES: ReadonlySet<string> = new Set([
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
  "localhost",
  // `control-plane` is the FLAKE HOST name and k3s adds it via --tls-san on every machine
  // built from that host config. It is present on both live nodes and is exactly why it
  // must not be treated as an identity.
  "control-plane",
]);

/**
 * The node's own name, from the SAN list of its API server certificate.
 *
 * Returns `undefined` when the certificate carries only generic names — an honest
 * "this certificate does not say who this machine is", not a guess.
 */
export function nodeNameFromSan(sanText: string): string | undefined {
  const names = [...sanText.matchAll(/DNS:([^,\s]+)/g)].map((m) => m[1] ?? "");
  return names.find((n) => n !== "" && !GENERIC_SAN_NAMES.has(n));
}

/** `kubectl config view` output (name<TAB>server per line) into contexts. */
export function parseKubeContexts(raw: string): readonly { name: string; server: string }[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map((l) => {
      const [name = "", server = ""] = l.split(/\s+/);
      return { name, server };
    })
    .filter((c) => c.server.startsWith("http"));
}

/** The local ARP table into address -> MAC. Handles the short-octet spelling `arp` uses. */
export function parseArpTable(raw: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const m = /\((\d+\.\d+\.\d+\.\d+)\) at ([0-9a-fA-F:]+)/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined && m[2].includes(":")) {
      out.set(m[1], normaliseMac(m[2]));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

/** Read every `maintainers/*​/cluster-nodes/*​/node.yaml`. */
export function readNodeRecords(repoRoot: string): readonly NodeRecord[] {
  const base = join(repoRoot, "maintainers");
  if (!existsSync(base)) return [];
  const out: NodeRecord[] = [];
  for (const who of readdirSync(base)) {
    const dir = join(base, who, "cluster-nodes");
    if (!existsSync(dir)) continue;
    for (const node of readdirSync(dir)) {
      const path = join(dir, node, "node.yaml");
      if (!existsSync(path)) continue;
      const rec = parseNodeRecord(readFileSync(path, "utf8"), path);
      if (rec !== undefined) out.push(rec);
    }
  }
  return out;
}

export function arpTable(): ReadonlyMap<string, string> {
  return parseArpTable(run("arp", ["-a", "-n"], 8_000).stdout);
}

export function kubeContexts(): readonly { name: string; server: string }[] {
  const r = run(
    "kubectl",
    ["config", "view", "-o", "jsonpath={range .clusters[*]}{.name}{\"\\t\"}{.cluster.server}{\"\\n\"}{end}"],
    10_000,
  );
  return r.status === 0 ? parseKubeContexts(r.stdout) : [];
}

function icmpAlive(address: string): boolean {
  return run("ping", ["-c", "1", "-t", "2", address], 6_000).status === 0;
}

function tcpOpen(address: string, port: number): boolean {
  return run("nc", ["-z", "-G", "3", address, String(port)], 8_000).status === 0;
}

/**
 * The cluster's identity and the node's self-claim, from one TLS handshake.
 *
 * `caPublicKeySha256` is SHA-256 over the CA certificate's SubjectPublicKeyInfo — the
 * cluster's trust root. Two k3s servers in one cluster share it; two servers that each ran
 * `--cluster-init` never do. The issuer *string* is not used for this: k3s writes
 * `CN=k3s-server-ca@<epoch>`, which is informative but is not a key.
 */
export function apiServerIdentity(
  address: string,
): { readonly caPublicKeySha256: string | undefined; readonly servedNodeName: string | undefined } {
  const chain = run("openssl", ["s_client", "-connect", `${address}:6443`, "-showcerts"], 15_000).stdout;
  const pems = [...chain.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)].map(
    (m) => m[0] ?? "",
  );
  if (pems.length === 0) return { caPublicKeySha256: undefined, servedNodeName: undefined };

  const leaf = pems[0] ?? "";
  const ca = pems[pems.length - 1] ?? "";

  const pub = spawnSync("openssl", ["x509", "-noout", "-pubkey"], {
    input: ca,
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout: 8_000,
  });
  const caKey =
    pub.status === 0 && (pub.stdout ?? "") !== ""
      ? createHash("sha256").update((pub.stdout ?? "").trim()).digest("hex")
      : undefined;

  const san = spawnSync("openssl", ["x509", "-noout", "-ext", "subjectAltName"], {
    input: leaf,
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout: 8_000,
  });
  const servedNodeName = san.status === 0 ? nodeNameFromSan(san.stdout ?? "") : undefined;

  return { caPublicKeySha256: caKey, servedNodeName };
}

/**
 * Observe one address.
 *
 * Note the ordering: a node that does not answer ICMP is still probed on 6443, because a
 * host can drop ICMP and serve an API. Reporting it as absent on the strength of a ping
 * would be a check answering a question it did not ask.
 */
export function observeAddress(address: string, arp: ReadonlyMap<string, string>): ObservedNode {
  const icmpResponded = icmpAlive(address);
  const apiServerResponded = tcpOpen(address, 6443);
  const identity = apiServerResponded
    ? apiServerIdentity(address)
    : { caPublicKeySha256: undefined, servedNodeName: undefined };
  return {
    address,
    mac: arp.get(address),
    icmpResponded,
    apiServerResponded,
    servedNodeName: identity.servedNodeName,
    caPublicKeySha256: identity.caPublicKeySha256,
  };
}

/**
 * Which addresses to probe.
 *
 * The node records carry MACs and (usually empty) IPs, so the addresses come from the
 * local ARP table by matching recorded MACs, plus any address explicitly supplied. This
 * is a stated limit rather than a hidden one: **a node that is powered on but has not
 * exchanged a packet with this workstation will not be in ARP and will not be probed.**
 * Supply its address explicitly, or populate the record's IP field.
 */
export function addressesToProbe(
  records: readonly NodeRecord[],
  arp: ReadonlyMap<string, string>,
  explicit: readonly string[],
): readonly string[] {
  const recorded = new Set(records.map((r) => r.mac));
  const found = [...arp.entries()].filter(([, mac]) => recorded.has(mac)).map(([ip]) => ip);
  return [...new Set([...explicit, ...found])].sort();
}
