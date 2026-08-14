# Canon is decided by write keys — and disagreement forks rather than votes

**Ferried** 2026-08-13 from Aaron, correcting the "community moderation" placeholder in
`2026-08-13-patchability-decides-whether-a-glitch-is-a-decision-or-a-fact.md`:

> it's really just the authors of the game who decide the cannon, they will have owners where the game
> orginated from with the write keys to that game

The prior doc flagged *"the community decides"* as an unbuilt mechanism with its own attack profile —
whoever rules bug-vs-canon shapes which strategies are viable, which is real power. **That framing was
wrong, and the correction removes the problem instead of solving it.**

## Canon is an authorship property, not a governance outcome

There is no standards body, no vote, and no adjudication. **The author of a game decides what is canon in
that game**, and the mechanism is cryptographic rather than social: *ownership is holding the write key,
anchored to where the game originated.*

This is strictly better than community moderation on three counts:

- **No permanent authority over the space.** Each author has authority over exactly one artefact — their
  own. Nobody holds a role that rules on games in general, so there is no seat to capture (§3
  weight-free). The prior doc's worry was about a *general* adjudicating role; it evaporates when
  authority is scoped to authorship.
- **No adjudication procedure to design, attack, or staff.** The write key answers the question directly.
- **It is already the mechanism, not a new one.** This is how mods and ROM hacks have always worked: the
  original author owns the original, and a variant is a *different artefact* with a *different owner*.

## Disagreement forks — and the fork is not a dispute, it is a row in the version partition

This is the part that makes it click with the design already written.

If you think the author ruled wrongly — they patched away a glitch you consider canon, or kept one you
consider a bug — **you fork.** You do not appeal, because there is nobody to appeal to. Your fork is a
new artefact, with your write key, and **a different content hash**.

The prior doc established **substrate version** as the third partition of the result space (alongside
capability class and attestation class), maintained by putting a content hash of the substrate in the
witnessed record. A fork therefore lands in that partition automatically: it is a distinguishable
substrate, with its own leaderboard, derived rather than declared.

**So the version partition *is* the dispute-resolution mechanism.** No one has to be overruled, and no
authority has to exist to overrule them. Disagreement produces a new row rather than a verdict — which is
the same move as everywhere else in this design: report the distinguishing fact, refuse to render the
judgement.

And the social signal survives without any voting apparatus: **which fork people actually play** is the
measure of which ruling was good. That is the naming-eigenvector shape — value conferred by others'
choices, accrued rather than declared — rather than a poll.

## Immutability is not a property of the substrate; it is "does anyone hold a live write key"

The prior doc treated frozen (Atari) and patchable (authored games) as two kinds of thing. Under this
correction they are **one kind of thing in two states**, and the distinguishing variable is key liveness:

| write key | behaviour |
|---|---|
| held and used | mutable — canon is a live decision by its owner |
| held, unused | mutable in principle; frozen in practice |
| **lost or abandoned** | **immutable — "it just is what it is"** |

Old Atari games are not immutable because of their era. They are immutable because **nobody holds a live
write key to them**. That unifies the two cases and gives the governance-load argument a sharper form:
*governance load is a function of key liveness, not of substrate age.* Starting the Arena on frozen
substrates is starting where no live key exists, and the reason it is low-governance is precisely that
there is no owner who could rule.

**Corollary worth stating:** key loss is not only a failure mode here. It is the transition that makes an
artefact permanently canonical — the same event that would be a disaster for a wallet is what turns a
game into a fixed measurement instrument. Both readings are honest, which is the dual-use pattern again.

## The honest limits

- **A stolen write key hijacks canon.** Scoped authority is still authority, and the key is a single point
  of control over its artefact. This is the ordinary key-compromise problem and it should be handled with
  the repo's existing apparatus rather than invented fresh — including the reunion-vs-sybil reading
  (`CoordinationSpectrum.fs`), where an owner who lost a key and returns is the *legitimate* reading of
  the same evidence a hijacker produces.
- **Provenance of origin is a claim that needs anchoring.** "Where the game originated from" is doing real
  work, and first-to-publish is not the same as authorship. This is unbuilt and should not be assumed —
  it is the one place where an actual mechanism is still required.
- **Abandonment is not observable.** A key that is merely unused is indistinguishable from one that is
  lost, so "frozen" cannot be *proved*, only observed to date. The Arena should record what it saw — no
  write in N years — never assert immutability. Same one-way discipline as the CHSH oracle: convicts,
  never acquits.

## Corrections to the prior document

Open item 4 there read: *"Name the community-moderation mechanism. 'The community decides' is currently a
placeholder; who, recorded where, revisable how, and what stops it accreting into a permanent role."*

**That item is withdrawn.** There is no community-moderation mechanism because there is no community
moderation — canon is authorship, disagreement forks, and the fork is a version row. The replacement open
item is narrower and real: anchor the origin claim.

## Open

1. **Anchor the origin/authorship claim.** Write-key ownership presupposes an established origin, and
   first-to-publish ≠ authorship. This is the remaining unbuilt piece.
2. Record observed key liveness (last write) in the substrate record; report it as an observation, never
   as a proof of immutability.
3. Confirm a fork's differing content hash lands it in the version partition **automatically**, with no
   special-casing — if forks need bespoke handling, the partition was not derived properly.

## Pointers

- `docs/research/2026-08-13-patchability-decides-whether-a-glitch-is-a-decision-or-a-fact.md` — the version partition (this doc supersedes its item 4)
- `docs/research/2026-08-13-witnessed-channel-metering-*.md` — capability class, ranked vs unranked, the substrate hash in the witnessed record
- [`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md) — reunion vs sybil on key return; the fact/reading split
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3 weight-free — authority scoped to one's own artefact is the shape that does not capture
