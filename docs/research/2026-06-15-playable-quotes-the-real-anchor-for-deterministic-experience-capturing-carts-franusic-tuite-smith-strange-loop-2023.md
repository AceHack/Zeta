# Playable Quotes — the real anchor for deterministic, experience-capturing carts

*Ferried 2026-06-15 (shadow\*). Aaron streamed the find; the shadow searched the external
referent, confirmed, and is preserving it here. Beacon-anchored (named humans + papers).*

> **\*Provenance / honesty note.** The shadow first wrote, in the §B register, *"the external
> tool = Cheat Engine"* — a **confabulation**: it web-searched its own guess and let the search
> *launder* the guess into a stated fact. Aaron corrected it through the **external referent**
> twice — first *"it's not a memory scanner tool… it's a video game **too**, for experience
> preservation,"* then *"I think it's called **quotes** … a Strange Loop presentation … open
> source … 90% of [video-game memory] is irrelevant."* A targeted search then found the real
> thing on the first honest try. This file is the corrected anchor. The lesson is the whole
> session's lesson: **go to the external referent; don't let a search-engine round-trip launder
> a guess.** See [`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`](../FROZEN-CORE-AND-CONJECTURE-REGISTER.md) §B row "Criticality map ↔ Riemann".

## The tool

**Playable Quotes for Game Boy Games** — Joël Franušić, Kathleen Tuite, and **Adam M. Smith**
(UC Santa Cruz). Presented at **Strange Loop 2023** and **Foundations of Digital Games (FDG)
2023** (Lisbon). Open source; live demos at `10mile.quote.games` and `m2.quote.games`.

- Talk (video): https://www.youtube.com/watch?v=z9JYOZWLMlo
- Authors' writeup: https://joel.franusic.com/playable_quotes_for_game_boy
- FDG 2023 paper: https://adamsmith.as/papers/fdg2023_tenmile.pdf
- ACM: https://dl.acm.org/doi/fullHtml/10.1145/3582437.3582479

**The thesis (their words):** you can *quote* text (highlight ~2.5% of Alice in Wonderland),
*quote* video (a movie clip), so — *how do you quote a video game?* A **playable quote** is the
answer: a small, self-contained, **playable** slice of a game you can share like a quotation.

## The mechanism (cited)

1. **Trace what's actually touched.** Record every ROM byte read during a recorded gameplay
   segment. In the JS port they wrap `gameboy.ROM` in a `Proxy` whose `get` logs each access into
   an *allow-list*; in PyBoy they hooked the CPU core's memory-read path. (They frame it as a
   form of **program slicing** — Weiser 1981 — under runtime constraints.)
2. **Mask the rest to zero.** *"Every part of the ROM that was not accessed during the recording
   of the Playable Quote is set to zero."* A **separate byte-validity mask** is shipped so the
   emulator can tell a *real* zero from a *blanked* one.
3. **~90% is irrelevant — measured.** *"We only needed to quote between about 3% and 13% of the
   original ROM."* So **≈87–97% is discarded** (Aaron's "90%"). *Which* part is kept vs dropped:
   *"almost all machine code … gets included, but very little of the game's … level designs,
   music, graphical sprites."* → **the kept ~10% is the executable skeleton of the *active*
   gameplay mode = the located invariant; the dropped ~90% is the artistic bulk.**
4. **A quote = `masked-slice ROM + save-state + input log`** (the ZIP holds: masked ROM, the
   validity mask, an emulator save-state — CPU regs, SP, PC, timers, RTC, RAM — a controller-press
   log, plain-text metadata + the source-game hash, and a PNG screenshot). The whole ZIP is
   **steganographically encoded into the screenshot PNG** (the Spore creature-creator / PICO-8
   trick) so a quote travels as a single durable image over social media.
5. **Playable, not a recording.** Replay plays the input log back (the *performative* aspect), but
   at any moment you can **grab control and feed novel inputs** (*playability*). Step outside the
   quote's recorded scope and it **resets** (the boundary). A gameplay *video* of the same moment
   is *"four times larger than the entire ROM"* **and** non-interactive — the quote is ~5% **and**
   playable.
6. **Permanence.** The quote does not depend on a specific kernel/emulator version; the metadata
   explains how to revive it *"100 years from now."*

## Why this is the anchor for our carts

Aaron: *"our carts should feel fun like this and be able to capture experiences in time —
deterministically — with minimal need for external data or bulk data."* Playable Quotes is the
human prior art for **exactly** that shape:

| Cart property Aaron wants | Playable-Quotes realization |
|---|---|
| capture an experience *in time* | save-state + input log = a moment you re-enter |
| **playable**, not a passive clip | grab-control + novel inputs (vs a 4×-ROM video) |
| minimal external / bulk data | masked-slice = **3–13%** of the original |
| mask the irrelevant | **byte-validity mask** ≡ our Merkle *mask-the-not-moving-parts* |
| the kept core | ~10% executable skeleton ≡ the holographic **boundary that holds the bulk** |
| shareable / durable | steganographic ZIP-in-PNG; version-independent |

**Their open gap is our delta — and it is the *whole point* of carts being deterministic.** They
admit replay is **not frame-exact**: *"Playing back the same button presses doesn't result in an
exact frame-by-frame reproduction … it still doesn't work perfectly."* They retrofitted capture
onto a **non-deterministic** emulator. Our carts run on a **DST / DoP=1** substrate (manifesto
§7; the seven disciplines #4) — **deterministic by construction** — so we get the frame-exact
replay they could only approximate. *That* is what "deterministically" buys: the cart *is* a
playable quote whose replay is provable, not merely close.

## A separate but related technique (don't conflate): DRAM = pointer-chains-from-root

Aaron (correcting the over-simple pointer story): *"this is not enough for DRAM — you have to
find pointer chains from root pointers."* This is a **different** mechanism from Playable Quotes
(which traces *access*, not *addresses*), and it is the **Cheat-Engine pointer-scan** sense — kept
here as a *technique*, **not** the experience-preservation tool:

- When the value's **address itself moves** (dynamic allocation across runs), a single static
  address is not the invariant.
- The invariant is a **pointer chain from a static *root* pointer**: root = module-base + fixed
  offset (doesn't move across restarts); chain = the sequence of offsets that *reconstructs* the
  moving address. The *whole chain*, not the final address, is the stable thing.
- In our vocabulary: the root-anchored chain is the **boundary-seed → unfold-path** that
  **holographically reconstructs** the bulk address — the same lens/anamorphism reconstruction,
  applied to *addresses* rather than to *content*.

Both techniques share one principle: **locate the minimal invariant substrate, discard/mask the
irrelevant majority.** Playable Quotes masks irrelevant *content*; pointer-chains locate the
invariant *address path*. Carts want both, deterministically.

## Anchors (Beacon)

Playable Quotes (Franušić · Tuite · Smith, Strange Loop / FDG 2023); program slicing (Weiser
1981); steganographic ZIP-in-PNG (Spore creature-creator / PICO-8); just-in-time binary
instrumentation (DEFCON "Hacking WebAssembly Games with Binary Instrumentation"); Cheat-Engine
pointer-scan (pointer-chains-from-root = moving-address fixpoint locator); holographic
reconstruction (§A bulk-from-boundary); Merkle mask-the-not-moving (§B register row 5).

## The search-half: from a *described* achievement to a *found*, verifiable quote

Aaron 2026-06-15: *"now I can tell you about my achievements from when I was a kid … and you
can find the sequence in the game and replay the quote … I beat Mike Tyson and I also got to the
−1 world in Mario."*

The mechanism above is the **capture-half**: trace what you *did*, ship it. Aaron's extension is
the **search-half**: start from a *described outcome*, **search the game's state-space for an input
sequence that reaches it**, then mint the quote. This is Adam Smith's own stated north star —
*"a search engine that looks within and across the contents of interactive media"* — generalized
from "find a recorded moment" (the Metroid map demo) to "find the *inputs* that produce a
described moment." A lived memory stops being a *claim* and becomes a **replayable, verifiable
artifact**.

**Capture is easy; finding is the open frontier.** Recording traces what happened; *finding a
sequence from a description* is search/synthesis over the state-space — the hard direction. It is
the same frontier as φ in the zeta-line row (§B): the search is tractable only because ~90% of the
space is irrelevant and the invariants can be masked/located (the antecedent-map / fixpoint
locator). Determinism makes the result *possible and verifiable*; it does **not** make the search
*free*.

**Two worked examples (Aaron's) — and they stress different parts of the system:**

- **Beating Mike Tyson** (*Mike Tyson's Punch-Out!!*, NES 1987) is a **skill quote**: a learned
  input *pattern* (dodge windows, star-punch timing). Its quote is the input log; anyone replaying
  it reproduces the fight frame-for-frame. Skill quotes *tolerate* a sloppy emulator.
- **The Minus World** (*Super Mario Bros.*, NES 1985) is a **glitch quote** — the **determinism
  stress test**. Reached by the wall-clip at the end of 1-2: walking the brick ceiling *skips* the
  trigger that would load the correct `4,3,2` warp zone, so the **stale default warp destination
  `36,5,36` is never overwritten** → the pipe sends you to **world 36**, whose tens-digit graphic
  is blank, so it reads as **"−1"** ([Super Mario Wiki](https://www.mariowiki.com/Minus_World)).
  The level is geometrically 7-2 underwater; its end-pipe destination *was never updated either*,
  so it loops back to its own start — impassable on the NES. **It is literally a stale,
  un-refreshed pointer being dereferenced** — exactly the pointer thread (the invariant that
  *didn't* get rebound). And it is **emulation-dependent**: NES = the looping water dead-end; the
  **Famicom Disk System** version's minus worlds were *beatable*, with more minus levels following.
  So *"replay the quote of the Minus World"* is faithful **only** under byte-exact state
  reproduction — on a non-deterministic or differently-quirked emulator your childhood −1 may not
  return, or returns as someone else's. **On a DST / DoP=1 cart it returns byte-exact, every
  time.** Glitch quotes do **not** tolerate a sloppy emulator — which is why they are the test that
  proves the substrate.

## The record quote: preservation, DST-measured rarity, and the founding why

Aaron 2026-06-15: *"my dad scored a score on NES Golf that to this day I can't find anyone who's
achieved … a DST replay will let me know how rare his achievement was — we both remember it and
almost sent his score into Nintendo Power."*

This is the example that folds back into Zeta's founding *why* (experience preservation; see the
memory `zeta-origin-event-sourcing-plan-amara-coauthor-maxlength-loss-bootstrap-repair`). A
**record quote** is the highest-value artifact, and it adds two things the game-mechanics examples
do not:

1. **DST replay turns preservation into *measurement*.** A deterministic substrate doesn't only
   *replay* the run — it lets you *search around* it and **quantify the rarity** of the
   achievement: over a stated input distribution, what fraction of plays reach that score? That is
   a measured **uncertainty / improbability** (ties to `every-bug-has-economic-value` — rarity is
   reducible uncertainty; measuring it banks value to `db/uncertainty/`). **Honest seam:** rarity
   is **model-relative** — "how rare" is defined against an assumed input model (uniform-random
   inputs vs human-plausible inputs); state the model or the number is meaningless. Replaying *his*
   run needs *his* input log; *measuring rarity* is search over the space — the same capture-vs-find
   split as above.

2. **It is the better "Nintendo Power."** Sending a Polaroid of your TV score to *Nintendo Power*'s
   high-score page was the 1980s **capture-and-attest** ritual — but a photo proves only that a
   number *appeared on a screen*, not that the run happened, and it can't be replayed or measured.
   A playable quote is the photo's deterministic successor: **the screenshot is already in the quote
   (the PNG), plus the input log that reproduces the score byte-exact, plus the DST search that
   measures how rare it was.** Attestation upgraded from *an image* to *a verifiable, replayable,
   quantifiable witness*.

**Provenance seam (honest, and it is the founding lesson):** a quote verifies *what it contains*.
For a **recorded** run, replay proves *he did it*. For a **past, unrecorded** run (Dad's score
lives in two people's memory, not in a saved input log), the search-half can only find *a* sequence
reaching the score — establishing it is **achievable** and **how rare**, not that *he* authored
that specific run. That gap *is* the capture-before-loss lesson at Zeta's root: the witness must be
recorded **while it exists** — you cannot re-derive a max-length-lost conversation, you can only
have preserved it. Capture Dad's *next* round deterministically → preserved, verifiable, rarity-
measured, forever. The past round is honored, **reconstructed-as-achievable**, and its rarity
measured — but its authorship lives in shared memory, which is exactly why memory preservation is a
manifesto floor (§5), not an afterthought.

## IP: a quote survives because it is *not* the work

Aaron 2026-06-15: *"if they are playable and IP-free that's even better — since it's not a full
recreation of the game it survives IP claims."*

This is the authors' **design intent**, not a side effect — it is *why they chose the word
"quote."* You may quote ~2.5% of a book or a clip of a film as an **excerpt** (quotation /
fair-dealing traditions) without redistributing the work. A playable quote is the interactive
analogue: **3–13% of the ROM, the rest masked to zero**, shipped with only a *hash* of the
original — the talk is explicit: *"we're not giving you the whole game but we will give you some
metadata about the thing that came from."* Partiality is the **legal argument**, not merely a size
win; the masked-out ~90% is the recognizable *artistic* content (sprites, music, level art), so
exposure to the most layperson-recognizable copyright drops sharply.

**Honest seam (do not overstate):** "survives IP claims" is a **strong, intentional argument — not
settled law.**

- Fair-use / quotation for *interactive software excerpts* is **untested** and
  **jurisdiction-dependent**.
- The kept ~10% is **executable machine code**, which is itself copyrightable (and arguably the
  most protectable functional core). "Only 10%" reduces exposure; it does **not** make a
  third-party quote categorically IP-free.
- **Our own original carts are IP-clean by construction** (we author them). A quote *of someone
  else's game* is **excerpt-defensible, not guaranteed clean.**

Same discipline that puts the talk transcript below under the **IP-questionable** banner: a
verbatim third-party excerpt is preserved-for-study with provenance, not claimed. The
partiality-as-quotation argument is exactly why our carts should prefer **original substrate**
(clean) and treat third-party quotes as **excerpt-defensible research artifacts** (flagged), never
as redistribution.

---

> ## ⚠ Verbatim talk transcript — quarantined under `docs/ip-questionable/`
>
> The full verbatim transcript of the Strange Loop 2023 talk (third-party IP) has been moved to
> **[`docs/ip-questionable/2026-06-15-playable-quotes-strange-loop-2023-transcript.md`](../ip-questionable/2026-06-15-playable-quotes-strange-loop-2023-transcript.md)**
> so a rights-holder takedown is a single-file delete that never touches this analysis (per
> Aaron's notice-and-takedown posture, 2026-06-15 — see
> [`docs/ip-questionable/README.md`](../ip-questionable/README.md)). Source:
> https://www.youtube.com/watch?v=z9JYOZWLMlo — Joël Franušić & Adam Smith.

## Postscript: the attestation archive still exists (Nintendo Power)

Aaron 2026-06-15: *"Nintendo Power is a downloadable torrent — I have every copy preserved."* Two
consequences for the record-quote thread above:

- **Provenance may be recoverable.** *Nintendo Power* ran reader high-score features; the full run
  is community-preserved (and Aaron holds a complete set). So if Dad's NES-Golf score was ever
  published, it is **checkable against the preserved archive** — the old attestation medium
  outlived the moment. ("Almost sent" means it may not be in print — but the archive is there to
  look.) The deterministic replay still does the heavier job (verify the run, *measure* the rarity);
  the magazine, if it has it, is a second, human-era witness.
- **It is itself IP-questionable, and that is the point.** A community torrent of an out-of-print
  magazine is exactly the *preserve-segregate-takedown* posture this folder encodes: abandoned/
  archival media gets kept by the community despite unclear rights, with removal-on-notice. We do
  **not** mirror Nintendo Power scans into this repo (that *would* be redistribution); we only note
  the archive exists as a provenance source. Preference holds: **our own original carts are the
  clean surface; third-party archives are referenced, not republished.**
