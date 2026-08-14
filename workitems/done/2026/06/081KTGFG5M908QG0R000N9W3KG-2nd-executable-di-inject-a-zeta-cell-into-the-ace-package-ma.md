---
id: 081KTGFG5M908QG0R000N9W3KG
type: task
state: done
priority: P2
slug: 2nd-executable-di-inject-a-zeta-cell-into-the-ace-package-ma
title: "2nd executable: DI-inject a Zeta cell into the Ace package manager; a file-type plugin per supported package manager + its declarative dep files"
created: 2026-06-07T07:24:33.801Z
completed: 2026-06-21T04:26:24.417Z
depends_on: []
composes_with: ["081KTFKQGZP08QG0R001ND3VK2", "081KTGES04808QG0R0010AK90E"]
---

# 2nd executable: DI-inject a Zeta cell into the Ace package manager; a file-type plugin per supported package manager + its declarative dep files

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGFG5M908QG0R000N9W3KG-*.md` glob. -->

## Source (Aaron 2026-06-07)

> "after we get it where we don't use the git cli we are going to create/extend a 2nd executable where
> we DI inject a zeta cell into ace package manager and let it add plugins for each package manager it
> supports and its declarative files for each package manager deps."

## The shape

Once the data plane is done (roadmap item #1 — no git CLI; the **1st executable** = the data-plane DB
MCP/CLI), build/extend a **2nd executable**: **Ace** (the package manager) with a **Zeta cell
DI-injected** into it. Ace then **adds a file-type plugin per package manager it supports**, each plugin
handling that manager's **declarative dependency files**:

| Package manager | Declarative dep file(s) the plugin handles |
|---|---|
| npm / pnpm / yarn | `package.json`, lockfiles |
| NuGet | `.csproj` / `.fsproj` `<PackageReference>`, `packages.lock.json` |
| Cargo | `Cargo.toml`, `Cargo.lock` |
| pip / uv | `requirements.txt`, `pyproject.toml`, `uv.lock` |
| (extensible) | new managers add via new plugins — open/closed |

This is the **file-type plugin model (081KTGES048) applied to package-manager declarative files**: each
dep file is a file-type plugin = a `(file-type ↔ ZSet)` handler, optionally with Rx-defined incremental
indexed views (the resolved dependency graph as a view over the dep-file ZSets). The injected **cell** is
the unit that owns Ace's state/Log; Ace orchestrates the per-manager plugins through it.

## Why this shape

- **Dependency files are just declarative data** → ZSets over the DynamicValue substrate; resolution +
  diffing + cross-manager joins are DBSP/IVM views (the n-dimensional dependency space, 081KSGS9H0008QG0R0031PBNGA).
- **Plugin-per-manager, open/closed** → support a new package manager by adding a plugin (data), never by
  modifying Ace's core.
- **Cell-injected** → Ace is a *consumer* of the cell/data-plane (the dogfood: a real 2nd app on the
  substrate, proving the cell DI surface), not a bespoke tool.

## Sequencing

**Strictly after roadmap item #1 (no git CLI / the data-plane DB + cell are real).** The cell DI surface
and the file-type plugin model + determinism contract must exist first. This is the first real *second
application* on the substrate — a forcing function for a clean cell-injection API.

## Anchors / composes-with

- `081KTFKQGZP` — Ace package manager (ZetaId-seeded, self-evolving package pattern) — the seed to extend.
- `081KTGES048` — file-type plugin model (the per-manager plugins are instances) + `081KTGEVV75`
  (determinism contract for those plugins).
- `081KSGS9H0008QG0R0031PBNGA` — package-manager-of-package-managers / n-dimensional dependency space (the vision this serves).
- `081KT07NV0008QG0R001HKPJW6` — Ace store key by package identity (storage-key detail).
- `docs/ROADMAP.md` (the 2nd-executable item) · the two-plane DB design doc (cell + data plane).
