# OpenSpec in Zeta.Core

OpenSpec is the source of truth for this project.

If implementation code disappeared, the combination of:

- base capability specs under `openspec/specs/*/spec.md`
- capability profiles (overlays) under `openspec/specs/*/profiles/*.md`

should be sufficient to recreate the current repository shape and
behaviour at the original quality bar.

## Two kinds of "spec" — keep them separate

This project has two distinct things that get called "spec":

1. **Behavioural specs** (what this tree is) — `openspec/specs/*/spec.md`
   and their `profiles/` overlays. Plain-English requirements with
   RFC-2119 `MUST` / `SHOULD` / `MAY` keywords and Gherkin-style
   `WHEN`/`THEN` scenarios. These define **what the library does**.
2. **Formal specs** — TLA+ / Alloy / Z3 / Lean artefacts under
   `docs/*.tla`, `docs/*.als`, `proofs/**`. These define **what
   correctness properties hold**, in machine-checkable form.

When the distinction matters, always write "behavioural spec" or
"formal spec". Never "spec" alone. Agents that collapse the two
have been flagged by the Spec Zealot.

## Ground rules

- Base specs are language-agnostic unless the capability itself is
  a host-language companion surface (e.g. a `csharp-surface`
  capability).
- **Language / platform overlays** capture implementation
  constraints for a specific language or runtime. The directory
  name is `profiles/`, with one file per profile
  (`profiles/fsharp.md`, `profiles/csharp.md`,
  `profiles/github-actions.md`, etc.).
- The current implementation language is F#, with a C# companion
  surface.
- Future Rust, additional F#, or other implementations should
  reuse the same base specs and add their own overlays instead of
  rewriting requirements.
- Specs lead; code, docs, and tests follow.
- Architecture is described as the desired model, not an
  accidental snapshot of current files.
- AI / contributor instruction files (`AGENTS.md`, `CLAUDE.md`,
  `.github/copilot-instructions.md`) are **secondary guidance**;
  rebuild-critical policy must live in the specs, overlays, and
  standing docs.

## Modified OpenSpec workflow — no archive, no change-history

This repo uses a modified OpenSpec workflow. The canonical specs
under `openspec/specs/*/` are the only standing source of truth;
there is no change-history archive, no `openspec/changes/archive/`
tree holding retired proposals.

- **Greenfield refactors are welcome.** When an approach changes,
  the spec changes in place. Historical context lives in
  `docs/ROUND-HISTORY.md` and ADRs under `docs/DECISIONS/`, not
  in a parallel spec-history stream.
- **Disaster recovery is the design pressure.** If code was
  hard-deleted from the repository and from git history (pretend
  `git reflog` is empty, too), a contributor should be able to
  rebuild the current behaviour from these specs alone, at the
  same quality bar. Every spec owner reviews with that scenario
  in mind. The Spec Zealot enforces it.
- **When upstream OpenSpec prompts, skills, or templates are
  refreshed**, remove any archive / change-history flow they try
  to reintroduce so the canonical specs remain the only standing
  source of truth.
- **When old change-proposal material exists**, fold any surviving
  requirements into the canonical specs or overlays and then
  delete the stale change material.
- `openspec/changes/archive/` exists because `openspec init`
  created it, but it is intentionally unused and will be removed
  when the upstream CLI stops recreating it on `init`. Anything
  that lands there by mistake should be folded into
  `openspec/specs/*` and the archive entry deleted.

## Capabilities (populated progressively)

Three capabilities are spec'd today:

- **`operator-algebra`** — Z-sets, D / I / z⁻¹ / H operators, chain
  rule, bilinearity of Join, retraction-native invariants.
- **`retraction-safe-recursion`** — feedback cells, `Recursive`
  (Distinct-clamped LFP), `RecursiveCounting` (Z-linear,
  derivation-count weights), `RecursiveSemiNaive` (monotone-only).
- **`durability-modes`** — `DurabilityMode` DU, factory,
  feature-flag gating on `WitnessDurable`, evaluator resolution
  order, offline-safety, lifecycle stages.

Each capability ships with a `spec.md` plus at least an
`fsharp.md` profile under `profiles/`.

Planned capabilities (not yet spec'd — the Architect prioritises
these per round):

- `storage-spines` — `Spine`, `SpineAsync`, `DiskSpine`,
  `BalancedSpine`, checkpoint format
- `sketches` — HLL, Count-Min, KLL, Bloom (blocked + counting),
  future CQF
- `feature-flags` — already in-tree as a standalone module
  (`src/Core/FeatureFlags.fs`); behavioural spec pending
- `circuit-scheduling` — topo-sort, strict ops, async fast path

Future profiles (`csharp.md` for the shim, `rust.md`,
`python.md`) land only when there's an implementation to describe.

## Authoring convention

Our convention is that each `spec.md` follows the skeleton:

```markdown
## Purpose

<one paragraph, language-agnostic, defines scope>

## Requirements

### Requirement: <short imperative title>

<one sentence with MUST / SHOULD / MAY, RFC-2119 uppercase>.

#### Scenario: <name>

- **WHEN** <condition>
- **THEN** <observable>
- **AND** <additional observable>

### Requirement: <next>

...
```

No code, no method signatures, no F# / C# types in base specs —
those live in overlays.

Profiles under `profiles/<lang>.md` are prose, not RFC-2119. They
document "here's how this capability looks in <language>": current
types, modules, invariants. Overlays never reinvent base
requirements; they refine with platform-specific detail.

## Slash commands

OpenSpec ships slash commands under `.claude/commands/opsx/`:

- `/opsx:explore` — thinking-partner mode before writing a spec
- `/opsx:propose` — new change proposal (see workflow note above:
  we don't land change-history; the "propose" flow is used only
  to generate discussion material, not to create an archive entry)
- `/opsx:apply` — walk through implementation tasks

The `/opsx:archive` command exists in upstream OpenSpec but is
intentionally unused here.

## Reference

- `docs/ROUND-HISTORY.md` — where spec / code evolution narrative
  lives.
- `docs/DECISIONS/*.md` — architecture-decision records with
  dates.
- `.claude/skills/spec-zealot/SKILL.md` — the no-wiggle enforcer.
