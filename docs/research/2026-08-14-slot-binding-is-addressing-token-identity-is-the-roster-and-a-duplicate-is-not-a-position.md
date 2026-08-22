# Slot binding is addressing; token identity is the roster; a duplicate is not a position

*Nazar, 2026-08-14. Work-item 081M00PYT0K087G0R002F9YSEG. Sits on PR #10644
(081M00HVPGS087G0R0001T4BF8), which bound each sealed share to the token that sealed it.*

## The correction this document is built on

I got the framing wrong first and was corrected:

> Distribution is not obtained by addressing shares to different slots — slot binding is
> addressing, and addressing is not a security property. Making slot binding "a real,
> tested path" without identity binding would have produced a roster that looks
> distributed and isn't, which is worse because it reads as done.

That is the load-bearing sentence. Identity binding is what makes share *i* openable only
by token *i*; addressing is only how a caller says which token it wants to talk to. The
order matters and it is now the order that shipped: bind first (#10644), address second
(this work). Nothing below should be read as claiming addressing protects anything.

## Question 1: should slot enumeration be automatic or explicit?

The framing in the brief — automatic (`C_GetSlotList`) is convenient but makes the roster
depend on device ordering; explicit is verbose but stable — has a third answer, and it is
the right one: **enumeration is automatic, assignment is explicit.** They are different
jobs and only one of them is dangerous.

- **Assignment** — which device holds which share — is a human declaration, written once,
  checked forever. If it came from enumeration order, the roster would be a restatement of
  today's USB topology: unplug a printer dongle and share 2 now "belongs" to a different
  device. A roster derived from enumeration cannot detect the thing a roster exists to
  detect, because whatever the machine reports is by construction what the roster says.
- **Enumeration** — where a named device is *right now* — must be automatic, because the
  answer changes and nobody should have to know it. A caller says
  `{ by: "token-identity", tokenIdentity: "house-a#12345678" }`; resolution scans the
  attached tokens and finds the slot holding that device, or throws.

So `C_GetSlotList` is finally called — it had been declared in the FFI table since the
file was written and invoked by nothing — but it is called as a **search for a device the
caller already named**, never as a source of roster positions. The generated-roster
convenience is deliberately absent: `describeAttachedPkcs11Tokens` prints identities for a
human to copy, and there is no `--write-roster`.

The explicit option survives as `by: "slot-index"`, marked discovery-grade: it is how you
learn what is in front of you on a single-token host before any roster exists. It carries
an optional `expectTokenIdentity`, which upgrades it to a checked address.

**And there is no default.** The old `opts.slotId ?? 0` meant an options object that
forgot to say where the token was addressed slot 0 — so N adapters built for N tokens
quietly addressed one device. That is not a hypothetical: it is the shape of the original
finding, arriving through a defaulting expression instead of through provisioning. An
undeclared address now throws.

## Question 2: what does the artifact record — slot index, token serial, or both?

**Identity only.** #10644 already established that a slot index is positional and
therefore not identity; recording it as well would be recording a field that goes stale
the first time someone unplugs a token, in an artifact whose whole purpose is to be
trustworthy later. A reader would eventually believe it.

The same reasoning removes one more positional field that was tempting: **which directory
a share sits in carries no authority either.** Duplication needs a second copy of share
*x* somewhere, and one directory per device is the natural filing (it is also what
physically happens — a directory travels to a house). But verification reads the device
out of the artifact's own `sealedByToken`, never out of the path. FTR-23 pins that: put
share 2 in house-a's directory and the verifier still reads it as B's.

## Question 3: what happens when the expected token is absent?

It throws. `resolveSlotForTokenIdentity` has no fallback slot, and the error names what
*is* attached so the operator can fix it. This is the no-silent-downgrade discipline
applied to addressing, and it is the regression that would have quietly undone #10644 from
the outside: a resolver that shrugged and used slot 0 would open a device the share is not
bound to. The load would then fail on the binding — but the *seal* would have written a
share to the wrong device under a confident label, and the operator would have been asked
for the wrong token's PIN. Mutant M2 is exactly this; FSA-36 asserts not just that it
throws but that **no session was opened with any slot at all**.

Two attached devices reporting the same identity is also a refusal, not a
first-match-wins. If that ever happens the roster's one-device-one-position accounting is
already void, and guessing is the last thing to do.

## The roster, and why the binding alone was not enough

The binding is a per-artifact property: it can say "this file is not yours". What it
cannot say, one file at a time, is anything about the shape of the whole custody set —
whether N shares sit on N distinct devices, whether some device quietly holds two
positions, whether an extra copy got sealed onto a spare six months later. Each of those
is a threshold that has silently dropped while every individual artifact remains perfectly
correct.

`frost-token-roster.ts` is the object those questions can be asked of:

```
participant := one x, one position toward the threshold, MANY devices
```

`verifyRosterAgainstArtifacts` checks both directions, and the second is the one that
catches the quiet failure:

- **declared → observed**: every (x, device) the roster claims has an artifact. Catches a
  roster written for tokens that were never sealed.
- **observed → declared**: every artifact's (x, device) pair is one the roster declares.
  Catches the extra copy — share 1 additionally sealed onto the spare token "just in
  case". That artifact is individually flawless and correctly bound; only this direction
  sees that the spare now reaches two positions.

That is the difference between *configured* to be distributed and *verifiably*
distributed. `attestRosterOnDevices` goes one step further and runs the N×N matrix on the
real chips, which is the only check that would catch a shared wrapping key whose identity
binding had *also* been defeated.

## Duplication: a share may live on N devices and is still ONE participant

Aaron wants a backup token holding the same share, in another house, so a lost token is
not a lost position. That is availability, and it must not read as security. Two devices
holding share 3 do not make two participants; they make one participant that is harder to
lose and no harder to compromise — the adversary needs *either*, not both.

The model is shaped so the wrong count is hard to write and impossible to hide:

- Devices live *inside* a participant, so "this token counts twice" has no spelling.
- The remaining way to get it wrong — one device listed under two participants — is an
  error finding, `device-holds-two-positions`, with the arithmetic attached.
- The other spelling — give the backup its own row with the same `x` — is
  `duplicate-participant-index`.
- `seizureWitness` searches exhaustively for a set of *fewer than* `threshold` devices
  that reaches `threshold` positions and names it. One-way in the useful direction: a
  witness **convicts** the roster. It refuses (throws) rather than returning a clean-looking
  null when a roster exceeds the search budget.
- When `maxPositionsPerDevice` is 1 the bound is exact and provable, not hopeful: k
  devices yield at most k positions, so reaching a threshold of t needs at least t
  devices, and t devices drawn from distinct participants do reach it.

The availability side is reported too — `positionsSurvivingLoss` and a
`participant-without-backup` info finding, so Aaron can see what a fire costs before it
happens rather than after.

## Mutation results

Eight planted, eight dead. The three the brief required are M1, M4/M6, and M2.

| # | mutant | killed by |
| --- | --- | --- |
| M1 | slot binding removed (address ignored, everything lands on slot 0) | FSA-32…39, FSA-41, FSA-42 |
| M2 | absent token silently falls back to slot 0 | FSA-36, FSA-37, FSA-40 |
| M3 | slot-index expected-identity comparison dropped | FSA-39 |
| M4 | a device holding two positions is no longer flagged | FTR-9, FTR-11 |
| M5 | seizure witness always reports clean | FTR-10, FTR-11, FTR-12, FTR-31 |
| M6 | duplicate participant index accepted (backup becomes a 2nd position) | FTR-7 |
| M7 | artifacts the roster never declared are ignored | FSA-43, FTR-15 |
| M8 | a declared position with no artifact is ignored | FTR-16, FTR-17, FTR-19 |

## What was considered and rejected

- **Generating the roster from enumeration.** Rejected above: a roster that agrees with
  the machine by construction cannot check the machine.
- **Recording the slot index in the artifact as a hint.** Rejected: a stale positional
  field in a security artifact is a field someone will eventually trust.
- **Trusting the directory a share sits in.** Same class, rejected the same way (FTR-23).
- **Caching the resolved slot.** Rejected: a replug between two calls would silently
  redirect an adapter at a different device. Resolution is fresh every call, for the same
  reason `tokenIdentity()` is.
- **Warning instead of refusing** when a roster's real threshold is below its declared
  one. Rejected: `assertRosterSound` throws, in the same direction as
  `createHsmShareAdapter`'s no-silent-downgrade.

## Honest limits

- Addressing buys legibility and replug-stability. It buys **no** confidentiality. The
  security property is still the identity binding, and above that the file header's
  standing caveat: `loadShare` returns the share scalar, so no adapter here reaches
  use-without-extract.
- The multi-token hardware lane (HW-6…HW-12) is written and **has not run** — one YubiHSM
  is on the desk and the YubiKey bundle has not arrived. It fails loudly rather than
  skipping when opted into without hardware, so it cannot pass vacuously; but until it
  runs, the real-chip half of this is unexercised and should be described that way.
- `attestRosterOnDevices` needs every device present at once, so it belongs to a ceremony,
  not to a load path. A roster in N houses can only be fully attested when the devices are
  in one room — which is exactly once, at creation.

## Commands for Aaron (no ceremony script; these just print facts)

```bash
# 1. What is attached, and what each device calls itself. Reads CK_TOKEN_INFO label and
#    serial only — both printed on the outside of the device. No login, no PIN, no key.
bun tools/setup/persona-keys/frost-token-roster.ts tokens /opt/homebrew/lib/ykcs11.dylib

# 2. Write roster.json by hand from those identities. Never slot numbers.
#    A backup device goes in the SAME participant's devices list — that is what keeps it
#    one position.

# 3. Check the declaration against the artifacts. Runs anywhere, no device needed.
bun tools/setup/persona-keys/frost-token-roster.ts verify roster.json ~/.config/zeta/ca/frost/*/

# 4. When the YubiKey bundle arrives — the real-chip lane, N tokens plugged in at once.
ZETA_FROST_HARDWARE_LANE=pkcs11-multi \
ZETA_FROST_PKCS11_LIB=/opt/homebrew/lib/ykcs11.dylib \
ZETA_FROST_PKCS11_PIN=... \
ZETA_FROST_PKCS11_TOKENS='house-a#12345678,house-b#87654321' \
ZETA_FROST_PKCS11_BACKUP_TOKEN='house-d#11112222' \
bun test ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
```

## Pointers

- `tools/setup/persona-keys/frost-share-adapter.ts` — addressing, enumeration, the binding
- `tools/setup/persona-keys/frost-token-roster.ts` — the roster, its checks, the CLI
- `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md` — the L1 rung this sits on
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — findings name the fact
  (`device-holds-two-positions`), not a verdict about who did it
