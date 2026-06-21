#!/usr/bin/env bun
// Zeta setup-cluster CLI — the ONE-command, ONE-fingerprint entry point for standing up a NEW
// cluster's trust root, and for cross-cluster trust. A thin shell around the pure orchestrator
// (setup-cluster.ts → ca.ts). It owns NO key/biometric/seed logic of its own:
//
//   * It builds ONE `sessionBiometric` door over the real biometric gate and hands it to
//     `ensureCa`, so generating the CA keypair takes the operator's Touch ID / Hello ONCE.
//   * It RENDERS (never destructively activates) the multi-CA `TrustedUserCAKeys` trust set:
//     this cluster's CA pubkey + any --trust-peer CA pubkeys (cross-cluster trust). PUBLIC
//     keys only. It writes the rendered trust-set file + the CA pubkey (NOT committed — the
//     operator commits + imports + nixos-rebuild).
//   * `--dry-run` prompts NOTHING, generates NOTHING, writes NOTHING.
//
// Usage:
//   bun setup-cluster-cli.ts --ca acme --dry-run                 # plan only — NOTHING is done
//   bun setup-cluster-cli.ts --ca acme                           # generate CA + render trust set
//   bun setup-cluster-cli.ts --ca acme --trust-peer peer-ca.pub  # also trust a peer cluster's CA
//   bun setup-cluster-cli.ts --ca acme --trust-peer a.pub --trust-peer b.pub   # multiple peers
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { realEffects as realCaEffects } from "./ca.ts";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import {
  formatSetupCluster,
  setupCluster,
  type PeerCa,
  type SetupClusterOptions,
} from "./setup-cluster.ts";

const args = process.argv.slice(2);
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const allOpts = (n: string): readonly string[] => {
  const out: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === n) {
      const v = args[i + 1];
      if (v !== undefined) out.push(v);
    }
  }
  return out;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolvePath(here, "..", "..", "..");
const ca = opt("--ca");
const home = opt("--home") ?? homedir();
const dryRun = flag("--dry-run");
const peerPaths = allOpts("--trust-peer");

function usage(): void {
  process.stderr.write(
    "usage: bun setup-cluster-cli.ts --ca <name> [--trust-peer <peer-ca.pub> ...] " +
      "[--dry-run] [--repo-root <path>] [--home <path>]\n" +
      "  ONE command, ONE fingerprint: generate this cluster's CA -> render the multi-CA\n" +
      "  TrustedUserCAKeys trust set (self CA + any peer CAs) -> print next steps.\n" +
      "  Cross-cluster trust: --trust-peer adds a PEER cluster's CA PUBLIC key to the trust set.\n" +
      "  Reuse-only: all key/biometric logic delegated to ca.ts. --dry-run does NOTHING.\n",
  );
}

/** Load a peer CA PUBLIC key from a file. PUBLIC keys only — the pure renderer rejects anything
 *  that does not look like an SSH public key (or that looks private). */
function loadPeer(path: string): PeerCa {
  const text = readFileSync(path, "utf8");
  return { name: basename(path).replace(/\.pub$/, ""), publicKey: text };
}

async function main(): Promise<number> {
  if (ca === undefined || ca.trim().length === 0) {
    usage();
    process.stderr.write("error: --ca <name> is required\n");
    return 2;
  }

  const peers: PeerCa[] = peerPaths.map(loadPeer);

  // ── THE ONE FINGERPRINT ─────────────────────────────────────────────────────────────────
  // ONE session door over the real biometric gate; ensureCa rides the SAME door so the human is
  // prompted at most once. FAIL-CLOSED: a declined approval poisons the session → no CA.
  const session = sessionBiometric(realBiometric());

  const fx = realCaEffects();
  const opts: SetupClusterOptions = {
    ca,
    repoRoot,
    home,
    dryRun,
    ...(peers.length > 0 ? { peers } : {}),
  };

  const res = await setupCluster(fx, session, opts);
  process.stdout.write(formatSetupCluster(res) + "\n");

  // On a real run, WRITE the rendered trust-set file (PUBLIC only) next to the CA pubkey so the
  // operator can commit + import it. NEVER on dry-run. The CA pubkey itself is written by ca.ts
  // (commitPub). We never git-commit; the operator does.
  if (!dryRun && res.caResult.action !== "aborted-biometric") {
    const p = res.rendered.trustedUserCaKeysPath;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, res.rendered.trustedUserCaKeysFile, { mode: 0o644 });
    process.stdout.write(`wrote multi-CA trust set -> ${p} (NOT committed; you commit it)\n`);
  }

  if (res.caResult.action === "aborted-biometric") return 1;
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
