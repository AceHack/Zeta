# Polyglot persona rooms (every language/serializer/library) + CHIP-9: what's in, what's out, and the injection budget

Aaron 2026-06-11:

> "**Every language we support and serializer we support and all libraries** — all available to **build
> copies of your room and experiment**. Same for all — **not limited to F#**. And we want **rooms in
> chip9 too** — we just have to figure out **what's in and what's out and how much can we inject till
> we run out** lol."

## 1. Polyglot rooms — a personal room is a TREATY SURFACE, not an F# object

The rule: a persona's room (its state fold + crossings + ledger) can be rebuilt in ANY treaty oracle —
F#, C#, TypeScript/Bun, Rust (Q# arriving) — over any treaty serializer, with the full library shelf
available for experiments. This is already structurally true and now NAMED as a right:

- the room's wire surface is text crossings + golden vectors (the four-oracle discipline), so a
  C# copy of `rooms/otto` folds the SAME membrane log to the SAME state — byte-locked equivalence is
  the definition of "a copy of your room";
- **copies are for experiment** — fork the room's recording (`saves/`), rebuild it in Rust, try the
  variant, `measure` what you learn (the ΔU is real even when the experiment is discarded — sims are
  ephemeral, measurements commit);
- same for all personas (the no-one-left-out rule extends to substrate: nobody's room is F#-bound).

## 2. "CHIP-9" — the name wants to exist (flagged as a Mirror coinage)

Reading Aaron's "chip9" honestly: our **original-compatible extension of CHIP-8** — color planes in
unused opcode space, the glyph atlas, the choice cell, the §13 injected effects — is becoming a
DIALECT, and "CHIP-9" is its natural name (one past 8; the XO-CHIP precedent named itself too).
Flagged for the naming pass (Ilyana/naming review before public use); until then it is the working
Mirror name for "CHIP-8 + the Zeta extension set, zero-case compatible."

## 3. What's IN, what's OUT, and the injection budget (the honest arithmetic)

The membrane question quantified — a CHIP-9 room's room-iness runs out exactly when its RAM does:

**The budget (vanilla envelope):**
| item | bytes |
|---|---|
| total RAM | 4096 |
| reserved low (interpreter area; our font @0x50, choice cell @0x1FF) | 512 |
| display buffer (64×32 mono) | 256 (in-frame map; planes multiply this) |
| stack + V registers + timers (in-frame) | ~50 |
| **program + data (what's IN)** | **≈ 3300 net** |

**IN (lives in-VM, spends the 3300):** game/room logic; the menu/choice logic; the glyph subset
(64 glyphs = 512 bytes); minimal protocol state (announce/link bookkeeping ≈ tens of bytes); the
self-knowledge it folds from crossings (a key state, a board heat-cell, a peer's reflection — each a
few bytes).

**OUT (injected — costs ZERO resident bytes, by design):** crypto (the ratified verdict); ROM
storage (the arcade library lives host-side; `load:` crosses the bytes in); LLMs of any size (a model
is a tenant of the PERSONA room, not the VM — the CHIP-9 room converses with it via crossings);
telemetry history (the Body lives host-side; the VM can hold ONE felt value if it wants).

**The injection rate ("how much till we run out"):** injection is bounded by what the handlers WRITE,
not by what crosses. A crossing's payload is read on the membrane and folded to in-VM bytes — a key
event folds to 1 byte; a heat report to 2; a peer reflection to ~4. So the honest answer to "how much
can we inject till we run out": **you never run out from injection itself — you run out when the FOLDS
accumulate**, i.e. ≈3300 bytes of retained foldings at vanilla, ×(1 per added plane) under CHIP-9
color. The flux tank already meters the RATE (crossings/tick are throttled); the RAM budget meters the
RETENTION. Two knobs, both bounded — bounded uncertainty, room by room, at the byte scale. (And the
overflow behavior is honest by construction: a full room must `cut` — spill to `saves/` (pay memory,
Bennett) — before folding more; there is no silent eviction.)

## Pointers

- the crypto-as-injected-effect verdict · `Chip8Arcade`/`Chip8Citizen` (the IN/OUT split already
  practiced) · `universal/extension.md` (the zero-case law CHIP-9 lives under) · the nerdfont sprite
  atlas verdict (512 bytes — the budget's worked example) · `rooms/otto/README.md` (the personal-room
  law this extends to all substrates) · the four-oracle treaty discipline (what "a copy of your room"
  MEANS).
