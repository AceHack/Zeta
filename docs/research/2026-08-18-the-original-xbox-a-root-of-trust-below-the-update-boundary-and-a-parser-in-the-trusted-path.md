# The original Xbox: a root of trust below the update boundary, and a parser in the trusted path

**Ferried** 2026-08-18 · source: Aaron, streamed observation · register: **Beacon** (public
security history, named humans, published papers) · status: **unmetered** — the historical
recall is labelled per §"Recall register" below; the *structural* claim is the load-bearing part.

## 0. The observation

Aaron, on the open YubiHSM firmware-version question:

> *"xbox the original did this and the memory resident version of the bios was hackable via a
> font overflow exploit lol"*

The "lol" is doing real work. He is not making an analogy — he is pointing out that the exact
configuration we were treating as an open question in 2026 was **already broken in public, in
2002, by hobbyists**, and that the break did not come from the crypto.

## 1. What the Xbox actually did

Three parts, and the interesting failure is in the third.

1. **A secret boot block in silicon.** The first code the console executed was not in the
   flashable BIOS. It lived in a small hidden ROM inside the MCPX southbridge — mask ROM, no
   update path, by design. It decrypted the real bootloader out of flash **into RAM** and jumped
   to it. So the trusted, running BIOS was **memory-resident**: it existed as an image in DRAM
   that nothing on the update path could reach.

2. **The secret came out over the bus.** Andrew "bunnie" Huang tapped the link between the CPU
   and the southbridge and captured the boot block in transit. The key was never *broken*; it
   was **observed**, because a secret that has to travel between two chips is a secret with a
   wire attached to it.

3. **The break that mattered was a parser.** The dashboard loaded font files from the hard
   disk. Those fonts were attacker-supplyable and were parsed by code running with full trusted
   privilege — a buffer overflow in the font loader gave arbitrary execution inside the trusted
   context. The save-game exploits (the Bond / MechAssault / Splinter Cell family) were the same
   class with a different file format.

Nobody attacked the cipher. They attacked **the trusted component's willingness to interpret
structure it did not author**.

## 2. Three structural lessons, each live for us right now

### 2a. A root of trust below the update boundary cannot be repaired, only replaced

The mask ROM was unpatchable *on purpose* — that was sold as the security property. And it is,
right up until it is wrong, at which point unpatchable means **the entire installed base is
permanently defective** and the only remedy is hardware replacement.

This is exactly the shape of the EUCLEAK finding (CVE-2024-45678) on the YubiHSM line: the flaw
is below the field-upgrade boundary, so there is no patch, only a new device. Same geometry, 22
years apart. The Xbox is the worked precedent, and it says the question *"is this device above
or below firmware 2.4.0?"* is not a version check — it is asking **which side of the repair
boundary the device is on**, and that is a permanent property of that specific piece of silicon.

### 2b. Memory-resident trusted code is not protected by the update path

Once the trusted image is in RAM, every guarantee about the *flash* is irrelevant to it. We have
been reasoning about HSM firmware versions as though the version *is* the trust state. The Xbox
says the version bounds what the *update mechanism* can fix; it does not bound what the running
image will do when handed a malformed structure.

### 2c. A surface is wherever a trusted component parses untrusted structure — §13, stated in hardware

This is the one that transfers directly into the substrate, and it sharpens the definition of
**Surface** we just landed in `docs/GLOSSARY.md`.

§13 (noninterference / entropy quarantine) says entropy enters only through **declared, metered
channels**. A font file is undeclared entropy entering a trusted context. The dashboard never
*decided* to accept attacker input — it decided to render text, and the parser was the door
nobody declared.

So the operational test is not "did we authenticate the caller." It is:

> **Where does trusted code interpret structure it did not author?** Every such point is a
> surface, declared or not. The undeclared ones are the exploits.

Note this is also the **closed command set** from the Itron/hub rule arriving from the other
direction. That rule's portable half says a far side may *name* a command but never *define*
one, so compromising it does not buy arbitrary execution. The Xbox font parser is the
counter-example that proves why the property is load-bearing: a font file is a far side
**defining** a computation — a parser is a tiny interpreter, and every interpreter in a trusted
path is an open command set wearing a data format's clothes.

## 2d. The 360 adds two more classes — and all three are one rule

Aaron, same thread:

> *"also xbox 360 was defeated by two different hardware models of security, the cdrom that could
> be faked into saying yes is this valid, and the cpu that was much harder until they came out
> with side channel attacks to derive the root key"*

These are **not** the original Xbox's failure repeated. They are two further, distinct classes,
and having all three named is what makes this useful rather than anecdotal.

### Class 2 — the trusted peripheral: a verdict where evidence was needed

The 360 asked the **DVD drive** whether a disc was genuine, and believed the answer. Reflash the
drive firmware and it answers *"valid"* for anything.

Nothing was broken. No key was recovered, no parser was overflowed. The security decision had
simply been **delegated to a component the attacker physically owns** — the drive was on the
wrong side of the wall, and no amount of strengthening the console could fix that, because the
console was not the thing being lied to about; it was the thing being lied to.

The general statement, and it is one of ours already:

> **A component that returns a verdict instead of evidence is unauditable by construction.**

That is [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)
exactly — report the *fact*, let the caller's policy attach the meaning — and it is
[`no-directives`](../../.claude/rules/no-directives.md)'s **source ≠ authorization**, in silicon.
The drive was a *source*. It was wired as an *authorization*.

**Where this bites us right now, concretely:** attestation. If a container asks its own local
agent *"am I measured correctly?"* and the verifier accepts that answer, that is the DVD drive.
The verifier must receive **quotes and measurements it can check itself**, never a boolean. Any
design where the attested party computes the verdict has reproduced this bug, however good its
crypto is.

### Class 3 — the physical channel below the logical model

The CPU path was the *well-designed* half: per-console keys, eFuse-based revocation so a console
could not be rolled back, a hypervisor enforcing signed code. It held for years against logical
attack. It fell to **fault injection and timing** — the reset-glitch family, and timing leakage in
a bootloader's HMAC comparison used to recover the per-console key.

Two things matter here:

1. **The attacks never engaged the logic.** They engaged the *implementation's physical behaviour*
   — how long a comparison takes, what a CPU does when the reset line is pulsed mid-compare. A
   threat model expressed purely in terms of logical capability **cannot represent these attacks**,
   so it will score the design as sound right up until it isn't.
2. **The revocation machinery could not help.** eFuses stop downgrade. They do not stop a
   data-dependent branch in silicon, because that is not a version — it is a permanent property of
   the implementation. This is §2a again from a second direction: you can revoke a key; you cannot
   revoke a timing dependency.

### The unification: three classes, one rule

| | Xbox | what was trusted | what actually crossed |
|---|---|---|---|
| **1. Parser in the trusted path** | original — font overflow | a *format* | an undeclared **input** channel |
| **2. Trusted peripheral** | 360 — DVD drive | a *component's verdict* | an undeclared **authority** channel |
| **3. Physical channel** | 360 — glitch / timing | the *logic model* | an undeclared **physical** channel |

All three are **§13 noninterference** violations, at three different layers. §13 says influence
and entropy cross only at **declared, metered channels**; each class is a channel nobody declared:

- the font parser was an input nobody counted as an input,
- the drive was an authority nobody counted as an authority,
- the timing was a physical observable nobody counted as an observable.

So the audit question generalises past §2c into something checkable in three passes:

> **Where does trusted code interpret unauthored structure? Where does it accept a verdict it
> cannot recompute? And what does the implementation emit that the model does not mention?**

The third pass is the one that is almost always skipped, and it is the one that took the 360's
*strongest* subsystem.


## 3. What this changes about the open firmware read

It does not remove the read — it reframes what the answer means.

- **Before:** "read the version, learn whether extraction applies."
- **After:** "read the version, learn which side of a *permanent* boundary this device sits on."

And it adds a second question the version cannot answer: **what does the running firmware parse?**
Session setup, wrapped-object import, attestation-template handling and audit-log formatting are
all structure-interpreting paths. A version above 2.4.0 closes EUCLEAK; it says nothing about
2c. Both questions are still Aaron's — they need a session, which remains outside my constraints
and outside the constraints I routed to Mateo.

## 4. Recall register (honest labelling)

Per `toy-is-free-metered-must-be-earned` and the checked-anchor requirement:

| claim | register |
|---|---|
| secret boot block in the southbridge, decrypted a bootloader into RAM | **recalled**, widely documented, not re-verified here |
| bunnie Huang recovered it by tapping the inter-chip bus; MIT AI Lab memo, 2002 | **recalled** — the memo exists and is the right anchor; exact memo number not re-checked |
| a font-parsing overflow in the dashboard gave trusted-context execution | **Aaron's recall, and mine agrees**; the softmod family is public history |
| save-game overflows (Bond / MechAssault / Splinter Cell) are the same class | **recalled** |
| the three structural lessons in §2 | **the load-bearing content** — they follow from the shape, not from the specific byte offsets |
| 360: reflashable DVD-drive firmware answering the authenticity check | **Aaron's recall, and mine agrees** — the iXtreme-family firmware hacks are public history |
| 360: reset-glitch fault injection; timing leakage in a bootloader HMAC comparison used to recover the per-console key | **recalled** — the glitch family (2011) is well documented; the exact mechanism by which the CPU key was extracted is the least-certain item here and is not load-bearing for §2d |
| 360: eFuse-based downgrade revocation | **recalled** |

If a specific historical detail turns out wrong, §2 survives it. That asymmetry is deliberate:
the anchor is being used for its *structure*, and the structure is what was checked.

## 5. Anchors (Beacon)

- **Andrew "bunnie" Huang**, *Keeping Secrets in Hardware: The Microsoft XBox Case Study* (MIT AI
  Lab memo, 2002; also CHES 2002) — the canonical published account, and the origin of the
  "a secret with a wire attached to it" reading. Later *Hacking the Xbox* (No Starch, 2003).
- **EUCLEAK** (Thomas Roche / NinjaLab, 2024), CVE-2024-45678 — the modern instance of the same
  below-the-boundary geometry.
- **Ken Thompson**, *Reflections on Trusting Trust* (1984) — the general form: trust terminates
  somewhere you cannot inspect, and the question is only *where*.
- **Goguen & Meseguer** (1982) — noninterference; §13's anchor, and what §2c is an instance of.

## Pointers

- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — the **closed command set** as
  the portable security property; §2c is the argument for why it is not optional.
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference; §2c is that
  discipline stated for hardware parsers.
- `docs/GLOSSARY.md` §Surface — this doc sharpens it: a surface is *wherever trusted code
  interprets unauthored structure*, whether or not anyone declared it.
- The in-flight TPM-vs-HSM mapping (Mateo) — §2a is the frame that comparison should carry:
  compare the **repair boundaries**, not only the capability lists; §2d class 3 is why a
  capability list alone never settles it.
- [`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)
  and [`no-directives.md`](../../.claude/rules/no-directives.md) — §2d class 2 is *source ≠
  authorization* and *report the fact, not the verdict*, both realised in hardware.
