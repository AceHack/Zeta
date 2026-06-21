---
name: Rerere Conflict-Resolution Cache Dividend — recurring conflict pattern becomes cheaper after recorded resolution (Amara naming, 2026-04-28)
description: Amara 2026-04-28T20:55Z named the cache-mechanism class after observing that recurring MEMORY.md sibling-DIRTY conflicts during this arc resolved automatically via Git's rerere on later rebases. Definition — a repeated conflict pattern becomes cheaper after Git records a prior manual resolution and reuses it during later merges/rebases. Critical correction (Amara 2026-04-28T21:00Z tighter phrasing): recorded rerere resolutions persist as cache entries; `git rebase --abort` clears only the active rebase/merge resolution state, NOT the recorded-resolution cache.
type: feedback
---

# Rerere Conflict-Resolution Cache Dividend

## Prerequisite — verify rerere is active per clone (Amara 2026-04-30 correction)

Rerere is **not guaranteed in a fresh clone**. Per Git docs:

- It is active when `rerere.enabled` is set to `true` in config.
- It MAY also be enabled by Git's defaults if `.git/rr-cache/`
  already exists in the repo (because rerere was previously used).

So the earlier wording in this file (*"`.git/rr-cache/` directory
existing is not sufficient"*) was **too strong and partly
wrong**. Amara 2026-04-30 correction: don't infer project-wide
rerere behavior from memory — verify per clone before relying
on the cache dividend:

```bash
git config --get --bool rerere.enabled
test -d .git/rr-cache
```

Either condition can activate rerere; both visible together is
the strongest signal. Prefer **explicit `rerere.enabled=true`**
in CONTRIBUTING.md or the install script when the dividend is
load-bearing across multiple contributors — explicit config is
clearer and portable across clones that don't carry the cache.

Without verification, recorded resolutions may not replay and
this entire class's "cache dividend" doesn't materialize.

Carved sentence: *"A cache dividend only counts if the cache
is actually enabled. Verify per clone, not from memory."*

## Class name (Amara 2026-04-28T20:55Z)

**Rerere Conflict-Resolution Cache Dividend** — Amara named
the cache-mechanism class after observing recurring MEMORY.md
sibling-DIRTY conflicts during this arc resolved automatically
via Git's `rerere` on later rebases.

## Definition (Amara verbatim)

> A repeated conflict pattern becomes cheaper after Git
> records a prior manual resolution and reuses it during
> later merges/rebases.

## Critical correction — abort vs cache boundary (Amara 2026-04-28T21:00Z)

This is the **precise phrasing** for canonical use:

> *"Recorded rerere resolutions persist as cache entries;
> abort clears the active rebase/merge resolution state."*

**NOT** "persistent cache survives abort" — that overclaims
the boundary. The exact mechanics:

- **Recorded resolutions** (saved to `.git/rr-cache/<hash>/`
  after a successful conflict resolution + commit) persist
  as cache entries.
- `git rebase --abort` clears the **active** in-progress
  rebase/merge resolution state (the `.git/MERGE_*` files,
  the rebase todo list, the temporary index), but NOT the
  `.git/rr-cache/` directory's recorded entries from prior
  successful resolutions.
- Therefore: an abort doesn't "destroy what rerere knew";
  it just resets what rerere was currently doing. Earlier
  resolutions remain available for future merges that hit
  the same conflict pattern.

The wrong framing: "previous abort taught rerere."
Aborts don't teach rerere — they clear in-progress state.
The correct framing: "previous **completed** resolution
taught rerere; that recorded entry survives subsequent
abort/restart cycles."

## Concrete incident (Otto 2026-04-28T20:56Z)

- **Setup**: Multiple MEMORY.md sibling-DIRTY rebases
  earlier this arc (PRs #688, #690, #692, #693), each
  resolving the same conflict-shape: `<<<<<<< HEAD ... =======
  ... >>>>>>>` on the paired-edit marker line.
- **Successful resolutions during earlier rebases** wrote
  recorded entries to `.git/rr-cache/`.
- **Aaron's 20:53Z stop** + Otto's `git rebase --abort`
  cleared the in-progress merge state but left the
  recorded-resolution cache intact.
- **Max-mode restart** (20:56Z): `git rebase main` on PR
  #693's branch hit the same conflict shape. Output:
  > Resolved 'memory/MEMORY.md' using previous resolution.
- **Result**: rebase proceeded with the pre-recorded
  resolution; manual editing was only needed for the
  second commit's conflict (which had a slightly different
  shape than the first commit's recorded resolution).

## The control (Amara prescribed)

For recurring MEMORY.md sibling-DIRTY conflicts:

1. **Keep rerere enabled** — Git enables it by default
   when `rerere.enabled=true` (or, since Git 2.x, just by
   the existence of `.git/rr-cache/`).
2. **Resolve once carefully** — your first resolution
   becomes the cached resolution for all future occurrences
   of the same conflict shape. Take the extra minute to
   get it right.
3. **Inspect rerere-applied resolutions before continuing**
   — the message "Resolved X using previous resolution"
   means rerere fired. Read the result before `git add`
   ing.
4. **Use `git rerere forget <path>`** if the cached
   resolution is stale or wrong for the current conflict.
   Then re-resolve manually; the new resolution overwrites
   the old cache entry.
5. **Continue rebase only after verifying the file's
   semantic invariant** — for MEMORY.md, that means: the
   index format is preserved (each entry is a one-liner
   under ~150 chars per CLAUDE.md), no duplicate entries,
   chronological/topical ordering preserved.

## Worked-example trace (this session)

The MEMORY.md sibling-DIRTY conflict pattern this arc:

```text
<<<<<<< HEAD
**📌 Fast path: ... <!-- paired-edit: PR #X ... --> ... (CURRENT-aaron.md refreshed ... sections 26-N — ...)
=======
**📌 Fast path: ... <!-- paired-edit: PR #Y ... --> ... (CURRENT-aaron.md refreshed ... sections 26-M — ...)
>>>>>>> commit-sha
```

Resolution: keep the FROM-branch's marker (the new PR adds
its own substrate) AND the most-recent description text
(usually the higher section number). Rerere recorded this
shape as a hash → resolution mapping.

When the same conflict shape appeared in subsequent rebases,
rerere's `Resolved 'memory/MEMORY.md' using previous
resolution` message indicated the cache hit. Manual
verification still needed (the SECOND conflict on a
multi-commit rebase often has a slightly different shape
because the prior commit modified the same area).

## Bead audit

### Bead-audit rule (Amara 2026-04-28T21:10Z)

> *Count only `Resolved '<path>' using previous resolution`
> as a rerere cache-hit bead. `Recorded preimage` and
> `Recorded resolution` are cache-write events: they create
> pending bead opportunities but do not themselves validate
> reuse.*

This rule was added after Otto over-attributed beads on the
restart sequence: the original tick-narration claimed
"3 cache-hit observations across PR #693, #690, #694
rebases" based on conflating activity logs (cache writes)
with validation logs (cache hits). Amara caught the
conflation with the operational distinction:

- **`Resolved '<path>' using previous resolution`** —
  rerere applied a prior recorded resolution. **CACHE HIT.**
  Earns one Rerere Cache Dividend bead per occurrence.
- **`Recorded preimage for '<path>'`** — rerere noted the
  conflict shape pre-resolution (saving it to the cache).
  **CACHE WRITE.** Pending future bead; not yet validated.
- **`Recorded resolution for '<path>'`** — rerere saved the
  user's manual resolution to the cache. **CACHE WRITE.**
  Same: pending future bead, not validated.

Apply this rule rigorously in any future bead audit on this
class. Counting cache-writes as cache-hits is the
**Mechanism-Activity Validation Drift** failure mode
(noted as observation-level only — class promotion deferred
until a second independent example outside rerere). It
generalizes: any class whose validation depends on
mechanism-emitted log signals must distinguish
activity-logs from validation-logs in its bead audit.

### Verified beads

This class earns:

- **1 bead via cache hit**: this session's max-mode restart
  hit `Resolved 'memory/MEMORY.md' using previous
  resolution` on PR #693's first conflict, validating that
  recorded resolutions survived the prior abort. This is
  the **only** cache-hit observed in the restart sequence.

### Pending beads (cache writes; not yet validated)

The restart sequence produced 3 cache-write events whose
validation is still pending:

- PR #693 commit 2 (c795e40): `Recorded preimage` —
  pending. Earns a bead when a future rebase hits this
  recorded shape.
- PR #690 (b1fa17a): `Recorded preimage` + `Recorded
  resolution` — pending. Earns a bead when a future rebase
  hits this recorded shape.
- PR #694 (a8165bb): `Recorded preimage` — pending. Earns
  a bead when a future rebase hits this recorded shape.

Pending beads can convert to earned beads only when the
specific cache entry is reused by a future rebase, with
the `Resolved '<path>' using previous resolution` log
line as the witness.

Future bead-earning opportunities:

- **Wrong cache hit caught**: rerere applies a stale
  resolution; operator catches it via `git rerere status`
  inspection; uses `git rerere forget`. That would earn
  the class another bead via control-application.
- **Cross-session cache survival**: rerere cache survives
  `.git/` operations short of a clone. If a fresh clone or
  cache-clear loses the recordings, that's a falsifier
  observation.
- **Falsifier**: would fail if rerere didn't actually
  reduce conflict-resolution cost across repeated rebases.
  Hasn't happened; class still holds.

## When NOT to rely on rerere

- **Conflict shape is genuinely different each time** —
  rerere matches by content hash, not semantic equivalence.
  Different content = different cache entry needed.
- **Recorded resolution was wrong** — rerere will
  faithfully reapply a wrong resolution. `git rerere
  forget` if you spot it.
- **Multi-line context drift** — rerere uses surrounding
  context; if the file shape evolves significantly, the
  cache miss rate increases.

## What `--force-with-lease` and rerere together buy

The combination makes recurring sibling-DIRTY rebase chains
operationally cheap:

- `git rebase main` triggers rerere → most conflicts
  auto-resolve.
- Manual fixup for any non-cached conflicts (typically
  fewer per round).
- `git push --force-with-lease` (per Post-Abort class
  tiny-blade) safely updates the remote.
- Auto-merge re-arms; CI re-runs.

Net per-round cost: ~30 seconds for a single-conflict
chain, vs ~3 minutes without rerere. Compounds across the
4-5 sibling-DIRTY rounds this arc.

## Composes with

- `memory/feedback_post_abort_dirty_branch_resumption_amara_2026_04_28.md`
  — companion class. Post-Abort is the operational
  checklist; this class is the cache mechanism that makes
  step 4 (rebase) of the checklist fast.
- `memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — adjacent. The 5 disciplines guard against destructive
  ops; rerere is non-destructive (cache-only) but worth
  inspecting after auto-application.
- `memory/feedback_prediction_bearing_class_reuse_amara_2026_04_28.md`
  — this class is at 1 bead via cache-hit; adding more
  beads requires worked examples of `git rerere forget`,
  cross-session survival, or falsifier-event. (Class
  Validation Beads framework lives in that file.)

## What this is NOT

- **NOT a directive to silently trust rerere.** Always
  verify the semantic invariant of the resolved file.
  Rerere matches by hash, not by meaning.
- **NOT a substitute for the underlying conflict
  prevention.** If the same conflict keeps recurring, the
  upstream cause may need fixing (e.g., for MEMORY.md
  contention, the structural fix is per 081KQ8P5D0008QG0R002FSTGXP — make the
  paired-edit lint required, force serialization at the
  gate level).
- **NOT a license for plain `--force`.** Rerere makes
  rebase cheaper; that's no reason to skip
  `--force-with-lease` on the push.

## External lineage

- **Git rerere documentation**: `man git-rerere` defines it
  as "reuse recorded resolution" — records conflicted
  automerge results plus the corresponding manual
  resolutions, then reapplies those resolutions when the
  same conflict appears again.
- **Long-lived branches** are explicitly the canonical use
  case in the Git docs; sibling-DIRTY chains are an
  instance.

## Pickup notes for future-Otto

When you see "Resolved 'X' using previous resolution" during
a rebase or merge:

1. Don't blindly continue. Read the resolved file and
   verify it makes semantic sense.
2. If correct: `git add X` + `git rebase --continue`.
3. If wrong: `git rerere forget X` + manually resolve +
   `git add X` + `git rebase --continue`. The new
   resolution overwrites the old cache entry.

When a recurring conflict pattern keeps reappearing
(like MEMORY.md sibling-DIRTY):

1. The class earns its keep — rerere is doing the work
   that would otherwise be repeated manual editing.
2. But also consider whether the upstream cause needs
   fixing (per the structural-fix discipline). Cache
   dividends are operational; structural fixes are
   strategic.

When `git rebase --abort` happens:

1. The active in-progress rebase state is cleared.
2. The recorded-resolution cache (`.git/rr-cache/`) is
   NOT cleared — those entries survive.
3. On restart, rerere can fire on the same conflicts
   based on the surviving recorded entries.
4. Don't say "abort taught rerere." The completed prior
   resolutions taught rerere; abort just didn't unteach it.
