---
id: 081KTQXKXDX08QG0R001YFGZKV
type: task
state: completed
priority: P1
slug: core-ux-dx-ax-room-the-three-universal-interfaces-universal
title: "Core UX/DX/AX room — the three universal interfaces (Universal Language Interface, Universal Intelligence Interface, Universal Temperature Interface) each a BIT + COMPILER oracle room; this is the core experience room mapping UX(Iris)/DX(Bodhi)/AX(Daya) (Aaron 2026-06-10)"
created: 2026-06-10T04:45:57.565Z
depends_on: []
composes_with: []
---

# Core UX/DX/AX room — the three universal interfaces (Universal Language Interface, Universal Intelligence Interface, Universal Temperature Interface) each a BIT + COMPILER oracle room; this is the core experience room mapping UX(Iris)/DX(Bodhi)/AX(Daya) (Aaron 2026-06-10)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTQXKXDX08QG0R001YFGZKV-*.md` glob. -->

> **Aaron, 2026-06-10:** "we want our universal language interface and our universal intelligence interface
> and our universal temperature interface to be bit and compiler oracles room for these. This is the core
> UX/DX/AX room." · "for collaboration — that test." · "I'll wait for us to get this right; this is our core
> right here."

## Why this is THE core

Collaboration is only possible when **every participant sees the same thing**. Two people (or a human and an
agent) can only collaborate across an interface if their views of it **agree** — and the _strongest_ form of
agreement is **bit-perfect** (byte-identical) and **compiler-invariant** (the same regardless of toolchain).
So the core experience layer is **three universal interfaces, each made a bit + compiler oracle room** — the
oracle agreement is **what makes collaboration trustworthy**. (Sibling to the ZetaId-generation room
`081KTQXFPTQ08QG0R002BD36HC`: same bit+compiler-oracle discipline, applied to the experience layer.)

## The FOUR universal interfaces (each a bit + compiler oracle room)

1. **Universal Language Interface (ULI)** — how anything _expresses_ itself (the vocab/travelers; the
   ".fs is a universal language interface" coinage). The shared **language** all participants read/write.
2. **Universal Intelligence Interface (UII)** — how _intelligences/agents_ interface (the ".fs is a
   universal intelligence interface"; the agent layer — ZetaIdol auditions, the bus). The shared **agency**
   surface.
3. **Universal Temperature-Transient Interface (UTI)** — the **control / uncertainty** surface: temperature
   (the eigenvalue/eigen-tensor; the finalizer knob; the polarity-lens/LLMController) **and** the transient
   (the response dynamics) — **one interface** (the UTI naming-collision resolved by `same/`:
   `same/_-temperature-transient-_.md`; temperature drives the transient, value ⇄ dynamics of one surface).
   How participants **drive and read** the system's state (S→4; the meter).
4. **Universal Traversal Interface (UTrI)** — the **infinite DAG filesystem** (Aaron, 2026-06-10: "the
   infinite DAG file system is the universal traversal interface"). How anything _navigates_ the substrate:
   the symlink-DAG / multi-parent / **merkle-DAG** filesystem (see the load section below) — traversal IS an
   interface. The shared **navigation** surface; the `.fs` you walk.

**Each is a room** where the **bit oracles** assert byte-identical structure (not just final value — the
bits/fields) and the **compiler oracles** assert invariance across toolchains (host→compiler→OS closure;
Trusting-Trust). An interface that isn't bit+compiler-locked can't be a trustworthy collaboration surface.
(Four interfaces — fittingly a 4, like the 4 lang oracles; the 4-lang filesystem load below is UTrI's lock.)

## All 4 languages load the filesystem the same way — the infinite symlink-DAG (multi-parent / merkle-DAG)

> **Aaron, 2026-06-10:** "we need to make all 4 load the file system like we are doing in F# for infinite
> file system via symlinks — this is multi-parent filesystem, or our merkle-DAG."

The substrate under the three universal interfaces is **the filesystem itself**, loaded **identically by all
four languages** (F#/C#/TS/Rust) — the way F# already does:

- **Infinite filesystem via symlinks** — the vocab/ canonical-home + symlink-view pattern: a node appears in
  many places via **symlinks** without copying, so the tree is effectively **infinite** (views compose
  without duplication; lazy/git-lazy expansion).
- **Multi-parent filesystem = a DAG** — a symlink gives a child **more than one parent** (reachable from
  multiple paths), so the "tree" is actually a **directed acyclic graph**. (Already detectable in
  fs/git-mode-120000/MUMPS/F# per the vocab DAG work.)
- **Merkle-DAG** — content-addressed, the nodes hash-linked (git/IPFS shape): the multi-parent DAG with
  content hashes is a **merkle-DAG**, so the whole filesystem is verifiable + dedup'd by hash.
- **All 4 must load it identically** — the loader (resolve symlinks → the multi-parent DAG → the merkle-DAG)
  must be **byte-locked across F#/C#/TS/Rust** (and MUMPS): same input tree → same DAG → same merkle root,
  in every language. This is the **bit oracle** applied to _filesystem loading_; the **compiler oracle**
  asserts the load is toolchain-invariant. The universal **language**/**intelligence** interfaces _are_ this
  loaded filesystem (the ".fs" = the universal interface), so locking the load is locking the interface.

This is a **first deliverable** of the room (the substrate the other oracles stand on): a 4-language
(+MUMPS) byte-locked **symlink-DAG / merkle-DAG filesystem loader**, with golden vectors (a fixture tree →
its merkle root, identical across oracles).

## = the core UX/DX/AX room (the experience layer)

The four interfaces serve the three experiences — **not 1:1; a 3×4 the room must hold** (each experience
touches all four interfaces, with a primary):

|                                            | **ULI** (language)                     | **UII** (intelligence)                      | **UTI** (temperature)       | **UTrI** (traversal / DAG-fs)                                 |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| **UX** (Iris — library consumers / users)  | **primary** — the language users speak | read agent output                           | read/drive the meter        | browse/navigate the fs                                        |
| **DX** (Bodhi — contributors / developers) | write the language                     | **primary** — build/extend the intelligence | tune the control            | **primary** — author/traverse the DAG-fs                      |
| **AX** (Daya — agents / cold-start)        | speak the language                     | **primary** — the agent's own interface     | drive uncertainty, audition | **primary** — traverse to cold-start (walk the DAG to orient) |

The **room tests collaboration**: a human (UX/DX) and an agent (AX) operate the _same four interfaces_, and
the bit+compiler oracles guarantee they're on the **same bits** — so the collaboration is real, not a
divergence-prone illusion. "For collaboration, that test" = the room IS the collaboration test.

## Deliverables (get it right — Aaron is waiting)

- Define each universal interface's **canonical surface** (the bit layout / protocol) — the thing the
  oracles lock.
- A **bit oracle** per interface (field-by-field byte-equality; text golden vectors, hex-in-JSON — the
  no-binary-in-proof-lineage rule).
- A **compiler oracle** per interface (id/behavior invariant across toolchains; the compiler matrix in CI).
- Wrap the three as the **core UX/DX/AX room** under `rooms/` (Max — bounded DST tick; hat-governed;
  judged on oracle agreement; a mismatch = P0).
- The **collaboration test**: two participants (human + agent) over the three interfaces agree bit-for-bit.
- Bring in **UX (Iris) / DX (Bodhi) / AX (Daya)** as the room's experience reviewers (the 3×3 above).

## Honest scope / peels

- **Big + core — do it incrementally, get each interface right before the next.** Start with the one
  already closest (the ZetaId/language byte-lock exists; reuse that harness), then UII, then UTI.
- **No faked oracle agreement** — each oracle computes; agreement is earned, not asserted (same discipline
  as the ZetaId room).
- **UX/DX/AX mapping is a 3×3 to hold, not a forced 1:1** — the table is the starting hypothesis, refine
  with Iris/Bodhi/Daya.
- **"Universal" is aspirational** — scope honestly: these are the _intended_ universal interfaces; the room
  proves them universal by oracle agreement, it doesn't assume it.

## Ties / routing

The ZetaId-generation room (`081KTQXFPTQ…` — sibling bit+compiler-oracle room; reuse the cross-verify
harness) · the universal-interface coinages (".fs = universal language/intelligence interface") ·
temperature = eigenvalue/eigen-tensor + the finalizer + LLMController (UTI) · the three bit-perfect oracle
shapes + `BitAdinkra`/Gates-ECC (bit oracles) · host→compiler→OS closure / Trusting-Trust / ace dep graph
(compiler oracles) · rooms/ (Max — the DST room) · UX (Iris) / DX (Bodhi) / AX (Daya) — the experience
personas · no-binary-in-proof-lineage (text golden results). **Routes to:** Max (the room), Iris/Bodhi/Daya
(the UX/DX/AX 3×3 + collaboration test), the ZetaId/cross-verify owners (reuse the harness), Soraya/Sova
(bit+compiler oracle properties), Dejan (compiler matrix in CI), Aaron (this is the core — get it right).
