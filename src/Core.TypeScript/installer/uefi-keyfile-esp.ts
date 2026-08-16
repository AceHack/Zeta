/**
 * UEFI keyfile on ESP — USB-IDENTITY-THREAT-MODEL §4 / §8.
 *
 * QEMU-testable persist of a 32-byte factor at `/EFI/ZETA/keyfile` on a FAT
 * image. Binding material is lowercase hex of those bytes (HKDF string).
 * Does not change the shipped `usbUuid` persist path. No TPM / Touch ID claim.
 */

import { parentDirPaths, type AssembleStep } from "./multiboot/assemble.ts";

/** Removable-media ESP path (FAT). Identity namespace: not under `/payloads/`. */
export const UEFI_KEYFILE_IMAGE_PATH = "/EFI/ZETA/keyfile" as const;

export const UEFI_KEYFILE_BYTES = 32 as const;

export const UEFI_KEYFILE_SERIAL = {
  found: "[uefi-keyfile] found /EFI/ZETA/keyfile on ESP",
  missing: "[uefi-keyfile] missing /EFI/ZETA/keyfile; factor unavailable",
  wipeFailsDecrypt: "[uefi-keyfile] ESP wipe removes keyfile; decrypt must fail",
  noMetalClaim: "[uefi-keyfile] QEMU-testable; no TPM/Touch ID claim",
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
export function generateUefiKeyfile(
  randomBytes: (n: number) => Uint8Array,
): Uint8Array | UefiKeyfileError {
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

export function parseKeyfileBindingMaterial(
  hex: string,
): Uint8Array | UefiKeyfileError {
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
