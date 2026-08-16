#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-x86-marker-image.ts
 *
 * Builds tiny x86_64 boot images that exercise `qemu-boot-test.ts`'s
 * classifier on a REAL guest, so each outcome can be demonstrated
 * instead of asserted.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────
 * The x86_64 boot lane is a blocking CI gate whose only input is the
 * real NixOS installer ISO. That ISO can only produce BOOTED, so three
 * of the four outcomes — BOOT-FAILED, TIMEOUT, STALLED — had no live
 * evidence on x86_64 at all; they existed only as unit tests over
 * hand-written strings, which cannot catch a wiring defect (the ladder
 * reading a constant for 19 CI runs is exactly such a defect, and no
 * unit test saw it).
 *
 * These images are a FALSIFIER, not a model of NixOS. Each one is a
 * 512-byte MBR boot sector that writes a chosen prefix of the boot-stage
 * marker vocabulary to COM1 and then halts. Real SeaBIOS boots it, a
 * real UART carries it, the real harness classifies it — only the guest
 * is synthetic. That is the smallest thing that can prove the harness
 * separates the outcomes rather than proving it separates strings.
 *
 * The `none` variant is the important one: it is NOT a program at all,
 * just a disk with no boot signature, which is what a corrupt or
 * mis-baked zflash image looks like to the firmware.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/qemu-x86-marker-image.ts --stage login   /tmp/ok.img
 *   bun src/Core.TypeScript/ci/qemu-x86-marker-image.ts --stage kernel  /tmp/stall.img
 *   bun src/Core.TypeScript/ci/qemu-x86-marker-image.ts --stage none    /tmp/broken.img
 *
 * Exit codes: 0 written, 2 usage error.
 *
 * Anchor: the MBR boot protocol (IBM PC BIOS, 1981) — the firmware reads
 * LBA 0 to 0x7C00 and transfers control iff bytes 510-511 are 0x55 0xAA.
 * The 16550 UART's transmit-holding register at 0x3F8 (National
 * Semiconductor, 1987) needs no initialisation to transmit under QEMU's
 * reset state (LCR=0, so DLAB=0 and a write to 0x3F8 is a byte out).
 */

import { writeFileSync } from "node:fs";

/** Boot sector geometry — fixed by the IBM PC MBR protocol. */
export const SECTOR_BYTES = 512;
export const SIGNATURE_OFFSET = 510;
/** Padded well past a bare sector so USB-storage geometry is uncontroversial. */
export const IMAGE_BYTES = 1024 * 1024;
const LOAD_ADDRESS = 0x7c00;
const COM1_THR = 0x03f8;

/**
 * How far up the ladder the synthetic guest should climb before halting.
 * `none` emits no boot signature at all (the firmware refuses it).
 */
export type MarkerStage = "none" | "bootloader" | "kernel" | "userspace" | "login";

export const MARKER_STAGES: readonly MarkerStage[] = [
  "none",
  "bootloader",
  "kernel",
  "userspace",
  "login",
];

/**
 * Marker lines, ladder order. These are the strings `qemu-boot-test.ts`
 * matches, chosen to be recognisably synthetic where the real vocabulary
 * allows it — a reader of a serial log must never mistake this fixture
 * for a NixOS boot. `Welcome to NixOS` and the login prompt are matched
 * verbatim by the harness and so cannot be altered; they are the only
 * two that are not self-labelling.
 */
export const STAGE_LINES: readonly { readonly stage: MarkerStage; readonly line: string }[] = [
  { stage: "bootloader", line: "ISOLINUX 6.04 [zeta synthetic boot-stage fixture, not NixOS]" },
  { stage: "kernel", line: "Linux version 0.0.0-zeta-fixture (synthetic marker image)" },
  { stage: "userspace", line: "<<< Welcome to NixOS [zeta synthetic fixture] - ttyS0 >>>" },
  { stage: "login", line: "zeta-installer login: " },
];

/** The marker text a given stage should emit (all rungs up to it). Pure. */
export function markerTextFor(stage: MarkerStage): string {
  if (stage === "none") return "";
  const upto = STAGE_LINES.findIndex((s) => s.stage === stage);
  return STAGE_LINES.slice(0, upto + 1)
    .map((s) => `${s.line}\r\n`)
    .join("");
}

/**
 * A 16-bit real-mode boot sector: write a NUL-terminated string to COM1,
 * then halt forever.
 *
 * Hand-assembled because the toolchain has no assembler and a 23-byte
 * program does not justify adding one. Offsets are load-address-relative
 * and are pinned by a test that re-derives every jump target, so a future
 * edit that shifts the layout fails loudly rather than booting into
 * garbage.
 *
 *   0:  FA        cli                 ; no interrupts; the hlt below is final
 *   1:  FC        cld                 ; lodsb must advance, not retreat
 *   2:  31 C0     xor ax, ax
 *   4:  8E D8     mov ds, ax          ; DS=0 so SI is a flat 0x7Cxx offset
 *   6:  BE lo hi  mov si, MSG
 *   9:  BA F8 03  mov dx, 0x03F8      ; COM1 transmit-holding register
 *  12:  AC        lodsb               ; emit:
 *  13:  84 C0     test al, al
 *  15:  74 03     jz halt             ; -> 17 + 3 = 20
 *  17:  EE        out dx, al
 *  18:  EB F8     jmp emit            ; -> 20 - 8 = 12
 *  20:  F4        halt: hlt           ; halts with interrupts off = forever
 *  21:  EB FD     jmp halt            ; -> 23 - 3 = 20 (belt and braces)
 *  23:  MSG       db <text>, 0
 */
export const CODE_LENGTH = 23;
const MESSAGE_OFFSET = CODE_LENGTH;

export function buildBootSector(message: string): Uint8Array {
  const text = Buffer.from(`${message}\0`, "ascii");
  const available = SIGNATURE_OFFSET - MESSAGE_OFFSET;
  if (text.length > available) {
    throw new Error(
      `marker text is ${text.length} bytes; a boot sector has room for ${available}`,
    );
  }

  const msgAddress = LOAD_ADDRESS + MESSAGE_OFFSET;
  const sector = new Uint8Array(SECTOR_BYTES); // zero-filled = padding
  sector.set(
    [
      0xfa, // cli
      0xfc, // cld
      0x31, 0xc0, // xor ax, ax
      0x8e, 0xd8, // mov ds, ax
      0xbe, msgAddress & 0xff, (msgAddress >> 8) & 0xff, // mov si, MSG
      0xba, COM1_THR & 0xff, (COM1_THR >> 8) & 0xff, // mov dx, 0x03F8
      0xac, // lodsb
      0x84, 0xc0, // test al, al
      0x74, 0x03, // jz halt
      0xee, // out dx, al
      0xeb, 0xf8, // jmp emit
      0xf4, // halt: hlt
      0xeb, 0xfd, // jmp halt
    ],
    0,
  );
  sector.set(text, MESSAGE_OFFSET);
  sector[SIGNATURE_OFFSET] = 0x55;
  sector[SIGNATURE_OFFSET + 1] = 0xaa;
  return sector;
}

/** The full image bytes for a stage. Pure — no filesystem. */
export function buildMarkerImage(stage: MarkerStage): Uint8Array {
  const image = new Uint8Array(IMAGE_BYTES);
  if (stage === "none") {
    // Deliberately NO 0x55AA: the firmware must refuse this, which is the
    // only way to produce BOOT-FAILED from the firmware's own mouth.
    return image;
  }
  image.set(buildBootSector(markerTextFor(stage)), 0);
  return image;
}

function usage(): never {
  console.error(
    `usage: bun src/Core.TypeScript/ci/qemu-x86-marker-image.ts --stage <${MARKER_STAGES.join("|")}> <out.img>`,
  );
  process.exit(2);
}

function main(): never {
  const argv = process.argv.slice(2);
  const stageFlag = argv.indexOf("--stage");
  if (stageFlag < 0) usage();
  const stage = argv[stageFlag + 1];
  if (stage === undefined || !MARKER_STAGES.includes(stage as MarkerStage)) usage();
  argv.splice(stageFlag, 2);

  const outPath = argv[0];
  if (outPath === undefined || outPath.length === 0) usage();

  writeFileSync(outPath, buildMarkerImage(stage as MarkerStage));
  console.log(
    `[qemu-x86-marker-image] wrote ${outPath} (${IMAGE_BYTES} bytes, stage=${stage}, bootable=${stage !== "none"})`,
  );
  process.exit(0);
}

if (import.meta.main) {
  main();
}
