#!/usr/bin/env bun
// ace.ts -- Ace DLC package manager CLI. Smallest safe slice of 081KR2E4K0008QG0R002YE3MMD.
//
// Usage:
//   bun src/Core.TypeScript/ace/ace.ts list [--store <path>] [--json]
//   bun src/Core.TypeScript/ace/ace.ts install <url-or-path> [--allow-no-signature] [--print-resolution] [--frozen|--locked] [--lockfile <path>]
//   bun src/Core.TypeScript/ace/ace.ts update <url-or-path> [--lockfile <path>] [--allow-no-signature]
//   bun src/Core.TypeScript/ace/ace.ts verify <hash>
//   bun src/Core.TypeScript/ace/ace.ts keygen [--out <prefix>]
//   bun src/Core.TypeScript/ace/ace.ts sign <pkg> --key <priv.key> [--out <file>]
//   bun src/Core.TypeScript/ace/ace.ts trust add <pub-file-or-b64> [--label <name>]
//   bun src/Core.TypeScript/ace/ace.ts trust list
//   bun src/Core.TypeScript/ace/ace.ts registry add <name> <version> <url> [--hash <h>]
//   bun src/Core.TypeScript/ace/ace.ts registry list
//   bun src/Core.TypeScript/ace/ace.ts deps validate --graph <path>
//   bun src/Core.TypeScript/ace/ace.ts deps resolve --graph <path> [--out-dir <dir>] [--output-engine flux|argocd|both] [--charts-dir <dir>] [--namespace <ns>]
//
// Future commands (not yet implemented): remove, inspect.

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicKey, createPrivateKey } from "node:crypto";
import {
  defaultStorePath,
  listInstalled,
  installPackage,
  contentHash,
  loadTrustStore,
  addTrustedKey,
  listTrustedKeys,
  validatePackagePaths,
  addRegistryEntry,
  listRegistry,
  writeRegistryRemote,
  removeRegistryRemote,
  readRegistriesConfig,
  type AcePackage,
} from "./store.ts";
import { generateKeypair, signManifest, verifySignature, keyId, publicKeyInfoFromPrivatePem } from "./signing.ts";
import { verifyIndexSignature, signIndex } from "./index-signature.ts";
import { authorizedCapabilities, capabilityPermitted, validateCapabilities, INSTALL_TIME_VS_RUNTIME } from "./capability-manifest.ts";
import type { RevocationMap } from "./signing.ts";
import type { IndexSignableContent } from "./index-signature.ts";
import { applyRevoke, applyQuarantine, applyUnquarantine } from "./registry-revoke.ts";
import { resolve } from "./resolve.ts";
import { safePackageHash } from "./package-hash.ts";
import {
  buildLockfile,
  serializeLockfile,
  parseLockfile,
  verifyRootMatchesLock,
  lockfilesEqual,
  buildLeafLockfile,
} from "./lockfile.ts";
import { solve } from "./solver.ts";

function isValidDepEdge(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const d = e as Record<string, unknown>;
  if (typeof d.name !== "string" || typeof d.version !== "string") return false;
  if (d.kind === "registry") return true;
  if (d.kind === "inline") return typeof d.url === "string" && typeof d.package_hash === "string";
  return false;
}
import { buildIndexDoc, nextSequence } from "./registry-publish.ts";
import { loadRegistries, parseIndex } from "./registry-remote.ts";
import type { IndexDoc } from "./registry-remote.ts";
import { resolve as toAbsolutePath, join } from "node:path";
import {
  parseYaml,
  stringifyYaml,
  resolveGraph,
  generateFlux,
  generateArgoCD,
  getResolvedVersion,
  getMigrationPhase,
  checkRollbackSafety,
  generateMigrationRunbook,
  type AppDependencyGraphSpec,
  type UpgradeScheduleSpec,
} from "./deps.ts";

interface ListArgs {
  readonly command: "list";
  readonly storePath: string;
  readonly json: boolean;
}

interface HelpArgs {
  readonly command: "help";
}

interface InstallArgs {
  readonly command: "install";
  readonly source: string;
  readonly storePath: string;
  readonly allowNoSignature: boolean;
  readonly allowQuarantined?: boolean;
  readonly printResolution?: boolean;
  readonly frozen: boolean;
  readonly locked: boolean;
  readonly lockfile: string;
  readonly offline?: boolean;
}

interface VerifyArgs {
  readonly command: "verify";
  readonly hash: string;
  readonly storePath: string;
  /** Assert the installed package is authorized for each of these; refuse if not. */
  readonly requireCapabilities: readonly string[];
  /** Refuse an installed-but-unsigned package instead of reporting it as unverified. */
  readonly requireSignature: boolean;
}

interface KeygenArgs {
  readonly command: "keygen";
  readonly outPrefix: string;
}

interface SignArgs {
  readonly command: "sign";
  readonly pkgPath: string;
  readonly keyPath: string;
  readonly outPath?: string;
}

interface TrustArgs {
  readonly command: "trust";
  readonly sub: "add" | "list";
  readonly arg?: string;
  readonly label?: string;
}

interface UpdateArgs {
  readonly command: "update";
  readonly source: string;
  readonly lockfile: string;
  readonly allowNoSignature: boolean;
  readonly offline?: boolean;
}

interface RegistryArgs {
  readonly command: "registry";
  readonly sub:
    | "list"
    | "add"
    | "remote-add"
    | "remote-list"
    | "remote-rm"
    | "publish"
    | "revoke"
    | "quarantine"
    | "unquarantine";
  readonly regName?: string;
  readonly regVersion?: string;
  readonly regUrl?: string;
  readonly regHash?: string;
  readonly remoteUrl?: string;
  readonly remoteKey?: string;
  readonly remoteMaxStaleness?: number;
  readonly pubPackagesDir?: string;
  readonly pubBaseUrl?: string;
  readonly pubKeyPath?: string;
  readonly pubOut?: string;
  readonly pubSequence?: number;
  readonly revName?: string;
  readonly revVersion?: string;
  readonly revReason?: string;
}

interface DepsArgs {
  readonly command: "deps";
  readonly sub: "validate" | "resolve" | "query" | "evaluate-schedule";
  readonly graphPath: string;
  readonly outDir?: string;
  readonly outputEngine: "flux" | "argocd" | "both";
  readonly chartsDir?: string;
  readonly namespace: string;
  readonly asOf?: string;
  readonly duringMigration?: string;
  readonly rollbackWindow?: string;
  readonly schedulePath?: string;
}

type ParsedArgs =
  | ListArgs
  | HelpArgs
  | InstallArgs
  | VerifyArgs
  | KeygenArgs
  | SignArgs
  | TrustArgs
  | RegistryArgs
  | UpdateArgs
  | DepsArgs;

interface ArgError {
  readonly error: string;
}

/** Integrity preflight over a resolved graph: per-node content_hash, path-safety, and
 *  store-key (content_hash -> package_hash) collision. Returns null on success, or an
 *  error message. Shared by `install` (before extract) and `update` (before lock write). */
function preflightGraph(order: AcePackage[]): string | null {
  const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
  for (const node of order) {
    const fh = contentHash(new TextEncoder().encode(JSON.stringify(node.files)));
    if (fh !== node.manifest.content_hash) return `bad-content-hash in ${node.manifest.name}`;
    const unsafe = validatePackagePaths(node);
    if (unsafe !== null) return `unsafe file path in ${node.manifest.name}: ${unsafe}`;
    const phr = safePackageHash(node);
    if (!phr.ok) return `invalid-package in ${node.manifest.name}: ${phr.reason}`;
    const ph = phr.hash;
    const prior = byStoreKey.get(node.manifest.content_hash);
    if (prior !== undefined && prior !== ph)
      return `store-collision — ${node.manifest.name} shares a content_hash store key with a different package`;
    byStoreKey.set(node.manifest.content_hash, ph);
  }
  return null;
}

export function parseArgs(argv: readonly string[]): ParsedArgs | ArgError {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { command: "help" };
  }

  if (command === "keygen") {
    let outPrefix = "ace-key";
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === "--out" || argv[i] === "-o") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--out requires a prefix argument" };
        outPrefix = next;
        i++;
      } else {
        return { error: `Unknown option for keygen: ${argv[i]}` };
      }
    }
    return { command: "keygen", outPrefix };
  }

  if (command === "sign") {
    const pkgPath = argv[1];
    if (!pkgPath || pkgPath.startsWith("-")) return { error: "sign requires a <pkg-path> argument" };
    let keyPath: string | undefined;
    let outPath: string | undefined;
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === "--key") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--key requires a path argument" };
        keyPath = next;
        i++;
      } else if (argv[i] === "--out" || argv[i] === "-o") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--out requires a path argument" };
        outPath = next;
        i++;
      } else {
        return { error: `Unknown option for sign: ${argv[i]}` };
      }
    }
    if (!keyPath) return { error: "sign requires --key <priv.key>" };
    const result: SignArgs = { command: "sign", pkgPath, keyPath };
    if (outPath !== undefined) return { ...result, outPath };
    return result;
  }

  if (command === "trust") {
    const sub = argv[1];
    if (!sub) return { error: "trust requires a subcommand: add | list" };
    if (sub === "list") return { command: "trust", sub: "list" };
    if (sub === "add") {
      const arg = argv[2];
      if (!arg || arg.startsWith("-")) return { error: "trust add requires a <pubkey-file-or-b64> argument" };
      let label: string | undefined;
      for (let i = 3; i < argv.length; i++) {
        if (argv[i] === "--label") {
          const next = argv[i + 1];
          if (!next || next.startsWith("-")) return { error: "--label requires a name argument" };
          label = next;
          i++;
        } else {
          return { error: `Unknown option for trust add: ${argv[i]}` };
        }
      }
      const result: TrustArgs = { command: "trust", sub: "add", arg };
      if (label !== undefined) return { ...result, label };
      return result;
    }
    return { error: `Unknown trust subcommand: ${sub}` };
  }

  if (command === "registry") {
    const sub = argv[1];
    if (sub === "list") return { command: "registry", sub: "list" };
    if (sub === "add") {
      const name = argv[2],
        version = argv[3],
        url = argv[4];
      if (!name || !version || !url || name.startsWith("-") || version.startsWith("-") || url.startsWith("-")) {
        return { error: "registry add requires <name> <version> <url>" };
      }
      let hash: string | undefined;
      for (let i = 5; i < argv.length; i++) {
        if (argv[i] === "--hash") {
          hash = argv[++i];
          if (!hash || hash.startsWith("-")) return { error: "--hash requires a value" };
        } else return { error: `Unknown option for registry add: ${argv[i]}` };
      }
      const result: RegistryArgs = { command: "registry", sub: "add", regName: name, regVersion: version, regUrl: url };
      if (hash !== undefined) return { ...result, regHash: hash };
      return result;
    }
    if (sub === "remote") {
      const action = argv[2];
      if (action === "list") return { command: "registry", sub: "remote-list" };
      if (action === "rm") {
        const url = argv[3];
        if (!url || url.startsWith("-")) return { error: "registry remote rm requires <url>" };
        return { command: "registry", sub: "remote-rm", remoteUrl: url };
      }
      if (action === "add") {
        const url = argv[3];
        if (!url || url.startsWith("-")) return { error: "registry remote add requires <url> --key <keyid>" };
        let key: string | undefined;
        let msd: number | undefined;
        for (let i = 4; i < argv.length; i++) {
          if (argv[i] === "--key") {
            key = argv[++i];
            if (!key || key.startsWith("-")) return { error: "--key requires a value" };
          } else if (argv[i] === "--max-staleness-days") {
            const v = argv[++i];
            if (!v || v.startsWith("-")) return { error: "--max-staleness-days requires a value" };
            msd = Number(v);
            if (!Number.isInteger(msd) || msd <= 0) return { error: "--max-staleness-days must be a positive integer" };
          } else return { error: `Unknown option for registry remote add: ${argv[i]}` };
        }
        if (!key) return { error: "registry remote add requires --key <keyid>" };
        const r: RegistryArgs = { command: "registry", sub: "remote-add", remoteUrl: url, remoteKey: key };
        return msd !== undefined ? { ...r, remoteMaxStaleness: msd } : r;
      }
      return { error: "registry remote requires 'add', 'list', or 'rm'" };
    }
    if (sub === "publish") {
      let dir: string | undefined, base: string | undefined, key: string | undefined, out: string | undefined;
      let seq: number | undefined;
      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--packages") {
          dir = argv[++i];
          if (!dir || dir.startsWith("-")) return { error: "--packages requires a value" };
        } else if (argv[i] === "--base-url") {
          base = argv[++i];
          if (!base || base.startsWith("-")) return { error: "--base-url requires a value" };
        } else if (argv[i] === "--key") {
          key = argv[++i];
          if (!key || key.startsWith("-")) return { error: "--key requires a value" };
        } else if (argv[i] === "--out") {
          out = argv[++i];
          if (!out || out.startsWith("-")) return { error: "--out requires a value" };
        } else if (argv[i] === "--sequence") {
          const sv = argv[++i];
          const n = Number(sv);
          if (!sv || !Number.isInteger(n) || n <= 0) return { error: "--sequence requires a positive integer" };
          seq = n;
        } else return { error: `Unknown option for registry publish: ${argv[i]}` };
      }
      if (!dir) return { error: "registry publish requires --packages <dir>" };
      if (!base) return { error: "registry publish requires --base-url <url>" };
      if (!key) return { error: "registry publish requires --key <pem-path>" };
      let r: RegistryArgs = {
        command: "registry",
        sub: "publish",
        pubPackagesDir: dir,
        pubBaseUrl: base,
        pubKeyPath: key,
      };
      if (out !== undefined) r = { ...r, pubOut: out };
      if (seq !== undefined) r = { ...r, pubSequence: seq };
      return r;
    }
    if (sub === "revoke" || sub === "quarantine" || sub === "unquarantine") {
      const spec = argv[2];
      if (!spec || spec.startsWith("-")) return { error: `registry ${sub} requires <name>@<version>` };
      // split on the LAST '@' so scoped names (rare) survive; both parts must be non-empty.
      const at = spec.lastIndexOf("@");
      if (at <= 0 || at === spec.length - 1)
        return { error: `registry ${sub}: <name>@<version> must have a non-empty name and version` };
      const name = spec.slice(0, at),
        version = spec.slice(at + 1);
      let key: string | undefined, out: string | undefined, reason: string | undefined;
      for (let i = 3; i < argv.length; i++) {
        if (argv[i] === "--key") {
          key = argv[++i];
          if (!key || key.startsWith("-")) return { error: "--key requires a value" };
        } else if (argv[i] === "--out") {
          out = argv[++i];
          if (!out || out.startsWith("-")) return { error: "--out requires a value" };
        } else if (argv[i] === "--reason") {
          if (sub === "unquarantine") return { error: "registry unquarantine does not take --reason" };
          reason = argv[++i];
          if (reason === undefined || reason.startsWith("-")) return { error: "--reason requires a value" };
        } else return { error: `Unknown option for registry ${sub}: ${argv[i]}` };
      }
      if (!key) return { error: `registry ${sub} requires --key <pem-path>` };
      let r: RegistryArgs = { command: "registry", sub, revName: name, revVersion: version, pubKeyPath: key };
      if (out !== undefined) r = { ...r, pubOut: out };
      if (reason !== undefined) r = { ...r, revReason: reason };
      return r;
    }
    return { error: "registry requires 'add', 'list', 'remote', 'publish', 'revoke', 'quarantine', or 'unquarantine'" };
  }

  if (command === "update") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "update requires a <url-or-path> argument" };
    let lockfilePath = "ace.lock";
    let allowNoSignature = false;
    let offline = false;
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === "--lockfile") {
        const next = argv[++i];
        if (!next || next.startsWith("-")) return { error: "--lockfile requires a path argument" };
        lockfilePath = next;
      } else if (argv[i] === "--allow-no-signature") {
        allowNoSignature = true;
      } else if (argv[i] === "--offline") {
        offline = true;
      } else {
        return { error: `Unknown option for update: ${argv[i]}` };
      }
    }
    const updateResult: UpdateArgs = { command: "update", source, lockfile: lockfilePath, allowNoSignature };
    return offline ? { ...updateResult, offline: true } : updateResult;
  }

  if (command === "install") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "install requires a <url-or-path> argument" };
    let storePath = defaultStorePath();
    let allowNoSignature = false;
    let printResolution = false;
    let allowQuarantined = false;
    let frozen = false;
    let locked = false;
    let offline = false;
    let lockfilePath = "ace.lock";
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === "--store" || argv[i] === "-s") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--store requires a path argument" };
        storePath = next;
        i++;
      } else if (argv[i] === "--allow-no-signature") {
        allowNoSignature = true;
      } else if (argv[i] === "--allow-quarantined") {
        allowQuarantined = true;
      } else if (argv[i] === "--print-resolution") {
        printResolution = true;
      } else if (argv[i] === "--frozen") {
        frozen = true;
      } else if (argv[i] === "--locked") {
        locked = true;
      } else if (argv[i] === "--offline") {
        offline = true;
      } else if (argv[i] === "--lockfile") {
        const next = argv[++i];
        if (!next || next.startsWith("-")) return { error: "--lockfile requires a path argument" };
        lockfilePath = next;
      } else {
        return { error: `Unknown option for install: ${argv[i]}` };
      }
    }
    if (locked && frozen) return { error: "--locked and --frozen are mutually exclusive" };
    const baseResult: InstallArgs = {
      command: "install",
      source,
      storePath,
      allowNoSignature,
      frozen,
      locked,
      lockfile: lockfilePath,
      ...(allowQuarantined ? { allowQuarantined: true } : {}),
      ...(offline ? { offline: true } : {}),
    };
    if (printResolution) return { ...baseResult, printResolution: true };
    return baseResult;
  }

  if (command === "verify") {
    const hash = argv[1];
    if (!hash || hash.startsWith("-")) return { error: "verify requires a <hash> argument" };
    const requireCapabilities: string[] = [];
    let requireSignature = false;
    for (let i = 2; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--require-signature") { requireSignature = true; continue; }
      if (a === "--capability") {
        const v = argv[++i];
        if (v === undefined || v.startsWith("-")) return { error: "--capability requires a <scheme>:<resource> value" };
        requireCapabilities.push(v);
        continue;
      }
      if (a !== undefined && a.startsWith("--capability=")) {
        requireCapabilities.push(a.slice("--capability=".length));
        continue;
      }
      return { error: `verify: unknown flag ${a}` };
    }
    return { command: "verify", hash, storePath: defaultStorePath(), requireCapabilities, requireSignature };
  }

  if (command === "list") {
    let storePath = defaultStorePath();
    let json = false;

    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--store" || arg === "-s") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) {
          return { error: "--store requires a path argument" };
        }
        storePath = next;
        i++;
      } else if (arg === "--json") {
        json = true;
      } else {
        return { error: `Unknown option for list: ${arg}` };
      }
    }

    return { command: "list", storePath, json };
  }

  if (command === "deps") {
    const sub = argv[1];
    if (sub !== "validate" && sub !== "resolve" && sub !== "query" && sub !== "evaluate-schedule") {
      return { error: "deps requires subcommand: validate | resolve | query | evaluate-schedule" };
    }

    let graphPath: string | undefined;
    let outDir: string | undefined;
    let outputEngine: DepsArgs["outputEngine"] = "both";
    let chartsDir: string | undefined;
    let namespace = "default";
    let asOf: string | undefined;
    let duringMigration: string | undefined;
    let rollbackWindow: string | undefined;
    let schedulePath: string | undefined;

    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--graph" || arg === "-g") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--graph requires a path argument" };
        graphPath = next;
        i++;
      } else if (arg === "--out-dir" || arg === "-o") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--out-dir requires a path argument" };
        outDir = next;
        i++;
      } else if (arg === "--output-engine") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--output-engine requires flux | argocd | both" };
        if (next !== "flux" && next !== "argocd" && next !== "both") {
          return { error: `--output-engine must be flux, argocd, or both (got ${next})` };
        }
        outputEngine = next;
        i++;
      } else if (arg === "--charts-dir") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--charts-dir requires a path argument" };
        chartsDir = next;
        i++;
      } else if (arg === "--namespace" || arg === "-n") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--namespace requires a name argument" };
        namespace = next;
        i++;
      } else if (arg === "--as-of") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--as-of requires a date/time argument" };
        asOf = next;
        i++;
      } else if (arg === "--during-migration") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--during-migration requires a name argument" };
        duringMigration = next;
        i++;
      } else if (arg === "--rollback-window") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--rollback-window requires a release/chart name" };
        rollbackWindow = next;
        i++;
      } else if (arg === "--schedule") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--schedule requires a path argument" };
        schedulePath = next;
        i++;
      } else {
        return { error: `Unknown option for deps ${sub}: ${arg}` };
      }
    }

    if (!graphPath) return { error: "deps requires --graph <path>" };
    if (sub === "resolve" && !outDir) return { error: "deps resolve requires --out-dir <dir>" };
    if (sub === "evaluate-schedule" && !outDir) return { error: "deps evaluate-schedule requires --out-dir <dir>" };
    if (sub === "evaluate-schedule" && !schedulePath)
      return { error: "deps evaluate-schedule requires --schedule <path>" };

    return {
      command: "deps",
      sub,
      graphPath,
      outputEngine,
      namespace,
      ...(outDir === undefined ? {} : { outDir }),
      ...(chartsDir === undefined ? {} : { chartsDir }),
      ...(asOf === undefined ? {} : { asOf }),
      ...(duringMigration === undefined ? {} : { duringMigration }),
      ...(rollbackWindow === undefined ? {} : { rollbackWindow }),
      ...(schedulePath === undefined ? {} : { schedulePath }),
    };
  }

  const known = ["remove", "inspect"];
  if (known.includes(command)) {
    return { error: `'${command}' is not yet implemented` };
  }

  return { error: `Unknown command: ${command}` };
}

function printUsage(): void {
  const text = `Ace DLC Package Manager

Usage:
  ace list [--store <path>] [--json]             List installed DLC packages
  ace install <url-or-path> [--allow-no-signature] [--allow-quarantined] [--print-resolution] [--frozen|--locked] [--lockfile <path>] [--offline]
                                                   Download/read a package, verify integrity+authenticity, install
                                                   --allow-no-signature only installs packages with NO signature; it never bypasses a present (bad or untrusted) signature
                                                   --print-resolution prints the solved name@version graph before installing
                                                   writes ./ace.lock on a normal install; --frozen installs exactly the locked graph (registry-independent)
                                                   --locked asserts the committed lock is up to date vs a fresh solve, else refuses (CI guard; mutually exclusive with --frozen)
                                                   --lockfile <path> overrides the default lockfile path (default: ace.lock)
  ace update <url-or-path> [--lockfile <path>] [--allow-no-signature] [--offline]
                                                   Re-solve the dependency graph and rewrite the lockfile; installs nothing (lock-only)
  ace verify <hash>                              Re-verify an installed package's signature + report capabilities
       [--capability <scheme:resource>]          Refuse unless the package is authorized for it (repeatable)
       [--require-signature]                     Refuse an unsigned package instead of reporting it
  ace keygen [--out <prefix>]                    Generate an Ed25519 keypair (writes <prefix>.key + <prefix>.pub)
  ace sign <pkg> --key <priv.key> [--out <file>] Sign a package manifest with an Ed25519 private key
  ace trust add <pub-file-or-b64> [--label <name>] Trust an Ed25519 public key
  ace trust list                                 List all trusted keys
  ace registry add <name> <version> <url> [--hash <h>] Register a package in the local registry
  ace registry list                              List all registry entries
  ace registry publish --packages <dir>[,<dir>...] --base-url <url> --key <pem> [--out <path>] [--sequence <n>] Build + sign an index from one or more dirs of packages
  ace registry revoke <name>@<version> [--reason <s>] --key <pem> [--out <path>] Mark a version revoked (permanent hard-refuse) in the signed index
  ace registry quarantine <name>@<version> [--reason <s>] --key <pem> [--out <path>] Mark a version quarantined (soft-refuse; --allow-quarantined overrides)
  ace registry unquarantine <name>@<version> --key <pem> [--out <path>] Release a quarantined version
  ace registry remote add <url> --key <keyid> [--max-staleness-days <n>] Add a signed remote registry
  ace registry remote list                       List configured remote registries
  ace registry remote rm <url>                   Remove a configured remote registry
  ace deps validate --graph <path> [--charts-dir <dir>]  Validate an AppDependencyGraph (cycle + contract checks)
  ace deps resolve --graph <path> --out-dir <dir> [--output-engine flux|argocd|both] [--charts-dir <dir>] [--namespace <ns>] [--as-of <date>]
                                                   Resolve graph and write Flux/ArgoCD manifests at the specified date
  ace deps query --graph <path> [--as-of <date>] [--during-migration <name>] [--rollback-window <release>] [--schedule <path>] [--charts-dir <dir>]
                                                   Query temporal graph state and run rollback safety audits
  ace deps evaluate-schedule --graph <path> --schedule <path> --out-dir <dir> [--as-of <date>]
                                                   Evaluate scheduled upgrades and generate migration runbooks
  ace help                                       Show this help

Future commands (not yet implemented):
  ace remove <hash>                              Uninstall a DLC
  ace inspect <hash>                             Show manifest without installing`;
  console.log(text);
}

function loadDependencyGraph(graphPath: string): AppDependencyGraphSpec {
  const abs = toAbsolutePath(graphPath);
  if (!existsSync(abs)) throw new Error(`graph file not found: ${graphPath}`);
  const doc = parseYaml(readFileSync(abs, "utf8"));
  if (typeof doc !== "object" || doc === null) throw new Error("graph must be a YAML mapping");
  const g = doc as Record<string, unknown>;
  if (g.kind !== "AppDependencyGraph") throw new Error(`expected kind AppDependencyGraph (got ${String(g.kind)})`);
  if (typeof g.apiVersion !== "string") throw new Error("graph missing apiVersion");
  if (typeof g.metadata !== "object" || g.metadata === null) throw new Error("graph missing metadata");
  const meta = g.metadata as Record<string, unknown>;
  if (typeof meta.name !== "string") throw new Error("graph metadata.name must be a string");
  if (typeof g.spec !== "object" || g.spec === null) throw new Error("graph missing spec");
  const spec = g.spec as Record<string, unknown>;
  if (!Array.isArray(spec.dependsOn)) throw new Error("graph spec.dependsOn must be an array");
  return doc as AppDependencyGraphSpec;
}

function writeManifestDir(outDir: string, files: Record<string, unknown>): void {
  mkdirSync(outDir, { recursive: true });
  for (const [filename, manifest] of Object.entries(files)) {
    writeFileSync(join(outDir, filename), stringifyYaml(manifest));
  }
}

/** SLICE 7 lockfile re-check: best-effort load the registry marks and refuse any pinned
 *  name@version that is revoked (always) or quarantined (unless allowQuarantined; warn when
 *  allowed). Best-effort means an unreachable/empty registry yields no marks and no refusal —
 *  the --frozen install stays registry-independent (it only gains a security veto when a
 *  reachable trusted registry has marked a locked pin). Returns an error string or null. */
async function checkLockedMarks(
  pins: ReadonlyArray<{ name: string; version: string }>,
  allowQuarantined: boolean,
  offline: boolean,
): Promise<string | null> {
  let revoked: RevocationMap;
  let quarantined: RevocationMap;
  try {
    const loaded = await loadRegistries({ trustStore: loadTrustStore(), offline });
    revoked = loaded.revoked;
    quarantined = loaded.quarantined;
  } catch {
    return null;
  } // marks unavailable → no veto (preserve frozen registry-independence)
  for (const pin of pins) {
    if (revoked[pin.name]?.[pin.version] !== undefined) {
      const r = revoked[pin.name]![pin.version]!;
      return `${pin.name}@${pin.version} is revoked${r.reason ? ": " + r.reason : ""} (revocation overrides the lockfile)`;
    }
    if (quarantined[pin.name]?.[pin.version] !== undefined) {
      if (!allowQuarantined) {
        const q = quarantined[pin.name]![pin.version]!;
        return `${pin.name}@${pin.version} is quarantined${q.reason ? ": " + q.reason : ""} (use --allow-quarantined)`;
      }
      console.error(`ace: WARNING: installing quarantined ${pin.name}@${pin.version} (--allow-quarantined).`);
    }
  }
  return null;
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if ("error" in parsed) {
    console.error(`ace: ${parsed.error}`);
    return 64;
  }

  if (parsed.command === "help") {
    printUsage();
    return 0;
  }

  // keygen — exclusive-create the private key so secret bytes never land in a
  // pre-existing (possibly permissive) file, then belt-and-suspenders chmodSync.
  // Refuse with exit 1 if <prefix>.key already exists (never silently clobber).
  if (parsed.command === "keygen") {
    const kp = generateKeypair();
    const keyPath = `${parsed.outPrefix}.key`;
    try {
      // flag "wx": exclusive create — fails with EEXIST if the file already exists.
      // mode 0o600: applied on create (POSIX-guaranteed; advisory on Windows).
      writeFileSync(keyPath, kp.privatePem, { mode: 0o600, flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") {
        console.error(
          `ace: keygen refused: ${keyPath} already exists — remove it or choose a different --out (refusing to overwrite a private key)`,
        );
        return 1;
      }
      throw e;
    }
    // Belt-and-suspenders: force 0o600 even if the platform ignored mode-on-create.
    chmodSync(keyPath, 0o600);
    // Only write .pub after .key exclusive-create succeeds.
    writeFileSync(
      `${parsed.outPrefix}.pub`,
      JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }, null, 2),
    );
    console.log(
      `ace: wrote ${parsed.outPrefix}.key (0600) + ${parsed.outPrefix}.pub  key_id ${kp.keyId} — share ${parsed.outPrefix}.pub with consumers; keep ${parsed.outPrefix}.key private`,
    );
    return 0;
  }

  // sign — recompute content_hash with the SLICE-2 contentHash (never sort files); refuse on mismatch
  if (parsed.command === "sign") {
    let pkg: AcePackage;
    try {
      pkg = JSON.parse(readFileSync(parsed.pkgPath, "utf8")) as AcePackage;
    } catch {
      console.error("ace: package is not valid JSON");
      return 65;
    }
    const recomputed = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    if (recomputed !== pkg.manifest.content_hash) {
      console.error(
        `ace: sign refused: package content changed since its content_hash was computed — rebuild the package, then sign`,
      );
      return 1;
    }
    let priv: string;
    try {
      priv = readFileSync(parsed.keyPath, "utf8");
    } catch {
      console.error(`ace: cannot read key ${parsed.keyPath}`);
      return 1;
    }
    const signature = signManifest(pkg.manifest, priv);
    const signed = { ...pkg, manifest: { ...pkg.manifest, signature } };
    const out = JSON.stringify(signed, null, 2);
    if (parsed.outPath) {
      writeFileSync(parsed.outPath, out);
      console.log(`ace: signed -> ${parsed.outPath} (key_id ${signature.key_id})`);
    } else {
      process.stderr.write(
        `ace: signed (key_id ${signature.key_id}) — redirect stdout to a file, or use --out <file>\n`,
      );
      console.log(out);
    }
    return 0;
  }

  // trust
  if (parsed.command === "trust") {
    if (parsed.sub === "list") {
      const rows = listTrustedKeys();
      if (rows.length === 0) {
        console.log("No trusted keys. (add one: ace trust add <pub>)");
        return 0;
      }
      for (const r of rows) console.log(`  ${r.key_id}  [${r.source}]${r.label ? "  " + r.label : ""}`);
      return 0;
    }
    // add: arg is a .pub file path OR a raw base64 SPKI
    if (!parsed.arg) {
      console.error("ace: trust add requires a <pubkey-file-or-b64>");
      return 64;
    }
    let publicB64: string;
    let inputForm: string;
    try {
      const raw = readFileSync(parsed.arg, "utf8").trim();
      publicB64 = raw.startsWith("{") ? (JSON.parse(raw).public_key as string) : raw;
      inputForm = `from file: ${parsed.arg}`;
    } catch {
      publicB64 = parsed.arg; // not a file -> treat as raw b64
      inputForm = "from b64";
    }
    // Validate the public key before persisting: it must decode from base64,
    // parse as an SPKI DER, AND have asymmetricKeyType === "ed25519".
    // createPublicKey accepts RSA/EC SPKI too; a non-Ed25519 key can never
    // verify any Ace package signature and must be rejected early.
    let canonicalB64: string;
    try {
      const der = Buffer.from(publicB64, "base64");
      if (der.length < 32) throw new Error("too short");
      const pub = createPublicKey({ key: der, format: "der", type: "spki" });
      if (pub.asymmetricKeyType !== "ed25519") {
        console.error(
          `ace: trust add: not an Ed25519 public key (got ${pub.asymmetricKeyType ?? "unknown"}) — only Ed25519 keys are accepted`,
        );
        return 65;
      }
      // Normalize to the canonical SPKI: createPublicKey accepts an SPKI with trailing
      // bytes but re-exports the canonical 44-byte form. Compute key_id + store from the
      // canonical bytes so trust-add's key_id matches what signManifest/verify derive
      // (they hash the re-exported SPKI); a padded input would otherwise be stored under a
      // key_id no signature ever presents -> that publisher's packages never authenticate.
      canonicalB64 = (pub.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
    } catch {
      console.error(
        "ace: trust add: invalid Ed25519 public key (not a valid SPKI DER) -- check the .pub file or b64 string",
      );
      return 65;
    }
    const kid = keyId(canonicalB64);
    const entry: { key_id: string; public_key: string; label?: string } = { key_id: kid, public_key: canonicalB64 };
    if (parsed.label !== undefined) entry.label = parsed.label;
    const res = addTrustedKey(entry);
    console.log(
      res.added
        ? `ace: trusted ${kid}${parsed.label ? " (" + parsed.label + ")" : ""} [${inputForm}]`
        : `ace: ${kid} already trusted`,
    );
    return 0;
  }

  // registry
  if (parsed.command === "registry") {
    if (parsed.sub === "remote-list") {
      const remotes = readRegistriesConfig().remotes;
      if (remotes.length === 0) {
        console.log("No remote registries. (add: ace registry remote add <url> --key <keyid>)");
        return 0;
      }
      for (const r of remotes)
        console.log(
          `  ${r.url}  key=${r.key_id}${r.max_staleness_days ? `  max-staleness=${r.max_staleness_days}d` : ""}`,
        );
      return 0;
    }
    if (parsed.sub === "remote-rm") {
      const { removed } = removeRegistryRemote(parsed.remoteUrl!);
      console.log(removed ? `ace: removed remote ${parsed.remoteUrl}` : `ace: no such remote ${parsed.remoteUrl}`);
      return 0;
    }
    if (parsed.sub === "remote-add") {
      const entry =
        parsed.remoteMaxStaleness !== undefined
          ? { url: parsed.remoteUrl!, key_id: parsed.remoteKey!, max_staleness_days: parsed.remoteMaxStaleness }
          : { url: parsed.remoteUrl!, key_id: parsed.remoteKey! };
      const { added, updated } = writeRegistryRemote(entry);
      console.log(`ace: ${updated ? "updated" : added ? "added" : "noop"} remote ${parsed.remoteUrl}`);
      return 0;
    }
    if (parsed.sub === "list") {
      const rows = listRegistry();
      if (rows.length === 0) {
        console.log("No registry entries. (add one: ace registry add <name> <version> <url>)");
        return 0;
      }
      for (const r of rows) console.log(`  ${r.name}@${r.version}  ${r.url}  [${r.source}]`);
      return 0;
    }
    if (parsed.sub === "publish") {
      let pem: string;
      try {
        pem = readFileSync(parsed.pubKeyPath!, "utf8");
      } catch (e) {
        console.error(`ace: publish: cannot read key ${parsed.pubKeyPath}: ${(e as Error).message}`);
        return 1;
      }
      // P2-A: signIndex uses crypto.sign(null, ...) which only supports Ed25519/Ed448 — an RSA/EC key
      // THROWS rather than signing. Pre-check here to fail fast with a clear error before building the index.
      try {
        if (createPrivateKey(pem).asymmetricKeyType !== "ed25519") {
          console.error("ace: publish refused: --key must be an ed25519 private key");
          return 1;
        }
      } catch (e) {
        console.error(`ace: publish refused: invalid private key: ${(e as Error).message}`);
        return 1;
      }
      const dirs = parsed
        .pubPackagesDir!.split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (dirs.length === 0) {
        console.error("ace: publish refused: --packages requires at least one directory");
        return 1;
      }
      const packages: { pkg: AcePackage; url?: string }[] = [];
      for (const d of dirs) {
        let entries: string[];
        try {
          entries = readdirSync(d).filter((f) => f.endsWith(".json"));
        } catch (e) {
          console.error(`ace: publish: cannot read dir ${d}: ${(e as Error).message}`);
          return 1;
        }
        for (const f of entries) {
          const full = join(d, f);
          let raw: string;
          try {
            raw = readFileSync(full, "utf8");
          } catch {
            console.error(`ace: publish: skip unreadable ${f}`);
            continue;
          }
          let obj: unknown;
          try {
            obj = JSON.parse(raw);
          } catch {
            console.error(`ace: publish: skip non-JSON ${f}`);
            continue;
          }
          if (
            typeof obj !== "object" ||
            obj === null ||
            typeof (obj as AcePackage).manifest !== "object" ||
            (obj as AcePackage).manifest === null ||
            typeof (obj as AcePackage).manifest.name !== "string" ||
            typeof (obj as AcePackage).manifest.version !== "string" ||
            typeof (obj as AcePackage).files !== "object" ||
            (obj as AcePackage).files === null
          ) {
            console.error(`ace: publish: skip non-package ${f}`);
            continue;
          }
          // P2-C: a package whose content_hash is missing or does not match its files would be indexed
          // but fail the consumer's content-hash gate. Skip + warn (consistent with the non-package skip).
          if (typeof (obj as AcePackage).manifest.content_hash !== "string") {
            console.error(`ace: publish: skip ${f} — missing manifest.content_hash`);
            continue;
          }
          const fh = contentHash(new TextEncoder().encode(JSON.stringify((obj as AcePackage).files)));
          if (fh !== (obj as AcePackage).manifest.content_hash) {
            console.error(`ace: publish: skip ${f} — content_hash does not match files`);
            continue;
          }
          // Optional top-level url override (publish-only, outside the signed manifest). When present
          // it sets the consumer URL directly and relaxes the <name>-<version>.json filename guard for
          // this package. Must be a non-empty, absolute URL or the package is skipped.
          let urlOverride: string | undefined;
          const rawUrl = (obj as { url?: unknown }).url;
          if (rawUrl !== undefined) {
            if (typeof rawUrl !== "string" || rawUrl.length === 0) {
              console.error(`ace: publish: skip ${f} — url must be a non-empty string`);
              continue;
            }
            try {
              new URL(rawUrl);
            } catch {
              console.error(`ace: publish: skip ${f} — url is not an absolute URL: ${rawUrl}`);
              continue;
            }
            urlOverride = rawUrl;
          }
          // filename guard applies ONLY when there is no url override (the derived URL depends on the basename)
          if (urlOverride === undefined) {
            const expectedFile = `${(obj as AcePackage).manifest.name}-${(obj as AcePackage).manifest.version}.json`;
            if (f !== expectedFile) {
              console.error(
                `ace: publish: skip ${f} — filename must be ${expectedFile} to match its derived consumer URL`,
              );
              continue;
            }
          }
          const deps = (obj as AcePackage).manifest.dependencies;
          if (deps !== undefined && !Array.isArray(deps)) {
            console.error(`ace: publish: skip ${f} — manifest.dependencies must be an array`);
            continue;
          }
          // P2: every files value must be a string — installPackage's writeFileSync(dest, contents)
          // throws on non-string values, so a self-verified index could point at an un-installable
          // package. Skip + warn (consistent with the other scan skips).
          const fileVals = Object.values((obj as AcePackage).files as Record<string, unknown>);
          if (fileVals.some((v) => typeof v !== "string")) {
            console.error(`ace: publish: skip ${f} — every file value must be a string`);
            continue;
          }
          // P2: package name/version must be URL-safe — the derived consumer URL is
          // <base>/<name>-<version>.json, so a '#' or '?' (or path sep / control char) would break or
          // redirect the fetched URL. Applies in both cases (the package_hash store key is name-keyed).
          const nm = (obj as AcePackage).manifest.name;
          const ver = (obj as AcePackage).manifest.version;
          if (/[\x00-\x20#?%/\\]/.test(nm) || /[\x00-\x20#?%/\\]/.test(ver)) {
            console.error(`ace: publish: skip ${f} — name/version has a URL-unsafe character`);
            continue;
          }
          // P2: dependency edges must be well-formed (matching the consumer's AceDependency shape),
          // else a consumer resolve would break on a self-verified index.
          const depEdges = (obj as AcePackage).manifest.dependencies;
          if (Array.isArray(depEdges) && !depEdges.every(isValidDepEdge)) {
            console.error(`ace: publish: skip ${f} — malformed dependency edge`);
            continue;
          }
          // P2: reuse the consumer's path guard — a package with an unsafe files key (../ or absolute)
          // would index but be rejected/unsafe at install. Skip + warn.
          const unsafePath = validatePackagePaths(obj as AcePackage);
          if (unsafePath !== null) {
            console.error(`ace: publish: skip ${f} — unsafe file path: ${unsafePath}`);
            continue;
          }
          packages.push(
            urlOverride !== undefined ? { pkg: obj as AcePackage, url: urlOverride } : { pkg: obj as AcePackage },
          );
        }
      }
      if (packages.length === 0) {
        console.error(`ace: publish refused: no valid packages in ${dirs.join(", ")}`);
        return 1;
      }
      const outPath = parsed.pubOut ?? "index.json";
      let prev: IndexDoc | null = null;
      if (existsSync(outPath)) {
        let prevRaw: string;
        try {
          prevRaw = readFileSync(outPath, "utf8");
        } catch (e) {
          console.error(`ace: publish refused: cannot read existing ${outPath}: ${(e as Error).message}`);
          return 1;
        }
        const p = parseIndex(prevRaw);
        if ("error" in p) {
          console.error(
            `ace: publish refused: existing ${outPath} is not a valid index (${p.error}) — refusing to reset sequence (would look like a rollback to consumers); remove or fix it`,
          );
          return 1;
        }
        const prevInfo = publicKeyInfoFromPrivatePem(pem);
        const { signature: prevSig, ...prevContent } = p;
        const prevVerify = verifyIndexSignature(
          prevContent,
          prevSig,
          new Map([[prevInfo.keyId, { public_key: prevInfo.public_key }]]),
        );
        if (!prevVerify.ok) {
          console.error(
            `ace: publish refused: existing ${outPath} signature does not verify under --key (${prevVerify.reason}) — refusing to auto-bump from an untrusted index; fix or remove it`,
          );
          return 1;
        }
        prev = p;
      }
      const seq = parsed.pubSequence ?? nextSequence(prev);
      // Anti-rollback guard (defense-in-depth): unreachable while sequence is auto-bumped (+1),
      // but protects the deferred explicit --sequence flag from emitting a non-increasing index.
      if (prev && seq <= prev.sequence) {
        console.error(`ace: publish refused: sequence ${seq} <= prev ${prev.sequence}`);
        return 1;
      }
      let serialized: string;
      try {
        const doc = buildIndexDoc({
          packages,
          baseUrl: parsed.pubBaseUrl!,
          sequence: seq,
          issuedAt: new Date().toISOString(),
          privatePem: pem,
          ...(prev?.revoked ? { revoked: prev.revoked } : {}),
          ...(prev?.quarantined ? { quarantined: prev.quarantined } : {}),
        });
        if ("error" in doc) {
          console.error(`ace: publish refused: ${doc.error}`);
          return 1;
        }
        serialized = JSON.stringify(doc, null, 2);
        const reparsed = parseIndex(serialized);
        if ("error" in reparsed) {
          console.error(`ace: publish refused: self-verify parse failed: ${reparsed.error}`);
          return 1;
        }
        const info = publicKeyInfoFromPrivatePem(pem);
        const { signature, ...content } = doc;
        const sv = verifyIndexSignature(content, signature, new Map([[info.keyId, { public_key: info.public_key }]]));
        if (!sv.ok) {
          console.error(`ace: publish refused: self-verify signature failed: ${sv.reason}`);
          return 1;
        }
      } catch (e) {
        console.error(
          `ace: publish refused: signing failed (check --key is a valid Ed25519 PEM): ${(e as Error).message}`,
        );
        return 1;
      }
      try {
        writeFileSync(outPath, serialized);
      } catch (e) {
        console.error(`ace: publish failed: cannot write ${outPath}: ${(e as Error).message}`);
        return 1;
      }
      console.log(`ace: published ${packages.length} package(s) at sequence ${seq} → ${outPath}`);
      return 0;
    }
    if (parsed.sub === "revoke" || parsed.sub === "quarantine" || parsed.sub === "unquarantine") {
      const verb = parsed.sub;
      let pem: string;
      try {
        pem = readFileSync(parsed.pubKeyPath!, "utf8");
      } catch (e) {
        console.error(`ace: ${verb}: cannot read key ${parsed.pubKeyPath}: ${(e as Error).message}`);
        return 1;
      }
      try {
        if (createPrivateKey(pem).asymmetricKeyType !== "ed25519") {
          console.error(`ace: ${verb} refused: --key must be an ed25519 private key`);
          return 1;
        }
      } catch (e) {
        console.error(`ace: ${verb} refused: invalid private key: ${(e as Error).message}`);
        return 1;
      }
      const outPath = parsed.pubOut ?? "index.json";
      if (!existsSync(outPath)) {
        console.error(`ace: ${verb} refused: ${outPath} does not exist — cannot mark a version in a nonexistent index`);
        return 1;
      }
      let prevRaw: string;
      try {
        prevRaw = readFileSync(outPath, "utf8");
      } catch (e) {
        console.error(`ace: ${verb} refused: cannot read ${outPath}: ${(e as Error).message}`);
        return 1;
      }
      const p = parseIndex(prevRaw);
      if ("error" in p) {
        console.error(`ace: ${verb} refused: ${outPath} is not a valid index (${p.error}) — no silent reset`);
        return 1;
      }
      const prevInfo = publicKeyInfoFromPrivatePem(pem);
      const { signature: prevSig, ...prevContent } = p;
      const prevVerify = verifyIndexSignature(
        prevContent,
        prevSig,
        new Map([[prevInfo.keyId, { public_key: prevInfo.public_key }]]),
      );
      if (!prevVerify.ok) {
        console.error(
          `ace: ${verb} refused: ${outPath} signature does not verify under --key (${prevVerify.reason}) — not your index`,
        );
        return 1;
      }
      const name = parsed.revName!,
        version = parsed.revVersion!;
      const at = new Date().toISOString();
      let next: IndexSignableContent | { error: string };
      if (verb === "revoke") next = applyRevoke(prevContent, name, version, parsed.revReason, at);
      else if (verb === "quarantine") next = applyQuarantine(prevContent, name, version, parsed.revReason, at);
      else next = applyUnquarantine(prevContent, name, version, at);
      if ("error" in next) {
        console.error(`ace: ${verb} refused: ${next.error}`);
        return 1;
      }
      const seq = p.sequence + 1;
      const content: IndexSignableContent = { ...next, sequence: seq };
      let serialized: string;
      try {
        const sig = signIndex(content, pem);
        const doc = { ...content, signature: sig };
        serialized = JSON.stringify(doc, null, 2);
        const reparsed = parseIndex(serialized);
        if ("error" in reparsed) {
          console.error(`ace: ${verb} refused: self-verify parse failed: ${reparsed.error}`);
          return 1;
        }
        const sv = verifyIndexSignature(content, sig, new Map([[prevInfo.keyId, { public_key: prevInfo.public_key }]]));
        if (!sv.ok) {
          console.error(`ace: ${verb} refused: self-verify signature failed: ${sv.reason}`);
          return 1;
        }
      } catch (e) {
        console.error(`ace: ${verb} refused: signing failed: ${(e as Error).message}`);
        return 1;
      }
      try {
        writeFileSync(outPath, serialized);
      } catch (e) {
        console.error(`ace: ${verb} failed: cannot write ${outPath}: ${(e as Error).message}`);
        return 1;
      }
      const verbed = verb === "revoke" ? "revoked" : verb === "quarantine" ? "quarantined" : "unquarantined";
      console.log(`ace: ${verbed} ${name}@${version} → ${outPath} (sequence ${seq})`);
      return 0;
    }
    // sub === "add"
    // Local (non-HTTP) paths are stored ABSOLUTE: a relative path would be persisted into the
    // user-global ~/.ace/registry.json and then fail at install time when the cwd differs.
    const isHttp = parsed.regUrl!.startsWith("http://") || parsed.regUrl!.startsWith("https://");
    const storedUrl = isHttp ? parsed.regUrl! : toAbsolutePath(parsed.regUrl!);
    let pkgHash = parsed.regHash;
    if (pkgHash === undefined) {
      let raw: string;
      try {
        raw = isHttp ? await (await fetch(parsed.regUrl!)).text() : readFileSync(storedUrl, "utf8");
      } catch (e) {
        console.error(`ace: registry add: fetch/read failed: ${(e as Error).message}`);
        return 1;
      }
      let pkg: AcePackage;
      try {
        pkg = JSON.parse(raw) as AcePackage;
      } catch {
        console.error("ace: registry add: package is not valid JSON");
        return 65;
      }
      // Shape guard before hashing: a parseable-but-malformed package (missing manifest/files)
      // is refused here for SHAPE; a malformed field VALUE (float / lone surrogate) still throws
      // in packageHash, so safePackageHash below maps that to a clean exit. Also verify the
      // package identity matches the CLI name/version so a package cannot be registered under the
      // wrong name (mirrors the resolver declared-identity check, caught here at add-time).
      const pm = pkg as { manifest?: { name?: unknown; version?: unknown }; files?: unknown };
      if (
        typeof pkg !== "object" ||
        pkg === null ||
        typeof pm.manifest !== "object" ||
        pm.manifest === null ||
        typeof pm.files !== "object" ||
        pm.files === null
      ) {
        console.error("ace: registry add: package is not a well-formed AcePackage (missing manifest/files)");
        return 65;
      }
      if (pm.manifest.name !== parsed.regName || pm.manifest.version !== parsed.regVersion) {
        console.error(
          `ace: registry add: package identity ${String(pm.manifest.name)}@${String(pm.manifest.version)} != ${parsed.regName}@${parsed.regVersion}`,
        );
        return 65;
      }
      const phr = safePackageHash(pkg);
      if (!phr.ok) {
        console.error(`ace: registry add: invalid package — ${phr.reason}`);
        return 65;
      }
      pkgHash = phr.hash;
    }
    const res = addRegistryEntry(parsed.regName!, parsed.regVersion!, { url: storedUrl, package_hash: pkgHash });
    console.log(
      res.added
        ? `ace: registered ${parsed.regName}@${parsed.regVersion}`
        : res.updated
          ? `ace: updated ${parsed.regName}@${parsed.regVersion} (corrected url/hash)`
          : `ace: ${parsed.regName}@${parsed.regVersion} already registered (identical)`,
    );
    return 0;
  }

  if (parsed.command === "list") {
    const packages = listInstalled(parsed.storePath);

    if (parsed.json) {
      console.log(JSON.stringify(packages, null, 2));
      return 0;
    }

    if (packages.length === 0) {
      console.log("No DLC packages installed.");
      return 0;
    }

    console.log(`Installed DLC packages (${packages.length}):\n`);
    for (const pkg of packages) {
      const desc = pkg.manifest.description ? ` — ${pkg.manifest.description}` : "";
      console.log(`  ${pkg.manifest.name}@${pkg.manifest.version}${desc}`);
      console.log(`    hash: ${pkg.hash}`);
    }
    return 0;
  }

  if (parsed.command === "update") {
    let raw: string;
    try {
      raw =
        parsed.source.startsWith("http://") || parsed.source.startsWith("https://")
          ? await (await fetch(parsed.source)).text()
          : readFileSync(parsed.source, "utf8");
    } catch (e) {
      console.error(`ace: download/read failed: ${(e as Error).message}`);
      return 1;
    }
    let pkg: AcePackage;
    try {
      pkg = JSON.parse(raw) as AcePackage;
    } catch {
      console.error("ace: package is not valid JSON");
      return 65;
    }
    if (
      typeof pkg !== "object" ||
      pkg === null ||
      typeof pkg.manifest !== "object" ||
      pkg.manifest === null ||
      typeof pkg.files !== "object" ||
      pkg.files === null
    ) {
      console.error("ace: update refused: not a well-formed AcePackage");
      return 1;
    }
    // Signature gate (same policy as install): hard-refuse a present-but-invalid signature;
    // no-signature is only overridable with --allow-no-signature.
    const v = verifySignature(pkg.manifest, loadTrustStore());
    if (!v.ok && v.reason !== "no-signature") {
      console.error(`ace: update refused: ${v.reason}`);
      return 1;
    }
    if (!v.ok && v.reason === "no-signature" && !parsed.allowNoSignature) {
      console.error("ace: update refused: unsigned package (use --allow-no-signature)");
      return 1;
    }
    // Root content_hash.
    const rootFilesHash = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    if (rootFilesHash !== pkg.manifest.content_hash) {
      console.error(`ace: update refused: bad-content-hash in ${pkg.manifest.name} (root)`);
      return 1;
    }
    // Root is untrusted: guard a packageHash-throw ONCE before any helper (resolve / buildLockfile /
    // buildLeafLockfile) hashes it, so a malformed root refuses as invalid-package, not ace: fatal:.
    const rootHashCheck = safePackageHash(pkg);
    if (!rootHashCheck.ok) {
      console.error(`ace: update refused: invalid-package — ${pkg.manifest.name} (root): ${rootHashCheck.reason}`);
      return 1;
    }

    if (Array.isArray(pkg.manifest.dependencies) && pkg.manifest.dependencies.length > 0) {
      const fetchPackage = async (u: string): Promise<string> =>
        u.startsWith("http://") || u.startsWith("https://") ? await (await fetch(u)).text() : readFileSync(u, "utf8");
      const { registry, warnings, errors } = await loadRegistries({
        trustStore: loadTrustStore(),
        offline: parsed.offline === true,
      });
      for (const w of warnings) console.error(`ace: ${w}`);
      if (errors.length > 0) {
        for (const e of errors) console.error(`ace: update refused: ${e}`);
        return 1;
      }
      const solveResult = await solve(pkg, fetchPackage, registry);
      if (!solveResult.ok) {
        console.error(
          `ace: update refused: ${solveResult.reason} — ${solveResult.detail} (path: ${solveResult.path.join(" → ")})`,
        );
        return 1;
      }
      const res = await resolve(pkg, fetchPackage, loadTrustStore(), registry, solveResult.versions, {
        allowNoSignature: parsed.allowNoSignature,
      });
      if (!res.ok) {
        console.error(`ace: update refused: ${res.reason} — ${res.detail} (path: ${res.path.join(" → ")})`);
        return 1;
      }
      // Preflight BEFORE writing — never write a lock the graph install would reject (preflight-before-write per spec #6412, fix-forward #6414).
      const pf = preflightGraph(res.order);
      if (pf !== null) {
        console.error(`ace: update refused: ${pf}`);
        return 1;
      }
      const lf = buildLockfile(pkg, res.order, registry);
      if ("error" in lf) {
        console.error(`ace: update refused: could not build lockfile: ${lf.error}`);
        return 1;
      }
      try {
        writeFileSync(parsed.lockfile, serializeLockfile(lf));
      } catch (e) {
        console.error(`ace: update failed: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`);
        return 1;
      }
      console.log(`ace: wrote lockfile ${parsed.lockfile} (${lf.nodes.length} deps)`);
      return 0;
    }
    // Leaf: trivial lock — preflight the single package before writing, so update never
    // commits a lock for a package installPackage/--frozen would reject (parity with the
    // graph path's preflightGraph).
    const leafUnsafe = validatePackagePaths(pkg);
    if (leafUnsafe !== null) {
      console.error(`ace: update refused: unsafe file path in ${pkg.manifest.name}: ${leafUnsafe}`);
      return 1;
    }
    try {
      writeFileSync(parsed.lockfile, serializeLockfile(buildLeafLockfile(pkg)));
    } catch (e) {
      console.error(`ace: update failed: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`);
      return 1;
    }
    console.log(`ace: wrote lockfile ${parsed.lockfile} (0 deps)`);
    return 0;
  }

  if (parsed.command === "install") {
    let raw: string;
    try {
      raw =
        parsed.source.startsWith("http://") || parsed.source.startsWith("https://")
          ? await (await fetch(parsed.source)).text()
          : readFileSync(parsed.source, "utf8");
    } catch (e) {
      console.error(`ace: download/read failed: ${(e as Error).message}`);
      return 1;
    }
    let pkg: AcePackage;
    try {
      pkg = JSON.parse(raw) as AcePackage;
    } catch {
      console.error("ace: package is not valid JSON");
      return 65;
    }

    // AUTHENTICITY GATE (design §6) — before extraction.
    // Only `no-signature` is --allow-no-signature-overridable.
    // `bad-signature` and `untrusted-key` are ALWAYS hard-refused (even with --allow-no-signature).
    const v = verifySignature(pkg.manifest, loadTrustStore());
    let signer: { key_id: string; label?: string } | undefined;
    if (v.ok) {
      signer = { key_id: v.key_id };
      if (v.label !== undefined) signer.label = v.label;
    } else if (v.reason === "bad-signature") {
      console.error("ace: install refused: bad signature");
      return 1;
    } else if (v.reason === "unsupported-algo") {
      console.error("ace: install refused: unsupported signature algorithm (expected ed25519)");
      return 1;
    } else if (v.reason === "untrusted-key") {
      const kid = pkg.manifest.signature?.key_id ?? "?";
      console.error(
        `ace: install refused: signature from untrusted key ${kid} — unknown publisher. Run 'ace trust list' to see trusted keys, or obtain the publisher's .pub and run 'ace trust add <pub>'.`,
      );
      return 1;
    } else {
      // no-signature
      if (!parsed.allowNoSignature) {
        console.error("ace: install refused: unsigned package (use --allow-no-signature to override)");
        return 1;
      }
      console.error("ace: WARNING: installing UNSIGNED package (--allow-no-signature).");
    }

    // CAPABILITY-DECLARATION GATE — before extraction, beside the authenticity gate.
    // A declaration that ace cannot parse must not reach the store: otherwise `ace install`
    // accepts `capabilities: ["key:*"]` and the refusal appears only later at `ace verify`, which
    // is the worst ordering (the bytes are already on disk and an operator has already seen a
    // green install). Refusing here keeps "what installed" and "what verifies" the same set.
    const declaredCaps = validateCapabilities((pkg.manifest as { capabilities?: unknown }).capabilities);
    if (!declaredCaps.ok) {
      console.error(`ace: install refused: invalid-capabilities in ${pkg.manifest.name}: ${declaredCaps.reason}`);
      return 1;
    }

    // The root is untrusted: a malformed field (float / lone surrogate) makes packageHash throw.
    // Guard it ONCE here — before ANY path (graph / leaf / frozen) calls a packageHash-using helper
    // (resolve, verifyRootMatchesLock, buildLockfile, buildLeafLockfile, preflightGraph) — so a
    // malformed root refuses as invalid-package instead of escaping to the ace: fatal: catch-all.
    const rootHashCheck = safePackageHash(pkg);
    if (!rootHashCheck.ok) {
      console.error(`ace: install refused: invalid-package — ${pkg.manifest.name} (root): ${rootHashCheck.reason}`);
      return 1;
    }

    // SLICE 4: transitive graph. Leaf (no deps) falls through to the single-package path below (unchanged).
    if (Array.isArray(pkg.manifest.dependencies) && pkg.manifest.dependencies.length > 0) {
      // Verify root content_hash BEFORE resolving (no wasted graph fetch on a bad root).
      const rootFilesHash = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
      if (rootFilesHash !== pkg.manifest.content_hash) {
        console.error(`ace: install refused: bad-content-hash in ${pkg.manifest.name} (root)`);
        return 1;
      }
      if (parsed.frozen) {
        // SLICE 5.3 frozen replay: install exactly the locked graph; never solve, never touch the registry.
        let lockRaw: string;
        try {
          lockRaw = readFileSync(parsed.lockfile, "utf8");
        } catch {
          console.error(`ace: install refused: no lockfile at ${parsed.lockfile} — run install without --frozen first`);
          return 1;
        }
        const lf = parseLockfile(lockRaw);
        if ("error" in lf) {
          console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${lf.error}`);
          return 1;
        }
        if (!verifyRootMatchesLock(pkg, lf)) {
          console.error(
            `ace: install refused: lockfile out of date for ${pkg.manifest.name} — re-run without --frozen to regenerate`,
          );
          return 1;
        }
        // SLICE 7: revocation overrides the lockfile. Best-effort load the registry marks
        // (offline/unreachable → empty marks, frozen stays registry-independent) and re-check
        // every locked pin: a revoked pin hard-refuses; a quarantined pin refuses unless
        // --allow-quarantined (warn when allowed).
        const fr = await checkLockedMarks(lf.nodes, parsed.allowQuarantined === true, parsed.offline === true);
        if (fr !== null) {
          console.error(`ace: install refused: ${fr}`);
          return 1;
        }
        const trust = loadTrustStore();
        // PASS 1 (verify-all, install NOTHING) — mirrors the default-path preflight: fetch → parse →
        // verify pin + content_hash + signature + path-safety + store-key collision across the WHOLE
        // graph before any extract, so a verify failure on a later node cannot orphan earlier ones.
        const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
        // Seed the collision set with the root (already content_hash+signature verified above), so a
        // locked node that shares the root's content_hash store key with a different package is caught.
        // root already validated (hashable) at install-command entry; reuse that hash
        byStoreKey.set(pkg.manifest.content_hash, rootHashCheck.hash);
        const verified: AcePackage[] = []; // locked nodes in lock order; root installed separately
        for (const node of lf.nodes) {
          let nodeRaw: string;
          try {
            nodeRaw =
              node.url.startsWith("http://") || node.url.startsWith("https://")
                ? await (await fetch(node.url)).text()
                : readFileSync(node.url, "utf8");
          } catch (e) {
            console.error(
              `ace: install refused: fetch failed for ${node.name}@${node.version} (${node.url}): ${(e as Error).message}`,
            );
            return 1;
          }
          let np: AcePackage;
          try {
            np = JSON.parse(nodeRaw) as AcePackage;
          } catch {
            console.error(`ace: install refused: ${node.name}@${node.version} is not valid JSON`);
            return 1;
          }
          // Shape-guard the untrusted fetched bytes (object-ness) before any verify primitive
          // touches them. A malformed field VALUE (float / lone surrogate) still throws in
          // packageHash; safePackageHash below maps that to a clean refusal.
          const npm = np as { manifest?: unknown; files?: unknown };
          if (
            typeof npm !== "object" ||
            npm === null ||
            typeof npm.manifest !== "object" ||
            npm.manifest === null ||
            typeof npm.files !== "object" ||
            npm.files === null
          ) {
            console.error(`ace: install refused: ${node.name}@${node.version} is not a well-formed package`);
            return 1;
          }
          const nphr = safePackageHash(np);
          if (!nphr.ok) {
            console.error(`ace: install refused: invalid-package — ${node.name}@${node.version}: ${nphr.reason}`);
            return 1;
          }
          const nph = nphr.hash;
          if (nph !== node.package_hash) {
            console.error(
              `ace: install refused: package_hash mismatch for ${node.name}@${node.version} (lock pin violated)`,
            );
            return 1;
          }
          const fh = contentHash(new TextEncoder().encode(JSON.stringify(np.files)));
          if (fh !== np.manifest.content_hash) {
            console.error(`ace: install refused: bad-content-hash in ${node.name}@${node.version}`);
            return 1;
          }
          const unsafe = validatePackagePaths(np);
          if (unsafe !== null) {
            console.error(`ace: install refused: unsafe file path in ${node.name}@${node.version}: ${unsafe}`);
            return 1;
          }
          const nv = verifySignature(np.manifest, trust);
          if (!nv.ok && nv.reason !== "no-signature") {
            console.error(`ace: install refused: ${nv.reason} for ${node.name}@${node.version}`);
            return 1;
          }
          if (!nv.ok && nv.reason === "no-signature" && !parsed.allowNoSignature) {
            console.error(`ace: install refused: unsigned ${node.name}@${node.version} (use --allow-no-signature)`);
            return 1;
          }
          const prior = byStoreKey.get(np.manifest.content_hash);
          if (prior !== undefined && prior !== nph) {
            console.error(
              `ace: install refused: store-collision — ${node.name}@${node.version} shares a content_hash store key with a different package`,
            );
            return 1;
          }
          byStoreKey.set(np.manifest.content_hash, nph);
          verified.push(np);
        }
        // PASS 2 (install-all) — only after the full graph verifies: nodes in lock order, then root.
        for (let i = 0; i < verified.length; i++) {
          const np = verified[i]!;
          const node = lf.nodes[i]!;
          const ir = installPackage(parsed.storePath, np);
          if (!ir.ok) {
            console.error(`ace: install refused: ${node.name}@${node.version}: ${ir.error}`);
            return 1;
          }
        }
        // Install the root last (already signature+content_hash verified above).
        const rootIr = installPackage(parsed.storePath, pkg);
        if (!rootIr.ok) {
          console.error(`ace: install refused: ${pkg.manifest.name} (root): ${rootIr.error}`);
          return 1;
        }
        console.error(`ace: installed ${lf.nodes.length + 1} from lockfile ${parsed.lockfile} (frozen)`);
        return 0;
      }
      const fetchPackage = async (u: string): Promise<string> =>
        u.startsWith("http://") || u.startsWith("https://") ? await (await fetch(u)).text() : readFileSync(u, "utf8");
      const { registry, revoked, quarantined, warnings, errors } = await loadRegistries({
        trustStore: loadTrustStore(),
        offline: parsed.offline === true,
      });
      for (const w of warnings) console.error(`ace: ${w}`);
      if (errors.length > 0) {
        for (const e of errors) console.error(`ace: install refused: ${e}`);
        return 1;
      }
      const solveResult = await solve(pkg, fetchPackage, registry);
      if (!solveResult.ok) {
        console.error(
          `ace: install refused: ${solveResult.reason} — ${solveResult.detail} (path: ${solveResult.path.join(" → ")})`,
        );
        return 1;
      }
      // Print the solved graph if --print-resolution was requested.
      if (parsed.printResolution) {
        for (const [n, v] of [...solveResult.versions].sort()) {
          console.log(`  ${n}@${v}`);
        }
      }
      const res = await resolve(pkg, fetchPackage, loadTrustStore(), registry, solveResult.versions, {
        allowNoSignature: parsed.allowNoSignature,
        allowQuarantined: parsed.allowQuarantined === true,
        revoked,
        quarantined,
      });
      if (!res.ok) {
        console.error(`ace: install refused: ${res.reason} — ${res.detail} (path: ${res.path.join(" → ")})`);
        return 1;
      }
      // SLICE 5.4: --locked — assert the committed lock equals a fresh solve, else refuse
      // (CI guard; installs nothing). Falls through to the normal preflight+extract when it matches.
      if (parsed.locked) {
        let lockRaw: string;
        try {
          lockRaw = readFileSync(parsed.lockfile, "utf8");
        } catch {
          console.error(
            `ace: install refused: --locked but no lockfile at ${parsed.lockfile} — run 'ace update' or install without --locked`,
          );
          return 1;
        }
        const onDisk = parseLockfile(lockRaw);
        if ("error" in onDisk) {
          console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${onDisk.error}`);
          return 1;
        }
        const fresh = buildLockfile(pkg, res.order, registry);
        if ("error" in fresh) {
          console.error(`ace: install refused: could not build lockfile: ${fresh.error}`);
          return 1;
        }
        if (!lockfilesEqual(onDisk, fresh)) {
          console.error(`ace: install refused: lockfile out of date (--locked) — run 'ace update' to regenerate`);
          return 1;
        }
      }
      // PREFLIGHT (atomic): integrity + path-safety + store-key collision across the whole
      // graph BEFORE any extract (shared with `update`'s before-write guard via preflightGraph).
      const pf = preflightGraph(res.order);
      if (pf !== null) {
        console.error(`ace: install refused: ${pf}`);
        return 1;
      }
      // EXTRACT all, leaves first.
      for (const node of res.order) {
        const out = installPackage(parsed.storePath, node);
        if (!out.ok) {
          console.error(`ace: install failed mid-graph: ${out.error}`);
          return 1;
        }
      }
      // SLICE 5.3: write the lockfile (write failure is a warning, not a failed install).
      const lf = buildLockfile(pkg, res.order, registry);
      if ("error" in lf) {
        console.error(`ace: WARNING: could not build lockfile: ${lf.error}`);
      } else {
        try {
          writeFileSync(parsed.lockfile, serializeLockfile(lf));
        } catch (e) {
          console.error(`ace: WARNING: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`);
        }
      }
      console.log(
        `ace: installed ${res.order.length}: ${res.order.map((p) => `${p.manifest.name}@${p.manifest.version}`).join(", ")}`,
      );
      return 0;
    }

    // SLICE 5.4: leaf (no-dependency) install — uniform lockfile handling.
    // --frozen: require an on-disk lock + a matching root before installing (drift gate).
    // --locked: require the on-disk lock to equal a fresh leaf lock (CI guard).
    // default: install, then write the trivial leaf lock (empty nodes).
    if (parsed.frozen) {
      let lockRaw: string;
      try {
        lockRaw = readFileSync(parsed.lockfile, "utf8");
      } catch {
        console.error(`ace: install refused: no lockfile at ${parsed.lockfile} — run install without --frozen first`);
        return 1;
      }
      const lf = parseLockfile(lockRaw);
      if ("error" in lf) {
        console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${lf.error}`);
        return 1;
      }
      if (!verifyRootMatchesLock(pkg, lf)) {
        console.error(
          `ace: install refused: lockfile out of date for ${pkg.manifest.name} — re-run without --frozen to regenerate`,
        );
        return 1;
      }
      const lr = await checkLockedMarks(
        [{ name: pkg.manifest.name, version: pkg.manifest.version }, ...lf.nodes],
        parsed.allowQuarantined === true,
        parsed.offline === true,
      );
      if (lr !== null) {
        console.error(`ace: install refused: ${lr}`);
        return 1;
      }
    } else if (parsed.locked) {
      let lockRaw: string;
      try {
        lockRaw = readFileSync(parsed.lockfile, "utf8");
      } catch {
        console.error(
          `ace: install refused: --locked but no lockfile at ${parsed.lockfile} — run 'ace update' or install without --locked`,
        );
        return 1;
      }
      const onDisk = parseLockfile(lockRaw);
      if ("error" in onDisk) {
        console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${onDisk.error}`);
        return 1;
      }
      if (!lockfilesEqual(onDisk, buildLeafLockfile(pkg))) {
        console.error(`ace: install refused: lockfile out of date (--locked) — run 'ace update' to regenerate`);
        return 1;
      }
    }
    // INTEGRITY + extract (slice 2, unchanged)
    const result = installPackage(parsed.storePath, pkg);
    if (!result.ok) {
      console.error(`ace: install refused: ${result.error}`);
      return 1;
    }
    if (signer) {
      console.log(
        `ace: integrity + authenticity verified (signed by ${signer.key_id}${signer.label ? " " + signer.label : ""}) -> ${result.dir}`,
      );
    } else {
      console.log(`ace: installed ${pkg.manifest.name}@${pkg.manifest.version} -> ${result.dir}`);
      console.log("ace: integrity-verified (content hash). NOT authenticity-verified (--allow-no-signature).");
    }
    // SLICE 5.4: default (non-frozen) path writes the trivial leaf lock; write failure is a warning.
    if (!parsed.frozen) {
      try {
        writeFileSync(parsed.lockfile, serializeLockfile(buildLeafLockfile(pkg)));
      } catch (e) {
        console.error(`ace: WARNING: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`);
      }
    }
    return 0;
  }

  if (parsed.command === "verify") {
    // WHAT THIS USED TO BE. A presence check: it found the package in the store and exited 0.
    // It re-verified nothing — not the signature, not the trust store, not the manifest bytes —
    // so a manifest edited on disk AFTER install passed, and a package signed by a key that was
    // never trusted passed. That is a check that could not fail, in the file whose name promises
    // it can. The store is ordinary files under the same user as every agent on the box, so
    // "verified at install" does not survive to the next read; re-verification has to happen here
    // or nowhere.
    const pkgs = listInstalled(parsed.storePath);
    const found = pkgs.find((p) => p.hash === parsed.hash || p.manifest.content_hash === parsed.hash);
    if (!found) {
      console.error(`ace: no installed package with hash ${parsed.hash}`);
      return 1;
    }
    const label = `${found.manifest.name}@${found.manifest.version}`;
    const auth = authorizedCapabilities(found.manifest, loadTrustStore());

    if (!auth.ok) {
      if (auth.reason === "no-signature") {
        // An unsigned package is a KNOWN and reportable state, not a forgery. It stays exit 0
        // unless the caller asked otherwise, so `--allow-no-signature` installs remain
        // inspectable — but it can never satisfy a --capability assertion below.
        if (parsed.requireSignature || parsed.requireCapabilities.length > 0) {
          console.error(`ace: verify refused: ${label} is unsigned — no code identity to bind a capability to`);
          return 1;
        }
        console.log(`ace: ${label} present (manifest hash ${found.manifest.content_hash})`);
        console.error("ace: WARNING: package is UNSIGNED — present, NOT authenticity-verified.");
        return 0;
      }
      // bad-signature / untrusted-key / unsupported-algo / invalid-capabilities. A manifest
      // mutated after signing (capabilities or anything else) lands here, because signing.ts
      // covers the whole manifest minus `signature`.
      console.error(`ace: verify FAILED: ${label} — ${auth.reason} (manifest hash ${found.manifest.content_hash})`);
      return 1;
    }

    console.log(`ace: ${label} present (manifest hash ${found.manifest.content_hash})`);
    console.log(`ace: signature OK — code identity ${auth.codeIdentity}`);
    console.log(
      auth.capabilities.length === 0
        ? "ace: capabilities: (none declared)"
        : `ace: capabilities: ${auth.capabilities.join(" ")}`,
    );

    // The declaration is READ, with teeth: an unlisted capability is refused. This is what keeps
    // the field from being a decoration nothing checks.
    const missing = parsed.requireCapabilities.filter((c) => !capabilityPermitted(auth, c));
    if (missing.length > 0) {
      console.error(
        `ace: verify refused: ${label} is not authorized for ${missing.join(" ")} — declared: ${auth.capabilities.join(" ") || "(none)"}`,
      );
      return 1;
    }

    // Say the gap out loud on every success, so no operator reads this as a runtime guarantee.
    console.error(`ace: NOTE: ${INSTALL_TIME_VS_RUNTIME}.`);
    return 0;
  }

  if (parsed.command === "deps") {
    try {
      const graph = loadDependencyGraph(parsed.graphPath);

      let asOfDate = new Date();
      if (parsed.asOf) {
        asOfDate = new Date(parsed.asOf);
      }

      if (parsed.sub === "query") {
        let evaluatedAsOf = asOfDate;

        if (parsed.duringMigration) {
          let found = false;
          for (const node of graph.spec.dependsOn) {
            if (node.version && typeof node.version !== "string") {
              const mw = node.version["migration-window"];
              if (mw && mw.name === parsed.duringMigration) {
                const start = new Date(mw.start).getTime();
                const end = new Date(mw.end).getTime();
                evaluatedAsOf = new Date((start + end) / 2);
                found = true;
                break;
              }
            }
          }
          if (!found) {
            if (parsed.schedulePath && existsSync(parsed.schedulePath)) {
              const schedule = parseYaml(readFileSync(parsed.schedulePath, "utf8")) as UpgradeScheduleSpec;
              for (const s of schedule.schedules) {
                if (s.upgrade === parsed.duringMigration || `${s.upgrade}-upgrade` === parsed.duringMigration) {
                  evaluatedAsOf = new Date(s.when);
                  found = true;
                  break;
                }
              }
            }
          }
          if (!found) {
            console.error(`ace: deps query: migration window or schedule for '${parsed.duringMigration}' not found`);
            return 1;
          }
        }

        const resolved = resolveGraph(graph, parsed.chartsDir);
        console.log(`Dependency Graph Query Result (Evaluated as of: ${evaluatedAsOf.toISOString()}):`);
        console.log(`=============================================================================`);

        for (const name of resolved.order) {
          const node = resolved.nodes.get(name);
          if (!node || name === graph.metadata.name) continue;

          const version = getResolvedVersion(node, evaluatedAsOf);
          const phase = getMigrationPhase(node, evaluatedAsOf);

          console.log(`- Chart: ${name}`);
          console.log(`  Resolved Version: ${version}`);
          console.log(`  Active Phase:     ${phase}`);

          if (node.dependsOn && node.dependsOn.length > 0) {
            console.log(`  Depends On:       ${node.dependsOn.join(", ")}`);
          }
          console.log("");
        }

        if (parsed.rollbackWindow) {
          const node = graph.spec.dependsOn.find((n) => n.chart === parsed.rollbackWindow);
          if (!node) {
            console.error(`ace: deps query: chart '${parsed.rollbackWindow}' not found in dependency graph`);
            return 1;
          }

          let scheduleWhen: Date | undefined;
          let scheduleRollbackWindow: string | undefined;

          if (parsed.schedulePath && existsSync(parsed.schedulePath)) {
            const schedule = parseYaml(readFileSync(parsed.schedulePath, "utf8")) as UpgradeScheduleSpec;
            const s = schedule.schedules.find((s) => s.upgrade === parsed.rollbackWindow);
            if (s) {
              scheduleWhen = new Date(s.when);
              scheduleRollbackWindow = s["rollback-window"];
            }
          }

          const safety = checkRollbackSafety(node, evaluatedAsOf, scheduleWhen, scheduleRollbackWindow);
          console.log(`Rollback Safety Audit for '${parsed.rollbackWindow}':`);
          console.log(`-----------------------------------------------`);
          if (safety.safe) {
            console.log(`Rollback is considered safe under current constraints.`);
          } else {
            for (const warning of safety.warnings) {
              console.log(`- ${warning}`);
            }
          }
          console.log("");
        }
        return 0;
      }

      if (parsed.sub === "evaluate-schedule") {
        if (!parsed.schedulePath) {
          console.error("ace: deps evaluate-schedule requires --schedule <path>");
          return 1;
        }
        const schedule = parseYaml(readFileSync(parsed.schedulePath, "utf8")) as UpgradeScheduleSpec;
        const outDir = parsed.outDir!;
        const runbookFile = generateMigrationRunbook(graph, schedule, outDir, asOfDate);
        console.log(`ace: evaluated schedule and generated migration runbook: ${runbookFile}`);
        return 0;
      }

      const resolved = resolveGraph(graph, parsed.chartsDir);
      if (parsed.sub === "validate") {
        console.log(`ace: dependency graph '${graph.metadata.name}' is valid (${resolved.order.length} charts)`);
        return 0;
      }

      const outDir = parsed.outDir!;
      if (parsed.outputEngine === "flux" || parsed.outputEngine === "both") {
        writeManifestDir(outDir, generateFlux(resolved, parsed.namespace, asOfDate));
      }
      if (parsed.outputEngine === "argocd" || parsed.outputEngine === "both") {
        writeManifestDir(outDir, generateArgoCD(resolved, parsed.namespace));
      }
      console.log(`ace: wrote manifests for '${graph.metadata.name}' to ${outDir}`);
      return 0;
    } catch (e) {
      console.error(`ace: deps ${parsed.sub} failed: ${(e as Error).message}`);
      return 1;
    }
  }

  return 1;
}

if (import.meta.main) {
  // .catch() closes the unhandled-promise surface from the async main(): an unexpected throw
  // inside an async main() exits 1 with a diagnostic instead of an UnhandledPromiseRejection.
  main(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(`ace: fatal: ${(e as Error).message}`);
      process.exit(1);
    });
}
