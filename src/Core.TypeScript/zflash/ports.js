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
