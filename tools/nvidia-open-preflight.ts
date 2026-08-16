#!/usr/bin/env bun
// nvidia-open-preflight.ts — decide whether ONE node may set
// `hardware.nvidia.open = true`.
//
// Run this ON the candidate GPU node, while it is still running the CLOSED
// kernel module (that is the point: the closed module binds every generation
// from Maxwell through Blackwell-minus-one, so the driver is up and can be
// asked what the cards actually are). Exit 0 = every NVIDIA GPU in this box is
// Turing or newer, so the open kernel module can bind them. Exit 1 = at least
// one card cannot, and flipping the flag would leave this node without a
// working driver.
//
// WHY COMPUTE CAPABILITY AND NOT A PCI-ID TABLE
// ---------------------------------------------
// The open kernel modules depend on the GPU System Processor (GSP), first
// introduced in Turing; pre-Turing silicon has no GSP, so the open modules
// cannot support Maxwell, Pascal or Volta at all. NVIDIA's own architecture
// boundary is therefore Turing, and CUDA compute capability is a monotone,
// driver-reported encoding of exactly that boundary:
//
//     Maxwell 5.x · Pascal 6.x · Volta 7.0 / 7.2   -> NO GSP, open cannot bind
//     Turing  7.5 · Ampere 8.0-8.7 · Ada 8.9
//     Hopper  9.0 · Blackwell 10.x / 12.x          -> GSP, open binds
//
// so `compute_cap >= 7.5` is the test. It is read from the driver rather than
// from a hand-maintained device-ID list, which is the whole reason to prefer
// it — NVIDIA PCI device IDs are not ordered by architecture, so any local
// table is a guess that silently rots. Volta at 7.0/7.2 is the case a
// "7 or above" shortcut would get wrong; the threshold is 7.5, not 7.
//
// THE OTHER DIRECTION, WHICH IS NOT SYMMETRIC
// -------------------------------------------
// From the R560 driver series the open modules are the default for Turing and
// newer, and for Blackwell (RTX 50-series, compute capability 10.x/12.x) the
// proprietary module is not offered at all — those cards REQUIRE open. So a
// node holding a Blackwell card cannot run `open = false`, and on such a node
// this script passing is not merely permission to flip, it is notice that the
// flag is already wrong.
//
// Anchors (checked, not merely cited):
//   NVIDIA, "Open Linux Kernel Modules", README ch. 44/45 (515.43.04,
//     580.105.08) — GSP dependency; Turing-and-later support statement.
//   NVIDIA, "NVIDIA Transitions Fully Towards Open-Source GPU Kernel Modules"
//     (developer blog, R560) — open becomes the default for Turing and newer.
//   NVIDIA Driver Installation Guide, "Kernel Modules" — proprietary flavour
//     spans Maxwell..Turing and later "until Blackwell"; Blackwell and Grace
//     Hopper require the open flavour.
//   NVIDIA CUDA C Programming Guide, compute-capability table — the
//     architecture-to-capability mapping behind the 7.5 threshold.
//
// Usage (bun is on cluster nodes via mise; see nixos/modules/common.nix):
//   bun tools/nvidia-open-preflight.ts
//   bun tools/nvidia-open-preflight.ts --quiet     # exit code only
//
// On pass, record the result in that host's NixOS config:
//   zeta.gpu.openModulePreflight.passed   = true;
//   zeta.gpu.openModulePreflight.evidence = "<date>, <host>: <cards + cc>";
//   hardware.nvidia.open = lib.mkForce true;
//
// This establishes what the SILICON can do. It does not benchmark, and it does
// not verify that CUDA, the container toolkit, or a GPU pod still work after
// the flip — those are separate, and they are still unexercised.

import { spawnSync } from "node:child_process";

/** Minimum compute capability whose silicon carries a GSP. Turing == 7.5. */
export const MIN_MAJOR = 7;
export const MIN_MINOR = 5;

/** Capability at or above which no proprietary kernel module exists at all. */
export const BLACKWELL_MAJOR = 10;

export type GpuStatus = "ok" | "requires-open" | "blocking-pre-turing" | "blocking-unreadable";

export interface GpuVerdict {
  readonly index: string;
  readonly name: string;
  readonly capability: string;
  readonly status: GpuStatus;
}

export interface RosterVerdict {
  readonly gpus: readonly GpuVerdict[];
  readonly blocking: number;
  readonly requiresOpen: number;
  /** True only when at least one GPU was seen and none of them block. */
  readonly pass: boolean;
}

function classify(capability: string): GpuStatus {
  const m = /^(\d+)\.(\d+)$/.exec(capability.trim());
  if (m === null) return "blocking-unreadable";

  const major = Number.parseInt(m[1] as string, 10);
  const minor = Number.parseInt(m[2] as string, 10);

  const turingOrNewer = major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
  if (!turingOrNewer) return "blocking-pre-turing";

  return major >= BLACKWELL_MAJOR ? "requires-open" : "ok";
}

/**
 * Decide a whole node from `nvidia-smi --query-gpu=index,name,compute_cap
 * --format=csv,noheader` output. Pure: this is the part worth testing, and it
 * is tested without any GPU present.
 */
export function evaluateRoster(csv: string): RosterVerdict {
  const gpus: GpuVerdict[] = [];

  for (const raw of csv.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    const fields = line.split(",");
    const index = (fields[0] ?? "").trim();
    // Card names can themselves contain a comma; capability is always last.
    const capability = (fields.length > 1 ? (fields[fields.length - 1] as string) : "").trim();
    const name = fields.slice(1, -1).join(",").trim();

    gpus.push({ index, name, capability, status: classify(capability) });
  }

  const blocking = gpus.filter((g) => g.status.startsWith("blocking")).length;
  const requiresOpen = gpus.filter((g) => g.status === "requires-open").length;

  return { gpus, blocking, requiresOpen, pass: gpus.length > 0 && blocking === 0 };
}

/** Human-readable report. Separated from the decision so neither can drift. */
export function renderReport(v: RosterVerdict): string {
  const out: string[] = [
    `NVIDIA open-kernel-module preflight — threshold: compute capability >= ${MIN_MAJOR}.${MIN_MINOR} (Turing)`,
    "",
  ];

  for (const g of v.gpus) {
    switch (g.status) {
      case "ok":
        out.push(`  [${g.index}] ${g.name}: cc ${g.capability} — OK (GSP present)`);
        break;
      case "requires-open":
        out.push(
          `  [${g.index}] ${g.name}: cc ${g.capability} — OK, and REQUIRES the open module (Blackwell or newer)`,
        );
        break;
      case "blocking-pre-turing":
        out.push(
          `  [${g.index}] ${g.name}: cc ${g.capability} — BLOCKING (pre-Turing, no GSP; open module cannot bind)`,
        );
        break;
      case "blocking-unreadable":
        out.push(
          `  [${g.index}] ${g.name}: UNREADABLE compute capability (${g.capability}) — treated as BLOCKING`,
        );
        break;
    }
  }

  out.push("", `GPUs seen: ${v.gpus.length}   blocking: ${v.blocking}`, "");

  if (v.gpus.length === 0) {
    out.push(
      "FAIL: no NVIDIA GPUs reported on this node.",
      "      Nothing to attest. Do not set hardware.nvidia.open on a node whose",
      "      GPUs this check never saw.",
    );
    return out.join("\n");
  }

  if (!v.pass) {
    out.push(
      "RESULT: DO NOT set hardware.nvidia.open = true on this node.",
      `        ${v.blocking} of ${v.gpus.length} card(s) would lose their driver.`,
    );
    return out.join("\n");
  }

  out.push("RESULT: this node's silicon can run the open kernel modules.");
  if (v.requiresOpen > 0) {
    out.push(
      `        NOTE: ${v.requiresOpen} card(s) are Blackwell or newer and have NO`,
      "        proprietary kernel module available. For those, open = false is",
      "        not the conservative option — it is the broken one.",
    );
  }
  out.push(
    "",
    "        Still unexercised by this check: CUDA, the container toolkit, GPU",
    "        pod scheduling, and any performance comparison. Bench before you",
    "        call the flip verified.",
  );
  return out.join("\n");
}

function main(argv: readonly string[]): number {
  const quiet = argv.includes("--quiet");
  const say = (s: string): void => {
    if (!quiet) process.stdout.write(`${s}\n`);
  };

  const probe = spawnSync("nvidia-smi", ["--query-gpu=index,name,compute_cap", "--format=csv,noheader"], {
    encoding: "utf8",
  });

  if (probe.error !== undefined && (probe.error as NodeJS.ErrnoException).code === "ENOENT") {
    say("FAIL: nvidia-smi not found.");
    say("      Run this on the GPU node itself, with the CURRENT driver loaded.");
    say("      A node whose driver is already broken cannot be preflighted; fix");
    say("      that first — an unanswerable question is not a pass.");
    return 1;
  }

  if (probe.status !== 0) {
    say("FAIL: nvidia-smi ran but could not enumerate GPUs.");
    say("      Same conclusion as above: unknown is not a pass.");
    return 1;
  }

  const verdict = evaluateRoster(probe.stdout ?? "");
  say(renderReport(verdict));
  return verdict.pass ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
