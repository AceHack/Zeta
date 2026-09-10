#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/seal-emulator-install.ts
 *
 * Runtime consumer of unseal-path.ts emulatorMatrixCell.
 * The GitHub job *installs* SoftHSM2 / swtpm, then this module
 * measures what is actually on disk. A cell that wants an
 * emulator the runner did not install is fail-missing.
 * skip-if-absent cannot wear pass.
 *
 * This does not start OpenBao, does not write Application.yaml,
 * and does not infer swtpm from `/dev/tpmrm0`. SoftHSM green is
 * not YubiHSM green. CardContact is metal, not this job.
 *
 * Cite: unseal-path.ts, seal-emulator-rung.ts,
 * docs/research/2026-09-05-ci-emulator-rung-softhsm-swtpm-witness-wiring-not-metal.md.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  emulatorMatrixCell,
  skipIfAbsentCannotWearPass,
  usbInstallSealFromPath,
  type IntegrateDecision,
  type UnsealPath,
  type UsbInstallSeal,
} from "./unseal-path.ts";

/** Ubuntu 24.04 + Fedora/RHEL well-known SoftHSM2 module paths. */
export const SOFTHSM2_MODULE_CANDIDATES: readonly string[] = [
  "/usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so",
  "/usr/lib/aarch64-linux-gnu/softhsm/libsofthsm2.so",
  "/usr/lib64/softhsm/libsofthsm2.so",
  "/usr/lib/softhsm/libsofthsm2.so",
];

export interface EmulatorFs {
  readonly fileExists: (path: string) => boolean;
  readonly commandOnPath: (name: string) => boolean;
}

export const REAL_FS: EmulatorFs = {
  fileExists: (path) => existsSync(path),
  // `$0` is the dummy name; `$1` is the binary. Do not pass `--` to
  // `command -v`: dash on some runners treats it as the operand.
  commandOnPath: (name) =>
    spawnSync("/bin/sh", ["-c", 'command -v "$1"', "sh", name], { stdio: "ignore" }).status === 0,
};

export function softhsmInstalled(fs: EmulatorFs): boolean {
  return SOFTHSM2_MODULE_CANDIDATES.some((p) => fs.fileExists(p)) || fs.commandOnPath("softhsm2-util");
}

export function swtpmInstalled(fs: EmulatorFs): boolean {
  return fs.commandOnPath("swtpm");
}

export function detectEmulators(fs: EmulatorFs = REAL_FS): {
  readonly softhsmInstalled: boolean;
  readonly swtpmInstalled: boolean;
} {
  return {
    softhsmInstalled: softhsmInstalled(fs),
    swtpmInstalled: swtpmInstalled(fs),
  };
}

/**
 * Inferring the CI TPM emulator from a kernel TPM device is the
 * cardinal failure named in seal-emulator-rung.ts.
 */
export function inferSwtpmFromKernelTpm(devTpmrm0Exists: boolean): boolean {
  void devTpmrm0Exists;
  return false;
}

export interface WitnessWant {
  readonly wantSofthsm: boolean;
  readonly wantSwtpm: boolean;
  readonly kindUnsealerPresent: boolean;
}

export function witnessInstall(want: WitnessWant, fs: EmulatorFs = REAL_FS): IntegrateDecision {
  if (skipIfAbsentCannotWearPass() !== false) {
    return { ok: false, reason: "fail-missing" };
  }
  const detected = detectEmulators(fs);
  return emulatorMatrixCell({
    wantSofthsm: want.wantSofthsm,
    wantSwtpm: want.wantSwtpm,
    softhsmInstalled: detected.softhsmInstalled,
    swtpmInstalled: detected.swtpmInstalled,
    kindUnsealerPresent: want.kindUnsealerPresent,
  });
}

export function parseWantFlag(raw: string | undefined): boolean {
  const v = (raw ?? "").trim();
  return v === "1" || v === "true" || v === "yes";
}

export function aptPackagesForCell(wantSofthsm: boolean, wantSwtpm: boolean): readonly string[] {
  const pkgs: string[] = [];
  if (wantSofthsm) pkgs.push("softhsm2");
  if (wantSwtpm) pkgs.push("swtpm");
  return pkgs;
}

/**
 * What the cell is *for*. SoftHSM wins when both were asked for
 * (one OpenBao seal). A dirty runner that has the other emulator
 * leftover must not report this path and still pass.
 */
export function expectedPathForCell(
  wantSofthsm: boolean,
  wantSwtpm: boolean,
  kindUnsealerPresent: boolean,
): UnsealPath | undefined {
  if (wantSofthsm) return "ci-softhsm";
  if (wantSwtpm) return "ci-swtpm";
  if (kindUnsealerPresent) return "kind-shamir";
  return undefined;
}

/** Same three rungs USB install speaks. CI tests all three independently. */
export function expectedLadderForCell(
  wantSofthsm: boolean,
  wantSwtpm: boolean,
  kindUnsealerPresent: boolean,
): UsbInstallSeal | undefined {
  const path = expectedPathForCell(wantSofthsm, wantSwtpm, kindUnsealerPresent);
  return path === undefined ? undefined : usbInstallSealFromPath(path);
}

function parseArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const a of argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return undefined;
}

export function main(argv: readonly string[], fs: EmulatorFs = REAL_FS): number {
  const wantSofthsm = parseWantFlag(parseArg(argv, "want-softhsm"));
  const wantSwtpm = parseWantFlag(parseArg(argv, "want-swtpm"));
  const kindUnsealerPresent = parseWantFlag(parseArg(argv, "kind-unsealer") ?? "1");
  const expectPath = parseArg(argv, "expect-path");
  const expectLadder = parseArg(argv, "expect-ladder");
  const decision = witnessInstall({ wantSofthsm, wantSwtpm, kindUnsealerPresent }, fs);
  if (!decision.ok) {
    process.stderr.write(`seal-emulator-install: ${decision.reason}\n`);
    return 1;
  }
  const ladder = usbInstallSealFromPath(decision.path);
  if (expectPath !== undefined && expectPath !== decision.path) {
    process.stderr.write(
      `seal-emulator-install: expected path=${expectPath} got path=${decision.path} mechanism=${decision.mechanism} ladder=${ladder}\n`,
    );
    return 1;
  }
  if (expectLadder !== undefined && expectLadder !== ladder) {
    process.stderr.write(
      `seal-emulator-install: expected ladder=${expectLadder} got ladder=${ladder} path=${decision.path}\n`,
    );
    return 1;
  }
  process.stdout.write(`seal-emulator-install: path=${decision.path} mechanism=${decision.mechanism} ladder=${ladder}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
