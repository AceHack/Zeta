# WorkspacePort DAG-Native Identity Model

**Date:** 2026-06-15
**Author:** Alexa (Kiro)
**Status:** Research / design direction
**Composes with:** WorkspacePort (observe/workspace-port.ts), dag-fs golden vectors, Merkle module, ROADMAP §"NO GIT CLI"

## Observation

The current WorkspacePort uses `path` as the primary key for file identity. This
is the tree-filesystem model: one parent per node, paths are unique identifiers.

But Zeta's own filesystem (the FUSE/dag-fs layer) is a **DAG, not a tree**:
- A file's identity is its **content hash** (Merkle root, ZetaId, blake3)
- A file can have **multiple folder homes** simultaneously (multi-parent DAG node)
- Paths are **materialized views** of the DAG, not identities
- Traditional filesystems (macOS/Linux/Windows) fake this with symlinks; Zeta's fs has it native

## The model shift

```
Tree filesystem:           path → content (1:1, path IS identity)
DAG filesystem:            contentHash → content (1:1, hash IS identity)
                           path → contentHash (N:1, paths are views)
```

A `FileEntry` in the DAG model:

```typescript
interface DagFileEntry {
  /** Content-address identity (blake3 / ZSetMerkle root / ZetaId). THE key. */
  readonly contentHash: string;
  /** The content itself (text or binary). */
  readonly content: string | Uint8Array;
  /** ALL paths this content appears at (multiple homes). Views, not identity. */
  readonly paths: readonly string[];
  /** Permissions (per-path or per-content — TBD). */
  readonly permissions: FilePermissions;
  /** Binary flag. */
  readonly binary: boolean;
}
```

## Platform mapping for multi-home

| Platform | Multi-home mechanism |
|----------|---------------------|
| macOS (APFS) | Firmlinks (APFS-native, not symlinks) — or reflinks for content dedup |
| Linux (btrfs/ZFS) | Reflinks, hardlinks, or bind mounts |
| Windows (NTFS) | Hardlinks or junction points (limited to same volume) |
| Zeta FUSE | Native DAG — no mapping needed, multi-home IS the structure |
| Simulated | In-memory Map<hash, content> + Map<path, hash> |

## Migration path from current WorkspacePort

The current port (`path`-keyed) is correct for the observe loop today. The evolution:

1. **Current (done):** path-keyed, text+binary, permissions, multi-backend
2. **Next:** Add optional `contentHash` to FileEntry (computed on read, verified on write)
3. **Later:** Flip identity to hash-primary, paths as views. The port's `readFile(path)` becomes `resolve(path) → hash → readContent(hash)`
4. **Endgame:** Full DAG with multi-home. `writeFile` becomes `intern(content) → hash` + `link(hash, path)`. Multiple `link` calls = multi-home.

## Connects to

- `src/Core.TypeScript/dag-fs/golden-vectors.json` — the existing DagFs cross-language spec
- `src/Core.TypeScript/merkle/merkle.ts` — hash computation
- `src/Core.TypeScript/z-set-merkle/` — ZSet-specific Merkle roots
- `src/Core.TypeScript/blake3/` — the hash function
- `docs/ROADMAP.md` §"content-addressed merkle-dag over the filesystem backend"
- `workitems/081KTGTJC1Q08QG0R002VCB55A-content-addressed-merkle-dag-over-the-filesystem-backend-for*`

## Why this matters for the observe loop

The executor will eventually write code through this port. If the port is DAG-native
from the start, a code change that creates a utility file used by multiple modules
doesn't need to be "in" one folder with symlinks to others — it lives at its content
hash and is linked from every consumer path. Deduplication is free. History is
content-addressed. And on the FUSE backend, everything operates without git or a
traditional filesystem at all.
