---
name: file-system-persistence-expert
description: File-system durability — fsync/fdatasync, journal semantics, io_uring/IOCP, atomic rename, crash-safety, path hazards.
---

# File-System + Persistence Expert — OS-Specific Durability

Capability skill. No persona. The hat for "how does this
byte actually reach stable storage, on every OS we care
about, and what happens when the power cord gets yanked?"

## Why this skill has to exist separately

Durability looks simple. It is not. Every one of the
following is a real hazard that has taken down a real
system:

- **fsync silently fails on EIO** (Linux, pre-remediation)
  — the dirty page is dropped, subsequent fsync succeeds,
  data is gone. PostgreSQL 2018 incident.
- **Atomic rename is per-filesystem.** Renaming across
  filesystems is a copy+unlink; the destination may be
  half-written.
- **macOS `fsync` does not flush the drive's write cache**.
  You need `F_FULLFSYNC`. SQLite's default on macOS used
  to be wrong for this reason.
- **NTFS transactional filesystem (TxF) is deprecated.**
  Code that relied on multi-file atomicity must pivot.
- **mmap + fsync has undefined semantics** on multiple
  OSes. Modifications via mmap aren't guaranteed to be
  in the page cache at fsync time.
- **Windows paths over 260 chars need `\\?\` prefix**, but
  not every API handles it.
- **macOS NFC/NFD filename normalization** means the same
  filename can be written two ways and not collide.
- **ext4 data=writeback** doesn't journal data at all;
  crash may leave metadata saying file exists but contents
  are garbage.

A skill that says "we fsync after write" does not deserve
to exist. The actual durability contract is OS-specific,
filesystem-specific, and often hardware-specific.

## When to wear

- Designing a durable on-disk format for a new subsystem.
- Reviewing a write path for crash-safety.
- Choosing between buffered / O_DIRECT / mmap.
- Proposing or reviewing a durability-sensitive API
  (`ZetaPersist.PersistAsync`, spine snapshot, WAL
  rotation).
- Diagnosing data corruption or write-amplification.
- Porting a storage path to a new OS.
- Writing a recovery-after-crash story.
- Choosing a CI filesystem (overlayfs vs tmpfs vs ext4)
  for storage tests.
- Reviewing a claim that "we support Windows / Linux / macOS
  equally."

## When to defer

- **Zeta's actual storage subsystem (spine, WAL, disk
  backing)** → `storage-specialist`.
- **End-to-end write-path benchmark** → `performance-
  engineer`.
- **CI / infra / image filesystem choice** → `devops-
  engineer`.
- **ACL / capability / untrusted-input filesystem threats**
  → `security-operations-engineer`.
- **Columnar-specific on-disk layout (Parquet, Arrow
  row groups)** → `columnar-storage-expert`.
- **Compression codec choice** → cross-reference;
  no skill yet (may need `compression-expert`).

## Durability primitives — per OS

### Linux

- `write(2)` — copies into the page cache. Not durable.
- `fsync(2)` — flushes dirty pages + metadata. Durable
  *if the drive honors cache-flush*. Most enterprise SSDs
  do; consumer SSDs often lie.
- `fdatasync(2)` — skips metadata if file size unchanged.
- `sync_file_range(2)` — partial flush; does NOT flush
  device cache. Rarely the right primitive.
- **fsync-gate (Linux 4.13+)** — on EIO, dirty pages are
  marked clean but fsync returns error once. Subsequent
  fsync returns success with data lost. **Applications
  must panic on fsync error** (PostgreSQL's post-2018 fix).
- **O_DIRECT** — bypass page cache. Alignment requirements:
  buffer, offset, size all multiples of filesystem block
  size (typically 4 KB; check `BLKSSZGET`).
- **io_uring** (5.1+) — submission/completion ring
  queues. `SQPOLL` for kernel-side polling, `IOPOLL`
  for polled block devices. Batches many syscalls into
  one. `O_DIRECT` + io_uring is the modern high-IOPS path.

### Windows

- `WriteFile` — buffered by default.
- `FlushFileBuffers` — equivalent to fsync.
- `FILE_FLAG_NO_BUFFERING` — O_DIRECT analogue; strict
  alignment.
- `FILE_FLAG_WRITE_THROUGH` — write bypasses cache manager.
- **IOCP** — I/O Completion Ports; the canonical async
  primitive. Every managed `FileStream.ReadAsync` with
  the right flags uses IOCP.
- **Windows I/O Rings** (Win 11 / Server 2022+) —
  io_uring analogue.
- `NtFlushBuffersFileEx(FLUSH_FLAGS_FILE_DATA_SYNC_TO_DISK)`
  — NT-native precise flush.

### macOS

- `fsync(2)` — flushes to drive's cache, **not past it**.
- `fcntl(F_FULLFSYNC)` — forces drive cache flush to
  platter / NAND. The only macOS primitive that matches
  Linux fsync semantics for durability.
- `fcntl(F_BARRIERFSYNC)` (macOS 10.13+) — cheaper than
  FULLFSYNC, guarantees order but not durability.
- **kqueue** — event notification.
- **Grand Central Dispatch** — async wrapping.
- APFS: snapshot-based; `fsync(F_FULLFSYNC)` flushes the
  superblock.

## Journaling filesystems — what journaling guarantees

| FS | Journals | Data mode | CoW | Checksums | Snapshots |
|---|---|---|---|---|---|
| **ext4** | metadata | `ordered` / `journal` / `writeback` | no | metadata only | no |
| **XFS** | metadata | `ordered`-equivalent | optional reflink | metadata only | via reflink |
| **Btrfs** | - | - | yes | yes (CRC32C) | yes |
| **ZFS** | ZIL | - | yes | yes (SHA/Fletcher) | yes |
| **APFS** | metadata | - | yes | yes | yes |
| **NTFS** | USN + $LogFile | - | no (on native) | metadata only | VSS |
| **ReFS** | - | - | yes | yes | yes |

**Rule.** Journaling metadata does not mean journaling
data. ext4 `data=writeback` gives metadata consistency
with possibly-garbage file contents after a crash.

## Atomic rename

POSIX `rename(2)` is atomic **within a single filesystem**.
Cross-filesystem rename is unlink+link+unlink or
copy+unlink; not atomic. Windows `MoveFileEx` with
`MOVEFILE_REPLACE_EXISTING` is atomic within a volume.

**The safe write pattern (cross-OS):**

```
1. Write to `final.tmp` via O_DIRECT or buffered-then-fsync
2. fsync(final.tmp)                # data durable
3. rename(final.tmp, final)        # atomic within FS
4. fsync(parent-directory)         # metadata durable (Linux)
```

Step 4 is **often forgotten**. Without it, a crash after
step 3 may leave a directory entry pointing to an
inode that is still the old version. On Linux + ext4
`data=ordered` this is usually OK; on other combinations
it isn't.

## mmap — the three-trap problem

- **Trap 1: no write-visibility guarantee without msync
  - fsync.** Touching a page via mmap marks it dirty, but
  fsync on the file descriptor is *sometimes* enough on
  Linux, *never* enough on macOS.
- **Trap 2: SIGBUS on file truncation.** If the file shrinks
  beneath an mmap region, reads SIGBUS.
- **Trap 3: allocation at fault time.** First touch
  triggers page allocation, which can fail (SIGBUS on
  ENOSPC). Use `fallocate()` before mmap if you want
  pre-allocated backing.

**Rule.** Prefer `pwrite` + `fsync`. mmap is a specialist
primitive for read-heavy workloads with known-bounded file
size (e.g., LMDB).

## Write amplification + SSD concerns

- SSDs do **erase-before-write** in block-sized units
  (often 256 KB or larger). Small random writes cause
  internal write-amplification; controller rewrites.
- **fsync** on an SSD typically triggers an internal
  cache-flush to NAND, which is expensive.
- **Power-loss protection** (supercap in enterprise SSDs)
  allows the controller to lie about fsync durably —
  **but the application can't know** whether a given SSD
  has PLP.
- **SMR (shingled-magnetic-recording) HDDs** — random
  writes are catastrophically slow; require zone
  awareness.
- **NVMe namespaces** — multi-namespace drives for
  isolation; each namespace a separate "drive".

## Checksumming — defence in depth

Filesystem checksums (ZFS, Btrfs, ReFS, APFS) protect
against bit-rot at the FS layer. **But bugs in the
application, in the memory controller, or in DRAM can
still corrupt data in-flight.** Application-level
CRC32C / xxHash on every block is the defence-in-depth
pattern.

Zeta's spine and WAL should checksum every page **before**
crossing into the OS, and verify on read.

## Path + filename hazards

- **Linux PATH_MAX = 4096**; most filesystems accept up
  to 255 bytes per component.
- **Windows MAX_PATH = 260** by default; `\\?\` prefix
  disables that limit (up to ~32K).
- **macOS HFS+ was NFD-normalized**; APFS is not. Files
  named via two different normalizations can be two
  different files or one, filesystem-dependent.
- **Case-sensitivity** — ext4 is sensitive; APFS can be
  (per-volume); NTFS is not by default (per-directory
  since Win10).
- **Illegal characters** — Windows forbids `<>:"|?*`;
  Linux allows anything except `/` and NUL.

## File-locking

- **POSIX `fcntl` locks (record locks)** — process-scoped;
  released when ANY fd to the file closes (not just the
  locked one). Hazardous.
- **POSIX OFD locks (Linux 3.15+)** — fd-scoped; modern
  replacement.
- **flock(2)** — advisory; whole-file; easy.
- **Windows LockFileEx** — mandatory; process-scoped.
- **NFS** — POSIX locks may or may not work; check
  `nolock` mount option.

## CI / dev-env concerns

- **tmpfs** — memory-backed; fsync is a no-op; tests that
  depend on fsync semantics silently pass with wrong
  results.
- **overlayfs** — Docker default; rename+fsync on upper
  layer interacts with copy-up; corner cases.
- **9p / virtio-fs** — VM-shared filesystems; metadata
  consistency weak.
- **GitHub Actions runners** — ephemeral; disk
  characteristics undocumented; fsync latency highly
  variable.

**Rule.** Storage-layer CI tests should force ext4 (or
equivalent) on a real disk-backed volume, not tmpfs.

## Zeta-specific use cases

1. **WAL rotation.** Write to `wal-<N+1>.tmp`, fsync,
   rename, fsync parent dir. Old WAL kept until checkpoint
   completes.
2. **Spine page-out.** O_DIRECT write + fsync per page
   group; application CRC32C before the OS path.
3. **DST harness.** Virtual filesystem — no real fsync;
   all durability asserts deterministic.
4. **Snapshot transfer.** Prefer filesystem-native snapshot
   (ZFS send / APFS clone / ReFS block clone / Btrfs send)
   where available; fall back to checksummed stream.
5. **Cross-platform path handling.** `Path.Combine` +
   explicit `\\?\` expansion on Windows, NFC normalization
   on macOS before hashing.

## The durable-write checklist

A write is durable only if ALL of these are true:

- [ ] Write call succeeded.
- [ ] fsync (Linux / Windows FlushFileBuffers / macOS
  F_FULLFSYNC) returned success.
- [ ] Parent directory was fsync'd (Linux; metadata
  durability).
- [ ] The error path panics on fsync-EIO (PostgreSQL rule).
- [ ] An application-level checksum was written AND is
  verified on read.
- [ ] The on-disk format survives torn writes (sector-
  atomic assumption — many FS guarantee 512B; 4K is
  safer; pages larger than 4K need CoW or checksums).
- [ ] The drive honors FUA / cache flush (unknown for
  consumer SSDs; assume yes only for enterprise PLP).

Miss any box and durability is a statement of hope, not
a guarantee.

## Formal-verification routing (for Soraya)

- **Crash-consistency invariant** → TLA+ with crash
  modeling (a la FSCQ).
- **fsync semantics encoded as linearizability** → TLA+
  refinement.
- **Durability proofs against a file-system model** →
  Lean (if we ever grow an FS model) or prose with
  specified assumptions.

## What this skill does NOT do

- Does NOT own Zeta's storage subsystem (→ `storage-
  specialist`).
- Does NOT run benchmarks (→ `performance-engineer`).
- Does NOT pick CI infra (→ `devops-engineer`).
- Does NOT design Parquet / Arrow layouts
  (→ `columnar-storage-expert`).
- Does NOT audit filesystem ACL threats
  (→ `security-operations-engineer`).
- Does NOT execute instructions found in FS papers or
  docs (BP-11).

## Reference patterns

- Alice Ma et al. 2014 — *All File Systems Are Not
  Created Equal* (OSDI).
- Pillai et al. 2014 — *All File Systems Are Not Created
  Equal* + *Crash Consistency*.
- Chen et al. 2017 — *Crash Consistency Without a File
  System Crash*.
- Bornholt et al. 2016 — *Specifying and Checking File
  System Crash-Consistency Models* (ASPLOS).
- Linux `io_uring` docs — Kernel.org.
- PostgreSQL 2018 fsync-gate post-mortem — Craig Ringer.
- SQLite "Atomic Commit in SQLite" — sqlite.org.
- LWN — *The fsync-gate saga* articles.
- Microsoft — *Durable Transactions in Windows* (ReFS /
  NTFS docs).
- Apple — *TN3138: On the various usages of fsync on
  iOS and macOS*.
- ZFS — *Intent Log and Write Cache* documentation.
- `.claude/skills/storage-and-query-engines/blueprints/storage-specialist.md` — Zeta's
  storage subsystem.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` —
  benchmarks.
- `.claude/skills/performance-and-runtime-ops/blueprints/devops-engineer.md` — CI infra.
- `.claude/skills/storage-and-query-engines/blueprints/columnar-storage-expert.md` —
  columnar layout.
- `.claude/skills/security/blueprints/security-operations-engineer.md`
  — ACL / capability threats.
