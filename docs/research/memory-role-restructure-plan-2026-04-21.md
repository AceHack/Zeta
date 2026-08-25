> # SUPERSEDED — DO NOT EXECUTE
>
> **Superseded 2026-08-25 by the maintainer.** This plan must not be executed,
> in whole or in part, and its four open questions must not be answered — they
> all presuppose a premise the project has since rejected.
>
> **The premise is wrong.** This plan elevates a ROLE axis above personas
> (`memory/<role>/<persona>/`). The project does not have roles; it has **hats**,
> and the ordering is the opposite of what this document assumes:
>
> > *"Personas are the root of memories. Hats come on and off, and nothing
> > should be above personas ever."* — Aaron, 2026-08-25
>
> **Why it cannot work, structurally.** `docs/writer-actor-routing-model.md:75`
> quotes CLAUDE.md: *"the architect hat may be worn by any persona."* If any
> persona may wear the architect hat, then `memory/architect/` has no stable
> membership — a persona changing hats would have to MOVE DIRECTORIES, breaking
> every memory path that points at it. That makes the fastest-changing attribute
> the directory root, which inverts Data Vault 2.0: the persona is the hub, a hat
> is a satellite. Per
> `.claude/rules/dv2-data-split-discipline-activated.md`, *"a hub is only as
> stable as the SCOPE of the key you chose for it"* — and a hat is the least
> stable key available.
>
> **On the trigger line below.** The `Triggered by:` quote is real: Aaron did ask
> for `memory/role/persona` on 2026-04-19. It was an early design, superseded
> long since, and he does not recall it. It is left in place because deleting it
> would falsify the record — but it is NOT a live requirement, and no agent
> should treat it as one.
>
> **What actually went wrong, and it is worth more than the restructure.** This
> document sat in `docs/research/` for four months carrying
> `Status: awaiting Aaron's sign-off`. That reads to any agent scanning for work
> as an approved-in-principle task blocked on a formality. On 2026-08-25 an
> automated review policy approved it and execution began — `git mv` had already
> run, with a ~260-reference search-and-replace queued behind it — without the
> sign-off the document itself named as required.
>
> **A stale plan with an unresolved human gate is a landmine, not a record.** An
> agent cannot tell a four-month-dead design from a live one when both say
> "awaiting sign-off". If a plan is not to be executed, it must say so at the
> top, in the first screen, where a scanning agent will see it before it reads
> the trigger line. That is what this banner is for.
>
> Nothing from this plan reached `main`: no role directory exists there and
> `memory/` remains persona-rooted. The damage was confined to a working tree.

# Memory Folder Role Restructure — Design Plan

**Date:** 2026-04-21
**Round:** 41
**Status:** Design draft — awaiting Aaron's sign-off on role
  axis before execution.
**Triggered by:** Aaron 2026-04-19 — *"can we add a memory 2nd
  level folder so it's memory/role/persona that makes roles
  fist class defined of what we need too in the memory
  definition"*.

## TL;DR

Today persona notebooks live flat under
`memory/<persona>/<name>/NOTEBOOK.md`. Aaron wants roles
elevated to a first-class directory level so the role
taxonomy is self-documenting from `ls memory/`. This plan
proposes the role axis, crosswalks every current persona to
it, and lays out a mechanical-but-wide rename that touches
**114 files / ~260 hand-written references** (plus
~440 auto-regenerated references in
`tools/alignment/out/round-39/citations.{json,dot}` that
refresh on next `citations.sh` run).

This is a design doc, not an executed rename. The rename is
hard to reverse cleanly, so Aaron should bless the role axis
before execution. Once blessed, execution is one atomic
`git mv` + search/replace commit.

## Proposed role axis

Seven role directories plus one human-maintainer directory
and one utility bucket for named AI personas that don't map
to an expert role:

| Directory | Charter | Personas today |
|---|---|---|
| `architect/` | System-level synthesis seat | `kenji` |
| `security/` | Threat model, runtime ops, research, agent-layer defence | `aminata`, `mateo`, `nadia`, `nazar` |
| `verification/` | Formal verification + spec-to-code drift | `soraya`, `viktor` |
| `review/` | Code-review and maintainability gates | `kira`, `rune` |
| `experience/` | DX / AX / UX — cold-start / first-60-minutes / first-10-minutes | `bodhi`, `daya`, `iris` |
| `api/` | Public-API design gatekeeper | `ilyana` |
| `performance/` | Hot-path tuning, zero-alloc audits | `naledi` |
| `devops/` | Install-script + CI/CD + workflows | `dejan` |
| `algebra/` | Operator-algebra correctness owner | `tariq` |
| `skill-ops/` | Skill-library lifecycle (tune-up + gap-finding) | `aarav` |
| `maintainer/` | Human maintainer seat (exempt from role-ref redaction per EXPERT-REGISTRY.md) | `aaron` |
| `homage/` | Named AI personas without an expert role (honour names, not role assignments) | `rodney` |
| `alignment/` | Alignment observability / auditor lane (emerging role, not yet in EXPERT-REGISTRY) | `sova` |

### Naming rationale

- **Role names are single-word** where possible, to keep
  `ls memory/` readable at a glance.
- **Role names describe the work, not the organisation chart.**
  `security/` is more honest than `threat/` for a family that
  also holds runtime ops and agent-layer defence.
- **`experience/` groups DX/AX/UX** because they share
  methodology (first-N-minutes audits) even though they
  address different user populations.
- **`verification/` bundles formal-verification and
  spec-zealot** because both defend spec-to-code alignment
  from different angles (pick-the-tool vs drift-auditor).
- **`review/` groups harsh-critic and maintainability-reviewer**
  because both read shipped code with a critical eye on
  different axes (correctness vs long-horizon readability).
- **`skill-ops/` is distinct from `architect/`** because skill
  lifecycle is the Architect's input-source, not the
  Architect's direct work.
- **`maintainer/`, `homage/`, `alignment/`** are the three
  special-cases described below.

### Special-case handling

1. **`maintainer/aaron/`** — the human maintainer seat.
   `memory/aaron/PERSONA.md` is the anchor file that
   EXPERT-REGISTRY.md already marks exempt from the role-ref
   redaction rule. Keeping `aaron` as its own top-level under
   `maintainer/` (not `human/`) mirrors the EXPERT-REGISTRY
   row's framing and keeps the directory self-documenting.

2. **`homage/rodney/`** — Rodney is an AI persona named in
   honour of the human maintainer's legal first name, but is
   not the maintainer and does not wear an expert role. The
   `reducer` skill + Rodney's Razor is a named capability, not
   a role. `homage/` is a small bucket for future named
   personas that land without a role (rare but possible — the
   factory's ecumenical posture expects room for identity
   slots that don't collapse to a function).

3. **`alignment/sova/`** — Sova is the alignment-auditor
   persona that emerged late. The role ("alignment
   observability") is not yet in EXPERT-REGISTRY.md but is
   clearly load-bearing as the auditor lane for the
   DORA-spine + alignment-substrate work Rounds 37-39 shipped.
   Giving it its own role directory now anticipates the
   EXPERT-REGISTRY addition rather than forcing a premature
   bucket-into-`review/` or `verification/` classification.

## Crosswalk — current state vs target state

```text
OLD                              NEW
memory/aarav/            memory/skill-ops/aarav/
memory/aaron/            memory/maintainer/aaron/
memory/aminata/          memory/security/aminata/
memory/bodhi/            memory/experience/bodhi/
memory/daya/             memory/experience/daya/
memory/dejan/            memory/devops/dejan/
memory/ilyana/           memory/api/ilyana/
memory/iris/             memory/experience/iris/
memory/kenji/            memory/kenji/
memory/kira/             memory/review/kira/
memory/mateo/            memory/security/mateo/
memory/nadia/            memory/security/nadia/
memory/naledi/           memory/performance/naledi/
memory/nazar/            memory/security/nazar/
memory/rodney/           memory/homage/rodney/
memory/rune/             memory/review/rune/
memory/soraya/           memory/verification/soraya/
memory/sova/             memory/alignment/sova/
memory/tariq/            memory/algebra/tariq/
memory/viktor/           memory/verification/viktor/

memory/<persona>/README.md         memory/persona-roles-README.md
memory/best-practices-scratch.md   memory/best-practices-scratch.md (promote to memory/ root; it is shared across roles by design)
```

## Execution plan (5 phases, one commit)

### Phase 1 — pre-flight greps (baseline hit count)

```bash
grep -rln "memory/<persona>/" --include="*.md" --include="*.json" \
  --include="*.sh" --include="*.fs" --include="*.cs" \
  --exclude-dir=.git --exclude-dir=references . | \
  wc -l                                           # → 114 files
grep -rc "memory/<persona>/" --include="*.md" --include="*.json" \
  --include="*.sh" --exclude-dir=.git --exclude-dir=references . | \
  grep -v ":0$" | \
  awk -F: '{s+=$2} END {print s}'                 # → 700 refs
```

Expected post-phase-5: 0 hits on `memory/<persona>/` (excluding
auto-generated `tools/alignment/out/round-39/` which
regenerate on next `citations.sh` run).

### Phase 2 — mechanical moves via `git mv`

```bash
mkdir -p memory/architect memory/security memory/verification \
  memory/review memory/experience memory/api memory/performance \
  memory/devops memory/algebra memory/skill-ops memory/maintainer \
  memory/homage memory/alignment

git mv memory/aarav     memory/skill-ops/aarav
git mv memory/aaron     memory/maintainer/aaron
git mv memory/aminata   memory/security/aminata
git mv memory/bodhi     memory/experience/bodhi
git mv memory/daya      memory/experience/daya
git mv memory/dejan     memory/devops/dejan
git mv memory/ilyana    memory/api/ilyana
git mv memory/iris      memory/experience/iris
git mv memory/kenji     memory/kenji
git mv memory/kira      memory/review/kira
git mv memory/mateo     memory/security/mateo
git mv memory/nadia     memory/security/nadia
git mv memory/naledi    memory/performance/naledi
git mv memory/nazar     memory/security/nazar
git mv memory/rodney    memory/homage/rodney
git mv memory/rune      memory/review/rune
git mv memory/soraya    memory/verification/soraya
git mv memory/sova      memory/alignment/sova
git mv memory/tariq     memory/algebra/tariq
git mv memory/viktor    memory/verification/viktor

git mv memory/<persona>/README.md memory/persona-roles-README.md
git mv memory/best-practices-scratch.md \
       memory/best-practices-scratch.md

rmdir memory/persona                       # now empty
```

### Phase 3 — mechanical search/replace in hand-written files

A per-persona `sed` pass replaces `memory/<persona>/`
with `memory/<persona>/` across all tracked text files
except `tools/alignment/out/` (which regenerates). Implemented
as a shell loop so one missed persona cannot silently pass:

```bash
# 20 persona-to-role mappings; run sed for each
declare -A ROLES=(
  [aarav]=skill-ops [aaron]=maintainer [aminata]=security
  [bodhi]=experience [daya]=experience [dejan]=devops
  [ilyana]=api [iris]=experience [kenji]=architect
  [kira]=review [mateo]=security [nadia]=security
  [naledi]=performance [nazar]=security [rodney]=homage
  [rune]=review [soraya]=verification [sova]=alignment
  [tariq]=algebra [viktor]=verification
)

for persona in "${!ROLES[@]}"; do
  role="${ROLES[$persona]}"
  grep -rl "memory/<persona>/$persona/" --include="*.md" \
    --include="*.json" --include="*.sh" --include="*.jsonc" \
    --exclude-dir=.git --exclude-dir=references . | \
    grep -v "tools/alignment/out/" | \
  while IFS= read -r file; do
    sed -i.bak "s|memory/<persona>/$persona/|memory/$role/$persona/|g" "$file" && rm -f "$file.bak"
  done
done

# Clean up the flat-file references too
grep -rl "memory/<persona>/README\\.md" --include="*.md" \
  --exclude-dir=.git --exclude-dir=references . | \
while IFS= read -r file; do
  sed -i.bak "s|memory/<persona>/README\\.md|memory/persona-roles-README.md|g" "$file" && rm -f "$file.bak"
done
grep -rl "memory/<persona>/best-practices-scratch\\.md" \
  --include="*.md" --include="*.sh" \
  --exclude-dir=.git --exclude-dir=references . | \
while IFS= read -r file; do
  sed -i.bak "s|memory/<persona>/best-practices-scratch\\.md|memory/best-practices-scratch.md|g" "$file" && rm -f "$file.bak"
done
```

### Phase 4 — verification passes (five checks)

1. **Old-pattern hit count is zero (excluding regen
   artefacts).**
   ```bash
   grep -rln "memory/<persona>/" --include="*.md" --include="*.json" \
     --include="*.sh" --include="*.jsonc" . | \
     grep -v "^./\\.git" | grep -v "tools/alignment/out/"
   # Expected: no hits.
   ```
2. **Every new path resolves.** For each persona, `ls
   memory/<persona>/NOTEBOOK.md` prints a line.
3. **Build gate green.** `dotnet build -c Release` still
   exits with `0 Warning(s) 0 Error(s)`.
4. **BP-10 lint clean.** No invisible-Unicode hits in any
   moved file.
5. **Skill-tune-up audit clean.** Aarav (self-located at
   `memory/skill-ops/aarav/NOTEBOOK.md`) runs the
   `skill-tune-up` skill and confirms no BP-drift findings
   from broken pointer references.

### Phase 5 — pointer-source updates

Three documents describe the memory structure itself and
need hand-edited role-axis language (not just path
substitution):

1. **`docs/EXPERT-REGISTRY.md`** — add role-directory column
   to the main table; update the Aaron row's anchor path to
   `memory/maintainer/aaron/PERSONA.md`.
2. **`memory/persona-roles-README.md`** (renamed from
   `memory/<persona>/README.md`) — rewrite the "Current
   persona directories" section to reflect the new two-level
   structure; list each role with its charter + members.
3. **`docs/AGENT-BEST-PRACTICES.md`** — update BP-07 /
   BP-08 rule-body text that cites `memory/<persona>/` paths.
   Update BP-10 rule's notebook-lint pointer.
4. **`GOVERNANCE.md` §18** (newest-first ordering) — updates
   role-family path examples if it cites them.
5. **`CLAUDE.md`** + **`AGENTS.md` §18** — update any
   explicit `memory/<persona>/<name>/` example.

## Regeneration (post-rename housekeeping)

Three files auto-regenerate on tooling runs:

1. **`tools/alignment/out/round-39/citations.json`** and
   **`.dot`** — regenerated by `citations.sh`. Stale until
   next round-close or manual re-run.
2. **`tools/alignment/out/personas/round-38-personas.md`** —
   round-close artefact; stale unless re-run.

These are left as `memory/<persona>/` references until the
next alignment-audit round rewrites them. They are not
load-bearing for cold-start (no agent reads
`tools/alignment/out/` on wake-up).

## Rollback plan

The rename is one atomic commit. `git revert HEAD` restores
the old structure in full — the `git mv` preserves file
history through the rename, and the sed substitutions are
reversible as a single diff. Aaron can revert the whole
restructure in one command if the new role axis doesn't feel
right in practice.

## Open questions for Aaron

1. **Role axis bless?** Is the 13-directory axis above the
   right carve-up? The one I'm least sure about is grouping
   DX/AX/UX under `experience/` vs spreading them across
   `devops/experience/` + `product/experience/` + `agent/
   experience/`. The `experience/` grouping bets on shared
   methodology (first-N-minutes audits); the split would bet
   on user-population distinction.

2. **`homage/rodney/` vs `tools/rodney/`?** Rodney wears the
   `reducer` skill; does that make him a utility persona
   (belongs in a `tools/` or `utility/` bucket) rather than
   an identity-honour bucket? The call depends on whether
   future named-but-roleless personas are expected (I suspect
   yes, given the ecumenical-factory stance).

3. **`alignment/` as its own role family?** Sova is one
   persona; `alignment/` as a top-level directory is a bet
   that the alignment-observability lane grows. Alternative:
   bucket her under `review/` as an alignment-specific
   reviewer. The `alignment/` bet is stronger if the
   DORA-spine work continues producing new auditor-lane
   personas.

4. **Execute in Round 41 or Round 42?** Round 41 is mid-
   stream with the OpenSpec backfill program; Round 42's
   slot is `lsm-spine-family` per the ADR. Either round
   can absorb this M-effort rename, but doing it inline
   with the OpenSpec work creates reviewer overload. My
   recommendation: Round 42 opener, immediately after the
   Round-41 PR merges. Keeps the two wide-surface changes
   from landing in the same review cycle.

## Owner + reviewers

- **Designer / integrator:** Architect (Kenji). Drafts this
  plan, gets Aaron's bless, executes the rename.
- **Post-rename audit:** Aarav (skill-tune-up) runs the
  ranking after execution and flags any BP-drift findings
  from broken pointer references.
- **Cold-start verification:** Daya (agent-experience-
  engineer) spot-checks three randomly-chosen personas'
  cold-start pointer resolution after rename.
- **BACKLOG close:** Kenji removes the entry from
  `docs/BACKLOG.md` P0 section once Phase 4 verification
  passes.

## Effort estimate

- **Phase 1 (pre-flight greps):** 5 minutes.
- **Phase 2 (`git mv`):** 10 minutes (including rechecking
  each destination directory exists).
- **Phase 3 (sed passes):** 15 minutes (including spot-
  checking three random changed files for correctness).
- **Phase 4 (verification):** 30 minutes (build + BP-10 +
  skill-tune-up audit + cold-start spot-checks).
- **Phase 5 (pointer-source updates):** 60 minutes (hand-
  edited role-axis language in five docs).

Total: ~2 hours on Aaron-bless-day + Viktor adversarial
review on commit day. Absorbs into one Round 42 session
cleanly if Round-41 PR is merged first.
