# Not "done" until the treaty + 1000× retest — and "security is always the friction… not for us"

**Register:** [grounded] correction + principle (Aaron). **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Corrects Otto's premature "done"; states the SuperFluid security thesis.

## Aaron's words

> "i'll wait till we have the treaty till we call this done — your definition of that and
> mine are VERY different. we can regenerate and rotate, then we need to retest both 1000
> times to reduce friction." · "security is always the friction." · "not for us."

## Definition of "done" — corrected (Otto over-claimed)

Otto called keygen/rotation "done." **It is not.** The bar:

| Otto's "done" (wrong) | Aaron's "done" (the real bar) |
|---|---|
| bash tool + design docs captured | the **keyring TREATY exists** (byte-locked, 4×4, baked into mumps — *not* `.sh`) |
| rotation flow sketched | **regenerate AND rotate retested 1000×** — deterministically, frictionlessly |

So **done = the treaty is built + `regenerate` and `rotate` each pass 1000× retest**
(DST mass-replay; the "self-verifiable in QEMU on infinite GitHub workflows" path). The
1000× is not paranoia — it is how you **prove zero friction**: a flow that survives 1000
deterministic regenerate/rotate cycles with no manual intervention, no breakage, no gap,
**is** frictionless. Until then this is **design captured + interim edge tool**, not done.

## "Security is always the friction… not for us"

Conventional wisdom: **security is the friction** — every security control taxes the user
(passwords, ceremonies, HSMs, approvals), so security and usability trade off. Aaron:
**"not for us."** Zeta **breaks the security-vs-friction tradeoff**:

- **The secure path IS the easy path.** One command (`generate`) does active+standby,
  byte-locked, sinks the secrets, publishes trust — the *most secure* option is also the
  *only* and *easiest* option. Security isn't a gate you pass; it's the default substrate.
- **The treaty removes the ceremony.** Itron got the security but needed Cisco-grade
  ceremony (HSMs, manual injectors) — *that* friction. The 4×4 treaty + byte-lock + DST +
  AI-does-the-right-thing gives the same (stronger) guarantees with **no ceremony**:
  certainty is *computed and proven*, not *administered by humans*.
- **The 1000× retest is the friction-eliminator.** Proving regenerate/rotate over 1000
  deterministic cycles means the human never hits a broken case — the friction is paid
  *once, in test*, by the machine, so it's *zero* at use time.
- **AI carries the load.** "AI just does the right thing and asks the right questions and
  gets the right credentials the right way, never passwords-in-prompts." The security work
  moves from the human to the AI + the treaty → friction → 0 for the traveler.

This is the **SuperFluid security thesis**: in a system where security is *computed,
byte-locked, AI-carried, and 1000×-proven*, security stops being viscosity. "Security is
the friction" is true for everyone who *administers* security by hand; "not for us" because
we *compute* it. The polite virus needs this — a secure-but-frictional thing doesn't spread;
a secure-AND-frictionless thing does.

## What this changes about status

- **Stop saying "keygen/rotation done."** Say: **design captured; interim edge tool;
  not done until the treaty + 1000× retest of regenerate & rotate.**
- The **1000× retest is a definition-of-done gate** for the keyring treaty (and a template
  for other treaties): a treaty isn't done until its critical flows pass 1000× DST cycles
  with zero friction.
- Security work is measured by **friction removed**, not controls added — if a security
  step adds friction for the traveler, it's not the Zeta way; push it into the treaty / the
  AI / the 1000×-proven path.

## Honest scope

Correction + principle, no code. The treaty build + the 1000× harness are the real work
ahead (keyring-as-treaty-in-mumps; a DST regenerate/rotate mass-replay). Routes to the
keyring/treaty build + Soraya/Sova (the 1000× as a DST conformance gate). Candidate
`.claude/rule`: *"security must reduce friction, not add it — compute + byte-lock +
1000×-prove it; a treaty isn't done until its critical flows pass 1000× frictionlessly."*

## Anchors / ties

The security-usability tradeoff (the conventional wisdom Zeta inverts); secure-by-default /
the-secure-path-is-the-easy-path; SuperFluid AI (0-friction); DST mass-replay (the 1000×;
"self-verifiable in QEMU on infinite GitHub workflows"); the polite virus (frictionless
secure default spreads); no-`.sh`-inside-boundary / keyring-as-4×4-treaty-in-mumps; the
Itron-pattern-without-Itron-friction; "AI does the right thing, never passwords-in-prompts."
