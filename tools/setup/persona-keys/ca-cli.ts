// Zeta SSH-CA CLI — a thin shell around the pure oracle (ca.ts). Two modes, both
// OPERATOR-RUN and security-class:
//   ca   (GATED) — generate the SSH CA keypair (private stays LOCAL under umask 077);
//                  --commit-pub writes ONLY the CA PUBLIC key to maintainers/<ca>/ssh-ca.pub
//                  (no git commit — the operator commits). --dry-run generates NOTHING.
//   cert (GATED) — sign a per-machine device PUBLIC key into a cert
//                  (`principal=<user>` + machine id + validity window). --dry-run signs NOTHING.
// SECURITY: the CA PRIVATE key + any seed NEVER reach argv/stdout/git. Only the CA PUBLIC key
// and certs (public) are printed/written. CA-keypair generation is operator-run. See ca.ts.
//
// Usage:
//   bun ca-cli.ts ca   --ca aaron --dry-run                       # generates NOTHING
//   bun ca-cli.ts ca   --ca aaron                                 # generate local CA key
//   bun ca-cli.ts ca   --ca aaron --commit-pub                    # + write CA pubkey to repo (no commit)
//   bun ca-cli.ts ca   --ca aaron --shamir 2-of-3                  # generate + split private key into shares (one fingerprint)
//   bun ca-cli.ts frost-ca --ca aaron --frost 2-of-3 --confirm     # threshold CA shares (live signing path)
//   bun ca-cli.ts cert --user aaron --machine mymac --dry-run     # signs NOTHING (single owner)
//   bun ca-cli.ts cert --user aaron --machine mymac               # sign that machine's pubkey -> cert
//   bun ca-cli.ts frost-cert --user aaron --machine mymac --confirm  # frost device attestation (no key reassembly)
//   bun ca-cli.ts cert --users aaron,addison --machine d --dry-run # multi-owner plan (NOTHING signed)
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCa, signMachineCert, realEffects, DEFAULT_CERT_VALIDITY } from "./ca.ts";
import { machinePubPath, sanitizeHostname } from "./machine.ts";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import {
  formatSplitCaShamir,
  realEffects as shamirRealFx,
  splitCaToShares,
} from "./ca-shamir-custody.ts";
import {
  ensureFrostCa,
  formatEnsureFrostCa,
  formatSignFrostAttestation,
  realEffects as frostCaRealFx,
  signFrostDeviceAttestation,
} from "./frost-ca-custody.ts";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const mode = args[0];
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

// Repo root: 3 levels up from tools/setup/persona-keys/ (override with --repo-root for tests).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = opt("--repo-root") ?? resolve(here, "..", "..", "..");
const fx = realEffects();
const shamirSpec = opt("--shamir");
const frostModes = mode === "frost-ca" || mode === "frost-cert" || shamirSpec !== undefined;
// One fingerprint covers CA gen + Shamir split, or frost-ca / frost-cert.
const biometricSession = frostModes ? sessionBiometric(realBiometric()) : undefined;
const biometricAuth = biometricSession?.door ?? realBiometric();

async function main(): Promise<number> {
  if (mode === "ca") {
    const ca = opt("--ca") ?? "zeta";
    const dryRun = flag("--dry-run");
    const commitPub = flag("--commit-pub");
    const r = await ensureCa(fx, { ca, repoRoot, dryRun, commitPub, biometricAuth });
    if (r.dryRun) {
      console.log(`[dry-run] action=${r.action} (NOTHING generated or written)`);
      console.log(`[dry-run] would write CA private key to: ${r.caPrivatePath}`);
      if (commitPub) console.log(`[dry-run] would write CA PUBLIC key to: ${r.caPublicPath}`);
      return 0;
    }
    if (r.action === "aborted-biometric") {
      console.error(
        `blocked: biometric ${r.biometric?.reason ?? "not approved"} — NO CA key generated (fail-closed).`,
      );
      return 1;
    }
    console.log(`action=${r.action} ca=${ca}`);
    console.log(`CA private key (local only): ${r.caPrivatePath}`);
    if (r.committedPub) console.log(`wrote CA PUBLIC key -> ${r.caPublicPath} (NOT committed; you commit it)`);
    if (shamirSpec !== undefined && (r.action === "generated" || r.action === "exists")) {
      const sr = await splitCaToShares(shamirRealFx(), {
        ca,
        shamir: shamirSpec,
        confirm: true,
        biometricAuth,
      });
      console.log(formatSplitCaShamir(sr));
      if (sr.action === "skipped-biometric" || sr.action === "no-ca" || sr.action === "failed") return 1;
    }
    // Printing the CA PUBLIC key is safe (it is the git-distributed trust root).
    if (r.caPublicKey !== undefined) console.log(r.caPublicKey);
    return 0;
  }

  if (mode === "cert") {
    const machineRaw = opt("--machine");
    const machineId = sanitizeHostname(machineRaw ?? "");
    const validity = opt("--validity") ?? DEFAULT_CERT_VALIDITY;
    const dryRun = flag("--dry-run");
    // The device PUBLIC key is the machine.ts registry seam: the USER-INDEPENDENT
    // `machines/<host>.pub`. The cert's principals are the (user × machine) binding.
    const devicePubPath = opt("--device-pub") ?? machinePubPath(repoRoot, machineId);
    // AUTHORIZED USER LIST: `--users aaron,addison` for a co-owned machine; `--user aaron` is the
    // single-owner shorthand. The comma-joined value becomes the cert's `-n` principals; the Key
    // ID stays machine-only. The (user × machine) pairing lives in the LIST, never a composite id.
    const usersFlag = opt("--users");
    const users =
      usersFlag !== undefined
        ? usersFlag.split(",").map((u) => u.trim()).filter((u) => u.length > 0)
        : [opt("--user") ?? "zeta"];
    const r = await signMachineCert(fx, { users, machineId, devicePubPath, validity, dryRun, biometricAuth });
    if (r.action === "no-ca") {
      console.error(`blocked: no CA private key at ${r.caPrivatePath} — run 'ca-cli.ts ca' first.`);
      return 3;
    }
    if (r.action === "no-device-key") {
      console.error(`blocked: no device pubkey at ${r.devicePubPath} — run machine-cli.ts machine --publish first.`);
      return 3;
    }
    if (r.dryRun) {
      console.log(`[dry-run] action=${r.action} (NOTHING signed)`);
      console.log(`[dry-run] would sign ${r.devicePubPath}`);
      console.log(`[dry-run]   -> cert ${r.certPath} (id=${r.certId} principals=${r.principal} validity=${r.validity})`);
      return 0;
    }
    if (r.action === "aborted-biometric") {
      console.error(
        `blocked: biometric ${r.biometric?.reason ?? "not approved"} — NO cert signed (fail-closed).`,
      );
      return 1;
    }
    console.log(`action=${r.action} cert=${r.certPath}`);
    console.log(`  id=${r.certId} principals=${r.principal} validity=${r.validity}`);
    // The cert is public — safe to print.
    if (r.certText !== undefined) console.log(r.certText);
    return 0;
  }

  if (mode === "frost-ca") {
    const ca = opt("--ca") ?? "zeta";
    const frost = opt("--frost") ?? "2-of-3";
    const confirm = flag("--confirm");
    const dryRun = !confirm;
    const home = opt("--home") ?? homedir();
    const r = await ensureFrostCa(frostCaRealFx(), {
      ca,
      repoRoot,
      home,
      frost,
      dryRun,
      confirm,
      commitPub: flag("--commit-pub"),
      biometricAuth,
    });
    console.log(formatEnsureFrostCa(r));
    if (r.action === "skipped-biometric") return 1;
    return 0;
  }

  if (mode === "frost-cert") {
    const ca = opt("--ca") ?? opt("--user") ?? "zeta";
    const machineRaw = opt("--machine");
    const machineId = sanitizeHostname(machineRaw ?? "");
    const confirm = flag("--confirm");
    const dryRun = !confirm;
    const home = opt("--home") ?? homedir();
    const devicePubPath = opt("--device-pub") ?? machinePubPath(repoRoot, machineId);
    const validity = opt("--validity");
    const usersFlag = opt("--users");
    const users =
      usersFlag !== undefined
        ? usersFlag.split(",").map((u) => u.trim()).filter((u) => u.length > 0)
        : [opt("--user") ?? "zeta"];
    const r = await signFrostDeviceAttestation(frostCaRealFx(), {
      ca,
      repoRoot,
      home,
      machineId,
      devicePubPath,
      users,
      dryRun,
      confirm,
      biometricAuth,
      ...(validity !== undefined ? { validity } : {}),
    });
    console.log(formatSignFrostAttestation(r));
    if (
      r.action === "no-frost-ca" ||
      r.action === "no-device-key" ||
      r.action === "skipped-biometric" ||
      r.action === "failed" ||
      r.action === "insufficient-shares"
    ) {
      return 1;
    }
    return 0;
  }

  console.error(
    "usage:\n" +
      "  bun ca-cli.ts ca   --ca <name> [--dry-run] [--commit-pub] [--shamir <k-of-n>]\n" +
      "  bun ca-cli.ts frost-ca --ca <name> --frost <k-of-n> [--confirm] [--commit-pub]\n" +
      "  bun ca-cli.ts cert (--user <name> | --users a,b) --machine <host> [--validity +52w] [--dry-run]\n" +
      "  bun ca-cli.ts frost-cert (--user <name> | --users a,b) --machine <host> [--confirm]",
  );
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
