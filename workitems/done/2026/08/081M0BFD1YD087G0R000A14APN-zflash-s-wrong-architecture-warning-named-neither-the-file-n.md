---
id: 081M0BFD1YD087G0R000A14APN
type: bug
state: done
priority: P2
slug: zflash-s-wrong-architecture-warning-named-neither-the-file-n
title: "zflash's wrong-architecture warning named neither the file nor the architecture"
created: 2026-08-18T22:20:50.509Z
completed: 2026-08-18T22:21:24.907Z
depends_on: []
composes_with: []
---

# zflash's wrong-architecture warning named neither the file nor the architecture

**Found by:** Dejan, 2026-08-18, dogfooding the USB/zflash path against the operator's real machine
state rather than against fixtures. **Fixed in the same PR.** Filed because a bug is a priced
measurement, not a liability to hide.

**No hardware was touched.** A USB stick is attached at `/dev/disk6`; nothing was written to it,
formatted, or ejected. Every observation below is `diskutil list` / `ls` / pure-function evaluation.

## The bug

`selectIsoForArch` and `selectDownloadedIsoForArch` (`src/Core.TypeScript/zflash/lib.ts`) landed in
#12047 with their operator-facing messages **missing every interpolation**. Not stripped later —
`git log -S'assuming it is ${'` finds no reachable commit where the interpolated form ever existed.
They were born empty:

```text
zflash: WARNING no ISO here names arch ; falling back to , whose arch cannot be read.
zflash: WARNING could not read an architecture from  — assuming it is .
```

A third defect in the same block: the refusal path built its message with `\\n` inside a template
literal, so it rendered as ONE line carrying literal backslash-n and the candidate list inlined
into the prose. That is the branch the module's own comment calls "the one worth stopping for".

## Why it matters — this is the live branch on the operator's machine

`~/Downloads` holds exactly two `zeta-installer-*.iso` files (2026-06-09, 2026-06-21) and **neither
carries an arch token**. The ISO the first-metal preflight staged is gone. So `zflash` on that Mac
takes the arch-less-fallback branch **today**, and prints the empty warning.

#12047 exists because a wrong-arch flash's only symptom is "no bootable device" on the target board
— indistinguishable from Secure Boot or boot-order — after a full flash-and-walk-to-the-box cycle
has been spent. This warning is the **only** signal that cycle is about to be wasted, and it named
neither which file was chosen nor which architecture was wanted.

## Why 90 green tests did not catch it

Every existing assertion checks a substring of the **constant tail**:

```ts
expect(r.warning).toContain("no bootable device");
expect(r.warning).toContain("cannot be read");
expect(r.error).toContain("refusing to guess");
```

The constant part cannot fail. This is the vacuity class: a test that pins only the invariant half
of a message cannot notice when the variable half disappears. 90 pass, 0 fail, message empty.

## The fix

Three interpolations restored; `\\n` → `\n` in the refusal. Plus four falsifiers that assert the
**variable** half, including a class-level guard enumerating every branch that can emit a message
and failing any that names none of its candidates — so a new branch added later with a
bare-constant message fails in CI rather than on a target board.

## Evidence

- Reverting `lib.ts` to `origin/main` turns exactly the 4 new tests red; the 90 pre-existing tests
  stay green, which is the measurement of the coverage gap.
- 468 tests pass across the 21 zflash files with the fix in.
- Class swept: `\\n`-in-template-literal has two other hits repo-wide, both correct (a `printf '%s\n'`
  shell argument and a `RegExp` source). No other dropped-interpolation site found in the
  zflash / installer / persona-keys surfaces.

## Not done here (needs physical access or a destructive step)

- Flashing the attached `/dev/disk6`. Writing a block device is Aaron's call at the keyboard.
- The Touch ID PAM consent gate — biometric, by construction not agent-satisfiable.
- Re-verifying the cosign keyless chain: `cosign` is still not installed and the staged bundle is
  gone with the ISO (§4 #5 of the preflight).

## Pointers

- `src/Core.TypeScript/zflash/lib.ts` · `src/Core.TypeScript/zflash/lib.test.ts`
- `docs/runbooks/2026-08-16-first-metal-bringup-preflight.md` — §0 corrected in the same change;
  it staged an ISO that is no longer on disk, so its hand-path step failed at `flash-usb.ts`'s
  ISO gate
- #12047 — the arch-selection fix this defect shipped inside
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a message asserted only on its constant
  tail is unmetered, not verified
