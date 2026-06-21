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
//   bun ca-cli.ts cert --user aaron --machine mymac --dry-run     # signs NOTHING
//   bun ca-cli.ts cert --user aaron --machine mymac               # sign that machine's pubkey -> cert
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCa, signMachineCert, realEffects, DEFAULT_CERT_VALIDITY } from "./ca.ts";
import { machinePubPath, sanitizeHostname } from "./machine.ts";
import { realBiometric } from "./biometric.ts";

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
// AGENT-RUN, OPERATOR-APPROVED: the shared biometric gate is the operator's authorization
// for the real keygen/sign path (fail-closed). Dry-run never invokes it.
const biometricAuth = realBiometric();

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
    // Printing the CA PUBLIC key is safe (it is the git-distributed trust root).
    if (r.caPublicKey !== undefined) console.log(r.caPublicKey);
    return 0;
  }

  if (mode === "cert") {
    const user = opt("--user") ?? "zeta";
    const machineRaw = opt("--machine");
    const machineId = sanitizeHostname(machineRaw ?? "");
    const validity = opt("--validity") ?? DEFAULT_CERT_VALIDITY;
    const dryRun = flag("--dry-run");
    // The device PUBLIC key is the machine.ts registry seam: the USER-INDEPENDENT
    // `machines/<host>.pub`. This cert (principal=<user>) is the (user × machine) binding.
    const devicePubPath = opt("--device-pub") ?? machinePubPath(repoRoot, machineId);
    const r = await signMachineCert(fx, { user, machineId, devicePubPath, validity, dryRun, biometricAuth });
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
      console.log(`[dry-run]   -> cert ${r.certPath} (id=${r.certId} principal=${r.principal} validity=${r.validity})`);
      return 0;
    }
    if (r.action === "aborted-biometric") {
      console.error(
        `blocked: biometric ${r.biometric?.reason ?? "not approved"} — NO cert signed (fail-closed).`,
      );
      return 1;
    }
    console.log(`action=${r.action} cert=${r.certPath}`);
    console.log(`  id=${r.certId} principal=${r.principal} validity=${r.validity}`);
    // The cert is public — safe to print.
    if (r.certText !== undefined) console.log(r.certText);
    return 0;
  }

  console.error(
    "usage:\n" +
      "  bun ca-cli.ts ca   --ca <name> [--dry-run] [--commit-pub]\n" +
      "  bun ca-cli.ts cert --user <name> --machine <host> [--validity +52w] [--dry-run]",
  );
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  });
