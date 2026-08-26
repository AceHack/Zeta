#!/usr/bin/env bun
/**
 * GPT + ESP USB boot smoke — the automatable half of MAN-USB-05.
 *
 * WHAT THE EXISTING LANE DOES NOT DO. `qemu-uefi-menu-smoke.ts` boots a
 * synthesised *directory* through QEMU vvfat. vvfat manufactures its own
 * volume, so that lane proves the loader and grub.cfg are right and proves
 * nothing about a partition table — there isn't one anywhere in its path. It
 * is the "verified the artifact was BUILT, not that it BOOTS" shape, and it
 * says so in its own comment ("Superfloppy on usb-storage is BLK0-only").
 *
 * WHAT THIS DOES. Assembles the same FAT image the real builder assembles,
 * wraps it in a real GPT with the ESP type GUID `MAN-USB-05` tells an operator
 * to check first, attaches it as `-device usb-storage` on an xHCI controller,
 * and boots OVMF against it. The firmware has to walk the protective MBR, the
 * GPT header, the entry array, find an ESP, mount FAT, and load
 * `/EFI/BOOT/BOOTX64.EFI` from the removable-media default path before the
 * marker can appear on serial.
 *
 * WHAT IT STILL DOES NOT PROVE, precisely: that a *physical* stick boots a
 * *physical* machine. OVMF is one firmware implementation; vendor firmware
 * quirks, USB controller enumeration on real silicon, and secure-boot key
 * enrolment are untouched. This narrows MAN-USB-05, it does not close it.
 *
 * AND ONE THING IT MEASURED THAT NOBODY EXPECTED. Run 32977813494, 2026-08-26:
 * with the ESP entry retyped to Microsoft Basic Data, **OVMF booted it
 * anyway** — its FAT driver binds to any FAT-carrying partition and never
 * consults the type GUID. The boot therefore cannot falsify the type GUID; the
 * unconditional `sfdisk --json` cross-check below is the only thing in this
 * repository that enforces it. Whether a given *physical* firmware is stricter
 * than OVMF here is now an explicit open hardware question, not an assumption.
 *
 * NON-VACUITY IS STRUCTURAL. Every run boots TWICE: once with the loader
 * present (must reach the marker) and once with the loader removed (must NOT
 * reach it). A change that makes the marker appear unconditionally — or that
 * makes the boot silently not happen at all — fails on the second boot. A pass
 * therefore cannot be produced by a check that did not run.
 *
 * Register: **metered** — the falsifier is the negative control in this file
 * plus `ZETA_GPT_ESP_SMOKE_MUTATE`, which can only corrupt the image, never
 * bypass a check.
 *
 * Usage:
 *   bun src/Core.TypeScript/installer/multiboot/gpt-esp-usb-boot-smoke.ts
 *   MULTIBOOT_UEFI_SMOKE_REQUIRED=1 ...   # absent tooling is a FAILURE, not a skip
 *   ZETA_GPT_ESP_SMOKE_MUTATE=esp-type-guid ...   # demonstrate red
 */

import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { executeAssembleFatImage, planAssembleFatImage, planQemuUeFiBootArgs } from "./assemble.ts";
import { planMultibootUsb } from "./plan.ts";
import {
  ESP_TYPE_GUID,
  MSFT_BASIC_DATA_TYPE_GUID,
  SECTOR_BYTES,
  assembleGptEspDisk,
} from "./gpt-esp.ts";
import {
  detectSmokeTooling,
  kvmIsUsable,
  missingSmokeTools,
  resolveOvmfPaths,
  grubMkimageArgs,
} from "./qemu-uefi-menu-smoke.ts";

/** Distinct from the vvfat lane's marker so a log cannot be mistaken for it. */
export const GPT_ESP_BOOT_MARKER = "ZETA-GPT-ESP-USB-BOOT";
/** Delimiters around GRUB's own `ls` output on the serial log. */
export const DEVLIST_BEGIN = "ZETA-DEVLIST-BEGIN";
export const DEVLIST_END = "ZETA-DEVLIST-END";
/** iSerial of the SECOND attached stick in the two-stick enumeration phase. */
export const SECOND_STICK_SERIAL = "ZETA-QEMU-002";

const ESP_SIZE_BYTES = 48 * 1024 * 1024;
const POSITIVE_TIMEOUT_MS = 120_000;
/** Absence needs less time than presence: nothing is going to start later. */
const NEGATIVE_TIMEOUT_MS = 60_000;
const POLL_MS = 1_000;

/**
 * The mutation knob. Every value CORRUPTS the image; none disables a check, so
 * setting it can only turn the lane red. That asymmetry is the whole reason an
 * env-var escape is acceptable here.
 */
export type SmokeMutation = "none" | "esp-type-guid" | "remove-loader" | "zero-gpt";

export const SMOKE_MUTATIONS: readonly SmokeMutation[] = [
  "none",
  "esp-type-guid",
  "remove-loader",
  "zero-gpt",
];

export function parseMutation(
  raw: string | undefined,
): { readonly ok: true; readonly mutation: SmokeMutation } | { readonly ok: false; readonly error: string } {
  if (raw === undefined || raw.trim().length === 0) {
    return { ok: true, mutation: "none" };
  }
  const value = raw.trim();
  const found = SMOKE_MUTATIONS.find((m) => m === value);
  if (found === undefined) {
    return {
      ok: false,
      error: `ZETA_GPT_ESP_SMOKE_MUTATE="${value}" is not one of ${SMOKE_MUTATIONS.join(", ")}`,
    };
  }
  return { ok: true, mutation: found };
}

export function gptEspGrubCfg(): string {
  return [
    "serial --unit=0 --speed=115200",
    "terminal_input serial",
    "terminal_output serial",
    `echo ${GPT_ESP_BOOT_MARKER}`,
    `echo ${DEVLIST_BEGIN}`,
    // GRUB's own view of the EFI block devices firmware handed it: one token
    // per device plus one per partition, space separated, e.g.
    //   (hd0) (hd0,gpt1) (hd1) (hd1,gpt1)
    "ls",
    'echo ""',
    `echo ${DEVLIST_END}`,
    'menuentry "zeta-installer" {',
    "  echo selected-zeta-installer",
    "}",
    "",
  ].join("\n");
}

/**
 * Distinct whole-disk names GRUB reported, in first-seen order.
 *
 * Returns null when the delimiters are absent — an unparseable log must never
 * read as "zero devices", because zero would silently satisfy a one-stick
 * expectation phrased as "no more than one".
 */
export function parseGrubDeviceList(log: string): readonly string[] | null {
  const begin = log.indexOf(DEVLIST_BEGIN);
  if (begin < 0) return null;
  const end = log.indexOf(DEVLIST_END, begin + DEVLIST_BEGIN.length);
  if (end < 0) return null;
  const body = log.slice(begin + DEVLIST_BEGIN.length, end);
  const disks: string[] = [];
  for (const match of body.matchAll(/\((hd\d+)(?:,[^)]*)?\)/g)) {
    const name = match[1]!;
    if (!disks.includes(name)) {
      disks.push(name);
    }
  }
  return disks;
}

/**
 * The MAN-USB-02 premise, stated as a check: N attached sticks must present as
 * N distinct block devices to the firmware. A hub or controller that collapsed
 * two into one would show fewer — upstream of any selection logic, which is
 * exactly where the register says the untested risk lives.
 */
export function enumerationMatches(
  log: string,
  expectedDisks: number,
):
  | { readonly ok: true; readonly disks: readonly string[] }
  | { readonly ok: false; readonly error: string } {
  const disks = parseGrubDeviceList(log);
  if (disks === null) {
    return {
      ok: false,
      error: `GRUB device listing absent from serial log (no ${DEVLIST_BEGIN}/${DEVLIST_END} pair)`,
    };
  }
  if (disks.length !== expectedDisks) {
    return {
      ok: false,
      error:
        `firmware enumerated ${String(disks.length)} disk(s) [${disks.join(" ")}] with ` +
        `${String(expectedDisks)} usb-storage device(s) attached`,
    };
  }
  return { ok: true, disks };
}

/**
 * The one partition `sfdisk --json` must report. Kept as a function so the
 * expectation is assertable without running sfdisk.
 */
export type SfdiskPartition = { readonly type?: string; readonly start?: number };

export function sfdiskAgreesWithGpt(
  parsed: unknown,
  expected: { readonly typeGuid: string; readonly startLba: number },
): { readonly ok: true } | { readonly ok: false; readonly error: string } {
  const table = (parsed as { partitiontable?: { label?: string; partitions?: SfdiskPartition[] } })
    .partitiontable;
  if (table === undefined) {
    return { ok: false, error: "sfdisk --json produced no partitiontable" };
  }
  if (table.label !== "gpt") {
    return { ok: false, error: `sfdisk read label "${String(table.label)}", expected "gpt"` };
  }
  const partitions = table.partitions ?? [];
  if (partitions.length !== 1) {
    return {
      ok: false,
      error: `sfdisk found ${String(partitions.length)} partitions, expected exactly 1`,
    };
  }
  const first = partitions[0]!;
  const actualType = (first.type ?? "").toLowerCase();
  if (actualType !== expected.typeGuid.toLowerCase()) {
    return {
      ok: false,
      error: `sfdisk read partition type ${actualType || "(none)"}, expected ${expected.typeGuid}`,
    };
  }
  if (first.start !== expected.startLba) {
    return {
      ok: false,
      error: `sfdisk read start LBA ${String(first.start)}, expected ${String(expected.startLba)}`,
    };
  }
  return { ok: true };
}

function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/**
 * Read a file that may not exist yet, in ONE syscall.
 *
 * An `existsSync` gate in front of a read answers a question that is already
 * stale by the time the read runs, and reads as defensive while preventing
 * nothing (`lint-check-then-use-file-races`). The serial log genuinely may not
 * exist yet -- QEMU creates it when it first writes -- so absence is an
 * expected state here, not an error, and the ONLY absence that is expected is
 * ENOENT. Anything else still throws.
 */
function readTextOrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return "";
    }
    throw err;
  }
}

function spawnExecutor() {
  return {
    writeFile: (path: string, content: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    },
    runCommand: (command: { readonly command: string; readonly args: readonly string[] }) => {
      const result = spawnSync(command.command, [...command.args], { encoding: "utf8" });
      return { status: result.status ?? 1, stderr: result.stderr ?? undefined };
    },
  };
}

function commandOnPath(bin: string): boolean {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (probe.status === 0) {
    return true;
  }
  const help = spawnSync(bin, ["-V"], { encoding: "utf8" });
  return help.status === 0;
}

/**
 * Build the FAT ESP with the SAME planner the real builder uses, then hand back
 * its bytes. `includeLoader: false` is the negative control: identical image,
 * no `/EFI/BOOT/BOOTX64.EFI`.
 */
function buildEspBytes(input: {
  readonly tmpRoot: string;
  readonly tag: string;
  readonly isoPath: string;
  readonly efiPath: string;
  readonly includeLoader: boolean;
}): { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly error: string } {
  const outImg = join(input.tmpRoot, `esp-${input.tag}.img`);
  const stagingDir = join(input.tmpRoot, `staging-${input.tag}`);
  mkdirSync(stagingDir, { recursive: true });

  const planned = planMultibootUsb({
    entries: [{ name: "zeta-installer", kind: "grub-iso-local", flakeAttr: "nix:.#installer-iso" }],
  });
  if (!planned.ok) {
    return { ok: false, error: planned.error };
  }

  const assembled = planAssembleFatImage({
    plan: planned.plan,
    artifacts: [
      {
        name: "zeta-installer",
        imagePath: "/boot/iso/zeta-installer.iso",
        localPath: input.isoPath,
        sizeBytes: 64,
      },
    ],
    outputImagePath: outImg,
    imageSizeBytes: ESP_SIZE_BYTES,
    stagingDir,
    grubCfgContent: gptEspGrubCfg(),
    // The negative control omits the loader by omitting the KEY, not by passing
    // undefined: under exactOptionalPropertyTypes an absent option and an
    // explicitly-undefined one are different types, and the planner's contract
    // is "absent means no loader".
    ...(input.includeLoader ? { grubEfiLocalPath: input.efiPath } : {}),
  });
  if (!assembled.ok) {
    return { ok: false, error: assembled.error };
  }
  if (input.includeLoader && !assembled.grubEfiEmbedded) {
    return { ok: false, error: "planner did not embed the EFI loader when asked to" };
  }
  if (!input.includeLoader && assembled.grubEfiEmbedded) {
    return { ok: false, error: "negative control still embedded the EFI loader" };
  }

  const executed = executeAssembleFatImage(assembled.steps, spawnExecutor());
  if (!executed.ok) {
    return { ok: false, error: executed.error };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(outImg));
  } catch (err) {
    if (isEnoent(err)) {
      return { ok: false, error: `assemble produced no image at ${outImg}` };
    }
    throw err;
  }
  if (bytes.length !== ESP_SIZE_BYTES) {
    return {
      ok: false,
      error: `assembled ESP is ${String(bytes.length)} bytes, expected ${String(ESP_SIZE_BYTES)}`,
    };
  }
  // The negative control must genuinely lack the loader, not merely claim to.
  const hasLoaderName = Buffer.from(bytes).includes(Buffer.from("BOOTX64 EFI", "ascii"));
  if (input.includeLoader !== hasLoaderName) {
    return {
      ok: false,
      error: `ESP loader presence is ${String(hasLoaderName)} but ${String(input.includeLoader)} was requested`,
    };
  }
  return { ok: true, bytes };
}

async function waitForToken(input: {
  readonly token: string;
  readonly serialLogPath: string;
  readonly deadline: number;
  readonly extraText: () => string;
  readonly hasExited: () => boolean;
}): Promise<boolean> {
  while (Date.now() < input.deadline) {
    const fileText = readTextOrEmpty(input.serialLogPath);
    if (fileText.includes(input.token) || input.extraText().includes(input.token)) {
      return true;
    }
    if (input.hasExited()) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

async function bootAndWatch(input: {
  readonly diskPath: string;
  readonly ovmfCodePath: string;
  readonly ovmfVarsPath: string;
  readonly serialLogPath: string;
  readonly timeoutMs: number;
  readonly additionalUsbImages?:
    | readonly {
        readonly imagePath: string;
        readonly serial: string;
      }[]
    | undefined;
  /**
   * Token that ends the wait. The positive phases wait for DEVLIST_END, which
   * GRUB prints AFTER the marker — stopping at the marker would truncate the
   * device listing and make the enumeration assertion read an empty log.
   */
  readonly waitFor: string;
}): Promise<{ readonly sawToken: boolean; readonly log: string }> {
  const qemuPlan = planQemuUeFiBootArgs({
    outputImagePath: input.diskPath,
    ovmfCodePath: input.ovmfCodePath,
    ovmfVarsPath: input.ovmfVarsPath,
    serialLogPath: input.serialLogPath,
    media: "usb",
    additionalUsbImages: input.additionalUsbImages,
  });
  if (!qemuPlan.ok) {
    return { sawToken: false, log: `planQemuUeFiBootArgs refused: ${qemuPlan.error}` };
  }
  writeFileSync(input.serialLogPath, "");
  const qemuArgs = [...qemuPlan.args.slice(1)];
  qemuArgs.push("-accel", kvmIsUsable() ? "kvm" : "tcg");
  const qemu = spawn("qemu-system-x86_64", qemuArgs, { stdio: ["ignore", "pipe", "pipe"] });
  const extra: string[] = [];
  qemu.stdout?.on("data", (chunk: Buffer) => extra.push(chunk.toString("utf8")));
  qemu.stderr?.on("data", (chunk: Buffer) => extra.push(chunk.toString("utf8")));
  let exited: number | null = null;
  qemu.on("error", (err: Error) => {
    extra.push(err.message);
    exited = 1;
  });
  qemu.on("exit", (code) => {
    exited = code;
  });
  try {
    const sawToken = await waitForToken({
      token: input.waitFor,
      serialLogPath: input.serialLogPath,
      deadline: Date.now() + input.timeoutMs,
      extraText: () => extra.join(""),
      hasExited: () => exited !== null,
    });
    const fileTail = readTextOrEmpty(input.serialLogPath);
    return { sawToken, log: `${fileTail}\n${extra.join("")}`.trim() };
  } finally {
    qemu.kill("SIGTERM");
  }
}

export async function runGptEspUsbBootSmoke(): Promise<{
  readonly exitCode: 0 | 1 | 2;
  readonly reason: string;
}> {
  const required = process.env.MULTIBOOT_UEFI_SMOKE_REQUIRED === "1";
  const mutationParsed = parseMutation(process.env.ZETA_GPT_ESP_SMOKE_MUTATE);
  if (!mutationParsed.ok) {
    // Fail closed: an unrecognised knob value must never be read as "none".
    return { exitCode: 1, reason: mutationParsed.error };
  }
  const mutation = mutationParsed.mutation;

  const tools = detectSmokeTooling(commandOnPath);
  const missing = [...missingSmokeTools(tools)];
  if (!commandOnPath("sfdisk")) {
    missing.push("sfdisk");
  }
  if (missing.length > 0) {
    const reason = `missing tooling: ${missing.join(", ")}`;
    return required ? { exitCode: 2, reason } : { exitCode: 0, reason: `skip — ${reason}` };
  }
  const ovmf = resolveOvmfPaths();
  if (ovmf === null) {
    return { exitCode: required ? 2 : 0, reason: "OVMF paths unresolved" };
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "zeta-gpt-esp-smoke-"));
  const isoPath = join(tmpRoot, "zeta-installer.iso");
  const efiPath = join(tmpRoot, "BOOTX64.EFI");
  writeFileSync(isoPath, "zeta-gpt-esp-smoke-iso\n");

  const mkimage = spawnSync("grub-mkimage", [...grubMkimageArgs(efiPath)], { encoding: "utf8" });
  if (mkimage.status !== 0 || !existsSync(efiPath)) {
    return {
      exitCode: 1,
      reason: `grub-mkimage failed: ${mkimage.stderr || mkimage.stdout || `status ${String(mkimage.status)}`}`,
    };
  }

  // ---- positive image -----------------------------------------------------
  const positiveEsp = buildEspBytes({
    tmpRoot,
    tag: "positive",
    isoPath,
    efiPath,
    includeLoader: mutation !== "remove-loader",
  });
  if (!positiveEsp.ok) {
    return { exitCode: 1, reason: `positive ESP assembly failed: ${positiveEsp.error}` };
  }
  const positiveDisk = assembleGptEspDisk({
    espBytes: positiveEsp.bytes,
    espTypeGuid: mutation === "esp-type-guid" ? MSFT_BASIC_DATA_TYPE_GUID : ESP_TYPE_GUID,
    partitionName: "ZETA_ESP",
  });
  if (!positiveDisk.ok) {
    return { exitCode: 1, reason: `GPT assembly failed: ${positiveDisk.error}` };
  }
  const positiveBytes = positiveDisk.disk;
  if (mutation === "zero-gpt") {
    positiveBytes.fill(0, SECTOR_BYTES, SECTOR_BYTES * 2);
    const backupOff = positiveDisk.layout.backupHeaderLba * SECTOR_BYTES;
    positiveBytes.fill(0, backupOff, backupOff + SECTOR_BYTES);
  }
  const positivePath = join(tmpRoot, "stick-positive.img");
  writeFileSync(positivePath, positiveBytes);

  // ---- external oracle: sfdisk reads the table back -----------------------
  //
  // Not this repo's own parser reading its own output — util-linux is an
  // independently written GPT implementation, so agreement is evidence.
  //
  // THIS RUNS UNCONDITIONALLY, and that is a measured decision rather than a
  // tidy one. MEASURED 2026-08-26 (run 32977813494): with the ESP entry
  // retyped to Microsoft Basic Data, **OVMF booted it anyway**. Its FAT driver
  // binds to any partition carrying a FAT filesystem and does not consult the
  // type GUID. So the boot cannot falsify the type GUID, and if this check
  // were skipped under mutation, the `esp-type-guid` mutant would be caught by
  // nothing at all — a check that did not run, looking like one that passed.
  //
  // The static cross-check is therefore the ONLY thing in this repository that
  // enforces `c12a7328-f81f-11d2-ba4b-00a0c93ec93b`, and whether a given
  // physical firmware requires it stays an open hardware question (MAN-USB-05).
  const sfdisk = spawnSync("sfdisk", ["--json", positivePath], { encoding: "utf8" });
  if (sfdisk.status !== 0) {
    return {
      exitCode: 1,
      reason:
        `sfdisk --json refused the assembled disk (status ${String(sfdisk.status)}, ` +
        `mutation=${mutation}): ${sfdisk.stderr ?? ""}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(sfdisk.stdout);
  } catch (err) {
    return { exitCode: 1, reason: `sfdisk --json output is not JSON: ${String(err)}` };
  }
  const agrees = sfdiskAgreesWithGpt(parsed, {
    typeGuid: ESP_TYPE_GUID,
    startLba: positiveDisk.layout.espStartLba,
  });
  if (!agrees.ok) {
    return {
      exitCode: 1,
      reason:
        `GPT cross-check failed (mutation=${mutation}): ${agrees.error}` +
        (mutation === "none"
          ? ""
          : " — this is the mutant being caught by the static check, which is where the type GUID is enforced"),
    };
  }

  // ---- negative control: same build, no loader ----------------------------
  const negativeEsp = buildEspBytes({
    tmpRoot,
    tag: "negative",
    isoPath,
    efiPath,
    includeLoader: false,
  });
  if (!negativeEsp.ok) {
    return { exitCode: 1, reason: `negative-control ESP assembly failed: ${negativeEsp.error}` };
  }
  const negativeDisk = assembleGptEspDisk({ espBytes: negativeEsp.bytes, partitionName: "ZETA_ESP" });
  if (!negativeDisk.ok) {
    return { exitCode: 1, reason: `negative-control GPT assembly failed: ${negativeDisk.error}` };
  }
  const negativePath = join(tmpRoot, "stick-negative.img");
  writeFileSync(negativePath, negativeDisk.disk);

  const varsPositive = join(tmpRoot, "OVMF_VARS_positive.fd");
  const varsNegative = join(tmpRoot, "OVMF_VARS_negative.fd");
  const varsTwoStick = join(tmpRoot, "OVMF_VARS_twostick.fd");
  copyFileSync(ovmf.varsPath, varsPositive);
  copyFileSync(ovmf.varsPath, varsNegative);
  copyFileSync(ovmf.varsPath, varsTwoStick);

  // Phase A — one stick, loader present. Waits for the END delimiter so the
  // whole device listing is on the log before the process is torn down.
  const positiveRun = await bootAndWatch({
    diskPath: positivePath,
    ovmfCodePath: ovmf.codePath,
    ovmfVarsPath: varsPositive,
    serialLogPath: join(tmpRoot, "serial-positive.log"),
    timeoutMs: POSITIVE_TIMEOUT_MS,
    waitFor: DEVLIST_END,
  });

  // Phase B — negative control. Same assembly, loader removed. Must NOT boot.
  const negativeRun = await bootAndWatch({
    diskPath: negativePath,
    ovmfCodePath: ovmf.codePath,
    ovmfVarsPath: varsNegative,
    serialLogPath: join(tmpRoot, "serial-negative.log"),
    timeoutMs: NEGATIVE_TIMEOUT_MS,
    waitFor: GPT_ESP_BOOT_MARKER,
  });

  // Phase C — MAN-USB-02's premise: TWO attached sticks, distinct iSerials.
  // The second is the loader-less image, so boot order is unambiguous.
  const twoStickRun = await bootAndWatch({
    diskPath: positivePath,
    ovmfCodePath: ovmf.codePath,
    ovmfVarsPath: varsTwoStick,
    serialLogPath: join(tmpRoot, "serial-twostick.log"),
    timeoutMs: POSITIVE_TIMEOUT_MS,
    waitFor: DEVLIST_END,
    additionalUsbImages: [{ imagePath: negativePath, serial: SECOND_STICK_SERIAL }],
  });

  // The negative control is checked FIRST and unconditionally: if a loader-less
  // ESP reaches the marker, the positive result carries no information at all.
  if (negativeRun.sawToken) {
    return {
      exitCode: 1,
      reason:
        "NEGATIVE CONTROL BOOTED: an ESP with no /EFI/BOOT/BOOTX64.EFI reached " +
        `${GPT_ESP_BOOT_MARKER}. This check cannot distinguish a boot from a non-boot; ` +
        `treat any green from it as vacuous.\n${negativeRun.log.slice(-1500)}`,
    };
  }

  if (!positiveRun.sawToken || !positiveRun.log.includes(GPT_ESP_BOOT_MARKER)) {
    return {
      exitCode: 1,
      reason:
        `GPT+ESP USB boot did not reach ${GPT_ESP_BOOT_MARKER} within ` +
        `${String(POSITIVE_TIMEOUT_MS / 1000)}s (mutation=${mutation}).\n` +
        (positiveRun.log.length > 0 ? positiveRun.log.slice(-2000) : "(empty serial)"),
    };
  }

  if (mutation !== "none") {
    return {
      exitCode: 1,
      reason:
        `mutation "${mutation}" was applied and the boot STILL reached ${GPT_ESP_BOOT_MARKER}. ` +
        "The mutant is not falsifying — the check does not cover what it claims to.",
    };
  }

  // One attached stick must enumerate as exactly one disk — the paired control
  // for the two-stick assertion below. Without it, "saw two" could just mean
  // "the parser counts something twice".
  const oneStick = enumerationMatches(positiveRun.log, 1);
  if (!oneStick.ok) {
    return {
      exitCode: 1,
      reason: `one-stick enumeration check failed: ${oneStick.error}\n${positiveRun.log.slice(-1500)}`,
    };
  }

  if (!twoStickRun.sawToken) {
    return {
      exitCode: 1,
      reason:
        `two-stick phase did not reach ${DEVLIST_END} within ` +
        `${String(POSITIVE_TIMEOUT_MS / 1000)}s.\n${twoStickRun.log.slice(-2000)}`,
    };
  }
  const twoSticks = enumerationMatches(twoStickRun.log, 2);
  if (!twoSticks.ok) {
    return {
      exitCode: 1,
      reason:
        "TWO-STICK ENUMERATION COLLAPSED — this is the MAN-USB-02 failure mode, " +
        `observed under emulation: ${twoSticks.error}\n${twoStickRun.log.slice(-1500)}`,
    };
  }

  return {
    exitCode: 0,
    reason:
      `observed ${GPT_ESP_BOOT_MARKER} from a GPT ESP (type ${ESP_TYPE_GUID}, ` +
      `LBA ${String(positiveDisk.layout.espStartLba)}) on -device usb-storage; ` +
      `1 stick enumerated as [${oneStick.disks.join(" ")}], ` +
      `2 sticks as [${twoSticks.disks.join(" ")}]; ` +
      "negative control (loader removed) correctly did NOT boot",
  };
}

if (import.meta.main) {
  const result = await runGptEspUsbBootSmoke();
  console.log(`[gpt-esp-usb-boot-smoke] ${result.reason}`);
  process.exit(result.exitCode);
}
