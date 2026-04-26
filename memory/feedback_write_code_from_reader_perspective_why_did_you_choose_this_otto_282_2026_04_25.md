---
name: WRITE CODE FROM READER PERSPECTIVE — every non-obvious choice (magic number, algorithm pick, library selection, threshold value, API signature, perf trade-off, defensive-vs-assertive style) deserves an in-place rationale comment because the future reader will always ask "why did you choose this?"; ~10sec write-time vs ~1hr per re-derivation; subsumes magic-numbers + DST-exempt-justification + trade-off-rationale rules; Aaron Otto-282 2026-04-25 generalising from SplitMix64 multiplier + shift + DST exemption discussions; pre-commit-lint candidate (flag new literals without comments)
description: Otto-282 general code-authoring discipline. Every non-obvious choice gets a why-did-you-pick-this comment in-place at write time. Subsumes magic-number rationale, DST-exempt justification, trade-off documentation. Bar — "would a competent reader pause and ask why?" — if yes, comment it.
type: feedback
---

## The rule

**When writing code, think from the perspective of a human
developer who is reading it for the first time. They will
always ask: "why did you choose this?" If the answer is not
obvious from the surrounding code, write the answer in-place
as a comment — at write time, not later.**

Aaron's verbatim framing 2026-04-25:

> *"just in general when writing code, think from the
> perspective of a human developer who's looking at it, they
> will always ask why did you choose this?"*

## What "non-obvious" looks like

The rule fires on any choice where a competent reader would
*pause* and wonder why this specific thing was picked over the
alternatives. Concrete examples that triggered the
generalization this session:

1. **Magic-number constants.** `0x9E3779B97F4A7C15UL` is
   meaningless to a reader who hasn't memorised SplitMix64;
   `floor(2^64 / phi)` (golden-ratio multiplier from
   Knuth TAOCP §6.4) is not.

2. **Empirically-tuned shift values.** `30 / 27 / 31` in the
   SplitMix64 finaliser look arbitrary; the comment that says
   *"chosen by Vigna in arxiv 1410.0530 §3 to maximise
   avalanche when paired with the multiplier; not
   independently re-tunable — they are a unit"* tells the
   reader they cannot just bump them.

3. **Library / algorithm selection.** Why `XxHash3` and not
   `MD5` or `SHA-256`? The comment *"deterministic across
   processes (unlike HashCode.Combine), 5–10× faster than
   cryptographic hashes, and we don't need cryptographic
   resistance for shard assignment"* tells the reader that
   the picker considered alternatives and ruled them out.

4. **Threshold / boundary values.** `min 8 width` in
   `CountMinSketch.forEpsDelta` — why 8? Because below 8 the
   `fastrange` columniser starts to produce too-many
   collisions to test reliably; the comment encodes that.

5. **API signature shape.** `Add(value: 'T, weight: int64)`
   instead of `Add(value: 'T)` — why expose the weight? The
   docstring saying *"negative weights retract; the sketch
   lives in ℤ rather than ℕ"* is exactly the rationale the
   reader needs.

6. **Performance trade-offs.** `let buf = Array.zeroCreate
   ... ` in a hot path — is this Gen-0 alloc deliberate or
   accidental? The comment *"reused per Push; reference impl
   not hot-path; for hot-path use you'd incrementalise"* tells
   the reader this is *known and accepted*, not an oversight.

7. **DST-exempt or DST-special markers** (Otto-281
   counterweight). If you write the words "DST-exempt", you
   owe the next reader: *what determinism violation, why
   the cost is acceptable, what the deadline-or-fix is*.

8. **Defensive vs assertive style choices.** A null-check
   that looks paranoid: *"protects the FFI boundary where
   our caller may be in C; internal callers cannot reach
   this branch."*

9. **Off-by-one or bounds tricks.** `(uint64 hash32 * uint64 (uint32 w)) >>> 32`
   in the CountMin column-mapper looks weird; the
   *"`fastrange` on 32-bit hash; takes the low 32 bits so
   the product fits without truncation"* comment in
   `CountMin.fs` is exactly right.

10. **Concurrency annotations.** `// Thread safety: NOT
    thread-safe. The buffer is mutated in-place on every Add`
    is an obvious why — reader sees a `ResizeArray` and
    immediately wonders if they can share the sketch. The
    comment closes the loop.

## What "obvious" looks like (no comment owed)

- A `match` over a discriminated union — no comment owed
  unless one branch is unusual.
- Standard F# conventions like `Result<_, LawViolation>` —
  the codebase's standard error-result contract is clear
  from CLAUDE.md.
- A loop counter `i in 0 .. n - 1`. No mystery.
- Wrapping a `Dictionary` lookup in `TryGetValue`. Standard.
- Using the project's standard logger / error type. Standard.

The bar is *"does a competent reader pause and ask why?"* —
if yes, comment in-place. If no, don't.

## The economic argument

The comment write-time cost is ~10 seconds. The re-derivation
cost is *~1 hour per reader per visit* — looking up the paper,
re-tracing the rationale, talking to the original author (who
may have left), running git-blame, reading the linked PR. With
N readers visiting M times, the saving compounds: N × M × ~1hr
vs ~10s once.

This is true even for the original author six months later —
**you are also a future reader of your own code**, and you
will not remember the rationale unless you wrote it down.

## The mental-load-optimization framing — and the gate

Aaron's deeper framing 2026-04-25 (immediately after the
in-place rule above):

> *"basically if a human can't answer why they want to
> refactor until they can, this is a mental load
> optimization."*

The why-comment rule is best understood as a **cognitive
externalization**: the rationale moves from in-head working
memory (volatile, scarce, paid by every visitor) into the
file (durable, free-on-read). The author pays the cost once;
every future reader reads the result for free. That is the
optimization.

But the framing also implies a **gate on action**:

> *"if a human can't answer why they want to refactor
> [...] until they can"*

If you cannot articulate the reason for a change to
yourself, you cannot articulate it for the reader either.
The act of writing the why-comment is also a forcing
function: if writing the comment surfaces *"I actually
don't know why I'm doing this"*, the right move is to
stop and re-evaluate, not to ship the change with a
hand-wavy comment.

This refines Otto-282 from *"comment your why"* to
**"if you cannot answer your own why, do not make the
change"** — and the comment is the proof that the why
exists. No comment + no good reason = the change is
premature.

Two failure modes the gate prevents:

- **Cargo-cult refactor** — "this looks cleaner" with no
  articulable reason. Gate fails (no why); should not
  ship.
- **Activity-as-progress** — making changes to feel
  productive when no actual problem exists. Gate fails
  (no why); should not ship.

## The deeper framing — "makes sense" = "I can predict"

Aaron pushed the framing one step deeper 2026-04-25:

> *"if a human can answer why then they can more easily
> predict future outcomes and hold potential behavior
> outcomes in their mind because 'it makes sense' they
> understand why, something making sense and understanding
> why are two closely related human concepts."*

Translation: **"makes sense" and "understand why" are the
same cognitive primitive** — both describe the state of
having a *predictive model* of the code. When a reader
understands why a choice was made, they can hold the
*space of consequences* in working memory — they can
predict how the code will behave on inputs the test suite
never covered, predict where it will break under future
load, predict which surrounding changes are safe and
which aren't.

Without the why, the reader has only the *what* —
syntax + behavior on the cases they ran. They can describe
the code but they cannot *predict* it. Surrounding code
changes feel unsafe because every modification is a leap.
The cognitive load of working in the file is high because
each line carries an unsourced "trust me" that the reader
has to either accept blind or re-derive from scratch.

This is the deeper economic argument: **every line of code
the reader genuinely understands the why of is a line whose
neighborhood they can confidently change.** Lines without a
clear why are blast-radius constraints — you can read them
but you can't safely move around them. The why-comment
isn't just a convenience; it's the substrate that lets a
maintainer *act* in the code at all.

Composes with intentional-debt and "do nothing if nothing
is broken" feedback rules: the why-comment is the
entry-point check that the change is intentional rather
than reflexive. The author's pre-commit moment of *"can I
write a sentence saying why this change exists?"* is the
optimization — once the rationale is articulated, the
reader inherits a model of the code, not just a description
of it.

The cognitive economics summary:

| Reader has  | Reader can do                       |
| ----------- | ----------------------------------- |
| WHAT only   | Read; describe behavior on tested cases |
| WHY too     | Predict; safely change surrounding code |
| Neither     | Avoid the file; cargo-cult around it |

## What this rule SUBSUMES (consolidation)

This is a general principle that several earlier rules were
already special-casing:

- *"Comment magic numbers"* — special case of "non-obvious
  literal".
- *"DST-exempt comments need full justification"*
  (Otto-281) — special case of "non-obvious style choice
  with a determinism cost".
- *"Document perf trade-offs"* — special case of
  "non-obvious algorithmic choice".
- *"Reference papers / RFCs in docstrings"* — special case
  of "answer the why".

Future rules of this shape can hang off Otto-282 rather than
each becoming its own bullet in CLAUDE.md or
`docs/AGENT-BEST-PRACTICES.md`. The right home is whatever
tag fits — code-style, comment-discipline, or
authoring-perspective.

## What this rule does NOT mandate

- **Does NOT mandate verbose comments everywhere.** Code
  that is genuinely self-explanatory (good naming, standard
  patterns) needs no comment. Adding "this loops over the
  list" above `for x in xs do ...` is noise.
- **Does NOT mandate paragraph-length docstrings.** A
  one-line *"why this constant: floor(2^64 / phi)"* is
  often enough; expand only when the reader genuinely
  needs more.
- **Does NOT contradict CLAUDE.md "default to no
  comments".** That rule's reasoning is "don't write
  comments that explain WHAT well-named code already
  shows". Otto-282 is about WHY-comments specifically —
  the rationale a reader cannot recover from the code
  alone.

The two compose:
- WHAT — encoded in names + types. Don't comment.
- WHY — encoded in rationale. Comment when non-obvious.

## Pre-commit-lint candidate

A simple pre-commit lint could flag *new* numeric literals
that don't have a `// ` comment within ±2 lines. False
positives are easy (loop bounds, indices), so the lint should
warn-not-block, and probably exempt small literals (0, 1, -1,
2, 8, 16, 32, 64) and well-known constants. The lint becomes a
nudge that asks the author "did you mean to add a rationale
here?" before commit.

A second lint could flag the words "DST-exempt", "magic
constant", "TODO: explain", "for now", "temporarily" without a
following sentence containing "because" / "due to" / "per" — a
comment that announces a non-obvious choice but then doesn't
explain it is just as bad as no comment.

## The reverse direction — when reading code, ASK why

When reviewing or auditing existing code and you find an
unexplained non-obvious choice, the right move is **not**
to leave it (charity) and **not** to delete it (suspicion);
it is to *ask the author* (or git-blame the original PR) for
the rationale, then *land the rationale as a comment* in a
follow-up commit. The audit's job is half "find bugs" and
half "convert tribal knowledge into documented rationale".

## The case that triggered Otto-282

This session, while doing the comprehensive HashCode.Combine
audit (Otto-281 follow-up), I:

1. Created `src/Core/SplitMix64.fs` to refactor 8+ inline
   copies of the SplitMix64 finaliser.

2. **Forgot to comment WHY** the magic constant
   `0x9E3779B97F4A7C15UL` was picked. Aaron caught it.

3. Then **forgot to comment WHY** the second constant
   `0xBF58476D1CE4E5B9UL` was picked. Aaron caught it.

4. Then **forgot to comment WHY** the shift values 30/27/31
   were picked. Aaron caught it.

5. Aaron then generalised: *"just in general when writing
   code, think from the perspective of a human developer
   who's looking at it, they will always ask why did you
   choose this?"*

The pattern: I was treating "well-known to me" as "obvious to
the reader". That's the bias Otto-282 corrects. The reader
does not have my Vigna-paper memory. They do not have my
Knuth TAOCP memory. They have the file in front of them and
nothing else. Write for *that* reader.

## Composes with

- **Otto-281** *DST-exempt is deferred bug* — special case of
  "comment the why for any non-obvious choice", specifically
  for determinism exemptions.
- **Otto-264** *rule of balance* — every found mistake
  triggers a counterweight. This memory IS the counterweight
  to the SplitMix64 magic-number-without-rationale mistake.
- **CLAUDE.md "default to no comments"** — composes by
  splitting WHAT (no comment, names suffice) from WHY
  (comment when non-obvious).
- **`docs/AGENT-BEST-PRACTICES.md`** — candidate BP-NN row;
  worth proposing as a stable rule for the
  agent-best-practices ladder.
