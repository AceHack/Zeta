#!/usr/bin/env bun
// frost-cli.ts — FROST-shaped threshold Schnorr oracle (slice 1).
// Monorepo tools path: lives beside shamir / ca-shamir-custody (tools-over-trunks).
//
// Usage:
//   bun frost-cli.ts keygen --threshold 2 --participants 3
//   bun frost-cli.ts keygen ... | bun frost-cli.ts sign --message "hello"
import { readFileSync } from "node:fs";
import { frostKeygen, frostThresholdSign, frostVerify } from "./frost.ts";

const args = process.argv.slice(2);
const mode = args[0];
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

function usage(): void {
  process.stderr.write(
    "usage:\n" +
      "  bun frost-cli.ts keygen --threshold <k> --participants <n>\n" +
      "  bun frost-cli.ts sign --message <text>   # stdin: keygen JSON; uses first k shares\n",
  );
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function main(): number {
  if (mode === "keygen") {
    const k = Number(opt("--threshold") ?? "2");
    const n = Number(opt("--participants") ?? "3");
    const kg = frostKeygen(k, n);
    const out = {
      groupPublicKeyHex: bytesToHex(kg.groupPublicKey),
      threshold: kg.threshold,
      shares: kg.shares.map((s) => ({
        x: s.x,
        secretShare: s.secretShare.toString(10),
      })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return 0;
  }

  if (mode === "sign") {
    const message = opt("--message");
    if (message === undefined) {
      usage();
      return 2;
    }
    const stdin = readFileSync(0, "utf8");
    const kg = JSON.parse(stdin) as {
      groupPublicKeyHex: string;
      threshold: number;
      shares: Array<{ x: number; secretShare: string }>;
    };
    const groupPublicKey = hexToBytes(kg.groupPublicKeyHex);
    const shares = kg.shares.map((s) => ({
      x: s.x,
      secretShare: BigInt(s.secretShare),
    }));
    const msg = new TextEncoder().encode(message);
    const sig = frostThresholdSign(
      groupPublicKey,
      shares.slice(0, kg.threshold),
      msg,
      undefined,
      kg.threshold,
    );
    const ok = frostVerify(groupPublicKey, msg, sig);
    process.stdout.write(
      JSON.stringify({ signatureHex: bytesToHex(sig), verified: ok }, null, 2) + "\n",
    );
    return ok ? 0 : 1;
  }

  usage();
  return 2;
}

process.exit(main());
