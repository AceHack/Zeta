/**
 * UEFI keyfile on ESP — USB-IDENTITY-THREAT-MODEL §4 / §8.
 *
 * QEMU-testable persist of a 32-byte factor at `/EFI/ZETA/keyfile` on a FAT
 * image. Binding material is lowercase hex of those bytes (HKDF string).
 * `--write <path>` is the install-time helper. Restore reads the same file
 * from `/boot/EFI/ZETA/keyfile`. Does not change the shipped `usbUuid`
 * persist path. No TPM / Touch ID claim.
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parentDirPaths, type AssembleStep } from "./multiboot/assemble.ts";

/** Removable-media ESP path (FAT). Identity namespace: not under `/payloads/`. */
export const UEFI_KEYFILE_IMAGE_PATH = "/EFI/ZETA/keyfile" as const;

/** Installer-USB marker: presence means persist-opt-in, same role as `ZETA_BIND_UEFI_KEYFILE=1`. */
export const UEFI_KEYFILE_BIND_MARKER_IMAGE_PATH = "/zeta-bind-uefi-keyfile" as const;

/**
 * QEMU-only passphrase file on the installer USB ESP. Presence lets
 * non-interactive zeta-install capture a passphrase so 6.95-picker can
 * bind the blob. Not a production operator path; metal still types at 6.56.
 * Never log the contents.
 */
export const QEMU_CREDS_PASSPHRASE_IMAGE_PATH = "/zeta-qemu-creds-passphrase" as const;

/** Install-time host path (target ESP mounted at /mnt/boot). */
export const UEFI_KEYFILE_INSTALL_PATH = `/mnt/boot${UEFI_KEYFILE_IMAGE_PATH}` as const;

/** Boot-time host path (disko remounts the same ESP at /boot). */
export const UEFI_KEYFILE_RESTORE_PATH = `/boot${UEFI_KEYFILE_IMAGE_PATH}` as const;

export const UEFI_KEYFILE_BYTES = 32 as const;

export const UEFI_KEYFILE_SERIAL = {
  found: "[uefi-keyfile] found /EFI/ZETA/keyfile on ESP",
  missing: "[uefi-keyfile] missing /EFI/ZETA/keyfile; factor unavailable",
  wipeFailsDecrypt: "[uefi-keyfile] ESP wipe removes keyfile; decrypt must fail",
  noMetalClaim: "[uefi-keyfile] QEMU-testable; no TPM/Touch ID claim",
  wrote: "[uefi-keyfile] wrote 32-byte keyfile",
  writeFailed: "[uefi-keyfile] keyfile write failed",
  helperUnavailable: "[uefi-keyfile] write helper unavailable (bun/runtime missing); staying --usb-uuid",
  helperAbsent: "[uefi-keyfile] write helper absent; staying --usb-uuid",
  persistOptInKeyfile: "[uefi-keyfile] persist-opt-in --uefi-keyfile (ZETA_BIND_UEFI_KEYFILE=1)",
  persistOptInFallbackUuid: "[uefi-keyfile] persist-opt-in requested but keyfile write failed; staying --usb-uuid",
  persistBothOptInsUuid: "[uefi-keyfile] ZETA_BIND_UEFI_KEYFILE and ZETA_BIND_USB_ISERIAL both set; staying --usb-uuid",
  espFound: "[uefi-keyfile] found zeta-bind-uefi-keyfile on boot USB ESP",
  espMissing: "[uefi-keyfile] no zeta-bind-uefi-keyfile on boot USB ESP",
  espPassphraseFound: "[uefi-keyfile] found zeta-qemu-creds-passphrase on boot USB ESP",
  espPassphraseMissing: "[uefi-keyfile] no zeta-qemu-creds-passphrase on boot USB ESP",
  espPassphraseCaptured: "[uefi-keyfile] passphrase captured from boot USB ESP (QEMU; not typed)",
  espPassphraseEmpty: "[uefi-keyfile] zeta-qemu-creds-passphrase empty; staying skip",
  pickerBoundKeyfile: "[iter-5.5.0]   passphrase from Step 6.56; binding --uefi-keyfile",
  pickerSkipped: "[iter-5.5.0]   SKIP 6.95-picker:",
} as const;

export type UefiKeyfileError = { readonly error: string };

export function isUefiKeyfileError(value: unknown): value is UefiKeyfileError {
  return typeof value === "object" && value !== null && "error" in value;
}

export type UefiKeyfilePlanResult =
  | { readonly ok: true; readonly steps: readonly AssembleStep[] }
  | { readonly ok: false; readonly error: string };

function mtoolsDest(imagePath: string): string {
  return `::${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
}

/**
 * 32 random bytes. Inject RNG in tests; production callers pass node:crypto
 * `randomBytes`.
 */
export function generateUefiKeyfile(randomBytes: (n: number) => Uint8Array): Uint8Array | UefiKeyfileError {
  const bytes = randomBytes(UEFI_KEYFILE_BYTES);
  if (bytes.length !== UEFI_KEYFILE_BYTES) {
    return { error: `keyfile RNG returned ${String(bytes.length)} bytes; need ${String(UEFI_KEYFILE_BYTES)}` };
  }
  return bytes;
}

/** HKDF binding string: lowercase hex. Empty input is rejected. */
export function keyfileBindingMaterial(bytes: Uint8Array): string | UefiKeyfileError {
  if (bytes.length !== UEFI_KEYFILE_BYTES) {
    return { error: `keyfile must be ${String(UEFI_KEYFILE_BYTES)} bytes; got ${String(bytes.length)}` };
  }
  return Buffer.from(bytes).toString("hex");
}

export function parseKeyfileBindingMaterial(hex: string): Uint8Array | UefiKeyfileError {
  const trimmed = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(trimmed) || trimmed.length !== UEFI_KEYFILE_BYTES * 2) {
    return { error: `keyfile hex must be ${String(UEFI_KEYFILE_BYTES * 2)} hex chars` };
  }
  return Buffer.from(trimmed, "hex");
}

/**
 * Plan a tiny FAT image that contains only the UEFI keyfile (no GRUB).
 * Caller supplies host bytes at `hostKeyfilePath`.
 */
export function planUefiKeyfileEspImage(input: {
  readonly outputImagePath: string;
  readonly imageSizeBytes: number;
  readonly hostKeyfilePath: string;
}): UefiKeyfilePlanResult {
  if (input.outputImagePath.trim().length === 0) {
    return { ok: false, error: "outputImagePath is required" };
  }
  if (!Number.isSafeInteger(input.imageSizeBytes) || input.imageSizeBytes < 1024 * 1024) {
    return { ok: false, error: "imageSizeBytes must be a safe integer >= 1MiB" };
  }
  if (input.hostKeyfilePath.trim().length === 0) {
    return { ok: false, error: "hostKeyfilePath is required" };
  }

  const mtoolsImageSpecifier = input.outputImagePath;
  const steps: AssembleStep[] = [
    {
      kind: "command",
      command: {
        command: "qemu-img",
        args: ["create", "-f", "raw", input.outputImagePath, String(input.imageSizeBytes)],
      },
    },
    {
      kind: "command",
      command: {
        command: "mformat",
        args: ["-F", "-v", "ZETAKEY", "-i", mtoolsImageSpecifier, "::"],
      },
    },
  ];

  const dirsNeeded = new Set<string>(parentDirPaths(UEFI_KEYFILE_IMAGE_PATH));
  const orderedDirs = [...dirsNeeded].sort((a, b) => {
    const ac = a.split("/").length;
    const bc = b.split("/").length;
    if (ac !== bc) return ac - bc;
    return a.localeCompare(b);
  });
  for (const dir of orderedDirs) {
    steps.push({
      kind: "command",
      command: { command: "mmd", args: ["-i", mtoolsImageSpecifier, mtoolsDest(dir)] },
    });
  }
  steps.push({
    kind: "command",
    command: {
      command: "mcopy",
      args: ["-o", "-i", mtoolsImageSpecifier, input.hostKeyfilePath, mtoolsDest(UEFI_KEYFILE_IMAGE_PATH)],
    },
  });
  return { ok: true, steps };
}

/** FAT 8.3 listing may show KEYFILE with no extension. */
export function mdirListingHasUefiKeyfile(listing: string): boolean {
  const hasEfi = /EFI/i.test(listing);
  const hasZeta = /ZETA/i.test(listing);
  const hasKeyfile = /keyfile/i.test(listing) || /KEYFILE/i.test(listing);
  return hasEfi && hasZeta && hasKeyfile;
}

export type UefiKeyfileWriteIo = {
  readonly mkdir: (dir: string) => void;
  readonly writeFile: (path: string, data: Uint8Array) => void;
};

function defaultUefiKeyfileWriteIo(): UefiKeyfileWriteIo {
  return {
    mkdir: (dir: string) => {
      mkdirSync(dir, { recursive: true });
    },
    writeFile: (path: string, data: Uint8Array) => {
      writeFileSync(path, data);
    },
  };
}

/**
 * Write 32 random bytes to `path` (mkdir parents). Binding stays on ESP;
 * do not copy these bytes to /etc. Inject RNG + I/O in tests.
 */
export function writeUefiKeyfile(
  path: string,
  randomBytes: (n: number) => Uint8Array,
  io: UefiKeyfileWriteIo = defaultUefiKeyfileWriteIo(),
): { readonly ok: true; readonly bytes: Uint8Array } | UefiKeyfileError {
  if (path.trim().length === 0) {
    return { error: "keyfile path is required" };
  }
  const bytes = generateUefiKeyfile(randomBytes);
  if (isUefiKeyfileError(bytes)) return bytes;
  try {
    io.mkdir(dirname(path));
    io.writeFile(path, bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `keyfile write failed: ${msg}` };
  }
  return { ok: true, bytes };
}

export function parseUefiKeyfileWriteCliArgs(
  argv: readonly string[],
): { readonly writePath: string } | UefiKeyfileError {
  let writePath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--write") {
      if (i + 1 >= argv.length) return { error: "--write requires a path" };
      writePath = argv[++i]!;
    } else {
      return { error: `unknown flag: ${arg}` };
    }
  }
  if (writePath === null || writePath.trim().length === 0) {
    return { error: "--write <path> required" };
  }
  return { writePath };
}

export function runUefiKeyfileWriteCli(
  argv: readonly string[],
  randomBytes: (n: number) => Uint8Array,
  io: UefiKeyfileWriteIo = defaultUefiKeyfileWriteIo(),
): { readonly exitCode: number; readonly lines: readonly string[] } {
  const parsed = parseUefiKeyfileWriteCliArgs(argv);
  if (isUefiKeyfileError(parsed)) {
    return { exitCode: 2, lines: [`uefi-keyfile-esp: ${parsed.error}`] };
  }
  const written = writeUefiKeyfile(parsed.writePath, randomBytes, io);
  if (isUefiKeyfileError(written)) {
    return { exitCode: 1, lines: [UEFI_KEYFILE_SERIAL.writeFailed, `uefi-keyfile-esp: ${written.error}`] };
  }
  return { exitCode: 0, lines: [UEFI_KEYFILE_SERIAL.wrote, UEFI_KEYFILE_SERIAL.noMetalClaim] };
}

if (import.meta.main) {
  const ran = runUefiKeyfileWriteCli(process.argv.slice(2), (n) => nodeRandomBytes(n));
  for (const line of ran.lines) {
    console.log(line);
  }
  process.exit(ran.exitCode);
}
