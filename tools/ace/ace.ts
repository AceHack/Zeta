#!/usr/bin/env bun
// ace.ts -- Ace DLC package manager CLI. Smallest safe slice of B-0288.
//
// Usage:
//   bun tools/ace/ace.ts list [--store <path>] [--json]
//   bun tools/ace/ace.ts install <url-or-path> [--allow-no-signature] [--print-resolution]
//   bun tools/ace/ace.ts verify <hash>
//   bun tools/ace/ace.ts keygen [--out <prefix>]
//   bun tools/ace/ace.ts sign <pkg> --key <priv.key> [--out <file>]
//   bun tools/ace/ace.ts trust add <pub-file-or-b64> [--label <name>]
//   bun tools/ace/ace.ts trust list
//   bun tools/ace/ace.ts registry add <name> <version> <url> [--hash <h>]
//   bun tools/ace/ace.ts registry list
//
// Future commands (not yet implemented): remove, inspect.

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import {
  defaultStorePath, listInstalled, installPackage, contentHash,
  loadTrustStore, addTrustedKey, listTrustedKeys, validatePackagePaths,
  loadRegistry, addRegistryEntry, listRegistry,
  type AcePackage,
} from "./store";
import { generateKeypair, signManifest, verifySignature, keyId } from "./signing";
import { resolve, packageHash } from "./resolve.ts";
import { buildLockfile, serializeLockfile, parseLockfile, verifyRootMatchesLock } from "./lockfile.ts";
import { solve } from "./solver.ts";
import { resolve as toAbsolutePath } from "node:path";

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
  readonly printResolution?: boolean;
  readonly frozen: boolean;
  readonly lockfile: string;
}

interface VerifyArgs {
  readonly command: "verify";
  readonly hash: string;
  readonly storePath: string;
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

interface RegistryArgs {
  readonly command: "registry";
  readonly sub: "list" | "add";
  readonly regName?: string;
  readonly regVersion?: string;
  readonly regUrl?: string;
  readonly regHash?: string;
}

type ParsedArgs = ListArgs | HelpArgs | InstallArgs | VerifyArgs | KeygenArgs | SignArgs | TrustArgs | RegistryArgs;

interface ArgError {
  readonly error: string;
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
      const name = argv[2], version = argv[3], url = argv[4];
      if (!name || !version || !url || name.startsWith("-") || version.startsWith("-") || url.startsWith("-")) {
        return { error: "registry add requires <name> <version> <url>" };
      }
      let hash: string | undefined;
      for (let i = 5; i < argv.length; i++) {
        if (argv[i] === "--hash") { hash = argv[++i]; if (!hash || hash.startsWith("-")) return { error: "--hash requires a value" }; }
        else return { error: `Unknown option for registry add: ${argv[i]}` };
      }
      const result: RegistryArgs = { command: "registry", sub: "add", regName: name, regVersion: version, regUrl: url };
      if (hash !== undefined) return { ...result, regHash: hash };
      return result;
    }
    return { error: "registry requires 'add' or 'list'" };
  }

  if (command === "install") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "install requires a <url-or-path> argument" };
    let storePath = defaultStorePath();
    let allowNoSignature = false;
    let printResolution = false;
    let frozen = false;
    let lockfilePath = "ace.lock";
    for (let i = 2; i < argv.length; i++) {
      if (argv[i] === "--store" || argv[i] === "-s") {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) return { error: "--store requires a path argument" };
        storePath = next;
        i++;
      } else if (argv[i] === "--allow-no-signature") {
        allowNoSignature = true;
      } else if (argv[i] === "--print-resolution") {
        printResolution = true;
      } else if (argv[i] === "--frozen") {
        frozen = true;
      } else if (argv[i] === "--lockfile") {
        const next = argv[++i];
        if (!next || next.startsWith("-")) return { error: "--lockfile requires a path argument" };
        lockfilePath = next;
      } else {
        return { error: `Unknown option for install: ${argv[i]}` };
      }
    }
    const baseResult: InstallArgs = { command: "install", source, storePath, allowNoSignature, frozen, lockfile: lockfilePath };
    if (printResolution) return { ...baseResult, printResolution: true };
    return baseResult;
  }

  if (command === "verify") {
    const hash = argv[1];
    if (!hash || hash.startsWith("-")) return { error: "verify requires a <hash> argument" };
    return { command: "verify", hash, storePath: defaultStorePath() };
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
  ace install <url-or-path> [--allow-no-signature] [--print-resolution] [--frozen] [--lockfile <path>]
                                                   Download/read a package, verify integrity+authenticity, install
                                                   --allow-no-signature only installs packages with NO signature; it never bypasses a present (bad or untrusted) signature
                                                   --print-resolution prints the solved name@version graph before installing
                                                   writes ./ace.lock on a normal install; --frozen installs exactly the locked graph (registry-independent)
                                                   --lockfile <path> overrides the default lockfile path (default: ace.lock)
  ace verify <hash>                              Confirm an installed package is present
  ace keygen [--out <prefix>]                    Generate an Ed25519 keypair (writes <prefix>.key + <prefix>.pub)
  ace sign <pkg> --key <priv.key> [--out <file>] Sign a package manifest with an Ed25519 private key
  ace trust add <pub-file-or-b64> [--label <name>] Trust an Ed25519 public key
  ace trust list                                 List all trusted keys
  ace registry add <name> <version> <url> [--hash <h>] Register a package in the local registry
  ace registry list                              List all registry entries
  ace help                                       Show this help

Future commands (not yet implemented):
  ace remove <hash>                              Uninstall a DLC
  ace inspect <hash>                             Show manifest without installing`;
  console.log(text);
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
        console.error(`ace: keygen refused: ${keyPath} already exists — remove it or choose a different --out (refusing to overwrite a private key)`);
        return 1;
      }
      throw e;
    }
    // Belt-and-suspenders: force 0o600 even if the platform ignored mode-on-create.
    chmodSync(keyPath, 0o600);
    // Only write .pub after .key exclusive-create succeeds.
    writeFileSync(`${parsed.outPrefix}.pub`, JSON.stringify({ algo: "ed25519", key_id: kp.keyId, public_key: kp.publicSpkiB64 }, null, 2));
    console.log(`ace: wrote ${parsed.outPrefix}.key (0600) + ${parsed.outPrefix}.pub  key_id ${kp.keyId} — share ${parsed.outPrefix}.pub with consumers; keep ${parsed.outPrefix}.key private`);
    return 0;
  }

  // sign — recompute content_hash with the SLICE-2 contentHash (never sort files); refuse on mismatch
  if (parsed.command === "sign") {
    let pkg: AcePackage;
    try { pkg = JSON.parse(readFileSync(parsed.pkgPath, "utf8")) as AcePackage; }
    catch { console.error("ace: package is not valid JSON"); return 65; }
    const recomputed = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
    if (recomputed !== pkg.manifest.content_hash) {
      console.error(`ace: sign refused: package content changed since its content_hash was computed — rebuild the package, then sign`);
      return 1;
    }
    let priv: string;
    try { priv = readFileSync(parsed.keyPath, "utf8"); }
    catch { console.error(`ace: cannot read key ${parsed.keyPath}`); return 1; }
    const signature = signManifest(pkg.manifest, priv);
    const signed = { ...pkg, manifest: { ...pkg.manifest, signature } };
    const out = JSON.stringify(signed, null, 2);
    if (parsed.outPath) {
      writeFileSync(parsed.outPath, out);
      console.log(`ace: signed -> ${parsed.outPath} (key_id ${signature.key_id})`);
    } else {
      process.stderr.write(`ace: signed (key_id ${signature.key_id}) — redirect stdout to a file, or use --out <file>\n`);
      console.log(out);
    }
    return 0;
  }

  // trust
  if (parsed.command === "trust") {
    if (parsed.sub === "list") {
      const rows = listTrustedKeys();
      if (rows.length === 0) { console.log("No trusted keys. (add one: ace trust add <pub>)"); return 0; }
      for (const r of rows) console.log(`  ${r.key_id}  [${r.source}]${r.label ? "  " + r.label : ""}`);
      return 0;
    }
    // add: arg is a .pub file path OR a raw base64 SPKI
    if (!parsed.arg) { console.error("ace: trust add requires a <pubkey-file-or-b64>"); return 64; }
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
        console.error(`ace: trust add: not an Ed25519 public key (got ${pub.asymmetricKeyType ?? "unknown"}) — only Ed25519 keys are accepted`);
        return 65;
      }
      // Normalize to the canonical SPKI: createPublicKey accepts an SPKI with trailing
      // bytes but re-exports the canonical 44-byte form. Compute key_id + store from the
      // canonical bytes so trust-add's key_id matches what signManifest/verify derive
      // (they hash the re-exported SPKI); a padded input would otherwise be stored under a
      // key_id no signature ever presents -> that publisher's packages never authenticate.
      canonicalB64 = (pub.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
    } catch {
      console.error("ace: trust add: invalid Ed25519 public key (not a valid SPKI DER) -- check the .pub file or b64 string");
      return 65;
    }
    const kid = keyId(canonicalB64);
    const entry: { key_id: string; public_key: string; label?: string } = { key_id: kid, public_key: canonicalB64 };
    if (parsed.label !== undefined) entry.label = parsed.label;
    const res = addTrustedKey(entry);
    console.log(res.added ? `ace: trusted ${kid}${parsed.label ? " (" + parsed.label + ")" : ""} [${inputForm}]` : `ace: ${kid} already trusted`);
    return 0;
  }

  // registry
  if (parsed.command === "registry") {
    if (parsed.sub === "list") {
      const rows = listRegistry();
      if (rows.length === 0) { console.log("No registry entries. (add one: ace registry add <name> <version> <url>)"); return 0; }
      for (const r of rows) console.log(`  ${r.name}@${r.version}  ${r.url}  [${r.source}]`);
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
        raw = isHttp
          ? await (await fetch(parsed.regUrl!)).text()
          : readFileSync(storedUrl, "utf8");
      } catch (e) {
        console.error(`ace: registry add: fetch/read failed: ${(e as Error).message}`);
        return 1;
      }
      let pkg: AcePackage;
      try { pkg = JSON.parse(raw) as AcePackage; } catch { console.error("ace: registry add: package is not valid JSON"); return 65; }
      // Shape guard before hashing: a parseable-but-malformed package (missing manifest/files)
      // would otherwise produce a bogus hash / throw; refuse with a clean exit. Also verify the
      // package identity matches the CLI name/version so a package cannot be registered under the
      // wrong name (mirrors the resolver declared-identity check, caught here at add-time).
      const pm = pkg as { manifest?: { name?: unknown; version?: unknown }; files?: unknown };
      if (typeof pkg !== "object" || pkg === null || typeof pm.manifest !== "object" || pm.manifest === null || typeof pm.files !== "object" || pm.files === null) {
        console.error("ace: registry add: package is not a well-formed AcePackage (missing manifest/files)");
        return 65;
      }
      if (pm.manifest.name !== parsed.regName || pm.manifest.version !== parsed.regVersion) {
        console.error(`ace: registry add: package identity ${String(pm.manifest.name)}@${String(pm.manifest.version)} != ${parsed.regName}@${parsed.regVersion}`);
        return 65;
      }
      pkgHash = packageHash(pkg);
    }
    const res = addRegistryEntry(parsed.regName!, parsed.regVersion!, { url: storedUrl, package_hash: pkgHash });
    console.log(res.added ? `ace: registered ${parsed.regName}@${parsed.regVersion}` : res.updated ? `ace: updated ${parsed.regName}@${parsed.regVersion} (corrected url/hash)` : `ace: ${parsed.regName}@${parsed.regVersion} already registered (identical)`);
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

  if (parsed.command === "install") {
    let raw: string;
    try {
      raw = parsed.source.startsWith("http://") || parsed.source.startsWith("https://")
        ? await (await fetch(parsed.source)).text()
        : readFileSync(parsed.source, "utf8");
    } catch (e) {
      console.error(`ace: download/read failed: ${(e as Error).message}`);
      return 1;
    }
    let pkg: AcePackage;
    try { pkg = JSON.parse(raw) as AcePackage; }
    catch { console.error("ace: package is not valid JSON"); return 65; }

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
      console.error(`ace: install refused: signature from untrusted key ${kid} — unknown publisher. Run 'ace trust list' to see trusted keys, or obtain the publisher's .pub and run 'ace trust add <pub>'.`);
      return 1;
    } else {
      // no-signature
      if (!parsed.allowNoSignature) {
        console.error("ace: install refused: unsigned package (use --allow-no-signature to override)");
        return 1;
      }
      console.error("ace: WARNING: installing UNSIGNED package (--allow-no-signature).");
    }

    // SLICE 4: transitive graph. Leaf (no deps) falls through to the single-package path below (unchanged).
    if (pkg.manifest.dependencies && pkg.manifest.dependencies.length > 0) {
      // Verify root content_hash BEFORE resolving (no wasted graph fetch on a bad root).
      const rootFilesHash = contentHash(new TextEncoder().encode(JSON.stringify(pkg.files)));
      if (rootFilesHash !== pkg.manifest.content_hash) {
        console.error(`ace: install refused: bad-content-hash in ${pkg.manifest.name} (root)`);
        return 1;
      }
      if (parsed.frozen) {
        // SLICE 5.3 frozen replay: install exactly the locked graph; never solve, never touch the registry.
        let lockRaw: string;
        try { lockRaw = readFileSync(parsed.lockfile, "utf8"); }
        catch { console.error(`ace: install refused: no lockfile at ${parsed.lockfile} — run install without --frozen first`); return 1; }
        const lf = parseLockfile(lockRaw);
        if ("error" in lf) { console.error(`ace: install refused: malformed lockfile ${parsed.lockfile}: ${lf.error}`); return 1; }
        if (!verifyRootMatchesLock(pkg, lf)) {
          console.error(`ace: install refused: lockfile out of date for ${pkg.manifest.name} — re-run without --frozen to regenerate`);
          return 1;
        }
        const trust = loadTrustStore();
        // PASS 1 (verify-all, install NOTHING) — mirrors the default-path preflight: fetch → parse →
        // verify pin + content_hash + signature + path-safety + store-key collision across the WHOLE
        // graph before any extract, so a verify failure on a later node cannot orphan earlier ones.
        const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
        // Seed the collision set with the root (already content_hash+signature verified above), so a
        // locked node that shares the root's content_hash store key with a different package is caught.
        byStoreKey.set(pkg.manifest.content_hash, packageHash(pkg));
        const verified: AcePackage[] = []; // locked nodes in lock order; root installed separately
        for (const node of lf.nodes) {
          let nodeRaw: string;
          try { nodeRaw = (node.url.startsWith("http://") || node.url.startsWith("https://")) ? await (await fetch(node.url)).text() : readFileSync(node.url, "utf8"); }
          catch (e) { console.error(`ace: install refused: fetch failed for ${node.name}@${node.version} (${node.url}): ${(e as Error).message}`); return 1; }
          let np: AcePackage;
          try { np = JSON.parse(nodeRaw) as AcePackage; } catch { console.error(`ace: install refused: ${node.name}@${node.version} is not valid JSON`); return 1; }
          // Shape-guard the untrusted fetched bytes before any verify primitive touches them, so a
          // malformed payload refuses cleanly instead of throwing in packageHash/contentHash.
          const npm = (np as { manifest?: unknown; files?: unknown });
          if (typeof npm !== "object" || npm === null || typeof npm.manifest !== "object" || npm.manifest === null || typeof npm.files !== "object" || npm.files === null) {
            console.error(`ace: install refused: ${node.name}@${node.version} is not a well-formed package`); return 1;
          }
          if (packageHash(np) !== node.package_hash) { console.error(`ace: install refused: package_hash mismatch for ${node.name}@${node.version} (lock pin violated)`); return 1; }
          const fh = contentHash(new TextEncoder().encode(JSON.stringify(np.files)));
          if (fh !== np.manifest.content_hash) { console.error(`ace: install refused: bad-content-hash in ${node.name}@${node.version}`); return 1; }
          const unsafe = validatePackagePaths(np);
          if (unsafe !== null) { console.error(`ace: install refused: unsafe file path in ${node.name}@${node.version}: ${unsafe}`); return 1; }
          const nv = verifySignature(np.manifest, trust);
          if (!nv.ok && nv.reason !== "no-signature") { console.error(`ace: install refused: ${nv.reason} for ${node.name}@${node.version}`); return 1; }
          if (!nv.ok && nv.reason === "no-signature" && !parsed.allowNoSignature) { console.error(`ace: install refused: unsigned ${node.name}@${node.version} (use --allow-no-signature)`); return 1; }
          const nph = packageHash(np);
          const prior = byStoreKey.get(np.manifest.content_hash);
          if (prior !== undefined && prior !== nph) { console.error(`ace: install refused: store-collision — ${node.name}@${node.version} shares a content_hash store key with a different package`); return 1; }
          byStoreKey.set(np.manifest.content_hash, nph);
          verified.push(np);
        }
        // PASS 2 (install-all) — only after the full graph verifies: nodes in lock order, then root.
        for (let i = 0; i < verified.length; i++) {
          const np = verified[i]!;
          const node = lf.nodes[i]!;
          const ir = installPackage(parsed.storePath, np);
          if (!ir.ok) { console.error(`ace: install refused: ${node.name}@${node.version}: ${ir.error}`); return 1; }
        }
        // Install the root last (already signature+content_hash verified above).
        const rootIr = installPackage(parsed.storePath, pkg);
        if (!rootIr.ok) { console.error(`ace: install refused: ${pkg.manifest.name} (root): ${rootIr.error}`); return 1; }
        console.error(`ace: installed ${lf.nodes.length + 1} from lockfile ${parsed.lockfile} (frozen)`);
        return 0;
      }
      const fetchPackage = async (u: string): Promise<string> =>
        (u.startsWith("http://") || u.startsWith("https://")) ? await (await fetch(u)).text() : readFileSync(u, "utf8");
      const registry = loadRegistry();
      const solveResult = await solve(pkg, fetchPackage, registry);
      if (!solveResult.ok) {
        console.error(`ace: install refused: ${solveResult.reason} — ${solveResult.detail} (path: ${solveResult.path.join(" → ")})`);
        return 1;
      }
      // Print the solved graph if --print-resolution was requested.
      if (parsed.printResolution) {
        for (const [n, v] of [...solveResult.versions].sort()) {
          console.log(`  ${n}@${v}`);
        }
      }
      const res = await resolve(pkg, fetchPackage, loadTrustStore(), registry, solveResult.versions, { allowNoSignature: parsed.allowNoSignature });
      if (!res.ok) {
        console.error(`ace: install refused: ${res.reason} — ${res.detail} (path: ${res.path.join(" → ")})`);
        return 1;
      }
      // PREFLIGHT (atomic): integrity + path-safety + store-key collision across the whole
      // graph BEFORE any extract. content_hash is verified first (including the root, which
      // the resolver does not re-check) so a tampered root cannot orphan already-extracted
      // leaves.
      const byStoreKey = new Map<string, string>(); // content_hash -> package_hash
      for (const node of res.order) {
        // D6 atomicity: verify every node's content_hash before any extraction (incl. root).
        const fh = contentHash(new TextEncoder().encode(JSON.stringify(node.files)));
        if (fh !== node.manifest.content_hash) { console.error(`ace: install refused: bad-content-hash in ${node.manifest.name}`); return 1; }
        const unsafe = validatePackagePaths(node);
        if (unsafe !== null) { console.error(`ace: install refused: unsafe file path in ${node.manifest.name}: ${unsafe}`); return 1; }
        const ph = packageHash(node);
        const prior = byStoreKey.get(node.manifest.content_hash);
        if (prior !== undefined && prior !== ph) { console.error(`ace: install refused: store-collision — ${node.manifest.name} shares a content_hash store key with a different package`); return 1; }
        byStoreKey.set(node.manifest.content_hash, ph);
      }
      // EXTRACT all, leaves first.
      for (const node of res.order) {
        const out = installPackage(parsed.storePath, node);
        if (!out.ok) { console.error(`ace: install failed mid-graph: ${out.error}`); return 1; }
      }
      // SLICE 5.3: write the lockfile (write failure is a warning, not a failed install).
      const lf = buildLockfile(pkg, res.order, registry);
      if ("error" in lf) {
        console.error(`ace: WARNING: could not build lockfile: ${lf.error}`);
      } else {
        try { writeFileSync(parsed.lockfile, serializeLockfile(lf)); }
        catch (e) { console.error(`ace: WARNING: could not write lockfile ${parsed.lockfile}: ${(e as Error).message}`); }
      }
      console.log(`ace: installed ${res.order.length}: ${res.order.map((p) => `${p.manifest.name}@${p.manifest.version}`).join(", ")}`);
      return 0;
    }

    // INTEGRITY + extract (slice 2, unchanged)
    const result = installPackage(parsed.storePath, pkg);
    if (!result.ok) { console.error(`ace: install refused: ${result.error}`); return 1; }
    if (signer) {
      console.log(`ace: integrity + authenticity verified (signed by ${signer.key_id}${signer.label ? " " + signer.label : ""}) -> ${result.dir}`);
    } else {
      console.log(`ace: installed ${pkg.manifest.name}@${pkg.manifest.version} -> ${result.dir}`);
      console.log("ace: integrity-verified (content hash). NOT authenticity-verified (--allow-no-signature).");
    }
    return 0;
  }

  if (parsed.command === "verify") {
    const pkgs = listInstalled(parsed.storePath);
    const found = pkgs.find((p) => p.hash === parsed.hash || p.manifest.content_hash === parsed.hash);
    if (!found) { console.error(`ace: no installed package with hash ${parsed.hash}`); return 1; }
    console.log(`ace: ${found.manifest.name}@${found.manifest.version} present (manifest hash ${found.manifest.content_hash})`);
    return 0;
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
