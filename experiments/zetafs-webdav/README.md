# ZetaFS / DagFs — v0 mountable macOS filesystem (loopback WebDAV)

The **real F# `Zeta.Core.DagFs`** (content-addressed, deduplicated, multi-parent — `src/Core/DagFs.fs`)
served as a **mountable macOS filesystem** with **no kernel extension and no code-signing**. macOS mounts
it with its built-in WebDAV client (`mount_webdav`); this process is the userspace server and the backend
IS `DagFs`.

## Why this shape

Modern macOS is squeezing out kernel filesystem drivers (the exact class that panics — see the Paragon
`element modified after free` incident). The Apple-native successor is **FSKit** (userspace), but it is
Xcode + entitlement + code-signing gated. Loopback WebDAV gives the same *userspace, no-kext* safety and
mounts **today** with zero signing — the fastest "potential → kinetic" path, and a clean staging ground
before FSKit.

## Run + mount

```bash
# from the repo root
dotnet run --project experiments/zetafs-webdav -- 8787        # serves the real DagFs on :8787

mkdir -p ~/zetafs-mnt
mount_webdav http://127.0.0.1:8787/ ~/zetafs-mnt
open ~/zetafs-mnt                                             # browse it in Finder

# it proves the DagFs semantics through the real mount:
cat ~/zetafs-mnt/_zetafs_proof.txt                            # N paths -> M unique nodes
shasum ~/zetafs-mnt/readme.txt ~/zetafs-mnt/docs/readme.txt   # dedup: identical hash, two paths
```

## Unmount / teardown

```bash
umount ~/zetafs-mnt
# then Ctrl-C the dotnet server (or: pkill -f zetafs-webdav)
```

## Scope (v0 — honest)

- **Read-only**, in-memory demo seed. **Nothing persists; nothing at risk.**
- Backend is the **real `DagFs`** (not a reimplementation) — `link` / `resolve` / `paths` / `pathCount` /
  `nodeCount`.
- This proves *DagFs-as-a-mountable-filesystem works on macOS via userspace.* It does **not** claim
  production readiness or the FSKit-native path.

## Ladder from here

1. **This** — real DagFs core, read-only, mounted. ✅
2. **Write (WebDAV `PUT`/`MKCOL`)** → demonstrate copy-on-write live: `DagFs.editLocal` (fork this path)
   vs `DagFs.editEverywhere` (shared-object edit), visible in Finder.
3. **FSKit native** — the Mac-native destination, once a signing identity + FSKit developer mode +
   `com.apple.developer.fskit.fsmodule` entitlement are set up. Better perf, real FS integration.
