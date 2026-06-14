// Hexagonal ports for USB/ISO install media — vendor-neutral CS vocabulary.
//
// | Category            | Port                     | Today (adapter)        | Future (adapter)     |
// |---------------------|--------------------------|------------------------|----------------------|
// | install-media-source| InstallMediaSource         | ~/Downloads ISO scan   | Zeta artifact registry |
// | block-device        | RemovableBlockDeviceHost   | diskutil + /dev/disk*  | Zeta block enumerator |
// | raw-image-writer    | RawImageWriter             | flash-usb (dd)         | Zeta flash engine    |
// | consent-gate        | DestructiveConsentGate     | typed nonce + PAM/TID  | Zeta presence proof  |
// | esp-writer          | EspPayloadWriter           | FAT mount + file write | Zeta ESP channel     |
// | file-backed-image   | FileBackedImageExecutor    | sparse raw .img + dd   | in-memory VM attach  |
// | process-spawn       | ProcessRunner              | node:child_process     | adapter-only seam    |
//
// Pure planning logic lives in lib.ts; CLI orchestration in cli.ts / file-backed.ts.
// Use cases and tests should depend on lib + ports — not diskutil/dd/bun spawn by name.

export type { CommandResult, ProcessRunner } from "../cluster/ports.ts";

export interface InstallMediaCandidate {
  readonly path: string;
  readonly label: string;
}

/** Discover installer ISO artifacts on the host. */
export interface InstallMediaSource {
  discoverNewestMatching(prefix: string, extension: string): InstallMediaCandidate | null;
}

export interface RemovableBlockDevice {
  readonly path: string;
  readonly sizeBytes: number;
  readonly protocol: string;
}

/** Enumerate external/removable block devices safely. */
export interface RemovableBlockDeviceHost {
  listExternal(): readonly RemovableBlockDevice[];
}

export interface RawImageWriteRequest {
  readonly isoPath: string;
  readonly devicePath: string;
  readonly challengeMode: "short" | "long";
  readonly noEject?: boolean;
}

/** Write installer ISO bytes to a block device behind a consent gate. */
export interface RawImageWriter {
  write(request: RawImageWriteRequest): void;
}

/** Runtime consent for destructive operations (nonce challenge, biometric, etc.). */
export interface DestructiveConsentGate {
  /** Returns stdin bytes to satisfy the downstream writer's confirmation prompt. */
  buildConfirmationInput(nonce: string): string;
}

export interface EspWritePayload {
  readonly devicePath: string;
  readonly relativePath: string;
  readonly contents: string;
}

/** Write small files to the USB ESP (authorized_keys, cred blobs, hostname). */
export interface EspPayloadWriter {
  write(payload: EspWritePayload): void;
}

export interface FileBackedImageWriteRequest {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly espOffsetBytes: number;
  readonly authorizedKeys?: string;
  readonly testMode?: boolean;
}

/** Raw aligned block read/write on a host block device (flash-and-inject seam). */
export interface AlignedBlockDevice {
  readRegion(offset: number, length: number): Buffer;
  writeRegion(offset: number, data: Buffer): void;
  fsync(): void;
  close(): void;
}

/** QEMU/test lane: materialize a bootable raw image without touching real USB. */
export interface FileBackedImageExecutor {
  execute(request: FileBackedImageWriteRequest): { readonly outputImagePath: string };
}
