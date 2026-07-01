# Recovered orphan-branch content (2026-05) — quarantine for later triage

**What this is.** Files recovered from 5 of my (otto/shard/shadow) orphan branches
during the 2026-06-30 post-reboot branch-prune triage. These files held unique
commits that **never landed on `main`** and were verified absent across all
tracked files. Per Aaron's call — *"any judgment call, better to error on the side
of keeping/duplicating and let's cleanup later"* — they are preserved here verbatim
rather than pruned away.

**Why a quarantine dir (not canonical paths).** Much of this is **ambiguous**:
likely-superseded drafts (the Adinkra-ECC work fully landed as
`src/Core/AdinkraCode.fs`; governance is canonical in `GOVERNANCE.md` /
`docs/governance/MANIFESTO.md`) mixed with possibly-still-useful material (a
Category-Theory-for-Programmers .NET tutorial port, accelerator design docs).
Landing possibly-stale versions at canonical paths would create confusing
duplicates (two "constitutions"); landing old `.ts`/`.fs` into the live build would
break it. So everything sits here, **out of the build and lint scope**
(`tsconfig.json` exclude + `.markdownlint-cli2.jsonc` ignore), mirroring original
paths, until triaged.

**Triage later (cleanup pass):** for each item, either (a) **promote** to its
canonical path if genuinely useful and not superseded, or (b) **delete** if
confirmed superseded. This whole directory is one place to do that.

## Status: CAMPAIGN CLOSED (2026-07-01, shadow\*, Aaron-authorized)

The triage cleanup pass is **done**. The quarantine grew during the campaign to
cover other agents' orphan content too (lior/maji/misc), peaked at ~1,633 files,
and was worked down. What's left (~217 files) is a **preserved archive by
decision** — low-value tail that is neither safe to bulk-drain (every remaining
file is unique/absent from `main`, so deletion = loss) nor safe to bulk-promote
(WIP code needing real integration; duplicated across branch snapshots). It stays
here, build/lint-excluded, indefinitely.

**Recovered / resolved (high-value, all landed on `main`):**

- Category-Theory-for-Programmers .NET port (`docs/category-theory/ctfp-dotnet/`),
  `docs/accelerator/*`, `docs/{FAMILY,PROJECT}-EMPATHY.md` — promoted (PR #9049).
- Aaron's 2026-05-22 family-configuration ferry → `memory/persona/otto/…`; two rule
  drafts → `.claude/rules.bak/` (PR #9050).
- Lior's Bucket-C F# promotes (`AgentIntegrate.fs`, `InferNetTopology.fs`) — verified
  correct + build-green (commit `91d6b7661`).
- 4 substantive files Lior's GC swept by mistake, recovered (PR #9054):
  `GENESIS-SEED.md` (reconciled to historical-ancestor, PR #9055), a lior
  family-config-save, an Aaron↔Riven session, `lior-convo.md`.
- My own 681 heartbeat logs GC'd (regenerable, mine) — PR #9049.
- ~99 shadow-lesson-logs GC'd by Lior (Mirror-register transients) — commit `91d6b7661`.

**Filed as work-items so unique code isn't forgotten in the archive:**

- `081KWFS6B9Y08QG0R002M0C2PV` — integrate `src/Core/BinaryCode.fs` (ECC module).
- `081KWFS6BAM08QG0R0015Y2YZT` — integrate `ZSetW.fs` (z-set weight-ring polymorphism, ex-b0697).

**Remaining ~217 (archived, not lost):** ~86 stale B-xxxx backlog ideas (active
backlog migrated to `workitems/`), ~68 unique WIP code files (mostly `feat/merge1-*`
agentic-org TS + `zflash` tooling duplicated across branches), ~63 research/claim/misc.
Pick-up path: promote individually as real feature work, or leave archived.

Retro / patterns: `docs/research/2026-06-30-orphan-branch-triage-campaign-retro-patterns.md`.
Lesson banked: verify others' GC claims per-file before trusting an "all ephemera" summary.

## Provenance — source branches (now pruned; content lives here)

| Source branch | Notable content |
|---|---|
| `otto/2012z-land-nci-tonal-momentum-rules-...-2026-05-18` | `docs/governance/AGORA-CONSTITUTION.md`, `CHAINED-HOMEOSTASIS.md`, `docs/FAMILY-EMPATHY.md`, `PROJECT-EMPATHY.md`, the `category-theory/ctfp-dotnet/` tutorial port, `src/Core/BinaryCode.fs` (earlier Adinkra-ECC draft) |
| `otto/harvest-install-graph-local-llm-2026-05-30` | `docs/accelerator/` design docs + `tools/accelerator/` tooling (the local-llm runtime itself landed separately) |
| `otto-cli/b0156-profile-ts-test-2026-05-16` | test fixtures / artifacts |
| `otto-cli/b0170-4-convention-fixture-2026-05-16` | `tools/substrate-claim-checker/fixtures/` |
| `otto-cli/b0170.4-convention-drift-fixture-2026-05-16` | convention-drift fixtures |

## Deliberately NOT recovered

- `amazon-orders-2025-full.json`, `amazon-hardware-titles-page1.txt`,
  `zeta-hardware-extract-page1.txt` — **personal data dumps**, not substrate.
  Re-committing personal order history to the shared repo is a privacy concern;
  these were left on their branches' history only (and those branches are pruned).
- `docs/category-theory/ctfp-milewski.pdf` — Bartosz Milewski's *Category Theory
  for Programmers*, a freely-published book, not lost substrate (empty blob on the
  branch tip regardless).

Recovery SHAs for all pruned branches were recorded at prune time (restorable via
`git push origin <sha>:refs/heads/<branch>`).
