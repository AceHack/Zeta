# Patchability decides whether a glitch is a decision or a fact — and version is the third partition

**Ferried** 2026-08-13 from Aaron, on the manufactured-refutation incentive in
`2026-08-13-witnessed-channel-metering-*.md`:

> yes it's up to the community/socity to moderate with categorising bugs vs fun glitches that remain when
> programs can be updated, on old atari games that don't have updates it just is what it is

Two claims: **the community moderates** (not an authority), and **the question only exists for mutable
substrates**. The second is the structural one and it was not in the prior design at all.

## Patchability turns a category into a decision

If a program **can** be updated, then a discovered glitch forces a choice: fix it, or keep it as a "fun
glitch." Someone has to make that call, and that call is governance — with all the load that implies.

If a program **cannot** be updated, no such choice exists. An old Atari cartridge's glitches are simply
part of the object. *"it just is what it is."* There is nothing to adjudicate, because there is no
counterfactual version in which the glitch is absent.

So **governance load is a function of substrate mutability**, and it is not a small effect. An immutable
substrate needs *zero* governance for this entire question class; a mutable one needs a standing process,
a decision record, and an authority structure to run it — which the repo would then have to keep
weight-free (§3: no permanent, irreversible authority), because "who decides what counts as a bug" is
exactly the kind of role that accretes into capture.

**Consequence for sequencing, and it is a good argument rather than nostalgia:** starting the Arena on
CHIP-8 and then Atari is the **low-governance path**. Those substrates are frozen, so the entire
bug-vs-feature dispute class does not exist yet, and the Arena can develop its witnessing, capability
labels, and refutation machinery before it also has to run a standards body. Games we author ourselves —
which *are* patchable — bring that load with them, and should arrive after the rest works.

## Version is the third partition

The Arena design already has two partitions of the result space, and cross-partition comparison is a
category error in both:

1. **Capability class** — pixels-only / pixels+RAM / save-state search / input-solving
2. **Attestation class** — ranked (witnessed, signed) vs unranked (self-attested)

Aaron's point adds the third:

3. **Substrate version** — a score is against *a specific build of the game*

For frozen substrates this partition is degenerate: one version, forever, so it costs nothing and can be
ignored. The moment a substrate is patchable it becomes live, and it behaves exactly like the other two —
**a score against v1.0 and a score against v1.2 are not comparable**, because a patch can remove the
route the run used. This is not hypothetical; it is routine in speedrunning, where boards carry explicit
version categories and a patch that kills a skip splits the leaderboard rather than invalidating the old
runs.

The design consequence is small and cheap **if done at the start**: the witnessed record must include a
**content hash of the substrate**, alongside the channel record. Then the version partition is *derived*
rather than declared — the same derive-don't-declare discipline already required for capability class, and
free, because the record is already being hashed and signed for attestation. Retrofitting it later means
every prior result becomes unversioned and therefore uncomparable to anything after.

## "Fun glitches that remain" is an opt-in to immutability, and it is a commitment

The phrase is doing real work. A community deciding a glitch **stays** is choosing to freeze that
behaviour — accepting a constraint on all future patches of the substrate. That is a **preservation
commitment**, and it is the same shape as §5 (memory preservation): something is declared un-destroyable
going forward, and future changes must route around it.

Which means the decision has teeth and a cost, and both should be visible:

- It binds future maintainers, so it is *not* free and should not be made casually.
- It is what converts a mutable substrate into a **partially frozen** one — glitch by glitch, the object
  becomes more Atari-like in exactly the places the community found interesting.
- The commitment must be **recorded where a patch author will see it**, or it will be broken by accident
  rather than by decision. A preserved glitch with no regression test is a preference, not a commitment.

That last point is the actionable one: **a kept glitch needs a test that fails when it is patched away.**
Otherwise the community's decision has no mechanism, and the next refactor silently overrules it. That is
the same recurring shape — a claim with no check behind it is a claim that did not run.

## Community moderation, and the honest limit

*"up to the community/society to moderate"* is consistent with the rest of the design: no permanent
authority, the neutral fact reported and the reading attached by policy
(`dual-use-detection-is-neutral-oracle-decides.md`). The detector says *anomalous route*; the community
says *bug* or *canon*.

The limit worth stating now rather than discovering later: **community moderation is a governance surface
with its own attack profile.** Whoever decides bug-vs-canon shapes what strategies are viable, which is
real power. The design already has the ingredients to keep it honest — decisions recorded, socially
conferred standing rather than self-asserted, no permanent role — but "the community decides" is a
placeholder for a mechanism, not a mechanism. It should be named as unbuilt rather than assumed.

Also worth stating: this **partially dissolves the manufactured-refutation incentive** that prompted the
exchange. On a frozen substrate there is no bug/feature ruling to farm — a discovered route is simply
canon, and manufacturing one is just... finding one. The incentive problem is concentrated on patchable
substrates, which is another reason to start where it is absent.

## Open

1. Include a **content hash of the substrate** in the witnessed record from day one. Cheap now,
   irreversible-ish later.
2. Sequence the Arena frozen-first (CHIP-8 → Atari → authored games), and say explicitly that the reason
   is governance load rather than nostalgia.
3. **A kept glitch needs a regression test**, or the preservation commitment has no mechanism.
4. Name the community-moderation mechanism. "The community decides" is currently a placeholder; who,
   recorded where, revisable how, and what stops it accreting into a permanent role.

## Pointers

- `docs/research/2026-08-13-witnessed-channel-metering-*.md` — capability class, ranked vs unranked, the refutation channel
- `docs/research/2026-08-13-tit-for-lesser-tat-*.md` — the Arena, TAS as a capability class
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3 weight-free, §5 memory preservation
- [`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md) — the fact/reading split this relies on
