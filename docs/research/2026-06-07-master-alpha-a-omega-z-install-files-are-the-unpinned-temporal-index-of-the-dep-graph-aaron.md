# The master `.a` (alpha) / `.z` (omega) install/ensure files are the dep-graph's UNPINNED temporal index (Aaron, 2026-06-07)

Extends the temple-of-everything graph (#6972) with its master index. Aaron:

> *"the master .a (alpha) / .z (omega) install / ensure files are also the master deps-graph temporal index —
> not pinned."*

## The kernel: alpha and omega bracket the graph across time, unpinned

The full dep graph is one constructable file (the temple of everything, #6972; the infinite append-only file,
#6969). Its **master index** is two files bracketing its **temporal** extent:

- **`.a` — alpha = the beginning.** The genesis/root of the dependency graph — the bootstrap seed (ties Ace
  installs-itself #6945, the one-liner bootstrap #6942). The first end of the temporal axis.
- **`.z` — omega = the end / current head.** The latest/complete state of the full graph — HEAD of the infinite
  file (the temple of everything *as of now*).
- Together they are the **master temporal index** of the dep graph: they index it **across time** (the infinite
  file is temporally ordered, event-sourced #6969), from root (alpha) to head (omega).
- **NOT PINNED.** The master `.a`/`.z` **float** — they track the graph's *evolution* (the moving frontier),
  unlike a **pinned** lockfile (a fixed content-addressed snapshot). The master is the live, latest-tracking
  view; **pinned subsets are carved from it at a point in time.**

## Pinned vs unpinned = the craton/tide cut (#6937), on the dep index

This slots exactly into the tectonic/what-stays-what-shifts model (#6937):

- **Unpinned master `.a`/`.z` = the SHIFTING frontier (the tide).** They move as the graph grows — always "alpha
  through current omega." This is the *temporal index*: where the graph is now, and where it began.
- **Pinned install = a CRATON (a fixed carve).** Carving a niche/subset (#6972) at a moment pins it — a
  content-addressed snapshot that *stays* (reproducible, #6960). The lockfile is the craton; the master `.a`/`.z`
  is the tide.
- So: **define against the unpinned master (latest), pin when you carve.** The master tracks truth-over-time;
  each environment pins a slice of it. Bitemporal: the graph has a "what's latest" (omega, unpinned) and a
  "what I built against" (a pin) axis.

## Why a temporal index (not just a graph)

- **The graph evolves; the index gives you time.** "Not pinned" means the master answers *"what is the graph
  now?"* and *"where did it start?"* — and because the file is append-only/event-sourced (#6969), every
  intermediate omega is recoverable (you can pin any past head). The temporal index = the time axis over the
  static-known graph (#6972).
- **Alpha = bootstrap anchor, Omega = current target.** Installs/ensures resolve against omega (latest) by
  default, or against a pinned past head for reproducibility — same carve operation (#6972), different temporal
  point. Alpha is where bootstrap (#6942) starts; omega is where "ensure latest" lands.

## Honest scope / peel

- **Design + naming, not built.** The master-index concept (alpha/omega temporal brackets, unpinned) extends the
  #6972 graph; the file format + the temporal-index queries are to spec.
- **Naming-collision flag (real):** `.a` is already the Unix **`ar` static-library archive** extension; `.z` is
  the legacy **`compress`** extension (and `.Z`). So `.a`/`.z` as Zeta install-file extensions **collide** —
  route to `naming-expert` + collision check before adopting (like zs/zc #6957, NVIDIA-ACE #6946, `.zeta`/`.ace`
  #6962). The *concept* (alpha/omega unpinned temporal index) stands regardless of the chosen extensions.
- **"Unpinned" needs the pin discipline alongside it** — unpinned-by-default is convenient but *reproducibility
  requires pinning at carve* (#6960/#6972). The master floats; deployments must pin. (Don't ship unpinned to
  prod — pin the omega you tested.)
- Alpha/omega is a *rhyme* (beginning/end, Rev. 22:13) for the temporal brackets — anchor, not theology.

## Ties

- **Temple of everything / full graph (#6972)** — the master `.a`/`.z` is its temporal index.
- **Infinite append-only file (#6969)** — temporally ordered; alpha=root, omega=head; any past omega recoverable.
- **Tectonic faults / pinned-craton vs unpinned-frontier (#6937)** — the master is the tide, a pin is a craton.
- **Content-addressed reproducible carve (#6960) + DST (#6958)** — pinning a slice of the master = reproducible.
- **Bootstrap / Ace-installs-itself (#6942/#6945)** — alpha is the genesis the bootstrap starts from.
- **dependson statements (#6971)** — the graph the master indexes.

## Beacon anchors

- **Alpha and omega — beginning and end** (Rev. 22:13; the first/last brackets — rhyme, not creed). · **HEAD vs
  pinned ref** (git — HEAD/branch floats, a tag/SHA pins; the unpinned-master vs pinned-carve cut). · **Manifest
  (unpinned ranges) vs lockfile (pinned)** (npm/cargo/Nix flake.lock — float vs freeze). · **Bitemporal data /
  temporal index** (valid-time vs transaction-time; the "now" vs "as-of" axes). · **Append-only log / event
  sourcing** (#6969 — every past head recoverable). Honest novelty: none — it names the dep graph's **master
  temporal index** as alpha/omega (`.a`/`.z`) **unpinned** brackets (root → current head) over the static-known
  temple-of-everything (#6972), with pinning deferred to the carve (the craton/tide cut #6937); extensions
  naming-gated (collide with `ar`/`compress`).
