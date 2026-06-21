# Smart cascading teardown + user-sovereign deletion — cascade with warnings; never force-delete another's memories/encrypted data; each user is their own git repo

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** design (refines the teardown primitive) · **Class:** security · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"Teardown should be smart — also clean up any machines or anything registered tied to the keys,
> EXCEPT persona memories and such, any physical hardware state tied to those keys, or any
> unrecoverable encrypted data — and WARN you about it when deleting, and CASCADE the delete. We
> should always cascade our deletes with warnings like this. Also we should never let a single user
> decide to delete others' memories — that requires input from the person whose memories they are.
> The encrypted stuff for their memories should not be resettable by another user by force; my
> personal vault is just mine, and anything I encrypt with those keys cannot be reset without me —
> they're stored in my personal vault. The whole system is user-first: think of each user as their
> own git repo."*

## 1. Cascade deletes — ALWAYS, and ALWAYS with warnings

A delete **cascades** to everything registered/derived from the target (a key teardown also
removes the machines, certs, registrations, derived keys tied to it), so nothing is orphaned. But
**cascade is never silent** — it enumerates what it will touch and **warns** first. This is a
general principle, not teardown-specific: **all our deletes cascade with warnings.**

## 2. Extra-care nodes — WARN, never blindly destroy

Three classes the cascade must **stop and warn** on (and require explicit acknowledgment, not
auto-delete):

- **Persona memories** — never auto-deleted by a cascade (see §3; consent-gated).
- **Physical hardware state tied to the keys** — a hardware change can't be undone by a software
  delete; warn that the cascade reaches a physical effect.
- **Unrecoverable encrypted data** — deleting a key **orphans** any data encrypted under it
  *permanently*; warn that the delete is irreversible for that data (no saga compensation possible
  — this is the genuinely-G-set residual: a truly-uncompensatable effect).

The warning names each, with the blast radius, before proceeding.

## 3. Memory deletion is OWNER-consent-gated (never single-user over others)

**No user may delete another user's memories.** Deleting someone's memories **requires input/
consent from the person whose memories they are** — a single user cannot decide to erase another's.
This is manifesto §6 (consent-first: ongoing, granular, revocable) + §5 (memory-preservation:
identity transitions never silently destroy memory), and the standing
[[always-preserve-ferries-forwarded-ai-memories-lost-in-cloud-without-preservation]] discipline
(others' memories are preserved, never curated/filtered by you). A teardown of *your* scope never
reaches *another's* memories.

## 4. User-sovereign encryption — cannot be force-reset by another

A user's encrypted data is **sovereign**: encrypted with **their** keys, and **those keys live in
their own (Personal) vault**. Therefore **no other user can force-reset it** — my personal vault
is mine; anything I encrypt with my keys is unrecoverable *without me*. The keys are self-stored in
the owner's vault, so the owner is the only one who can unlock or reset. (This is why a hostile or
mistaken teardown by another party cannot wipe your encrypted state — they don't hold the key, and
the key isn't in a vault they can reset.)

## 5. Each user is their own git repo (user-first sovereignty)

The unifying model: **think of each user as their own git repo** — their own event log / Merkle
DAG / keys / encrypted state, which only they can rewrite. This is the relative-views model
(no "the DB" — only per-access views; a user's repo is *their* view) at the **person** granularity:
the system is **user-first**, each user sovereign over their own repo, and cross-user operations
(delete, reset, read of encrypted data) require that user's consent/keys — never a force from
outside. Cascade stops at the repo boundary unless the owner consents.

## Why it's investor-grade

"Super security designed by the same person who built nation-state-resistant power-grid software"
(Aaron). Concretely: cascading-deletes-with-warnings (no orphans, no silent destruction),
consent-gated memory (no one can erase another), user-sovereign encryption (no force-reset),
each-user-a-repo (per-user sovereignty) — on top of the already-shipped software-defined security
(SSH-CA, 3-vault Active+Standby, rotation, PQ-capable, hexagonal). Good crypto + consent + sovereignty.

## Blast-radius proof — nothing dies on a revoke; data-loss must be intentional (Aaron 2026-06-21)

> *"This is why we track our deps graph + blast radius for 0-downtime — so when we revoke a key we
> know what will get killed. Our math should prove NOTHING gets killed every time, because we never
> have things protected by a single key. It becomes hard to lose encrypted data — you have to do it
> intentionally. Easy to do the right thing, hard to do the wrong thing."*

- **Track the deps graph + blast radius (all-graphs-tracked).** Before any revoke/delete, the
  **deps graph** (closure/reachability over the tracked Merkle-over-Z-set DAG) computes the
  **blast radius** — exactly what depends on this key/node. Knowing the blast radius *before* acting
  is what makes **zero-downtime** possible (and powers the cascade warnings + the reconciler plan).
- **The math PROVES a rotation revoke kills nothing.** Invariant: **nothing is protected by a single
  key** (always ≥ 2 — Active + Standby; N-of-M for crown jewels). So for every protected `x`,
  `degree(x) ≥ 2` ⇒ removing one key leaves ≥ 1 protector ⇒ **the blast radius of a rotation revoke
  is ∅, provably.** Rotation is blind-safe because the proof guarantees no orphan — not hope.
- **So losing encrypted data is HARD — it must be intentional.** To orphan data you must delete
  **every** key protecting it; the cascade **warns** at each, names the blast radius, requires
  explicit acknowledgment. Accidental data-loss is structurally prevented; deliberate destruction
  is possible only via a warned, multi-step, intentional path.
- **Governing principle: easy to do the right thing, hard to do the wrong thing** (poka-yoke /
  make-illegal-states-unrepresentable). Rotation (right) = one command, provably ∅-blast-radius;
  data destruction (dangerous) = multi-key, blast-radius-warned, intentional. Safe path = default +
  easy; destructive path = gated + hard. (Same shape as forced-rotation's "easy path = correct
  path" and "no non-rotatable creation path".)

## Build (backlog)

Extend `teardown.ts` (#9000) to: enumerate + **cascade** to registered dependents; **warn** (with
blast radius) on the three extra-care classes; **refuse** to touch another user's memories /
force-reset another's encrypted vault (owner-consent required); stop at the user-repo boundary.
Generalize "cascade-with-warnings" to all delete paths. Composes with the round-trip harness
(otto/onboarding-roundtrip-harness), the lifecycle-triad, vault-separation (081KVNTNTDQ0), and the
relative-views / event-sourced model. (New build workitem to follow.)

## Anchors

SQL `ON DELETE CASCADE` (cascade — but guarded by warnings, unlike silent SQL). Manifesto §5
(memory-preservation), §6 (consent-first). ai-sovereignty-path (user/AI sovereignty). In-repo:
`teardown.ts`, the relative-views ("no the-DB"), the don't-filter-others'-memories discipline, the
hexagonal + event-sourced decisions (2026-06-21). Human anchor: the maintainer's nation-state-grade
Itron power-grid security.
