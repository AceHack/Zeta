#!/usr/bin/env bun
// ca-shamir-cli.ts — Shamir k-of-n custody for the LOCAL CA private key (081KVP3GYW1 custody slice).
//
// Usage:
//   bun ca-shamir-cli.ts split --ca aaron --shamir 2-of-3                    # dry-run (default)
//   bun ca-shamir-cli.ts split --ca aaron --shamir 2-of-3 --confirm          # write share files (one fingerprint)
//   bun ca-shamir-cli.ts combine --ca aaron --threshold 2 --confirm        # reconstruct from shares in default dir
//   bun ca-shamir-cli.ts combine --ca aaron --threshold 2 --shares 1,3 --confirm
import { homedir } from "node:os";
import { resolve as resolvePath } from "node:path";
import { realBiometric, sessionBiometric } from "./biometric.ts";
import {
  combineSharesToCa,
  formatCombineCaShamir,
  formatSplitCaShamir,
  realEffects,
  splitCaToShares,
} from "./ca-shamir-custody.ts";

const args = process.argv.slice(2);
const mode = args[0];
const flag = (n: string): boolean => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const home = opt("--home") ?? homedir();
const confirm = flag("--confirm");
const dryRun = !confirm;

function usage(): void {
  process.stderr.write(
    "usage:\n" +
      "  bun ca-shamir-cli.ts split --ca <name> --shamir <k-of-n> [--label active] [--private-key <path>] [--home <path>] [--confirm]\n" +
      "  bun ca-shamir-cli.ts combine --ca <name> --threshold <k> [--shares 1,2] [--shares-dir <path>] [--output <path>] [--home <path>] [--confirm]\n" +
      "  DEFAULT: dry-run — reports plan only; --confirm + one biometric for real split/combine.\n",
  );
}

async function main(): Promise<number> {
  const ca = opt("--ca");
  if (!ca?.trim()) {
    usage();
    return 2;
  }

  const session = sessionBiometric(realBiometric());
  const fx = realEffects();

  if (mode === "split") {
    const shamir = opt("--shamir");
    if (!shamir?.trim()) {
      usage();
      process.stderr.write("error: --shamir <k-of-n> is required for split\n");
      return 2;
    }
    const privateKeyPath = opt("--private-key");
    const label = opt("--label");
    const res = await splitCaToShares(fx, {
      ca,
      home,
      shamir,
      dryRun,
      confirm,
      biometricAuth: session.door,
      ...(privateKeyPath ? { privateKeyPath: resolvePath(privateKeyPath) } : {}),
      ...(label ? { label } : {}),
    });
    process.stdout.write(`${formatSplitCaShamir(res)}\n`);
    if (res.action === "no-ca" || res.action === "skipped-biometric" || res.action === "failed") return 1;
    return 0;
  }

  if (mode === "combine") {
    const thresholdRaw = opt("--threshold");
    if (thresholdRaw === undefined) {
      usage();
      process.stderr.write("error: --threshold <k> is required for combine\n");
      return 2;
    }
    const threshold = Number(thresholdRaw);
    if (!Number.isInteger(threshold) || threshold < 1) {
      process.stderr.write("error: --threshold must be a positive integer\n");
      return 2;
    }
    const sharesArg = opt("--shares");
    const shareIndices =
      sharesArg === undefined
        ? undefined
        : sharesArg
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((s) => Number(s));
    const sharesDir = opt("--shares-dir");
    const output = opt("--output");
    const res = await combineSharesToCa(fx, {
      ca,
      home,
      threshold,
      dryRun,
      confirm,
      biometricAuth: session.door,
      ...(shareIndices !== undefined ? { shareIndices } : {}),
      ...(sharesDir ? { sharesDir: resolvePath(sharesDir) } : {}),
      ...(output ? { outputPrivateKeyPath: resolvePath(output) } : {}),
    });
    process.stdout.write(`${formatCombineCaShamir(res)}\n`);
    if (
      res.action === "insufficient-shares" ||
      res.action === "skipped-biometric" ||
      res.action === "failed"
    ) {
      return 1;
    }
    return 0;
  }

  usage();
  return 2;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
      process.exit(1);
    });
}

export { main };
