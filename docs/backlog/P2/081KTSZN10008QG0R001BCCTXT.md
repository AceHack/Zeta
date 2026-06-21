---
id: 081KTSZN10008QG0R001BCCTXT
title: MIPS emulator as a treaty room — like our CHIP-8, for Max (Hennessy lineage; the 081KTSZN10008QG0R000VZHRQ4 fan-out's second machine)
priority: P2
status: open
tier: hardware-substrate
tags: [mips, max, emulator, treaty-room, golden-vectors, four-oracles, b1025, action-grammar]
created: 2026-06-11
owner: Max (the machine is his home turf) / open for pairing
---

# 081KTSZN10008QG0R001BCCTXT — Max's MIPS, a treaty room like CHIP-8

Aaron 2026-06-11: "Max wants a MIPS emulator like our chip8 too — on the list for backlog, as a
TREATY ROOM."

The CHIP-8/9 playbook, replayed on MIPS (Hennessy et al. 1981 — Max knows MIPS; the 081KTSZN10008QG0R000VZHRQ4 fan-out
named him): a small, exact, COW-friendly MIPS core (the classic 5-stage subset first — R/I/J formats,
the teaching ISA) built as a ROOM — membrane crossings for IO, DST-replayable, golden vectors locked
by the first oracle and ratified by the other three (the four-compilers-one-machine discipline), the
self-trace channels when ready (executed/data/speculation — the reflection register is
machine-agnostic), and capability upgrades through the door (MAME-inspired: the machine grows by
injection, never by fork).

## Staged

1. The core subset (R/I/J decode, the teaching-set instructions) in F# — exact, pure, stepwise.
2. Golden vectors: a treaty program's register/memory trajectory locked as text.
3. Oracle ports (TS/C#/Rust) — first-run byte-lock the bar (CHIP-9 set the precedent ×3).
4. Room mechanics: membrane IO, SimLoop laps, the self-trace channels.
5. Max's call on the dialect's growth (his machine, his room — clauses 1-5 apply).

## Relates

081KTSZN10008QG0R000VZHRQ4 (the fan-out; MIPS = Max's rung) · the CHIP-9 treaty (the playbook) · gen/action-grammar.md
(the grammar both machines bind) · Hennessy 1981 · MAME (capability-catalog inspiration).
