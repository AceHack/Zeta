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
