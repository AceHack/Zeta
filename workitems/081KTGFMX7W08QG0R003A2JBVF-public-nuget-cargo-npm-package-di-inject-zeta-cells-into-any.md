---
id: 081KTGFMX7W08QG0R003A2JBVF
type: task
state: backlog
priority: P2
slug: public-nuget-cargo-npm-package-di-inject-zeta-cells-into-any
title: "Public NuGet/Cargo/npm package — DI-inject Zeta cells into any app so it joins the distributed relativistic DB (git/filesystem integrated)"
created: 2026-06-07T07:27:09.052Z
depends_on: []
composes_with: ["081KTGFG5M908QG0R000N9W3KG", "081KTGES04808QG0R0010AK90E"]
---

# Public NuGet/Cargo/npm package — DI-inject Zeta cells into any app so it joins the distributed relativistic DB (git/filesystem integrated)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGFMX7W08QG0R003A2JBVF-*.md` glob. -->

## Source (Aaron 2026-06-07)

> "we can have a nuget/cargo/npm package that lets people DI-inject zeta cells into their code, making
> their app participate in our distributed relativistic database and integrate nicely with git or
> filesystem too."

## The shape — the public embedding SDK

A **published, multi-ecosystem library** (NuGet · Cargo · npm — and F# rides NuGet) that any developer
adds to their own app and **DI-injects a Zeta cell**. That app then **participates in the distributed
relativistic database**: its cell has an identity + a Log over the data plane, integrating with **git or
filesystem** as the backend (per-stream format choice). The developer gets the substrate (ZSet /
DynamicValue / Log + cell) inside their process via one dependency + a DI registration.

This is the **public generalization** of the internal Ace cell-injection (`081KTGFG5M9`): same
cell-injection surface, but packaged for *third-party* apps across all the ecosystems our 4 languages
already cover (C# → NuGet, Rust → Cargo, TS → npm, F# → NuGet). The 4-language proven base is exactly
what makes a credible cross-ecosystem package possible — each ecosystem ships the native oracle.

## Why it matters

- **Distribution = adoption.** People don't run our DB as a server; they `add` a package and their app
  *becomes a node* in the relativistic DB. Lowest-friction on-ramp.
- **git/filesystem integration** means zero new infra for the developer — their existing repo/fs is the
  backend.
- It's the **third application class** of the cell-injection API (after the data-plane DB CLI/MCP, and
  Ace), so it hardens the cell DI surface into a real public contract.

## Open questions / dependencies

- **Public API surface** → Ilyana (public-api-designer) — every member is a forever-contract; this is a
  *published* surface across 3 registries, so conservative + identical-shape-across-ecosystems matters.
- Depends on: the cell DI surface + data plane (roadmap item #1), the file-type plugin model
  (`081KTGES048`) + determinism contract (`081KTGEVV75`), and the canonical 4-lang nouns (ZSet ✅,
  DynamicValue ✅, Log 🚧 `081KTGD5JMD`).
- What's the minimal "join the DB" surface (register cell → get a Log → read/write ZSets → choose git/fs
  backend + format)? Keep it tiny.

## Sequencing

After roadmap item #1 (data plane + cell) and ideally after Ace (`081KTGFG5M9`) proves the internal
cell-injection. This is the *public* version — gate it behind a stable cell DI API.

## Anchors

- `081KTGFG5M9` (internal Ace cell-injection — the private sibling) · `081KTGES048` (plugin model) ·
  `docs/ROADMAP.md` · the two-plane DB design doc · public-api-designer (Ilyana).
