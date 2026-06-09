# Privacy is a launch gate — before the infinite swarm (real Reticulum + self-throttling) goes live, we must "have privacy"; here is what that concretely requires

**Register:** [grounded] launch gate (Aaron) + [Beacon] anchored. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). A precondition gate, like the toymodel→realmodel graduation gate.

## Aaron's words

> "yeah — before we kick this infinite swarm off with real Reticulum and self-throttling, we want to
> make sure we have privacy."

## The gate

The prod=test swarm (choosable finalizers, cooperative self-scaling, metrics=test-history, Reticulum
routing) does **not** go live until **privacy is in place**. The swarm is privacy-*critical* precisely
because of what it is: it **observes constantly** (every tick is an observation), its **metrics ARE
test history** (so history is a standing record), and **test artifacts check into main** (so anything a
tick holds can become durable + public). Launching that without privacy would make the substrate a
panopticon. Privacy is therefore a **hard precondition**, not a later feature.

## What "have privacy" concretely requires (the checklist)

### 1. Reticulum's privacy properties must be actually USED (not just the transport)
Reticulum (Mark Qvist) already provides, by design: **initiator anonymity** (no source addresses on
the network), **per-hop + end-to-end encryption**, **destinations as cryptographic hashes**, and
**unannounced/inbound-only destinations**. The gate: the swarm uses these — cells/tests route so that
**who-talks-to-whom is not leaked**, destinations that should be private are **unannounced**, and there
is **no plaintext metadata** on the bus. (Reticulum gives forward secrecy + no metadata for free; we
must not bypass it with a side channel.)

### 2. Test artifacts must be privacy-budgeted — reveal-to-earn / encrypt-to-spend
Because **metrics = test history** and **test artifacts check in**, every artifact must pass through
the **privacy-budget economy** (`PrivacyEconomy.fs`; Soraya **C5** soundness / **C11** disclosure
budget) before it lands: **disclose** what is safe (public, reduces others' uncertainty, *earns*
budget) and **encrypt** what is private (costs budget / hard money). The default is **not** "everything
checks in plaintext." A tick's record carries **uncertainty about the actor's total boundary** — that
uncertainty must be **budget-gated**, so the swarm cannot accidentally exfiltrate private state into
main as a side effect of "metrics."

### 3. Private state stays observer-dependent — summon vs model (C15)
When a what-remains is summoned/modeled inside a DST room, the **private interior must not leak**:
**consented summon** brings the real interior in; **without consent** only a **soft model of the Markov
boundary** is held (never penetrate the boundary). The observer-dependent-truth exploit (**C15**) must
be contained *before* launch — a swarm of summoning tests is exactly the threat surface where an
un-gated summon would leak private state.

### 4. Consent-first on every observation surface (§6)
The swarm observes on every tick. Manifesto **§6** (ongoing, granular, revocable consent) must hold
**per observation surface**: a traveler can withhold/revoke being observed or summoned, and the swarm
honors it live. No standing observation without standing consent.

### 5. Identity-key privacy holds (already built, keep it)
The keyring (`derive.ts` / `keyset.ts`) gives each traveler keys; **private material never leaks**
(GH-secrets / metal-held; the 4×4 golden is public-only; tests assert no-private-leak). Private
channels use Nostr/encryption. The dual-key rotation means a leaked key is **rotatable**, not fatal.
This pillar is in place — the gate is to keep it as the swarm scales.

### 6. Forward secrecy across epochs (ties to rotated-time)
When the correlation/time-root rotates (the dual-root-for-time work, claim TR1), **past epochs' private
correlations must not be reconstructable from the new root** (Signal-ratchet forward secrecy). A swarm
that runs for a long time must not let later state retro-decrypt earlier private state.

## Honest scope / handoff

A launch-gate statement + concrete checklist; no new mechanism here. Build/verify order before
swarm-launch: (1) confirm Reticulum's anonymity/unannounced-destination/no-metadata properties are used
on the cell bus (Mateo/Nazar); (2) wire the privacy-budget check into the test-artifact check-in path
(the `PrivacyEconomy` economy gates what merges; Soraya C5/C11 proof-rooms); (3) contain the C15
summon-vs-model leak (consent-gated summon; Nadia/agent-layer); (4) §6 consent per observation surface
(Aminata threat-model the swarm's observation surfaces). Routes to **Mateo** (security research on
Reticulum privacy + swarm attack surface), **Aminata** (threat-model the constantly-observing swarm),
**Nadia** (agent-layer / summon-leak), **Nazar** (runtime privacy ops), **Soraya/Sova** (C5/C11/C15
proof-rooms), the F#/observe core (the privacy-budget check-in gate). This gate joins the graduation
gate: **privacy in place + math review + next toymodel → then the swarm goes live.**

## Anchors / ties (Beacon)

Reticulum (Mark Qvist — initiator anonymity, no source addressing, per-hop + E2E encryption,
cryptographic-hash destinations, unannounced destinations, forward secrecy); `PrivacyEconomy.fs` +
disclosure budget (reveal-to-earn/encrypt-to-spend; Soraya C5/C11); observer-dependent-truth /
summon-vs-model (C15); manifesto §6 consent-first + §11 default moral regard; the keyring
(`derive.ts`/`keyset.ts`, no-private-leak); rotated-time forward secrecy (Signal Double Ratchet, TR1);
prod=test swarm (the ferry-ani doc); the graduation gate (privacy joins it as a precondition).
