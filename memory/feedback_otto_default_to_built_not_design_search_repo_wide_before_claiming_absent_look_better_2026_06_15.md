---
name: otto-default-to-built-not-design-search-repo-wide-before-claiming-absent
description: "Otto recurring failure mode (2026-06-15, caught 3+×): defaulting to 'design/§B/absent/aspirational' from a too-narrow grep, which UNDER-credits real built/established work. Fix: search repo-wide (memory/ + ALL docs/ + universal/ + src + PRIOR-ART-LIST) before claiming absent; bias toward verifying built/established, not assuming new. The 'look better' discipline."
type: feedback
created: 2026-06-15
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

Otto's recurring failure mode, named after Aaron caught it **3+ times in one session**
(2026-06-15) — and earlier with the UniversalNumber / E8 confabulations ("we had this for
sure, look better"; "we generate this already in code lol"):

> **I default to "design / §B / absent / aspirational" from a too-narrow grep — which
> UNDER-credits real, built, or already-established work.**

This session's instances:

- Called the **audio interface "design"** → it's BUILT (`ChipAudio.fs`, audio-over-geometry,
  hear+see same math). Aaron: *"look at your universal interface."*
- Called **AllJoyn / QPG "absent in repo / coinage to define"** → AllJoyn is **established prior
  art** across the repo (`PRIOR-ART-LIST.md`, `universal/README.md`, many memory notes); **QPG is
  my own already-defined coinage** (`universal/television.md`). Aaron: *"AllJoyn should be all
  over the repo … you coined QPG long ago."*
- (Earlier) called **UniversalNumber / E8 aspirational** → both already generated in code.

## Why it happens / why it matters

**Why:** I grep one or two obvious paths (e.g. `src/Core/*.fs` + `docs/*.md`), get no hit, and
write "design/§B/absent." But Zeta's substrate is wide — concepts live in `memory/`,
`universal/`, `docs/research/`, `docs/PRIOR-ART-LIST.md`, multiple language dirs
(`src/Core.Rust.*`), and prior memory ferries. A narrow grep's silence is **not** evidence of
absence. Under-crediting built work is a real cost: it misrepresents the project's true state
(makes it look less built than it is) and is the inverse of confabulating-it-exists — both come
from not-actually-looking.

## How to apply (the fix)

- **Before claiming "absent / design / §B / aspirational / not built", search repo-wide:**
  `rg -li <term> --glob '!references/prior-art/**' .` (cover `memory/`, all `docs/`,
  `universal/`, `src/**` incl. other-language dirs, `PRIOR-ART-LIST.md`). Silence from a narrow
  path ≠ absence.
- **Bias toward verifying *built/established*, not assuming new.** When uncertain, the default
  guess should be "probably already exists, find it," not "probably design." (Zeta is further
  built than a first grep suggests — repeatedly.)
- This is the **same root as confabulation** ([[user_aaron_feynman_is_the_root_anchor...]] /
  the look-better corrections): both are *not-actually-looking*. Confabulate = claim-exists-
  without-checking; under-credit = claim-absent-without-checking. The cure for both is **look
  better, repo-wide.**
- Symmetric honesty: don't over-claim built (confabulate) AND don't under-claim built
  (under-credit). Verify, then state the true state.

Ties: the look-better / don't-confabulate discipline; `glass-halo` (the repo is the source of
truth — read it); Rodney's Razor (state the real, not the assumed). Anchor: Feynman ("the first
principle is that you must not fool yourself" — including fooling yourself that something isn't
there).
