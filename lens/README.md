# lens/ — everything is lensable by address (the ILens half of the optics)

`lens/` is the home of **lenses** — the *product* optic (`ILens<'whole,'part>`: a focus you can `Get`
and `Set`), the sibling of `IPrism` (the *sum* optic / fingerprint, which `universal/` and
`FingerprintPrism` carry). Aaron's instinct (forcing-lensability): **everything is a lens by address** —
a lens is `address + size + codec` over a flat memory/state, the Cheat-Engine move generalized (read/write
any part of any whole by focusing it).

**Not to be confused with `/hooks`** (Aaron 2026-06-11): hooks are **Rx triggers with policy** (when X
crosses, fire Y under a `Policy` decision); a lens is a **focus** (get/set a part of a whole). A hook
*reacts*; a lens *addresses*. They compose (a hook can fire a lens-set), but they are different optics.

## What lives here

- Lens *instances* and lens-shaped surfaces (address+size+codec focuses over rooms, frames, memory).
- The reference optic is `src/Core/Optics.fs` (`ILens`/`IPrism`, `lens`/`prism` constructors); the
  memory-lens doctrine is `docs/research/2026-06-10-forcing-lensability-chip8-*.md` (everything lensable
  by address; the heap as the common seed lensed).

## Pointers

- `src/Core/Optics.fs` — `ILens<'whole,'part>` (Get/Set) + `IPrism` (the sibling sum optic).
- `.claude/rules/` (hooks vs lenses) · `src/Core/Policy.fs` (the policy a hook fires under).
- `universal/` — prisms/fingerprints (the sum side); lenses are the product side.
