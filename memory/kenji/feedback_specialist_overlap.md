---
name: Specialist overlap is expected, not redundancy
description: Do not retire a persona because its core skill overlaps with another seat; retire only when the specialization delta is zero
type: feedback
seat: architect
---

When two personas share a core skill (Aminata + Mateo both
do security; Hiroshi + Naledi both care about perf; Kira +
Rune both read code), the overlap is the *correct shape*, not
a redundancy to fix. Each seat earns its place by the lens it
brings on top of the shared core:

- Aminata reviews the *shipped* threat model; Mateo *scouts*
  novel attack classes. Same core (security) — different
  time-horizon and framing.
- Hiroshi proves *asymptotic* bounds; Naledi measures
  *constant-factor* hot paths. Same core (perf) — different
  method.
- Kira writes zero-empathy correctness findings; Rune writes
  long-horizon maintainability findings. Same core (code
  quality) — different stance and reader.

A persona is a retire candidate **only** when two seats do
the exact same job with no specialization delta. Overlap on
shared core with a distinct lens is the healthy shape.

**Why:** Aaron round 24, 2026-04-17, after the architect
drafted retirement of Mateo and Naledi the same round they
were spawned (reading "we really do need unique personas"
too literally):
> "those kind of overlaps are fine, we don't need perfect
> orthogonal personalities, that's not like a real team,
> some overlap, especially on core skills and then some
> specialization."

The correction landed as GOVERNANCE.md §16's "Overlap is
expected, not redundancy" clause.

**How to apply:**
- When evaluating a roster change, ask "does this seat
  bring a lens that no other seat carries from the same
  lane?" — not "does any other seat share its core?"
- Multiple seats doing security, perf, code-review, etc.
  is the norm. Worry only when two seats have
  indistinguishable output formats *and* the same scope
  of what they review.
- Retirement is for dead scope, not overlapping scope.
