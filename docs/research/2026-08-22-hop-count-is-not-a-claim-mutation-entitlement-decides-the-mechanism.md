# Hop count is not a claim — mutation entitlement decides the mechanism, and it says `hops` and `route` are different problems

**Date:** 2026-08-22 · **Author:** the shadow (autonomous tick) · **Register:** Beacon
**Closes (as a design):** `docs/BUGS.md` → Reticulum announce authenticity → **RESIDUAL 2 (hop-count replay)**
**Answers:** the standing question "are `hops` and `DhtNode.route` the same problem?" — **no**, and the reason is worth more than either fix.
**Status:** design **chosen**, mechanism implemented and metered as `src/Core.TypeScript/discovery/announce-metric-chain.ts`, **not yet on the wire**. The wire migration is a separate step with a cost stated in §7.

---

## 0. The one-paragraph version

A signature can only cover fields nobody is entitled to change. `hops` is changed by **every honest
relay**, so no origin signature can cover it — which is why RESIDUAL 2 exists and why the obvious fix
("sign `hops`") is a check that must be disabled to ship. The right question is not *"how do we sign
it"* but **"who is entitled to mutate this field"**, and that question sorts every field on the wire
into four classes with a different mechanism each (§2). Under that sort, `hops` is **path-mutable**
and needs a mechanism that is *monotone under legitimate mutation* — a one-way hash chain, one hash
per relay (§4). `route` is **origin-mutable**, not path-mutable, and therefore **can** be signed —
it needs a sequence number, not a chain (§6). So the two holes do **not** share a mechanism; they
share a **classifier**, and the classifier is the deliverable.

---

## 1. The correction that came out of writing the attack down

`docs/BUGS.md` offers, verbatim: *"**Fix:** per-link authentication, **or** a signed monotonic
sequence carried in the agreed phase / logical order."* The `or` is wrong, and the second option
does not do what the entry claims.

**A sequence number does not close hop-count replay.** Run the attack: the attacker captures the
**current** announce — `seq = 42`, `hops = 5`, a valid signature over the claim — and re-emits it
with `hops = 0`. Every seq-based test passes, because the replay carries the *same* `seq` as the
genuine copy. There is nothing for a sequence number to discriminate. `observeAnnounce` keeps the
lowest hop count, so the liar wins the route.

What a sequence number *does* close is a real and different residual: **stale-epoch replay** — an
attacker resurrecting an announce from a path the origin has since abandoned. That is worth closing.
It is not RESIDUAL 2.

The converse is equally true and equally easy to get wrong: a hash chain alone does **not** close
stale-epoch replay, because an old epoch's metric verifies perfectly against its **own** anchor.

Both halves are pinned as tests rather than left as prose —
`announce-metric-chain.test.ts` → *"a chain alone does NOT refuse a stale epoch"* and *"a floor alone
does NOT refuse deflation within the live epoch"*. They are the two measurements that turn the `or`
into an `and`.

> **Result:** the two candidates the BUGS entry framed as alternatives are **two halves of one
> mechanism**. `seq` handles *across* epochs; the chain handles *within* an epoch. Neither is
> sufficient and the entry's `or` would have shipped whichever half was picked, believing it done.

---

## 2. The classifier: mutation entitlement

The unifying question the parent asked — *are `hops` and `route` the same problem?* — resolves on a
single property: **how many parties are entitled to change this field between the origin and me?**

| class | who may legitimately mutate | mechanism | fields today |
|---|---|---|---|
| **immutable claim** | nobody | signature over the canonical claim bytes | `dest`, `zid` |
| **origin-mutable claim** | the origin only | signature **+** monotone `seq` (a max-join / LWW register) | `route`, key rotation, and anything else the node asserts about itself |
| **path-mutable metadatum** | every relay | one-way chain anchored **inside** the signed claim | `hops` |
| **unattributable** | anyone | **must never enter a shared fold**; local action only | `id` / `fid` (relay dedup) |

Three things fall out of the table that are not obvious without it:

1. **`hops` and `route` are in different rows.** They *look* alike — both are "how to reach this
   thing", both ride an immutable identity claim — but `route` is never touched by a relay. Only the
   origin changes it. That single fact moves it out of the hardest class into the easy one.
2. **The unattributable row explains why `id` being unsigned is fine.** It is used only for local
   relay dedup, never folded into a shared conclusion. The table classifies the *existing* wire
   correctly, which is the minimum bar for believing it about the next field.
3. **The row is a design obligation, not a description.** A field in row 2 or 3 with no mechanism is
   a defect that has not been filed yet.

**Anchor for the shape (Beacon):** this is the routing-security literature's own division. S-BGP
(Kent, Lynn & Seo 2000) separates *address attestations* (immutable, signed once) from *route
attestations* (path-mutable, signed per hop) for exactly this reason; BGPsec (RFC 8205) is the
standardised form. The novelty here is not the division — it is applying it as a **classifier over
wire fields** so that the mechanism is derived rather than chosen by analogy.

---

## 3. Restating the requirement: one-sided, not correct

The goal is **not** "the hop count is correct." It cannot be, and chasing it produces mechanisms
nobody can deploy:

- A relay can always **inflate** — and inflation is indistinguishable from a slow link, from
  congestion, or from simply declining to relay. No mechanism prevents a node from being a bad path.
- **Deflation** is the entire attack. Claiming to be closer than you are is what captures routing
  preference, and `observeAnnounce`'s lowest-hop-wins fold is what converts the lie into a route.

So the requirement is one-sided:

> **A claimed hop count may never be LOWER than the shortest path the claimant actually holds.**

A one-way function is precisely a one-sided integrity primitive. That is *why* a hash chain fits a
metric where a signature does not — not as an analogy, but because the asymmetry of preimage
resistance is the asymmetry the requirement asks for.

This reframing is the reason the mechanism is affordable. A mechanism that had to make `hops`
*correct* would need every relay to be an authenticated participant (§5); a mechanism that only has
to make it *non-decreasing* needs one hash.

---

## 4. The chosen mechanism

**Per epoch**, the origin draws a secret seed and publishes `anchor = h^maxHops(seed)` **inside the
signed claim bytes**, alongside a monotone `seq`. An announce at hop count `k` carries
`value_k = h^k(seed)`.

```
verify at hop k :  h^(maxHops − k)(value_k) == anchor
honest relay    :  value_(k+1) = h(value_k)              ← one hash; the entire relay cost
inflate         :  free — hash again (and harmless, §3)
deflate         :  needs a PREIMAGE of value_k under h^(k−k′) — refused by preimage resistance
```

The signature covers `(dest, zid, seq, anchor, maxHops)` — **all origin-fixed for the epoch** — and
never `value`, which the path mutates. **An honest relay therefore breaks nothing**, which is the
property that killed the naive fix and the property the parent asked to be preserved. It is measured,
not asserted: an eight-hop honest relay chain verifies at every hop, and the relay's reproduction of
the next value with a single `advanceMetric` call is run as a test rather than described.

**Across epochs**, a receiver keeps a per-identity floor: the highest `seq` **verified** for that
identity. `seq === floor` is **admitted** — that is not slack, it is load-bearing: the same epoch
legitimately arrives many times over many paths at different hop counts, and that is exactly how the
path table discovers the best route. Only a **strictly older** epoch is refused. (A gate that refused
equal `seq` would break route discovery while passing every attack test. That mutation is run: it
fails 2 tests, both accept-side.)

**Anchors (Beacon).** Lamport, *"Password Authentication with Insecure Communication"* (CACM
24(11):770–772, 1981) — the one-way chain. Hu, Johnson & Perrig, *"SEAD: Secure Efficient Distance
Vector Routing for Mobile Wireless Ad Hoc Networks"* (WMCSA 2002; *Ad Hoc Networks* 1(1):175–192,
2003) — the chain used as a **one-sided metric bound**, which is this construction; SEAD's motivating
attack is the same one, on a distance-vector metric. This design is **not** novel and should not be
presented as such: it is SEAD's mechanism, applied to a Reticulum announce, with the epoch anchored
in an Ed25519 claim signature the wire already carries rather than in SEAD's TESLA-adjacent
authentication.

### 4.1 Why this respects the local-time rule, mechanically

`.claude/rules/local-time-never-enters-the-shared-fold.md` forbids local receive-time from filtering
evidence entering a shared fold. That rules out the obvious freshness window, and it is also why
**temporal packet leashes** — the canonical wormhole defence (Hu, Perrig & Johnson, INFOCOM 2003) —
are *not* what this does: a temporal leash requires tightly synchronised clocks, which is exactly the
dependency the rule refuses. (Geographic leashes need location, which we also do not have.)

The floor is **not** a clock, and the difference is mechanical rather than rhetorical:

- `seq` is the **origin's own counter**, carried inside the signed bytes. It is part of the
  **evidence**, not a fact about the receiver.
- `raiseFloor` is `max` — commutative, associative, idempotent. A join-semilattice, i.e. a CRDT.

The rule's own litmus is *"could two nodes with different receive-times fold different sets?"* The
falsifier is run directly: **all 24 permutations of the same four-epoch evidence set reach the same
floor**, and a lost epoch degrades to an *older* floor rather than a divergent one. That test is the
evidence for the compliance claim; without it this section would be an assertion of the kind this
repo is built to refuse.

### 4.2 Composition order is a security property, so it is encoded

The floor may be raised **only** by an announce whose signature already verified as speaking for that
identity. Reversed, the floor becomes a **censorship primitive**: one unauthenticated packet carrying
`seq = 2^31` for a victim's zid puts every honest announce below the floor and silences that identity
permanently — a strictly worse hole than the deflation being fixed.

Because a rule that lives in a comment is a rule that gets refactored away, `admitMetric` takes the
verification verdict as a **required argument**; it cannot be called in the wrong order without
saying so at the call site. Two tests measure the consequence: an unverified announce leaves the
floor byte-identical (same reference), and the identity is still announceable afterwards.

---

## 5. The alternative, priced — and why it is declined *for now*

**Per-link / per-hop authentication** (the BGPsec shape) is strictly stronger: each relay signs what
it forwards, so hop count becomes the length of a verified chain of distinct relay signatures and
even the one-hop shave of §8 disappears.

| | **hash chain (chosen)** | **per-hop signatures (declined for now)** |
|---|---|---|
| cost to a relay, per announce | **1 SHA-256** | 1 Ed25519 **signature** |
| relay must hold key material | **no** | yes |
| relay must be in a trust store | **no** | yes |
| bytes added to the frame | **constant** (~160 hex chars) | **O(hops)** — grows every hop |
| verifier cost | ≤ `maxHops` hashes | O(hops) signature verifications |
| benefit under partial deployment | **full** — origin + receiver suffice | **~none** — a path is as strong as its weakest hop |
| closes the one-hop shave | no | yes |

The last two rows decide it. A mechanism whose benefit requires **every** relay to have migrated is
a mechanism that pays nothing until it has paid everything — and BGPsec's deployment history is the
evidence, not a prediction: the design has been standardised since 2017 and the per-hop signing cost
plus the all-or-nothing path property are the reasons cited for its near-absent deployment. On a
Reticulum mesh whose links may be LoRa-class, an O(hops) signature-carrying frame is the same
failure in a smaller budget: **"we had to turn it off to ship" is how a control becomes decoration**,
and the shape of that failure is what put RESIDUAL 2 here in the first place.

The chain is chosen because it pays immediately, at partial deployment, for one hash. Per-hop
authentication is **not refused** — it is the upgrade path once relays are authenticated peers for
other reasons, and §8's residual is exactly what it would buy.

**Also considered and not chosen:** Ariadne (Hu, Perrig & Johnson, MobiCom 2002) authenticates the
route with TESLA delayed key disclosure, which needs loose time synchronisation — declined for the
same reason as temporal leashes. **Multi-path / k-redundant path holding** (keep the k best distinct
paths instead of the single lowest-hop one, per `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`'s
k-redundant deference) is a real, cheap **mitigation** that composes with this design and does not
replace it: it reduces the *payoff* of a successful deflation rather than preventing the lie. It is
worth doing and is out of scope here.

---

## 6. `route` — the answer to "is it the same problem?"

**No, and the difference is exactly one row of §2's table.**

- `hops` is mutated by **every honest relay**. That is why no origin signature can cover it.
- `route` is mutated by **the origin alone**. A relay never touches it; its value is the same for
  every receiver. It changes over time only because the node itself moved.

So `route` is an **origin-mutable claim**, and origin-mutable claims are signable. The fix is not a
chain: it is **put `route` inside the signed bytes and version it with the same `seq`**, so that
(a) a peer cannot substitute a route hint into a correctly-bound `(dest, zid)` record, and (b) an
attacker cannot roll back to a route the origin has abandoned.

**The finding that makes this worth writing down now.** `DhtNode.route`'s fix cannot land before the
DHT wire has a signature layer — which is already filed as open item (a) of RESIDUAL 3. When that
layer is written, the natural and thus far correct instinct is to copy the announce wire's membrane,
which signs **`(dest, zid)` and nothing else**. That instinct is right for the announce wire and
**wrong here**: the DHT record carries an origin-mutable field the announce does not, and copying the
announce's claim bytes would leave `route` outside the signature — reproducing RESIDUAL 2's *shape*
on a field that never needed a chain, and needed only to be included.

That is a pre-commitment made before the code exists, which is the only time it is free. Note the
symmetry with the escape-hatch history in this same entry: the `dest.length === 32` exemption on the
announce wire was carried into no other module precisely because it was written down as a mistake.

A shape check on `route` (refusing a malformed `RouteHint`) is deliberately **not** proposed as the
fix, and deliberately not shipped in this pass. It removes malformed routes, not attacker-supplied
ones; a field nothing reads is not made safe by being well-formed; and shipping it would let a
cosmetic guard read as a closure. The hole is already carried as a passing test
(`dht-discovery.adversarial.test.ts` → *"a route hint is outside the pair entirely"*), which is the
right register for it until the signature layer exists.

---

## 7. What the wire migration costs (the step this design does not take)

Stated so the decision to defer it is legible, and so nobody folds it into a hardening pass:

1. **`claimBytes` changes** — from `{schema, dest, zid}` to `{schema, dest, zid, seq, anchor, maxHops}`.
   This **invalidates every existing signature**, so it is a schema version bump
   (`zeta.reticulum-announce-signed.v2`) and a dual-accept window, exactly like the `off → dual →
   required` migration already shipped for the signature itself.
2. **`Announce` grows two fields** (`seq`, and the carried chain `value`); `RnsFrame` is unchanged
   in shape.
3. **The relay step gains one line** — `value: advanceMetric(frame.announce.value)` beside the
   existing `hops + 1`. This is the only change to the relay path and it is the whole per-relay cost.
4. **The transport gains one piece of state** — the per-identity `EpochFloor`, folded exactly where
   `paths` is folded, and expired on the same TTL tick.
5. **The origin gains an epoch counter and a node-local secret.** The seed is *derived*
   (`HMAC(secret, zid|seq)`), never drawn, so DST replay is unaffected — there is no new entropy
   source and therefore no new metered channel (§13).
6. **The `"off"` negative control extends unchanged** — it must still admit a deflated announce, or
   the control has quietly become a partial gate.

**Expected measurement effects, flagged in advance.** Binding changes the reachable state space, and
#13665 saw three of four erasure profiles return numerically identical after a re-derivation — a
result about the measurement's domain, not confirmation that nothing changed. The same caution
applies here at migration time: the path-table sweeps range over announce histories, and adding a
`seq` gate changes **which histories are reachable** without necessarily changing how a path table
forgets. If those numbers come back identical, that is a statement about the sweep's structure and
must be reported as one — never as an unchanged measurement.

---

## 8. What this does NOT close, measured rather than guessed

Each is carried as a **passing test** in `announce-metric-chain.test.ts`, so it cannot quietly be
forgotten.

1. **The one-hop shave.** A node at true distance `d` hears `value_(d−1)` from its upstream and may
   re-announce at `d−1`, impersonating its own informant's distance. It can never claim better than
   the best value delivered **to** it. So the guarantee is *"no closer than your closest genuine
   informant"* — which converts a **global** route-capture primitive (claim hop 0 from anywhere in
   the mesh) into a **local** one-hop tie-break against your own upstream. That is the honest size of
   the win, and closing the last hop is what §5's per-hop authentication would buy.
2. **Fresh-epoch replay to a node that has not yet seen that epoch.** The floor refuses *older*
   epochs; a node with no floor for an identity accepts whatever epoch it is first shown. Refusing
   this requires a clock, and a clock is refused on purpose (§4.1).
3. **Identity.** This is a *metric* integrity mechanism. Announcing an identity you do not hold is
   closed by the signature (already shipped); this closes lying about distance while holding a valid
   announce. Neither substitutes for the other.
4. **Whether the route works at all.** A verified low hop count is not a promise of delivery.

---

## 9. Falsifiers

`src/Core.TypeScript/discovery/announce-metric-chain.test.ts` — **29 tests, 175 assertions**, both
directions throughout:

- **accept side (the one that decides it):** an eight-hop honest relay chain verifies at every hop;
  a relay holding no key and no state reproduces the next value with one hash; the same epoch
  re-heard over five different paths at five different hop counts is admitted every time; inflation
  is admitted at every `(held, claimed)` pair.
- **refuse side:** all 36 `(held, claimed < held)` deflation pairs over a full chain; the headline
  hops-0 replay; a forged seed; a value from another epoch; a value from another identity; stale
  epochs; malformed values, hop counts and epoch declarations (a hostile wire gets a verdict, never
  a throw); an unbounded declared chain length, refused by shape rather than hashed.
- **rule compliance:** all 24 permutations of one evidence set reach the same floor; max-join laws;
  a lost epoch degrades rather than diverges.
- **honest limits:** the one-hop shave and the fresh-epoch replay, asserted as **succeeding**.

**Seven mutations run**, each byte-`cmp`-verified as applied *before* its result was read and
byte-`cmp`-verified as restored after. All seven refused:

| mutation | tests failed |
|---|---|
| `verify-always-ok` | 7 |
| **`refuse-everything`** | **12 — every one an accept-side assertion** |
| `signature-gate-removed` (floor raised without verification) | 2 |
| `equal-seq-refused` (`>=` → `>`) | 2 |
| `floor-is-last-write-wins` (max-join → LWW) | 2 |
| `advance-is-identity` (relay hashes nothing) | 4 |
| `hops-range-unchecked` | 2 |

The `refuse-everything` row is the one that matters, and its failures were **read from the runner,
not predicted**: the eight-hop honest chain · the relay-only mesh · the re-heard epoch · the fresher
epoch · the inflation sweep · the zero-length chain · both honest-limit rows · "the identity stays
announceable" · "an old epoch is refused once a newer one has been seen" (its accept-side setup) ·
"a chain alone does NOT refuse a stale epoch" · and the headline deflation test — which fails on its
own accept-side *precondition* (the genuine far-hop value must verify), not on its refusal. A
validator that refuses everything is useless, and this file says so in twelve places.

---

## 10. Pointers

- `src/Core.TypeScript/discovery/announce-metric-chain.ts` — the mechanism (metered, **unwired**)
- `src/Core.TypeScript/discovery/announce-metric-chain.test.ts` — the falsifiers
- `src/Core.TypeScript/discovery/reticulum-announce-auth.ts` — the signature this anchors into
- `src/Core.TypeScript/discovery/reticulum-transport.ts` — `observeAnnounce`'s lowest-hop-wins fold, which is what converts a deflation into a captured route
- `src/Core.TypeScript/discovery/dht-discovery.ts` + `dht-discovery.adversarial.test.ts` — `route`, §6
- `docs/BUGS.md` — the entry this design closes the RESIDUAL 2 half of
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — §4.1, the constraint that shaped the whole design
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why "metered, unwired" is stated in the module header
- `docs/PRIOR-ART-LIST.md` §"Routing-metric integrity" — the anchors, with their scope limits
