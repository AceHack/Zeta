#!/usr/bin/env bun
// full-ai-cluster/tools/cluster-bringup/sovereignty-cli.ts
//
// READ-ONLY. Reports the estate's SHAPE under sovereign-by-default, and prints removal
// plans. It applies nothing, joins nothing, removes nothing, and resets no datastore.
//
//   shape          probe addresses and report how many sovereign clusters exist
//   removal-plan   print the named acts for one of the three removal operations
//
//   rc 0 = the shape was established (>=1 cluster identified). TWO CLUSTERS IS rc 0 —
//          that is the whole point: a node is sovereign on boot by design, so N clusters
//          is the expected shape and not a failure.
//   rc 3 = something answered but no cluster identity could be read. One act away.
//   rc 1 = nothing answered, or no address was supplied to probe.
//   rc 2 = usage.
//
// ---------------------------------------------------------------------------
// ON THE DOORS BELOW, AND WHEN THEY RETIRE
// ---------------------------------------------------------------------------
//
// `probe.ts` in this directory has better versions of `tcpOpen` and `apiServerIdentity`,
// including ARP-based discovery. It is NOT on `main`: it arrives with PR #15641, which was
// still open with failing checks when this file was written (2026-08-26). Rather than
// stack on an unmerged branch, the two doors this CLI needs are inlined here — about
// thirty lines, named as a duplication rather than hidden as one.
//
// WHEN #15641 MERGES: delete `tcpOpen` and `apiServerIdentity` below, import them from
// `./probe.ts`, and take `addressesToProbe` from there so ARP discovery works here too.
// The pure module (`sovereignty.ts`) has no doors at all and needs no change — its
// `ObservedServer` is deliberately assignable from `probe.ts`'s `ObservedNode`.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import {
  partitionBySovereignty,
  removalPlan,
  renderEstateShape,
  renderRemovalPlan,
  type ObservedServer,
  type RemovalOperation,
} from "./sovereignty.ts";

const SPAWN_MAX_BUFFER = 8 * 1024 * 1024;

/** Dotted-quad only. Every argument reaches `spawnSync` with `shell: false`, so this is
 *  defence in depth rather than the only guard — but an address that is not an address is
 *  a caller mistake worth naming rather than passing through to openssl. */
const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function run(program: string, argv: readonly string[], timeoutMs: number, input?: string): {
  status: number;
  stdout: string;
} {
  const r = spawnSync(program, [...argv], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout: timeoutMs,
    // No shell: an address can never become a command.
    shell: false,
    ...(input === undefined ? {} : { input }),
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? "" };
}

/** RETIRES INTO probe.ts — see the header. */
function tcpOpen(address: string, port: number): boolean {
  return run("nc", ["-z", "-G", "3", address, String(port)], 8_000).status === 0;
}

/** k3s puts these in EVERY API certificate, so they identify the service and never the
 *  node. `control-plane` is on the list because it is the FLAKE HOST name that
 *  `--tls-san=control-plane` adds to every machine built from that config — it is present
 *  on both live nodes and is exactly why it cannot be treated as an identity. */
const GENERIC_SAN_NAMES: ReadonlySet<string> = new Set([
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
  "localhost",
  "control-plane",
]);

function nodeNameFromSan(sanText: string): string | undefined {
  const names = [...sanText.matchAll(/DNS:([^,\s]+)/g)].map((m) => m[1] ?? "");
  return names.find((n) => n !== "" && !GENERIC_SAN_NAMES.has(n));
}

/**
 * One TLS handshake yields both the cluster's identity and the node's self-claim.
 *
 * RETIRES INTO probe.ts — see the header.
 *
 * The cluster identity is SHA-256 over the CA certificate's SubjectPublicKeyInfo. Two k3s
 * servers in one cluster share it; two servers that each ran `--cluster-init` never do.
 * The issuer STRING (`CN=k3s-server-ca@<epoch>`) is informative and is not used as the
 * key — it is not a key, and two clusters founded in the same second would collide on it.
 */
function apiServerIdentity(address: string): {
  caPublicKeySha256: string | undefined;
  servedNodeName: string | undefined;
} {
  const chain = run("openssl", ["s_client", "-connect", `${address}:6443`, "-showcerts"], 15_000, "").stdout;
  const pems = [...chain.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)].map(
    (m) => m[0] ?? "",
  );
  if (pems.length === 0) return { caPublicKeySha256: undefined, servedNodeName: undefined };

  const leaf = pems[0] ?? "";
  const ca = pems[pems.length - 1] ?? "";

  const pub = run("openssl", ["x509", "-noout", "-pubkey"], 8_000, ca);
  const caPublicKeySha256 =
    pub.status === 0 && pub.stdout.trim() !== ""
      ? createHash("sha256").update(pub.stdout.trim()).digest("hex")
      : undefined;

  const san = run("openssl", ["x509", "-noout", "-ext", "subjectAltName"], 8_000, leaf);
  const servedNodeName = san.status === 0 ? nodeNameFromSan(san.stdout) : undefined;

  return { caPublicKeySha256, servedNodeName };
}

function observe(address: string): ObservedServer {
  const apiServerResponded = tcpOpen(address, 6443);
  const identity = apiServerResponded
    ? apiServerIdentity(address)
    : { caPublicKeySha256: undefined, servedNodeName: undefined };
  return {
    address,
    apiServerResponded,
    servedNodeName: identity.servedNodeName,
    caPublicKeySha256: identity.caPublicKeySha256,
  };
}

const OPERATIONS: readonly RemovalOperation[] = [
  "member-secedes",
  "creator-evicts-member",
  "creator-dissolves-cluster",
];

export function usage(): string {
  return [
    "usage:",
    "  bun full-ai-cluster/tools/cluster-bringup/sovereignty-cli.ts shape --address <ip> [--address <ip>]...",
    "  bun full-ai-cluster/tools/cluster-bringup/sovereignty-cli.ts removal-plan <operation> \\",
    "        --node <k8s-node-name> --address <departing-ip> --cluster <surviving-ip>",
    "",
    `  operations: ${OPERATIONS.join(" | ")}`,
    "",
    "  rc 0 = shape established (N sovereign clusters — N>1 is NOT a failure)",
    "  rc 3 = something answered, no cluster identity readable",
    "  rc 1 = nothing answered / no address supplied",
    "  rc 2 = usage",
    "",
    "  This tool never writes anything and never touches a cluster.",
  ].join("\n");
}

function flagValues(argv: readonly string[], flag: string): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1] !== undefined) out.push(String(argv[i + 1]));
  }
  return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): 0 | 1 | 2 | 3 {
  if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
    process.stdout.write(`${usage()}\n`);
    return argv.length === 0 ? 2 : 0;
  }

  const verb = argv[0];

  if (verb === "removal-plan") {
    const op = argv[1];
    if (op === undefined || !OPERATIONS.includes(op as RemovalOperation)) {
      process.stderr.write(`sovereignty: unknown operation ${op ?? "(none)"}\n\n${usage()}\n`);
      return 2;
    }
    const nodeName = flagValues(argv, "--node")[0];
    const address = flagValues(argv, "--address")[0];
    const clusterAddress = flagValues(argv, "--cluster")[0];
    if (nodeName === undefined || address === undefined || clusterAddress === undefined) {
      process.stderr.write("sovereignty: removal-plan needs --node, --address and --cluster\n\n" + usage() + "\n");
      return 2;
    }
    process.stdout.write(
      `${renderRemovalPlan(removalPlan(op as RemovalOperation, { nodeName, address, clusterAddress }))}\n`,
    );
    process.stdout.write(
      "\nNOTHING ABOVE WAS RUN. Each act is printed for a human, and every act that\n" +
        "destroys something says so on its own line.\n",
    );
    return 0;
  }

  if (verb !== "shape") {
    process.stderr.write(`sovereignty: unknown verb ${verb ?? "(none)"}\n\n${usage()}\n`);
    return 2;
  }

  const addresses = [...new Set(flagValues(argv, "--address"))];
  const bad = addresses.filter((a) => !IPV4.test(a));
  if (bad.length > 0) {
    process.stderr.write(`sovereignty: not an IPv4 address: ${bad.join(", ")}\n`);
    return 2;
  }
  if (addresses.length === 0) {
    process.stderr.write(
      "sovereignty: no --address supplied, so nothing was probed.\n" +
        "This is rc 1 and not rc 0: a run that probed nothing must never look like a run\n" +
        "that found nothing wrong.\n\n" +
        usage() +
        "\n",
    );
    return 1;
  }

  const observed = addresses.map(observe);
  const shape = partitionBySovereignty(observed);
  process.stdout.write(`${renderEstateShape(shape)}\n`);

  if (shape.clusters.length > 0) return 0;
  // Something answered on 6443 but presented no readable CA: identity not established.
  if (shape.unidentified.length > 0) return 3;
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
