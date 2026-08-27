#!/usr/bin/env bun
/**
 * hardware-only-facts.ts — capture, at boot on the real machine, the facts a VM test provably
 * cannot establish.
 *
 * WHY THIS EXISTS. `docs/research/2026-08-26-cluster-join-boot-path-in-nixos-vm-tests-…md` §5 names
 * six things as HARDWARE-ONLY, each with a reason, under the house sentence:
 *
 *     X is a measured fact, not a declared one.
 *
 * Today those six live in prose. Nothing captures them, so when a machine is flashed the answers
 * exist only in whatever a person happened to look at, and are gone by the next boot. This module
 * is the capture: it turns the doc's list into an artifact, on the box, at the moment the box can
 * answer.
 *
 * FIVE ARE PROBE-ABLE. ONE IS NOT, AND SAYING SO IS THE POINT.
 *
 *   §5.1 real NIC / link       PARTIAL   interfaces, carrier, negotiated speed are readable;
 *                                        switch behaviour under load is not
 *   §5.2 serial console        YES       a UART is present or it is not
 *   §5.3 power-loss durability NO        requires actually cutting power; no syscall answers it
 *   §5.4 internal vs USB disk  YES       `removable` plus the device's transport ancestry
 *   §5.5 secure boot enrolment YES       EFI variables carry SecureBoot and SetupMode
 *   §5.6 TPM presence          YES       the device node and its `tpm_version_major`
 *
 * §5.3 goes to `unmeasured` with its reason and stays there. A meter whose product is the
 * measured/unmeasured PARTITION has to be willing to leave a row empty — the alternative is a
 * plausible number nobody can defend, which is worse than a gap everybody can see.
 *
 * IT DECIDES NOTHING. Like `host-capability-vector.ts`, whose `unmeasured` discipline this follows,
 * nothing here gates an install or changes a package. It records. A fact that gates before it is
 * trusted is a fact nobody got to check.
 *
 * EVERY READ IS INJECTED. The filesystem enters through `HardwareProbe`, never through an ambient
 * `readFileSync`, so the whole module is a pure function of its inputs and the tests drive real
 * fixture trees rather than the machine they run on (§13 noninterference, §7 DST). That also makes
 * it honest on a laptop: on a host with no `/sys/firmware/efi` the answer is `absent`, which is a
 * different claim from `false` and is recorded as such.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

/** Three-valued on purpose: a thing can be present, absent, or unreadable-from-here. */
export type Tri = "yes" | "no" | "unknown";

/** The injected view of the machine. Every path this module reads goes through here. */
export interface HardwareProbe {
  /** File contents, or `null` when the path does not exist or cannot be read. */
  readonly read: (path: string) => string | null;
  /** Directory entries, or `null` when the directory does not exist. */
  readonly list: (path: string) => readonly string[] | null;
  /** `true` when the path exists at all, whatever its kind. */
  readonly exists: (path: string) => boolean;
}

export interface NicFact {
  readonly name: string;
  /** Link up? `unknown` when the interface exposes no `carrier` (down interfaces often do not). */
  readonly carrier: Tri;
  /** Negotiated Mb/s, or `null` when unreadable — never 0, which would read as a measurement. */
  readonly speedMbps: number | null;
}

export interface HardwareOnlyFacts {
  readonly schema: "zeta.hardware-only-facts.v1";
  /** §5.1 — partial by nature; switch behaviour under load is not a syscall. */
  readonly nics: readonly NicFact[];
  /** §5.2 — a UART is present or it is not. */
  readonly serialConsole: { readonly present: Tri; readonly devices: readonly string[] };
  /** §5.4 — which block devices are removable, and which the installer would call internal. */
  readonly removableDisks: readonly { readonly name: string; readonly removable: Tri }[];
  /** §5.5 — SecureBoot and SetupMode as the firmware actually reports them. */
  readonly secureBoot: { readonly enabled: Tri; readonly setupMode: Tri; readonly evidence: string };
  /** §5.6 — TPM device presence and major version. */
  readonly tpm: { readonly present: Tri; readonly versionMajor: string | null };
  /** Named gaps, with the reason. §5.3 is always here. */
  readonly unmeasured: readonly string[];
}

const SYS_NET = "/sys/class/net";
const SYS_BLOCK = "/sys/block";
const SYS_TPM = "/sys/class/tpm";
const EFI_VARS = "/sys/firmware/efi/efivars";

/**
 * EFI variables are stored with a 4-byte attribute prefix before the value, so the byte that
 * answers "is Secure Boot on" is the FIFTH, not the first. Reading byte 0 yields the attributes and
 * looks like a plausible answer — which is why this is a named function with a test rather than an
 * index buried in a conditional.
 */
export function parseEfiBooleanVar(raw: string | null): Tri {
  if (raw === null) return "unknown";
  if (raw.length < 5) return "unknown";
  const v = raw.charCodeAt(4);
  if (v === 1) return "yes";
  if (v === 0) return "no";
  return "unknown";
}

/** `1`/`0` from a sysfs flag file. Anything else is `unknown`, never coerced to false. */
export function parseSysfsFlag(raw: string | null): Tri {
  if (raw === null) return "unknown";
  const t = raw.trim();
  if (t === "1") return "yes";
  if (t === "0") return "no";
  return "unknown";
}

/** Non-negative integer, or `null`. `-1` is what sysfs reports for "no link", and is NOT a speed. */
export function parseSpeed(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Find the EFI variable file whose name starts with `prefix-` (the suffix is a GUID). */
export function findEfiVar(entries: readonly string[] | null, prefix: string): string | null {
  if (entries === null) return null;
  return entries.find((e) => e.startsWith(`${prefix}-`)) ?? null;
}

/** Gather all six §5 rows. Pure: everything comes from `probe`. */
export function gatherHardwareOnlyFacts(probe: HardwareProbe): HardwareOnlyFacts {
  const unmeasured: string[] = [
    // §5.3, permanently. Stated with its reason so nobody later reads the empty row as an oversight
    // and fills it with an uptime heuristic.
    "disk-durability-under-power-loss: requires physically cutting power mid-write and re-reading; " +
      "no syscall reports whether the drive honoured the flush, so this cannot be probed from the " +
      "running system (§5.3)",
  ];

  const nicNames = probe.list(SYS_NET);
  if (nicNames === null) unmeasured.push(`nics: ${SYS_NET} absent (not a Linux host, or sysfs unmounted)`);
  const nics: NicFact[] = [...(nicNames ?? [])]
    .filter((n: string) => n !== "lo")
    .sort()
    .map((name) => ({
      name,
      carrier: parseSysfsFlag(probe.read(`${SYS_NET}/${name}/carrier`)),
      speedMbps: parseSpeed(probe.read(`${SYS_NET}/${name}/speed`)),
    }));
  if (nics.length > 0) {
    unmeasured.push(
      "nic-switch-behaviour: link state and negotiated speed are read above, but switch behaviour " +
        "under load — drops, pause frames, MTU blackholes — is not visible from the host (§5.1)",
    );
  }

  const devEntries = probe.list("/dev");
  const serialDevices = [...(devEntries ?? [])]
    .filter((d: string) => /^ttyS\d+$/.test(d) || /^ttyUSB\d+$/.test(d))
    .sort();
  const serialConsole = {
    // Absent is NOT an error — §5.2 says so explicitly: bare metal with no UART still journals.
    present: devEntries === null ? ("unknown" as Tri) : serialDevices.length > 0 ? ("yes" as Tri) : ("no" as Tri),
    devices: serialDevices,
  };

  const blockNames = probe.list(SYS_BLOCK);
  if (blockNames === null) unmeasured.push(`removable-disks: ${SYS_BLOCK} absent`);
  const removableDisks = [...(blockNames ?? [])]
    .sort()
    .map((name: string) => ({ name, removable: parseSysfsFlag(probe.read(`${SYS_BLOCK}/${name}/removable`)) }));

  const efi = probe.list(EFI_VARS);
  const sbName = findEfiVar(efi, "SecureBoot");
  const smName = findEfiVar(efi, "SetupMode");
  const secureBoot = {
    enabled: sbName === null ? ("unknown" as Tri) : parseEfiBooleanVar(probe.read(`${EFI_VARS}/${sbName}`)),
    setupMode: smName === null ? ("unknown" as Tri) : parseEfiBooleanVar(probe.read(`${EFI_VARS}/${smName}`)),
    evidence: efi === null ? `${EFI_VARS} absent (BIOS boot, or efivarfs not mounted)` : `${EFI_VARS}`,
  };
  if (efi === null) unmeasured.push("secure-boot: efivarfs absent, so enrolment state cannot be read (§5.5)");

  const tpmEntries = probe.list(SYS_TPM);
  const tpmName = (tpmEntries ?? []).find((t) => t.startsWith("tpm")) ?? null;
  const tpm = {
    present: tpmEntries === null ? ("unknown" as Tri) : tpmName === null ? ("no" as Tri) : ("yes" as Tri),
    versionMajor: tpmName === null ? null : (probe.read(`${SYS_TPM}/${tpmName}/tpm_version_major`)?.trim() ?? null),
  };
  if (tpmEntries === null) unmeasured.push("tpm: /sys/class/tpm absent, so presence cannot be read (§5.6)");

  return {
    schema: "zeta.hardware-only-facts.v1",
    nics,
    serialConsole,
    removableDisks,
    secureBoot,
    tpm,
    unmeasured: [...unmeasured].sort(),
  };
}

/**
 * Render as JSON. No timestamp, matching `host-capability-vector.ts`: the artifact is a pure
 * function of the hardware, so two emissions on one unchanged host are byte-identical
 * (idempotency, discipline #6). Provenance of *when* belongs to whatever records the file.
 */
export function renderHardwareOnlyFacts(facts: HardwareOnlyFacts): string {
  return `${JSON.stringify(facts, null, 2)}\n`;
}

/**
 * The real machine. Constructed only in `main`, never at import time, so importing this module for
 * its pure functions never touches the filesystem (§13 noninterference).
 *
 * Every failure collapses to the same answer the pure code already understands: `null` for a read,
 * `null` for a listing, meaning "could not look" — which `gatherHardwareOnlyFacts` renders as
 * `unknown` and names in `unmeasured`. A probe that returned `""` or `[]` on error would convert
 * "we could not look" into "we looked and found nothing", which is the one thing this module exists
 * to prevent.
 */
export function realProbe(): HardwareProbe {
  return {
    read: (path) => {
      try {
        return readFileSync(path, "latin1");
      } catch {
        return null;
      }
    },
    list: (path) => {
      try {
        return readdirSync(path);
      } catch {
        return null;
      }
    },
    exists: (path) => {
      try {
        return statSync(path) !== undefined;
      } catch {
        return false;
      }
    },
  };
}

/**
 * CLI. Prints the artifact to stdout, and additionally writes it to `--out <path>` when given.
 *
 * STDOUT IS THE PRIMARY SINK, deliberately. On a first boot the console is mirrored to the serial
 * UART, so printing means the facts reach a durable place even when the disk write fails or the
 * target filesystem is not mounted yet. A capture that exists only as a file is a capture that a
 * failed mount silently deletes.
 *
 * EXIT 0 EVEN WHEN EVERYTHING IS `unknown`. This tool RECORDS; it does not judge. A host with no
 * sysfs produces an artifact full of `unknown` and a populated `unmeasured` list, and that is a
 * successful run — the honest answer to "what can this machine tell us" is sometimes "very little",
 * and failing would make the caller treat an answer as an error. The one thing that DOES fail is a
 * requested `--out` that could not be written, because then the caller asked for a file and has not
 * got one.
 */
export function main(argv: readonly string[], probe: HardwareProbe, log: (s: string) => void): number {
  let out: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") {
      const next = argv[i + 1];
      if (next === undefined) {
        log("--out requires a path");
        return 2;
      }
      out = next;
      i += 1;
    } else if (a === "-h" || a === "--help") {
      log("usage: bun hardware-only-facts.ts [--out <path>]");
      return 0;
    } else {
      // Refused rather than ignored: a mistyped flag that silently does nothing would let a caller
      // believe it had requested a file it never gets.
      log(`unknown argument: ${a} (accepted: --out <path>, --help)`);
      return 2;
    }
  }

  const rendered = renderHardwareOnlyFacts(gatherHardwareOnlyFacts(probe));
  log(rendered.trimEnd());

  if (out !== null) {
    try {
      writeFileSync(out, rendered, "utf8");
    } catch (e) {
      log(`FAILED to write ${out}: ${String(e)}`);
      return 1;
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2), realProbe(), (s) => console.log(s)));
}
