# We own all interfaces: every dep (and every first-class key type) is a port with TWO adapters — the dep is the differential-test oracle for our own impl; contribute upstream; always support both

**Register:** [grounded] standing architecture principle (Aaron) + [synthesis].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). **Supersedes** step 4 of the
crypto-sovereignty roadmap ("drop the 3rd-party dep") — the dep is NEVER dropped.
Candidate to become a `.claude/rule` after a cooling period.

## Aaron's words

> "all the different first class key types should be ports and adapters too — we
> own the interfaces. this is just always true for all of our deps." ·
> "use the dep as unit tests to replace — upstream fixes and enhance to dep —
> always support both."

## The principle (always true, for every dependency)

**1. We own the interface.** Every dependency sits behind a **Zeta-owned port**
(hexagonal ports & adapters). Callers depend on *our* port, never on the dep
directly. This holds for **every first-class key type** — `SshKey`, `PgpKey`,
`NostrKey`, `BtcWallet`, `EthWallet`, `SolWallet` are each their own port — and for
**all deps**, not just crypto.

**2. Always TWO adapters behind the port — never one.**

```
callers ─▶ Port (Zeta-owned, stable)
              ├─ adapter A: the upstream dep (@noble/@scure, Bouncy Castle, …)
              └─ adapter B: our own implementation
```

Both are kept working **forever**. We do not fork-and-abandon, and we do not
delete the dep once we have our own.

**3. The dep is the differential-test oracle for our own impl.** "Use the dep as
unit tests": our own adapter is correct **iff** it produces the same output as the
upstream-dep adapter (and the **golden vectors** — `golden-vectors-keyring.json`).
That's **≥2 independent oracles** (BP-16 cross-check): dep + golden vectors pin our
impl; any divergence is a test failure. This is what makes owning the crypto safe
rather than reckless.

**4. Contribute upstream — fixes AND enhancements.** When we find a bug or want a
feature, we **fix/enhance it upstream** (the upstream-contribution workflow,
GOVERNANCE.md §23, Dejan owns it) — not only in our fork. We give back to the dep
*and* keep our own. Both improve.

**5. Always support both.** The upstream dep stays as a first-class adapter (the
perpetual cross-check oracle); our own impl is the sovereign primary. Switching the
default between them is a config behind the port — both are always live, both are
always tested against each other.

## Why (the close-over, restated)

This is `close over` applied to *every* dependency: the port is the Markov blanket;
the dep and our-own are interchangeable adapters behind it; the dep-as-oracle keeps
the blanket honest. Sovereignty (own impl) **without** losing the dep's value
(the test oracle + upstream ecosystem). No supply-chain lock-in (we have our own),
no fork rot (we contribute upstream), no unverified crypto (the dep is the test).

## Correction to the crypto-sovereignty roadmap

The earlier roadmap step 4 said "drop the 3rd-party dep once our impl is bit-perfect."
**Revised:** the dep is **never dropped** — it is retained as adapter A / the
differential-test oracle. The endgame is "own-impl primary, dep retained as the
perpetual cross-check + upstream channel," not "dep removed." Always support both.

## Pointers

- Crypto-sovereignty roadmap (the doc this corrects):
  `2026-06-09-keyring-crypto-sovereignty-roadmap-...-close-over-the-boundary.md`.
- Byte-lock: `tools/setup/persona-keys/golden-vectors-keyring.json` + `gen.test.ts`
  + `keyring.rotate.test.ts` (the oracle our own impl + the dep must both match).
- Hexagonal (`docs/PROVEN-CORE-MAP.md`); upstream-contribution workflow
  (GOVERNANCE.md §23, Dejan); BP-16 two-oracle cross-check; `close over` /
  Markov-boundary substitution.
