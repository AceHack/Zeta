---
name: Newest-first ordering for memory and narrative logs
description: Files with a sequence of entries (MEMORY.md index, ROUND-HISTORY, per-persona notebooks) go newest-first so recent context leads
type: feedback
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Any file in the Zeta project that accumulates a sequence of
entries over time is ordered **newest-first**: the most
recent entry is at the top, older entries trail below. This
applies to:

- `MEMORY.md` (the shared memory index in this folder)
- `docs/ROUND-HISTORY.md` (narrative round log — already
  follows this; keep it)
- `memory/persona/<persona>.md` (per-persona notebooks)
- Any new memory file that collects dated entries inside it

**Why:** Aaron round-25, 2026-04-18: "you probably want to
save memory files with newest memories first that makes it
easier to read for humans and computers when the recent
history is first and ancient history is way down at the
bottom."

Rationale: a reader skimming a memory file or a future
agent waking up on a new session needs the most recent
context first. Chronological-oldest-first makes you scroll
through irrelevant history to find the current state.
Newest-first means the load-bearing material is the first
thing seen.

**How to apply:**
- When adding a new entry to `MEMORY.md`, prepend (top of
  file) rather than append.
- When writing a `docs/ROUND-HISTORY.md` entry, prepend
  above the previous round's entry (the file already has
  a "New rounds are appended at the top" comment — that
  stays).
- When writing a per-persona notebook entry, prepend above
  the previous dated entry.
- For individual memory files (single-topic files like
  `feedback_*.md`), the body is usually one topic so no
  internal ordering applies. But if a memory develops
  multiple dated sections (e.g. "initial rule", "refinement
  2026-05-01"), order those newest-first too.

**Exception:** `docs/WINS.md` is currently ordered
oldest-first (round 21 → round 24 top-to-bottom). Pending
decision on whether to flip; leave as-is until the human
maintainer weighs in. Pattern files like code tests or
specs that are naturally ordered by dependency / topology
(not time) are not subject to this rule.
