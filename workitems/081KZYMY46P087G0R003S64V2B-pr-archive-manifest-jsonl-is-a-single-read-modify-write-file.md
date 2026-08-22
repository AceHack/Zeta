---
id: 081KZYMY46P087G0R003S64V2B
type: bug
state: backlog
priority: P2
slug: pr-archive-manifest-jsonl-is-a-single-read-modify-write-file
title: "PR-archive manifest.jsonl is a single read-modify-write file — N concurrent archive PRs conflict pairwise, O(N-squared) by construction"
created: 2026-08-13T22:47:25.142Z
depends_on: []
composes_with: []
---

# PR-archive manifest.jsonl is a single read-modify-write file — N concurrent archive PRs conflict pairwise, O(N-squared) by construction

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYMY46P087G0R003S64V2B-*.md` glob. -->

## The defect

`archive-pr-reviews.ts` writes `docs/github/prs/manifest.jsonl` by **read-modify-write of one shared
file** (`readFileSync` → append entry → `writeFileSync`, lines 1039–1108). Every archive PR therefore
rewrites the whole manifest, and every such PR touches the **same trailing region**.

Consequence: **N in-flight archive PRs conflict pairwise — O(N²) conflicts by construction.** Merging
any one of them invalidates all the others, so the queue can only be drained strictly serially, and
each merge requires a fresh rebase of every remaining PR.

**CHECKED, observed live 2026-08-13:** eight archive PRs (#10391, #10392, #10399, #10400, #10403,
#10404, #10405, #10407) were simultaneously open and mutually conflicting. Draining them consumed
three autonomous ticks of manual rebasing and produced one self-inflicted bug (a stray `=======`
marker pushed into two branches during an automated union resolution, caught on verification and
repaired). The queue then immediately re-grew, because each merge generates a *new* archive PR that
conflicts with whatever is still open.

This is not bad luck or a busy day. It is the designed behaviour of the data structure.

## Which disciplines this violates

- **§2 lock-free / wait-free** — an archive PR cannot make progress without the permission (i.e. the
  prior merge) of every other archive PR. The shared mutable file *is* the lock.
- **§8 DV2.0** — the manifest is a **fast-changing satellite** stored in a single-file shape suited to
  a stable hub. Change-rate and storage shape disagree.
- **§12 idempotency** — re-running the archiver for a PR already in the manifest is a read-modify-write,
  not an upsert against a natural key.

## Two fixes, both established in-tree

**Option A — shard by ZetaId (recommended).** One file per archived PR under a ZetaId-keyed path, the
pattern already used by `data/tick-shards/YYYY/MM/DD/<32-hex-zetaid>.json` and by `workitems/events/`.
Concurrent writers then never touch the same file, so the conflict class disappears rather than being
mitigated. Aaron 2026-08-13: *"many of our folder are absgtracted with zetaids for collizion
resistance"* — this is that instruction applied to a system that predates it.

**Option B — derive the manifest, do not store it.** Keep the per-PR archive documents as the source
of truth and *regenerate* `manifest.jsonl` from a scan at merge time, so no PR carries the mutation.
This is exactly the `derive` pattern shipped in `src/Core.TypeScript/ace/build-graph.ts` (PR #10395),
where a drift gate recomputes every row and fails on hand-edits.

**Recommendation: A, with B as the index layer.** Shards remove the conflict; a derived manifest keeps
the single-file index for readers that want one, without any writer mutating it. The two compose —
they are the same hub/satellite split the DV2.0 discipline prescribes.

## Migration note

`manifest.jsonl` currently holds **6336 entries** and **3 pre-existing malformed lines** (PRs 6247,
6521, 7865 — predating this work, not introduced by the drain). A migration should surface those three
rather than silently dropping them: a record that fails to parse is a record, and losing it during a
cleanup is the quiet-failure shape this repo already refuses elsewhere.

## Acceptance

- Two archive PRs generated concurrently both merge with **no rebase and no conflict**.
- Re-running the archiver for an already-archived PR is an **upsert**, not a duplicate line (§12).
- The 3 malformed legacy entries are either repaired or explicitly recorded as unparseable, never
  dropped without a trace.

## Anchors

- **Lamport 1978** (ordering without a shared clock) and the lock-free literature for §2. **CITED FROM
  STANDING KNOWLEDGE, not page-checked.**
- In-repo prior art (checked, these are ours): `data/tick-shards/` sharding, `workitems/events/`
  ZetaId-keyed event files, `src/Core.TypeScript/ace/build-graph.ts` `derive` + drift gate.

---

## CORRECTION — the "3 malformed lines" claim in this item is FALSE (2026-08-13, same day)

This work-item asserted, twice, that `manifest.jsonl` carried **3 pre-existing malformed lines**
(PRs 6247, 6521, 7865) and made "surface them, never silently drop them" an acceptance criterion.

**That is wrong. CHECKED: all 6340 lines parse.** So do all of them in every prior revision of the file
(verified independently during the migration, PR #10427).

The three named PRs are exactly — and only — the entries whose `title` contains a backslash escape or a
control character:

- 6247: `test(ci): option B — relocate docker dat…`
- 6521: `fix(DynamicValue): C# JSON \uXXXX uses A…`
- 7865: `fix(setup): skip idle \nSkipping NuGet pa…`

They round-trip byte-for-byte.

### Root cause of the false finding — and it is the second instance the same day

The detection ran each line through `echo "$l" | jq` in **zsh**, where `echo` **interprets backslash
escapes by default**. `\u` and `\n` inside the JSON string values were expanded *before* `jq` parsed
them, corrupting well-formed lines at the measuring instrument rather than in the data.

Earlier the same day, the same bug — zsh `echo` expanding escapes inside these same JSON lines —
produced a phantom 7-line discrepancy in a manifest line count, and sent an autonomous tick chasing
corruption that did not exist.

**The lesson, stated so it is reusable:** do not parse or count structured text through `echo` in a
shell pipeline. Read the file directly (`python3`, `jq -c . < file`, `bun`) so no shell builtin sits
between the bytes and the parser. A measuring instrument that mutates its input produces findings about
the instrument.

### What stands

The **defect this item files is unaffected** — the read-modify-write conflict storm is real, measured,
and was fixed in #10427. Only the migration-hazard subsection was wrong.

The quarantine sidecar (`docs/github/prs/unparseable.jsonl`) shipped anyway and is still worth having:
it is now empty, and the next genuinely unreadable line lands there with its reason and line number
instead of vanishing. A regression test pins the three escape-carrying titles so they cannot be
"cleaned up" by a future pass that repeats this mistake.
