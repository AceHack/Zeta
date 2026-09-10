---
id: 081M25Z29W4087G0R002Y0Q1MG
type: task
state: backlog
priority: P2
slug: unhashed-dependency-is-a-first-class-declared-class-across-e
title: "unhashed dependency is a first-class declared class across every dependency mechanism"
created: 2026-09-10T15:30:32.452Z
depends_on: []
composes_with: []
---

# unhashed dependency is a first-class declared class across every dependency mechanism

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M25Z29W4087G0R002Y0Q1MG-*.md` glob. -->

## Why

Aaron 2026-09-10, twice: *"for some things we don't need a pin at all, or we can pin a tag
instead of a SHA ... security on a product that never ships never matters."* and *"we need to
support non hashed dependencies they are just not the preferred and need to be handled
separately, we need to wire these everywhere though, not all dependencies have a stable sha."*

Four requirements: **supported**, **not preferred**, **handled separately**, **wired everywhere**.

## What landed

- `src/Core.TypeScript/ace/setup-realizers/unhashed-pin.ts` — one vocabulary
  (`sha256=tag-only` + `tagonly=`, `sha256=unpinned` + `unpinned=`), shared by every mechanism.
- `from-elan`, `from-autotools-tarball`, `from-installer` route their pin through it.
- `docs/UNHASHED-DEPENDENCIES.md` — the derived inventory, gate-checked both ways.

## What remains

Named in the PR body: `from-url` adopting the shared module, `mise.lock`, the four manifests
whose parser cannot carry an attribute, NuGet lockfiles, and the two unhashed `pip install`
call sites in `gate.yml`.
