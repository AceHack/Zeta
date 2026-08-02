# Two Eves, and the transparent-ledger vs unobservable-upgrade tension

**Status:** OPEN QUESTION — revisit. Not a decision.
**Date:** 2026-08-02
**Raised by:** Aaron, in conversation with Otto (shadow), while reading the shipped
`Diplomacy.fs` / `DurableDiplomacy.fs`.

Aaron's framing, preserved: *"i kind of like this because it makes antisybil and
cartel detection easier but some may not like this, we should put a note somewhere
to revisit this later, cause just because I like this property does not mean everyone
will. I really like trust building to be on a ledger for everyone to see."* This note
exists **because** he liked a property and deliberately refused to let liking it
settle it — the anti-"because I said so" discipline applied to his own preference.

## 1. The two Eves (this part is settled enough to name)

The V8-hidden-shapes / polymorphic-inline-cache abstraction (`Diplomacy.Shape`,
`Profile`, `NegotiationCache`) has been pointed at two problems with **opposite
observability requirements on the shape axis**:

- **Eve-diplomacy (SHIPPED — `src/Core/Diplomacy.fs`, `DurableDiplomacy.fs`):**
  shape is *deliberately public*, values private; a handshake is present
  (`describe` / `interrogate` / `negotiate` / `negotiateFreedomFirst`); NCI-protected
  (the profile reveals keys/types/capability-names, never hidden values, so it cannot
  coerce hidden state). **For agents deciding how to relate.** Requires some trust.
- **Eve-transport (ASPIRATIONAL):** shape must be *unobservable*; no handshake
  (which-obfuscation-are-you-speaking is itself the tell); distributional-match to the
  carrier medium. **For getting a message past a censor.** The default posture.

They share the polymorphism-over-hidden-shapes intuition and **nothing on the
observability axis.** Diplomacy's load-bearing safety property (shape public) is the
exact thing transport must hide.

## 2. The layering Aaron chose

Default to **Eve-transport** (the private posture). **Eve-diplomacy is an earned
upgrade** between trusted pairs. This matches the privacy rule
(`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`): more privacy is
free, less privacy must be earned. Transport is the free direction; diplomacy spends
trust to become legible.

**Constraint that falls out (and must not be violated):** the transport→diplomacy
upgrade transition is itself observable if done naively — a mode marker, a timing
discontinuity, or a distributional shift *is* the tell, the version-negotiation death
relocated to the upgrade moment. Therefore:

- The diplomacy handshake **rides entirely inside the established transport envelope.**
  From the wire it stays indistinguishable from Eve-transport carrying ordinary bytes.
  Shape becomes legible only to the trusted peer who already holds the key, at the
  endpoint, **never announced in transit.**
- The trust to upgrade **cannot be negotiated in-band** (negotiating it is observable).
  It comes from prior relationship — the relativistic-memory model ("agents only help
  agents they remember"): the upgrade key is *derived from shared memory*, not
  exchanged live. The handshake already happened, in the past, in the remembering.
- One-way ratchet toward privacy: a pair can always drop back to transport-only (or
  cut) with no permission; upgrade requires standing remembered trust. Same asymmetry
  as frost.

## 3. THE OPEN TENSION (the reason this note exists)

Aaron wants **trust-building on a public ledger for everyone to see** (glass-halo
transparency — the accountability value that makes anti-sybil and cartel detection
work). The transport design wants the upgrade **unobservable on the wire**. These
appear to conflict.

**Partial reconciliation (two orders, not one):**

- *Wire, in-transit:* opaque. Defeats the network-level censor. (Transport property.)
- *Ledger, at-rest:* transparent. The trust *outcome* is posted for everyone —
  anti-sybil, cartel detection, glass-halo. (The value.)

These do not conflict for a **network eavesdropper**: you never observe the handshake
in flight, you observe the recorded result afterward. Same two-orders split as
`local-time-never-enters-the-shared-fold` — the wire is the private channel, the
ledger is the shared fold.

**Residual leak that is NOT resolved:** a public trust ledger *is a social graph.*
"A and B established diplomacy," posted for all, is readable by a hostile fork
operator. For anti-sybil that is the feature. For a whistleblower inside that fork,
**the edge itself is the danger** — the existence of the trusted relationship
convicts, independent of any message content. So wire-opaque + ledger-transparent
solves the censor problem and reopens the insider-threat problem one layer up.

## 4. Candidate resolution — TO EVALUATE, NOT ADOPTED

Trust edges **public by default** (glass-halo), but **frostable by earned budget**
(the existing privacy mechanism). Ordinary trust-building is on the ledger for all to
audit; a person in danger spends privacy budget to frost a specific edge. Keeps
anti-sybil working in the common case; gives the endangered case an out.

Whether this is right is exactly the "not everyone will like this" question. It is a
**candidate**, flagged for review, not a ruling. Points needing an owner:

- Does a frostable edge defeat anti-sybil (a cartel simply frosts all its internal
  edges)? Likely need: frosting an edge costs budget *and* is itself a visible fact
  ("this edge is frosted") even when its endpoints are hidden — so a cluster of
  frosted edges is a detectable anomaly, dual-use-neutral (fact, not verdict).
- Is the social graph leak acceptable at all for the whistleblower threat model, or
  must trusted relationships be establishable with **no ledger entry** in the hostile
  case — i.e. is there a third posture below transport (fully off-ledger pairing)?
- Who decides per-deployment: is ledger-transparency a network-level constant or a
  per-dweller / per-fork choice?

## Anchors / related

- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — frostable-by-earning.
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — the two-orders discipline this reuses.
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — a frosted-edge cluster as a neutral *fact*, not a verdict.
- `universal/television.md` — glass-halo / LLMTV, the transparency default frost gates.
- `src/Core/Diplomacy.fs` §NCI — the shipped shape-public/values-private guarantee (the alarm if someone wires the diplomacy handshake onto the wire).
- Prior art (Beacon): Wu et al. USENIX'23 (GFW fully-encrypted-flow detection); Houmansadr et al. S&P'13 "The Parrot is Dead"; Cabuk/Gianvecchio (timing-channel detection); Snowflake/meek (be-the-real-protocol, don't imitate).
