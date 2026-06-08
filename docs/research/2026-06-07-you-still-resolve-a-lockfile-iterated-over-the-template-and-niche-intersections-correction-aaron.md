# You still resolve a versions/lockfile — iterated over the template ∩ niche intersections (correction to #6972) (Aaron, 2026-06-07)

A correction that bounds the "defined not calculated" claim (#6972). Aaron:

> *"you still have to resolve a versions / lock file that iterates based on your template and niche
> intersections."*

## The correction: not zero-solve — a BOUNDED, iterative resolution

#6972 said dependencies are "defined, not calculated" and installs "never solve again." **That was too strong.**
Honest correction: **you still resolve a versions/lockfile.** What changes is the *kind* of resolution:

- **Bounded by the template.** The "template" = the full defined graph (the temple of everything, #6972; the
  unpinned omega master, #6973). Resolution happens *within* that static graph's edges — you don't search an
  open universe, you resolve over a known, defined one.
- **Driven by niche intersections.** You carve niches (subsets, #6972); where multiple niches overlap, their
  version constraints **intersect**, and the lockfile must pick versions consistent across all of them. The
  *intersection* is where the real resolution work is — reconciling the constraints of the niches you actually
  selected.
- **It iterates.** Resolution is an **iterative fixpoint**: propagate constraints across the niche intersections
  over the template until versions converge to a consistent pinned set → the lockfile. ("Iterates" = converge,
  not one-shot lookup.)

So the spectrum, stated honestly:

| | conventional PM | #6972 (overclaimed) | **#6973-corrected (this)** |
|---|---|---|---|
| search space | open universe | "none, pre-defined" | **the static template (closed, defined)** |
| per-install work | full SAT/PubGrub solve | "zero solve" | **bounded iterative resolve over template ∩ niches** |
| output | lockfile | (implied none) | **a lockfile (the pin/craton, #6973)** |

The win is real but narrower than #6972 implied: the solve is **constrained to a defined graph and your niche
intersections** (much smaller, faster, conflicts pre-visible #6940) — *not eliminated*.

## Why "template ∩ niches" is the right framing

- **Template = the defined graph (#6972) = the constraint universe.** Resolution can only pick what the template
  defines; no inventing/fetching outside it. That's what makes it bounded + reproducible.
- **Niche intersections = the actual constraints to satisfy.** One niche alone may be trivially resolvable; the
  work is at the **intersection** of the niches you compose (their shared deps must agree on versions). The
  lockfile is the consistent assignment at that intersection.
- **Iterate = fixpoint over the intersections.** This is the substrate's own recursive/nested-fixpoint machinery
  (Recursive.fs / NestedCircuit.fs; DBSP nested fixpoints) applied to version resolution: propagate version
  constraints across the intersection edges until stable. Incremental: when a niche or the omega master moves
  (#6973), re-resolve only the affected intersection (not the whole graph).
- **The lockfile is the pin (craton, #6937/#6973).** Resolution's output is the pinned snapshot you ship; the
  unpinned omega master + your niches are the inputs; the lockfile is the carved, frozen result.

## Honest scope / peel (this IS the peel of #6972)

- **#6972's "no solve" was the overclaim; this corrects it.** Solving is **reduced and bounded** (closed
  template + niche intersections + iterative fixpoint), **not abolished**. A lockfile is still produced and still
  resolved.
- The reduction is genuine: bounded-graph + pre-visible-conflicts (#6940) make the resolve far smaller and
  deterministic than open-universe SAT — but "iterates" admits it's a *computation*, possibly nontrivial at
  large niche intersections (could still be NP-hard in the worst case over the template; the template just
  bounds it).
- Design, not built: the iterative resolver over (template, niches) → lockfile is to spec; it composes
  Schema/version constraints with the carve (#6972) and the pin (#6973).

## Ties

- **Temple of everything / defined graph (#6972)** — the *template* (constraint universe); this corrects its
  "no solve" claim.
- **Alpha/omega unpinned master (#6973)** — inputs (unpinned latest); the lockfile is the pin/craton output.
- **Compile-time conflicts (#6940)** — conflicts pre-visible in the template make the resolve bounded; resolution
  surfaces unsatisfiable intersections early.
- **Recursive / nested fixpoint (Recursive.fs, NestedCircuit.fs) + DBSP incremental** — "iterates" = fixpoint;
  re-resolve incrementally when niches/omega move.
- **Niche carving / subsets (#6972) + cratons/tides (#6937)** — niches are the inputs; the lockfile is the pin.

## Beacon anchors

- **Version/lockfile resolution** — Cargo (PubGrub), npm, **Nix flake.lock** (resolve against the defined
  nixpkgs *template*, freeze to a lock — the closest analog: defined graph + your inputs → lock). · **PubGrub /
  SAT-based dependency resolution** (Natalie Weizenbaum) — the iterative constraint solve, here *bounded by the
  template*. · **Constraint intersection / fixpoint iteration** (constraint propagation to a fixpoint). · **DBSP
  nested fixpoints / recursive queries** (the "iterates" machinery). Honest novelty: none — it **corrects**
  #6972: you still resolve a lockfile, but the solve is **bounded to the static template (#6972) and your niche
  intersections, resolved by iterative fixpoint** (output = the pinned lockfile, #6973) — a reduced, constrained,
  deterministic resolution, not the elimination of resolution.
