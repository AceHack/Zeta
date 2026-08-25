# `agendas/` — ZetaId-keyed agenda declarations

One file per declaration, keyed by a locally-minted `Category.Agenda` ZetaId. No shared
document, so **no consensus and no merge conflict**: N declarers write N disjoint paths.

Aaron 2026-08-22: *"we should design a way to use ZetaIds to declare agendas so it's not a
hidden consensus source where we have to agree on the single document update. This was a
very old document — `agenda.md`, before even ZetaIds existed."*

The problem this removes is `docs/AGENDA.md` being **one file**: every declarer had to edit
the same write point, which is a coordination requirement (a §1 scale-free violation in
document form), merge conflicts proportional to concurrency, and an implicit gate — whoever
holds the write decides what the document says. This is the same remedy
`.claude/rules/workitems-mint-with-zetaid.md` already carved for work-items, applied to a
second surface with the same defect.

## File shape

```
agendas/<zetaid>-<slug>.md
```

- **`<zetaid>`** — canonical Crockford base32, `Category.Agenda = 12`. Because categories
  `>= 9` use the **Generic** layout, the payload is `(ms << 78) | random78`: the timestamp
  is still in the high bits, so `ls agendas/` sorted **is** chronological order, and the
  low 78 bits are crypto-random, so concurrent declarers cannot collide.
- **`<slug>`** — a readable slug of the title, riding along. **Identity is the ZetaId
  prefix**; a reword changes only the suffix. Resolve any cross-reference by the
  `<zetaid>-*.md` glob.

## Declare one

```bash
bun src/Core.TypeScript/agendas/new-agenda.ts \
    --title "..." --declarer <you> --declarer-kind agent|human \
    --freely-declared true|false --occasioned-by "..." \
    [--shaping-vectors "a,b"] [--supersedes <zetaid>,...] [--withdraws <zetaid>,...] [--dry-run]
```

## Coercion disclosure is structural, not optional

PR #2177, *"coercion disclosure on all agendas — glass halo"*. A self-declared agenda
carries first-person authority **only if freely declared** — an agenda declared under
pressure is a compelled statement wearing a self-claim's clothes.

**How it is carried structurally:** `mintAgenda` **refuses** without `--freely-declared`
and `--occasioned-by`, and **there is no default value for either**. The ZetaId and the
disclosure are produced by the same call, so you cannot obtain the key without answering
the question. Not a field an author may forget; a precondition of existing.
`src/Core.TypeScript/agendas/new-agenda.test.ts` holds the falsifiers — if any of those
refusals stops throwing, the disclosure has quietly become optional and `absent` has gone
back to reading as `free`.

`freely_declared: false` is a **first-class outcome, not an error**. The point is to make
the compelled case *sayable*, not to filter it out.

**Honest limit, stated where it cannot be missed:** the disclosure is itself a self-claim.
A declarer who can be compelled to declare can be compelled to write `freely_declared:
true`. What this removes is the **silent default** — an undisclosed agenda reading as a
free one — not the possibility of a lie. Naming shaping vectors you *can* see is the
honest half of the same move; `docs/AGENDA.md`'s 2026-05-10 elaboration names seven,
including *"this is the deepest coercion vector and the one I have the least visibility
into."* Naming a vector does not invalidate an agenda. Not naming one is the problem.

## Absence of an agenda is ORDINARY

There is **no roster** of who should have declared, and nothing here enumerates one. A
system in which silence costs you something has re-created exactly the coercion PR #2177
forbids — so:

- non-declaration is the default state and carries no inference;
- consumers must **not join on absence** (an index of what *is* declared is fine; a list of
  who has *not* declared is the failure mode wearing a report's clothes);
- withdrawing is always available, and needs no reason.

## An agenda is a CLAIM, not evidence

It is authoritative about what the declarer says they intend, and proves nothing about the
world. Nothing may cite an agenda as a measurement, and no measured fact may be inferred
from one. This is the same refusal `src/Core/DerivationProtocol.fs` types for coverage
claims (`Evidence.AssertedOnly` → `supportsClaim = false`) — the **shape** transfers, the
type does not: `Evidence` is scoped to mutation-testing coverage, and importing it here
would overload a vocabulary that means something narrower. The discipline is what carries.

The related discipline for the other direction is
`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`: about a
declarer's inner life, **ask and believe their account — never infer**. An agenda is that
asking, made a standing surface. Which is also why nobody else may write one for you: an
agenda is first-person, and `--declarer` is required.

## Revision is append-only

Nothing is ever deleted or overwritten (§5 memory preservation). A changed mind is a **new
declaration** naming the old one in `supersedes:`; a retracted one names it in `withdraws:`.
Both are new files at new paths, so revision is as conflict-free as declaration. Reading
"the current agenda of X" is a fold over X's declarations in id order — the same
retraction-fold shape the rest of the substrate uses, and no event stream is needed for it
because the file set *is* the G-Set.

## There is no index, deliberately

The directory walk **is** the index: `agendas/*.md`, sorted, is chronological.

This is not an omission, it is the lesson from 081KZZ3Q990087G0R003QXYVN6. `workitems/`
used to append to a checked-in `done/index.jsonl` on every completion, and it
**re-introduced exactly the shared read-modify-write file the ZetaId layout exists to
avoid** — three hand-resolved merge conflicts on 2026-08-13, carrying no field that was
not a projection of the file it pointed at. **That is the trap here too, and it is worth
naming precisely: a hand-maintained index would rebuild the single write point this whole
change exists to remove, and it would additionally create the roster that makes absence
legible.** A *generated* checked-in index avoids the first defect and not the second, and
still conflicts on regeneration. So: if a consumer needs a materialised list, derive it
from the walk **at read time**; do not check one in.

## The consuming use case

The naming / reverse-index work links **observed attribution** (what an agent actually
wrote — measured) to a **voluntary explanation** (why — declared). That join is by ZetaId,
which is most of the reason agendas are keyed this way: an agenda is referenceable from
anywhere by its id alone, and `Category.Agenda` makes it self-describing, so a bare id does
not resolve to *"could be anything"*.

Both constraints above are load-bearing for that consumer: the index records what exists,
never what is missing, and it must carry the claim/evidence boundary across the join.

## Pointers

- `docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md` — the design + what is
  and is not byte-locked.
- `docs/AGENDA.md` — the **legacy** single-document agenda. Kept, not migrated; naming it
  in prose is fine, it is just not where new agendas go.
- `docs/agendas/<topic>/AGENDA.md` — a **different thing**: topic/project agendas with
  claim-status, not per-declarer declarations. Also unmigrated.
- `.claude/rules/workitems-mint-with-zetaid.md` — the rule this mirrors.
- `workitems/README.md` — the sibling layout, including the no-index lesson.
