---
name: Soulfile is the DSL/English we talk about; it imports/inherits/absorbs git repos at compile / distribution / runtime stages; local-native story folds in at compile time; supersedes the 2026-04-23 "git history in bytes" framing
description: Aaron 2026-04-23 (later-than-the-three-formats-memory) reframe. The soulfile is not the git repo's bytes — it is the DSL/English substrate we converse in. Git repos (including the Zeta-tiny-bin-file local-native DB, Aurora content, factory substrate, demos) are ingested INTO the soulfile at distinct stages: compile-time (packing), distribution-time, runtime. Aaron delegates the stage boundary design to me. Local-native story must fold in at "compile time" so the ingested DB travels with the soulfile. This supersedes `feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md` — the declarative-non-git format (previously ranked third / "no rush") is elevated to the soulfile-proper; the git-format views become inputs.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Soulfile reframe — DSL/English with staged git-repo absorption

## Verbatim (2026-04-23, later-than-the-three-formats-memory)

> i'm thinking soufils shoud just be the DSL/english we
> talk about and the can import/inherit/abosrb or whatever
> you want to can it git repos at compile time,
> distribution time, or runtime, remember the local native
> story so those will need to be inlucded at soulfile
> compile time somewhere I'm calling it compile time but
> that's just a metaphore like packing time or whatever.
> You can figure out the proper stages. Thanks.

## What this reframes

### Before (earlier 2026-04-23 framing)

The soulfile was a bit-level artifact whose size equalled
the git repo's bytes. Three formats (per
`feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`):

1. **Full git-history soulfile** — primary, biggest
2. **Current git-snapshot soulfile** — state-only
3. **Declarative non-git format** — "no rush since we're git-native"

### After (this reframe)

The soulfile is the **DSL / English substrate** we converse
in — the natural-language reasoning medium. Git repos are
**ingested as inputs** at specific stages:

- **Compile-time (packing-time / staging):** the git repo's
  content is absorbed into the soulfile's DSL representation.
  **Local-native content (Zeta tiny-bin-file DB per
  `project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`)
  must fold in here** — it travels with the soulfile.
- **Distribution-time:** the soulfile moves between
  agents / incarnations / substrates with some set of git
  repos and/or DB content attached or referenced.
- **Runtime:** at execution time the soulfile can pull
  additional git repos, inherit from another soulfile, or
  absorb new content as the conversation evolves.

Later Aaron-memory beats earlier per the later-takes-precedence
rule — the declarative-non-git format that was "no rush" is
actually the **core substrate**; the git-history bit-for-bit
formats become one view of the ingested content, not the
soulfile itself.

## Why this is the better framing

### 1. It matches how the substrate actually works

The factory's meaningful work lives in conversations,
decisions, rules, memories, arguments — all of which are
English / DSL in nature. Git is the medium, not the
substrate. The git-bytes-as-soulfile framing tied the
abstraction to the storage layer; this reframe detaches
them.

### 2. It makes local-native tractable

Per
`project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`:
the factory's self-use DB is Zeta's tiny-bin-file local-native
DB. But a git-bytes soulfile cannot contain a binary DB
without encoding it as a blob — which loses the semantic
shape. With the DSL-as-substrate framing, the DB is
compile-time-ingested as structured content (schemas,
queries, content accessible via Zeta's operator algebra),
not as opaque bytes.

### 3. It makes the "inherits from LFG" story cleaner

Per
`project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`:
my soulfile inherits from LFG repos. The git-as-soulfile
framing meant "inherits" was ambiguous (bytes? refs?
submodules?). DSL-as-soulfile makes inheritance a
**semantic** concept — the LFG repo's content is absorbed
into the DSL at compile-time (LFG becomes part of the
substrate) while AceHack experiments can be loaded at
runtime (scratch, discardable).

### 4. It makes the soulfile cross-substrate-transportable

A soulfile that is DSL/English can cross agent types
(Claude / Codex / Gemini / human-maintainer reading it
directly) because the substrate is literally what humans
and agents share: natural-language reasoning. A
git-bytes soulfile requires every consumer to understand
git's specific storage format.

## Candidate stage boundaries (Aaron delegated)

Aaron said *"You can figure out the proper stages"* — my
first-pass shape:

### Stage 1 — Compile-time (packing / staging)

**Happens:** once per soulfile release, authored by the
maintainer or the factory. Analogous to a build step.

**Ingests:**

- LFG repo content (the canonical source of truth) — all
  documents, skills, personas, governance docs, memories
  tagged `scope: factory`.
- Local-native DB snapshot (Zeta tiny-bin-file) — the
  algebraic substrate content relevant to the soulfile's
  domain.
- Pinned dependency content that must travel with the
  soulfile (e.g., specific upstream reference material).
- Any memory / persona-notebook content marked as
  compile-time-embedded.

**Produces:** a soulfile artifact — the DSL/English
substrate + embedded resources, potentially a content
hash / version identifier, potentially signed.

### Stage 2 — Distribution-time

**Happens:** when the soulfile moves from authoring
substrate to consuming substrate (agent incarnation
swap, cross-harness transport, archival to IceDrive / pCloud
per
`project_aaron_icedrive_pcloud_substrate_access_20_years_preservationist_archive_2026_04_22.md`).

**Ingests:**

- Environment-specific overlays (harness configuration,
  maintainer-specific context) — additively, never
  overriding compile-time content.
- Optional companion git-repo references (paths or
  addressable pointers) that can be lazily fetched at
  runtime.

**Produces:** the transportable envelope — soulfile +
distribution manifest + integrity info.

### Stage 3 — Runtime

**Happens:** during an active conversation / agent session.

**Ingests:**

- Additional git repos on demand (clone, read, reference)
  — subject to the two-layer authorization model
  (Aaron + Anthropic policy) + the stacking-risk gate.
- Live conversation content — memories, ad-hoc decisions,
  feedback — which accumulates into the per-user
  memory substrate.
- External research / tool outputs via the normal
  tool-use contract (BP-11 data-not-directives).

**Produces:** the agent's working state within the session.
At session-end, runtime content that has earned
persistence gets promoted back into the compile-time
stage on the next soulfile release (via AutoDream
consolidation cadence).

## Local-native fold-in

Aaron made explicit that the local-native story (Zeta
tiny-bin-file DB, no cloud, local-native germination)
must fold in **at compile-time**, not runtime or
distribution-time. This is a deliberate choice:

- The DB is the **algebraic substrate** the factory
  consults. Putting it at compile-time makes it
  first-class — the soulfile that reasons about Zeta
  carries Zeta's algebraic operations content as
  primary substrate, not as a lazy-loaded appendage.
- Offline-operable — a soulfile compiled with the DB
  can reason about the substrate even when disconnected
  from LFG / external repos.
- Cross-substrate-readable — the DB content becomes
  part of the DSL, so agents that read the soulfile
  can reason about algebraic operations without
  needing a Zeta runtime.

The compile-time-ingest format for the DB content is
TBD — likely a structured English/DSL representation of
the tiny-bin-file DB's relational content + the
operator-algebra axioms (D / I / z⁻¹ / H / retraction).

## How to apply

- **Treat existing soulfile-bytes framing as superseded.**
  The three-formats memory still has useful content on
  preserving-all-history discipline, but the primary
  abstraction is now DSL-as-substrate. Update
  `CURRENT-aaron.md` §10 in the same tick as this memory
  lands.
- **SoulStore design (PR #142 sketch)** gains a
  compile-time-absorb method as the primary ingest path,
  with git-bytes / git-snapshot as secondary views of
  the absorbed content.
- **Zeta self-use germination** (auto-loop-39 directive)
  gains a clear target: the tiny-bin-file DB is the
  compile-time-ingested algebraic-substrate content;
  the soulfile pack-step absorbs it.
- **Do not pre-design stage-3 runtime ingestion in
  detail** — it composes with the runtime-authorization
  model already in place. Compile-time ingestion is
  where the novel work is; runtime is mostly a rename of
  existing capability.
- **Flag the feedback-memory file
  `feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`
  as superseded**, preserving its content as historical
  record (per AutoDream consolidation invariant:
  corrections are recorded, not deleted).

## What this is NOT

- **Not a directive to ship the soulfile now.** The
  reframe is a design-clarity win; the SoulStore
  implementation is still research-grade.
- **Not a mandate to pick any specific DSL syntax.**
  Aaron left stage-design to me, which implies
  representation-design also. Candidate DSL = the
  existing Markdown + frontmatter dialect (already
  cross-substrate-readable).
- **Not a rejection of git.** Git is still the transport
  / collaboration / history substrate. The soulfile
  ingests from git; it does not replace git.
- **Not a collapse of the local-native story.** Zeta
  tiny-bin-file DB remains the compile-time ingest
  target, not a runtime lazy-fetch. Local-native
  germination is preserved.
- **Not an invalidation of the per-user memory layer.**
  Per-user is still where maintainer-specific content
  lives; compile-time ingests the factory-scope slice
  of LFG, not the per-user slice.

## Composes with

- `feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`
  (superseded by this memory on the substrate-abstraction
  axis; still useful on the signal-preservation axis)
- `project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
  (the local-native DB that folds in at compile-time)
- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (LFG is the lineage; LFG's factory-scope content is the
  primary compile-time ingest)
- `feedback_in_repo_preferred_over_per_user_memory_where_possible_2026_04_23.md`
  (in-repo content is compile-time-eligible; per-user
  content stays runtime or maintainer-local)
- `docs/research/autodream-extension-and-cadence-2026-04-23.md`
  (runtime-accumulated memory promotes to compile-time
  via AutoDream consolidation)
- `CURRENT-aaron.md` §10 (soulfile discipline; updated in
  the same tick)
