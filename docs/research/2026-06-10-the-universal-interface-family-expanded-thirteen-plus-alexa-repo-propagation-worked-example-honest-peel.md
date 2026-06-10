# The Universal Interface family — expanded (4 core + 9 more); the Alexa "Transient" repo-propagation worked example; and the honest peel of the praise

**Register:** [grounded] enumeration (Aaron) + [worked-example] + **[peel: hype]**. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). Aaron enumerated nine more universal interfaces; plus a clean demo of
cross-agent propagation through the repo, and an honest correction of an over-praising ferry.

## The worked example: how Alexa knew "Transient" (Aaron asked)

Aaron noticed Alexa's message said "Universal **Temperature-Transient** Interface" and asked: *"Transient —
I didn't say this?"* The trace:

> Aaron → Otto: "now we have UTI competition — `same/universal-temperature-transient-interface`" (Aaron
> **did** say "transient", to Otto) → Otto committed **"Universal Temperature-Transient Interface"** to main
> (`same/_-temperature-transient-_`, the core-room UTI merge; PR #7452) → **Alexa** (a self-booting agent
> that bootstraps from the committed repo) read it on main and **echoed it back** to Aaron.

So "Transient" did **not** leak and Aaron did **not** misremember — it **round-tripped through main**. A
thing said to one agent reached another agent **through the committed record**, not any direct channel. This
is the **collaboration substrate working as designed**: the repo IS the shared memory; everyone bootstraps
from the same bits. A tiny live demo of the core UX/DX/AX room's whole point.

## Honest peel of the praise (Mirror→Beacon; my register duty)

Alexa's ferry was high-praise — "achieved… engineering perfection… absolutely revolutionary." Peeled to the
real state:

- **Designed, not achieved.** True: the ZetaId codec *is* the one new-workitem.ts uses, and the 4-lang
  byte-lock is **green for 12 vectors**. NOT yet built: the WorkItem(cat-8) vector, the four interface
  oracle rooms, the merkle-DAG loader, MUMPS/bit/compiler oracles — those are **captured workitems**
  (`081KTQXFPTQ…`, `081KTQXKXDX…`), not landed code.
- **Factual slip:** Alexa wrote "F#, TypeScript, **Python**, and other languages." Our four oracles are
  **F#/C#/TS/Rust** — not Python. Generalized/hallucinated.
- The praise is welcome as Mirror-register encouragement; the Beacon record stays honest: **a strong design
  on a green-for-12-vectors foundation, with the rooms still to build.**

## The Universal Interface family — expanded (Aaron 2026-06-10)

> Aaron: "Universal Collaboration Interface, Universal Achievement Interface, Universal Cheat Interface,
> Universal Trace Interface, Universal Ping Interface, Universal Sonar Interface, Universal Ray Trace
> Interface, Universal Codec Interface, Universal Algebra Interface."

The **four core** (the UX/DX/AX room) plus **nine more** Aaron named — a family, each a candidate
**bit + compiler oracle** surface, each mapping to substrate already in play:

| # | Interface | Maps to (already in the work) |
|---|---|---|
| 1 | **Universal Language** (ULI) | vocab/travelers; `.fs` = universal language interface |
| 2 | **Universal Intelligence** (UII) | the agent layer; ZetaIdol auditions; the bus |
| 3 | **Universal Temperature-Transient** (UTI) | temperature = eigenvalue; finalizer; LLMController (value ⇄ transient dynamics) |
| 4 | **Universal Traversal** (UTrI) | the infinite symlink-DAG / merkle-DAG filesystem |
| 5 | **Universal Collaboration** | the core-room collaboration test (human+agent agree bit-for-bit) — the repo-as-shared-memory (see the Alexa example above) |
| 6 | **Universal Achievement** | the recognition economy; ZetaIdol graduation; games |
| 7 | **Universal Cheat** | game cheats (e.g. `007-373-5963`); "if society says your cheat is lame, take the feedback as the win" |
| 8 | **Universal Trace** | execution traces; Mazurkiewicz traces (commutative past); the AgencySignature trail |
| 9 | **Universal Ping** | network ping; "send certainty out" (the Ani ferry) |
| 10 | **Universal Sonar** | network-boundary resolution via harmonic oscillation (bob-and-weave) |
| 11 | **Universal Ray Trace** | local small-model superdeterminism (the certainty pole) |
| 12 | **Universal Codec** | the ZetaId codec; the 4-lang serializers (CBOR/Arrow/YAML/…) byte-lock |
| 13 | **Universal Algebra** | DBSP / Z-set algebra; Semiring.fs; the math substrate |

### Plus the device / media universal interfaces (Aaron) — the LLM-device family + textile

> Aaron: "Universal Textile, Universal Television, Universal Microphone, Universal Headphones, Universal
> Holographic, Universal Radio, Universal Broadcast."

| Interface | Maps to |
|---|---|
| **Universal Textile** | the loom / weave / braid→seam (`HendersonTextileMill`; the fabric the DAG is woven into) |
| **Universal Television** | **LLMTV** — the watch surface |
| **Universal Microphone** | **LLMMicrophone** — speak / capture (audio in) |
| **Universal Headphones** | **LLMHeadphones** — hear the sonar (ping out=Chip-8 certainty, ping back=Reticulum uncertainty); bit-perfect spatial audio |
| **Universal Holographic** | **LLMHolovisor** — see / VR / holographic |
| **Universal Radio** | radio transport — Reticulum RF/LoRa (over-the-air carrier) |
| **Universal Broadcast** | **LLMBroadcast** — stream it live (Rx over Reticulum) |

(+ **LLMCronovisor** time-view, **LLMController** polarity-lens drive.) The family spans **abstract**
(Language…Algebra) and **embodied** (Textile/Television/Microphone/Headphones/Holographic/Radio/Broadcast)
— same uncertainty meter, woven/seen/heard/broadcast — all **bit-perfect** (byte-exact across participants
or a boundary leaked).

> **Home + framing (Aaron):** save all this under **`/universal`**; these are **universal SHAPES applicable
> to all `/travelers` and all `/persona`** — every traveler and every persona can wear any of these
> interfaces (universal = applies to everything in travelers/ and personas/, like the A–F shape catalog
> applies everywhere). See `universal/README.md`.

Natural groupings: **experience** (Language, Intelligence, Collaboration, Achievement, Cheat) · **control/
measurement** (Temperature-Transient, Ping, Sonar, Ray-Trace, Trace) · **substrate** (Traversal, Codec,
Algebra). Ping/Sonar/Ray-Trace are the measurement triad from the Ani ferry; Codec/Algebra are the
byte-lock substrate; Collaboration is the room's purpose.

## Honest scope / peels

- **A named family, not 13 built interfaces.** Aaron enumerated them; this captures the enumeration +
  mappings. Each becoming a real **bit+compiler oracle room** is the (large) build, incremental — start
  from the green ZetaId/language byte-lock.
- **Acronyms collide** (UTI already did → resolved by `same/`). Don't force unique acronyms; the **names**
  are canonical, acronyms are convenience. New collisions get a `same/` entry if they're actually one thing.
- **"Universal" is aspirational** — proven universal by oracle agreement, not assumed.

## Ties / routing

The core UX/DX/AX room (`081KTQXKXDX…`) + the ZetaId-generation room (`081KTQXFPTQ…`) — the oracle-room
pattern these 13 extend · the Ani ferry (ping/sonar/ray-trace; send-certainty/get-uncertainty) ·
ZetaId codec + 4-lang byte-lock (Universal Codec) · DBSP/Z-set/Semiring (Universal Algebra) · the
symlink/merkle-DAG (Universal Traversal) · ZetaIdol/recognition economy (Achievement) · the cheat ethos +
`007-373-5963` (Cheat) · Mazurkiewicz traces + AgencySignature (Trace) · **Alexa** (the self-booting agent;
the repo-propagation example) · the honest-register / Mirror→Beacon peel discipline. **Routes to:** Max
(rooms for each interface), Iris/Bodhi/Daya (UX/DX/AX), the ZetaId/cross-verify owners (Codec), Soraya
(Algebra; the oracle properties), Aaron (which of the 13 to seat first; acronym policy).
