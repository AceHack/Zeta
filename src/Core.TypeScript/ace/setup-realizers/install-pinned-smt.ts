#!/usr/bin/env bun
/**
 * install-pinned-smt — put z3 4.16.0 and cvc5 1.3.4 on PATH when apt is too old.
 *
 * WHY (081KZZ27KJ8). Ubuntu 24.04 apt gives the CI runner z3 4.8.12 and
 * cvc5 1.1.2. Two committed certificates do not discharge under that pair
 * and discharge in well under a second under 4.16.0 / 1.3.4. The runners
 * used to soft-skip those legs. This script pins the GitHub-release
 * binaries (checksummed) into ~/.local/bin so the TS-suite job runs the
 * certificates. The skip-floor is gone (081KZZ27KJ8, second half).
 *
 * Usage: bun src/Core.TypeScript/ace/setup-realizers/install-pinned-smt.ts
 */
import { mkdirSync, mkdtempSync, rmSync, chmodSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { curlFetchToFile, verifySha256File } from "./curl-fetch.ts";

export const Z3_PIN = "4.16.0";
export const CVC5_PIN = "1.3.4";

export interface ReleasePin {
  readonly url: string;
  readonly sha256: string;
  readonly binaryName: "z3" | "cvc5";
}

export const LINUX_PINS: Readonly<Record<"linux-x64" | "linux-arm64", readonly ReleasePin[]>> = {
  "linux-x64": [
    {
      binaryName: "z3",
      url: "https://github.com/Z3Prover/z3/releases/download/z3-4.16.0/z3-4.16.0-x64-glibc-2.39.zip",
      sha256: "7288c49a5bd6dbafd7b0b0d1f65956b91672da24b08f09242919af159be3418e",
    },
    {
      binaryName: "cvc5",
      url: "https://github.com/cvc5/cvc5/releases/download/cvc5-1.3.4/cvc5-Linux-x86_64-static.zip",
      sha256: "dcdbfada0ce493ee98259c0816e0daafc561c223aadb3af298c2968e73ea39c6",
    },
  ],
  "linux-arm64": [
    {
      binaryName: "z3",
      url: "https://github.com/Z3Prover/z3/releases/download/z3-4.16.0/z3-4.16.0-arm64-glibc-2.38.zip",
      sha256: "87fcd963d3eecb0f12cf1c3ef0ad74e84a3a7bd3caed5d94445645ef94ae6274",
    },
    {
      binaryName: "cvc5",
      url: "https://github.com/cvc5/cvc5/releases/download/cvc5-1.3.4/cvc5-Linux-arm64-static.zip",
      sha256: "2a4c108367f20b0c8990abd6b9535a5d62e08908d471d4671c00734e408f85bc",
    },
  ],
};

export function hostKey(): "linux-x64" | "linux-arm64" | null {
  if (process.platform !== "linux") return null;
  if (process.arch === "x64") return "linux-x64";
  if (process.arch === "arm64") return "linux-arm64";
  return null;
}

function versionOf(bin: string): string | null {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = (r.stdout + r.stderr).match(/(\d+\.\d+\.\d+)/);
  return m?.[1] ?? null;
}

function versionKey(v: string): number {
  const [a = 0, b = 0, c = 0] = v.split(".").map(Number);
  return a * 1_000_000 + b * 1_000 + c;
}

export function meetsPin(installed: string | null, pin: string): boolean {
  if (installed === null) return false;
  return versionKey(installed) >= versionKey(pin);
}

function findNamedBinary(root: string, name: string): string | null {
  const entries = readdirSync(root);
  for (const e of entries) {
    const p = join(root, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      const hit = findNamedBinary(p, name);
      if (hit !== null) return hit;
    } else if (e === name || e === `${name}.exe`) {
      return p;
    }
  }
  return null;
}

async function installOne(pin: ReleasePin, destDir: string): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), `smt-${pin.binaryName}-`));
  try {
    const zip = join(work, "asset.zip");
    await curlFetchToFile(zip, pin.url);
    verifySha256File(zip, pin.sha256);
    const unpacked = join(work, "unpacked");
    mkdirSync(unpacked);
    const unzip = spawnSync("unzip", ["-q", zip, "-d", unpacked], { encoding: "utf8" });
    if (unzip.status !== 0) {
      throw new Error(`unzip failed for ${pin.url}: ${unzip.stderr}`);
    }
    const found = findNamedBinary(unpacked, pin.binaryName);
    if (found === null) throw new Error(`no ${pin.binaryName} binary inside ${pin.url}`);
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, pin.binaryName);
    copyFileSync(found, dest);
    chmodSync(dest, 0o755);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function installPinnedSmt(destDir: string = join(homedir(), ".local", "bin")): Promise<string> {
  const key = hostKey();
  if (key === null) {
    return `skip: host ${process.platform}/${process.arch} is not a Linux CI pin target`;
  }
  const z3Have = versionOf("z3");
  const cvc5Have = versionOf("cvc5");
  const needZ3 = !meetsPin(z3Have, Z3_PIN);
  const needCvc5 = !meetsPin(cvc5Have, CVC5_PIN);
  if (!needZ3 && !needCvc5) {
    return `ok: z3 ${z3Have} and cvc5 ${cvc5Have} already meet ${Z3_PIN}/${CVC5_PIN}`;
  }
  const pins = LINUX_PINS[key];
  for (const pin of pins) {
    const have = pin.binaryName === "z3" ? z3Have : cvc5Have;
    const want = pin.binaryName === "z3" ? Z3_PIN : CVC5_PIN;
    if (meetsPin(have, want)) continue;
    await installOne(pin, destDir);
  }
  return `installed pins for ${key} into ${destDir}`;
}

if (import.meta.main) {
  const msg = await installPinnedSmt();
  console.log(`[install-pinned-smt] ${msg}`);
}
