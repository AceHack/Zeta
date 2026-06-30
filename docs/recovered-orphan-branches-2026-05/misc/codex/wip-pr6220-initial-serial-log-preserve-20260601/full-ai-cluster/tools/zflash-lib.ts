// full-ai-cluster/tools/zflash-lib.ts
//
// Pure-logic library extracted from zflash.ts for unit-testability
// (CI test cascade #2 per the maintainer 2026-05-26 — substrate
// engineerable in isolation gets unit-tested cheaply before paying
// for slower integration tests).
//
// All exports here are pure functions / pure constants — NO I/O
// (no fs, no execFileSync, no process.exit). zflash.ts imports + uses
// them in I/O-wrapping contexts.
//
// Tests live at zflash-lib.test.ts (run via `bun test`).

/**
 * RFC1123 hostname regex.
 *
 * Validates a single hostname label per RFC1123:
 *   - Alphanumeric + hyphens only
 *   - No leading or trailing hyphen
 *   - 1-63 characters total
 *
 * Used by zflash.ts (iter-5.2 --host flag + iter-5.2.1 auto-gen
 * validation) and zeta-install.sh (mirror grep `[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$`).
 * Keep these in sync — if you change one, change the other.
 */
export const VALID_HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/** Convenience wrapper around the regex. */
export function isValidHostname(s: string): boolean {
  return VALID_HOSTNAME_REGEX.test(s);
}

/**
 * Parse `diskutil list <device>` output to find a FAT/EFI partition.
 *
 * Recognizes BOTH:
 *   GPT format: `2: EFI EFI                  209.7 MB   disk6s1`
 *               `2: MS-DOS FAT32 NIXOS_ISO   65.5 MB    disk6s2`
 *   MBR format: `1:           0xEF           3.1 MB     disk6s2`
 *               (FDisk numeric type codes: 0xEF = ESP; 0x0C/0x0E = FAT32-LBA/FAT16-LBA;
 *                0x06 = FAT16; 0x0B = FAT32; 0x0F = Extended-LBA)
 *
 * NixOS isohybrid ISO produces the MBR form on macOS after dd.
 *
 * iter-4.4 fix-forward added MBR 0xEF support after the 2026-05-26
 * empirical test surfaced that diskutil reports MBR 0xEF (not GPT
 * EFI/DOS_FAT) for NixOS isohybrid ISOs post-dd.
 *
 * Returns the partition device path (e.g., `/dev/disk6s2`) or null
 * when no matching partition line is found.
 */
export function parseFatPartitionFromDiskutilList(diskutilOutput: string): string | null {
  const lines = diskutilOutput.split("\n");
  for (const line of lines) {
    // GPT-style FAT/EFI markers. `DOS_FAT(_\d+)?` matches both bare
    // `DOS_FAT` AND suffixed `DOS_FAT_32` / `DOS_FAT_16` (cascade-2
    // finding: bare `\bDOS_FAT\b` failed on the underscore-suffix
    // shape; broadened to catch the documented variant too).
    const matchesGpt = /\b(DOS_FAT(_\d+)?|EFI|MS-DOS|FAT16|FAT32|Windows_FAT)\b/i.test(line);
    // MBR partition type codes that indicate FAT or ESP. \b on both
    // sides prevents accidental match inside longer hex strings.
    const matchesMbr = /\b0x(EF|0C|0E|06|0B|0F)\b/i.test(line);
    if (matchesGpt || matchesMbr) {
      const m = line.match(/\b(disk\d+s\d+)\s*$/);
      if (m) return `/dev/${m[1]}`;
    }
  }
  return null;
}

/**
 * Parse `diskutil info <partition>` output for the filesystem UUID used as
 * the USB-bound credential KDF input.
 *
 * Prefer `Volume UUID` because that matches Linux `blkid -s UUID` for the
 * FAT filesystem that zeta-install.sh records at install time. Fall back to
 * `Disk / Partition UUID` for diskutil variants that omit the volume field.
 */
export function parseUuidFromDiskutilInfo(diskutilOutput: string): string | null {
  const volume = diskutilOutput.match(/^\s*Volume UUID:\s+(.+)$/m)?.[1]?.trim();
  if (volume) return volume;
  const partition = diskutilOutput.match(/^\s*Disk \/ Partition UUID:\s+(.+)$/m)?.[1]?.trim();
  return partition && partition.length > 0 ? partition : null;
}

/**
 * Generate an auto-name `node-<6hex>` (24-bit entropy = ~16M possible
 * names; negligible collision risk for any homelab cluster size).
 *
 * NOTE: iter-5.2.2 moved hostname auto-generation from FLASH time
 * (zflash.ts) to INSTALL time (zeta-install.sh on the cluster node)
 * per the maintainer 2026-05-26 multi-node-from-same-USB correction.
 * This function is retained here for any future zflash-side use
 * (e.g., pre-allocating a hostname for cluster-side reservation) +
 * for testing the format. zeta-install.sh uses its own bash-based
 * equivalent (`node-$(head -c 3 /dev/urandom | xxd -p)`).
 */
export function generateRandomNodeName(getRandomBytes: (n: number) => Uint8Array = defaultGetRandomBytes): string {
  const rand = getRandomBytes(3);
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `node-${hex}`;
}

function defaultGetRandomBytes(n: number): Uint8Array {
  // Repo convention (per Copilot review on #5117): route through
  // globalThis.crypto rather than the DOM-typed bare `crypto`,
  // since this repo's TS config uses `lib: ["esnext"]` (no DOM).
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?(b: Uint8Array): Uint8Array } }).crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error(
      "globalThis.crypto.getRandomValues unavailable — running in a non-Web-Crypto environment?",
    );
  }
  const buf = new Uint8Array(n);
  cryptoApi.getRandomValues(buf);
  return buf;
}

/**
 * Recognize a peer-call output-file path for shell-pipe callers
 * (the `OUTPUT-FILE: <path>` marker pattern used by tools/peer-call/*.ts).
 * Not currently used by zflash.ts; included as a candidate pure-logic
 * extraction for future peer-call-wrapper unit tests in the same lib.
 */
export function parseOutputFileMarker(line: string): string | null {
  const m = line.match(/^OUTPUT-FILE:\s+(.+?)\s*$/);
  return m ? m[1]! : null;
}
