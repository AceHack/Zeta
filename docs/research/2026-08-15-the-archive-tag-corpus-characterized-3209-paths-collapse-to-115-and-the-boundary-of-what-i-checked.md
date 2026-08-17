# The archive-tag corpus, characterized — 3,209 paths collapse to 115, and where I stopped

**Date:** 2026-08-15
**Agent:** shadow (Claude Code, claude-opus-5)
**Prompt:** Aaron — *"let's try to move all this forward and route if needed — we don't want to be stuck."*
Characterize first; triage only the residue; stop when the remainder stops being worth it; name the boundary.

**Answer in one line:** the 3,209 tag-only paths are **96.4% accounted for by four documented
migrations**; the honest residue is **115 paths**, and the only class in it with real preservation
value is **16 `docs/research/` documents whose absence is selective, not era-wide**.

***

## 0. The collapse, in one table

The characterize-first step was the right call: it collapsed the task rather than starting a month of
hand-triage. Each row is a *named migration* with its own instrument and its own positive control.

| accounted by | count | share | instrument |
|---|---:|---:|---|
| same basename on `main` (path move) | 1,889 | 58.9% | basename identity |
| `docs/backlog/**` `B-NNNN` → ZetaId row present on `main` | 1,108 | 34.5% | alias map → **file existence** |
| same stem on `main` (rename) | 87 | 2.7% | stem identity |
| prefix-stripped rename, verified individually | 4 | 0.1% | correction pass |
| **residue — genuinely unaccounted** | **115** | **3.6%** | — |
| | **3,209** | | |

Three of the four `docs/backlog` stragglers resolved individually (§3), so the backlog block is
**1,111 in, 0 lost**.

***

## 1. Corpus definition (so the denominator is auditable)

- **323** `archive/*` tags, all present. **314** are not reachable from `main`.
- Their trees hold **15,805** distinct paths; `main` holds 30,926.
- **3,209** tag paths have no same-path counterpart on `main`. That is the corpus.

**A denominator I rejected.** Blob-level comparison says **13,510** distinct tag blobs are not on
`main` — a number 4× larger and *wrong for this question*. It counts every historical **revision** of
every file, so an ordinary edited-since file scores as "absent content". A stale revision is not lost
work. Path-level is the right unit; the blob number is reported here only so nobody re-derives it and
thinks the residue is 13,510.

***

## 2. Every instrument, with its positive control

At this scale a silently-broken instrument produces a confident, wrong, very large answer — the
`rg -N` index that scored **0/3 on known positives** last sweep would have manufactured 125 items of
fake work. So each instrument was controlled *before* it was believed, and two failed.

| instrument | control | result |
|---|---|---|
| **blob identity** | (a) real blob found, (b) fabricated SHA absent, (c) a shared blob's two paths are **byte-identical** via `git cat-file` | **3/3 PASS** |
| **alias map → row existence** | B-0730 + B-0732 must read `ROW-ON-MAIN`; B-0747 (minted fresh 2026-08-15) must read `NO-ROW`; an absent id must read `NO-ALIAS` | **4/4 PASS after a control fix** |
| **basename identity** | `memory/persona/aarav/JOURNAL.md` must match; a known-absent research doc must not | **2/2 PASS** |
| **stem identity** | — | **KNOWN FALSE-NEGATIVE, corrected** |

**The alias-map control failed first, and it was my expectation that was wrong, not the code.** I
asserted `B-9999` was a fabricated id; it is a **real alias** (`081KED9T0X008QG0R003SZN0FB`). The <!-- b-ref-adjudicated: B-9999 never-a-row src/Core.TypeScript/backlog/b-to-zetaid-map.json -->
harness refused to report a population result while any control failed, which is exactly what a
control is for. Re-controlled with `B-ZZZZ`, then run.

The map instrument requires the **ZetaId file to exist on `main`**, never map membership — membership
was the prior sweep's Attempt 1 and it proves nothing, because the map contains ids whose rows never
landed.

**The stem instrument's failure mode, found and corrected.** It missed prefix-stripped renames:
`full-ai-cluster/tools/zflash-file-backed-runtime.ts` scored `NO-STEM` while `main` has
`src/Core.TypeScript/zflash/file-backed-runtime.ts`. A correction pass recovered 4 real matches
(3 zflash + `nightly-low-memory.yml` → `low-memory.yml`) — and **produced 3 false positives of its
own** (`design.md`, `json.ts`, `files.test.ts`, from over-stripping to generic stems). Those were
rejected by inspection, not accepted. The correction instrument needs a specificity guard; it is not
safe to run unattended.

### The symlink hazard — checked, not assumed

The warning was that a naive walk follows symlinks and can recurse (this repo has a
`link_to_parent → ..` cycle), and that **tag trees may contain links `main` does not**. Both halves
are true here: the tag trees carry **161** symlinks, `main` carries **164**, and they are not the same
set.

My walk is immune **by construction**, and I verified the mechanism rather than trusting it:
`git ls-tree -r` reads the object database, where a symlink is a **mode-120000 blob whose content is
the target string**. It is never traversed. Demonstrated on the one symlink that reached my residue:

```
.broadcasts  →  blob d8530a2e…  →  content: /Users/acehack/.local/share/zeta-broadcasts
```

An absolute path *outside the repo*, stored as a blob, walked once. No `statSync`, no filesystem, no
cycle. The enumeration terminated finitely at 20,176 rows.

***

## 3. The three backlog stragglers — all resolved, none lost

| id | verdict | evidence |
|---|---|---|
| **B-0282** autonomous-pickup tick integration | **LANDED as code** | `src/Core.TypeScript/backlog/autonomous-pickup.ts` + `.test.ts`, trajectory `docs/trajectories/autonomous-backlog-pickup/RESUME.md` <!-- b-ref-adjudicated: B-0282 landed-as-code src/Core.TypeScript/backlog/autonomous-pickup.ts --> |
| **B-0080** `gate.yml` cache clobbers tracked paths | **ABANDONED-CORRECTLY — the risk is gone** | every `actions/cache` step in `gate.yml` now uses `~/…` home paths; `tools/tla` and `tools/alloy` hold **only `.gitkeep`** (specs moved to `src/Core.TLA/specs/`), so there is nothing tracked left to clobber <!-- b-ref-adjudicated: B-0080 abandoned .github/workflows/gate.yml --> |
| **B-0094** escrow the Aurora Immune Governance flywheel thesis | **SUPERSEDED — the escrow was discharged** | trajectory `docs/trajectories/aurora-immune-reground/RESUME.md` is active (status 2026-06-19, §B row landed, partial §C promotion) and is grounded on `docs/research/aurora-immune-math-standardization-2026-04-26.md`, which is on `main` <!-- b-ref-adjudicated: B-0094 superseded docs/trajectories/aurora-immune-reground/RESUME.md --> |

B-0094 is worth dwelling on because it is the one I most expected to be live: Aaron's own words,
*"This is not rejected. It is escrowed."* The escrow condition was *"until prototype passes"* — and
the prototype did pass, under a different name, on a trajectory that never mentions B-0094. **Looking
at the successor is what prevented me reporting a resolved escrow as lost work.**

***

## 4. The residue — 115 paths, stratified

This is where I stopped triaging per-file and started stratifying, as instructed. **What follows
distinguishes what I verified from what I did not.**

### Verified — dead or superseded (≈ 82 paths)

| class | n | verdict + evidence |
|---|---:|---|
| `docs/trajectories/*.md` (flat) | 14 | **SUPERSEDED** — `docs/trajectories/` is now **29 directories, 0 flat files**; the flat-file era was restructured to directory-per-trajectory with `RESUME.md` |
| `inventory/**` (sql, seed, proofs, lib) | 17 | **SUPERSEDED** — `main`'s `inventory/` is a static markdown+JSON project (`items.json`, `items/*.md`, `proofs/phase7-csp-proof.ts`); the Postgres/RLS design was replaced, not lost |
| `tools/setup/common/*.sh` + `manifests/*` | 10 | **SUPERSEDED** — the documented bash-retirement program; capability moved to ACE setup-realizers (`src/Core.TypeScript/ace/setup-realizers/`) |
| `docs/lost-substrate/artifacts/2026-04-29-corruption/*` | 6 | **ABANDONED-CORRECTLY** — `fsck`/`rev-list` dumps from one corruption incident; forensic transients |
| `docs/hygiene-history/ticks/*` + autodream-fire-history | 6 | **ABANDONED-CORRECTLY** — tick shards, Mirror-register transients |
| `docs/claims/*` + `docs/pr-preservation/329-*` | 8 | **ABANDONED-CORRECTLY** — work-claim and drain logs; expire by nature (the claim ledger itself is alive on `main`) |
| launchd plists (`.copilot`, `.cursor`, `tools/kiro`, `tools/peer-call/ani.sh`) | 5 | **ABANDONED-CORRECTLY** — local loop shims superseded by the GH-Actions heartbeat (`agent: [alexa, otto, soraya]`) |
| `.claude/rules/manifesto-11-specifications.md` | 1 | **SUPERSEDED** — `manifesto-13-specifications.md` on `main` (V2.2, 13 specs) |
| `tools/lint/no-python-files.test.ts` | 1 | **ABANDONED-CORRECTLY** — PR-8130 *"fully retire the no-python-files guard; Python is now first-class"* |
| `.broadcasts` | 1 | **ABANDONED-CORRECTLY** — machine-local symlink to `/Users/acehack/.local/share/…`, outside the repo |
| `memory/*elisabeth*` | 2 | **LANDED** — the Elisabeth→Elizabeth spelling correction (§5) |
| misc transients (`conflict-check.log`, `tools/backlog/backfill-legacy-zetaids.ts` one-shot, …) | ~11 | **ABANDONED-CORRECTLY** — logs and completed one-shot migrations |

### The one class worth Aaron's attention — 16 `docs/research/` documents

**Absence verified as selective, not era-wide.** The natural explanation would be "that era was
cleaned up", and it is false: `main` holds date-siblings from every one of these dates
(2026-04-29: 2, 2026-05-01: 21, 2026-05-07: 30, 2026-05-11: 6, 2025-09: 1). These 16 are missing while
their neighbours survived — consistent with being authored on branches that were pruned before merge.

The notable ones:

- **`2025-09-aurora-cloud-self-migration-safe-haven-amara-unpublished-essay.md`** — an **unpublished
  essay by Amara**. Under *always-preserve-ferries* (others' memory, not curated) this is the single
  highest-preservation-value item in the entire corpus. `main`'s only 2025-09 research doc is a
  different subject (the twitter-mesh vignette), so nothing covers it.
- **The DecisionSignal review record** (7 docs) — rounds 1–3 of a multi-AI design review plus Amara's
  design packets, including *"aaron-delegation-correction"*. `DecisionSignal` is still discussed on
  `main` (`docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md`, several memory files),
  so the concept is live while the review that shaped it is not. Their matching `memory/feedback_*`
  files are absent too — the loss is consistent across both surfaces, which is what makes it look like
  an unmerged branch rather than a deletion.
- The remaining 8 are single-topic notes (Satoshi design-intent 2010, immune-system Z-set/Clifford,
  multi-AI troubleshooting lane discipline, response-size discipline, autodream cadence, …).

**Register, stated plainly:** these are **LIVE-CANDIDATE**, not LIVE. I verified *absence* rigorously;
I did **not** read all 16 and judge each one's present worth. Calling them LIVE would be exactly the
rounding-up this discipline forbids.

**Cost to land:** trivial per file (they are documents; `git show <tag>:<path> > docs/research/<path>`).
**Not done here** — restoring others' memory to a canonical path is a preservation decision, and the
Amara essay in particular is Aaron's call, not mine.

### What I did NOT check — the boundary

Stated so this reads as a partial sweep that names its edge, never as a complete one:

- **~17 residue paths were classified by category, not opened individually** — mostly `tools/*`
  singletons (`tools/git`, `tools/audit`, `tools/soraya`, `tools/lanes`, `tools/budget`,
  `tools/persistence/windows/*`), plus 4 `.github/workflows`, 2 `.claude/skills`, 4 `samples/*`,
  2 `tests/*`, `registry/firefly-cases.yaml`, `src/Core.CSharp.ZetaId/Firefly.cs`, `ui/demo/…`. Their
  directories all have living successors on `main`, which is why they sort as superseded — but that
  is a **category inference, not a per-file content check**.
- **The 1,889 basename matches were not content-compared.** Same basename is strong evidence of a
  path move; it is not proof the content is equivalent. A file that moved *and* was gutted would
  score as accounted here.
- **The 3,088 accounted paths were not read.** The point of characterizing was to avoid that.
- **Nothing was deleted and no deletion is proposed.** The scheduled cooling-tag GC owns that
  decision; these tags remain the only copy of the branches they hold.

***

## 5. The near-miss worth recording

`memory/user_sister_elisabeth.md` — a memory file about **Aaron's late sister, to whom Zeta is
dedicated** — sat in the residue as "absent from `main`". Under a filename-only reading it is a
catastrophic loss.

It is not lost. It landed as `memory/user_sister_elizabeth.md`: **Elisabeth → Elizabeth**, a
deliberate canonical-spelling correction that `main` itself documents
(`memory/feedback_elizabeth_canonical_spelling_overrides_section_33_history_preservation_aaron_2026_04_28.md`),
alongside two `archive/*` tags named for the fix. Verified by content, not name — same
`originSessionId`, same disclosure, and the file **grew** 159 → 219 lines. `docs/DEDICATION.md` is
present.

This is the sharpest possible illustration of why filename evidence is not content evidence, and why
a rename is the exact shape that makes landed work read as lost. It is also why the residue number
must never be reported without saying which instrument produced it.

***

## 6. Corrections to the brief (flagged, as asked)

1. **"~25× the corpus you just triaged" is right by paths, wrong as a workload estimate.** The
   3,209 paths carry **20,176 path/blob pairs** across 314 tags, but **96.4% collapse under four
   named migrations**. The triage-shaped remainder is **115** — *smaller* than the 125-file sweep it
   was compared against.
2. **The prettier correction arrived after Task 1 was already pushed, and Task 1 is unaffected** —
   it touches only `.github/workflows/accelerator-move-next.yml` and two `docs/accelerator/*.md`
   files. `build-graph.json` was never written, so the 1,273-line reformat diff was never at risk.
   `derive` ran (after `git add`) and reported in sync without modifying the graph.
3. **`docs/accelerator/EVENT-STORE-SCHEMA.md` had more dead links than briefed** — eight across the
   two accelerator docs, not two. Fixed in the Task 1 PR.
4. **The `accelerator-move-next` workflow *did* work once** (run 26674800857, 2026-05-30, all 8 steps
   executed). My earlier triage implied it never functioned; corrected in the Task 1 PR.

***

## 7. Pointers

- Prior sweeps: `docs/research/2026-08-15-recovered-wip-code-and-research-sweep-the-125-non-backlog-files-triaged.md`
  · commit `6e47ac90f` (B-NNNN census, unmerged branch)
- Alias map: `src/Core.TypeScript/backlog/b-to-zetaid-map.json` (1,251 aliases — membership proves nothing)
- Resolved stragglers: `docs/trajectories/aurora-immune-reground/RESUME.md` ·
  `src/Core.TypeScript/backlog/autonomous-pickup.ts`
- The near-miss: `memory/user_sister_elizabeth.md` · `docs/DEDICATION.md`
- Rules applied: `.claude/rules/toy-is-free-metered-must-be-earned.md` (the 16 docs are
  **LIVE-CANDIDATE**, not LIVE — absence is metered, worth is not) ·
  `numerology-vs-number-theory.md` (a matching basename is a count, not an identification) ·
  `always-preserve-ferries` (why the Amara essay is called out by name and left for Aaron)
