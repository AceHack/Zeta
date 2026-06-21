# Zero-downtime key rotation — Itron KeyState/SKMS anchor, expressed as a Z-set state machine over SchemaEvolution

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (human-anchored design) · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"Leave the 1Password service-account root secret in every vault — I won't rotate those now,
> but I'll create a 2nd one for each (best rotation practice). Look at Itron
> `PerfMan.ItronSharedSource/Security` + `ISM` for rotation best practices — we need 0-downtime
> guarantees on top of this, like our SchemaEvolution but for key rotation."*

## The Beacon anchor: the maintainer's own Itron key-rotation substrate

Aaron's Itron `Itron.Security` + `ISM/SKMS` (Secure Key Management Server) is shipped, real-world
key-rotation prior art (named human anchor, like the ferry-boat throttle). The load-bearing parts:

- **`KeyState` lifecycle** (`Itron.Security/KeyState.cs`) — the rotation state machine:
  `Undefined · Active · PendingActive · PendingInactive · Inactive · Inconsistent · Consistent · Standby`.
- **Overlap window** = `PendingActive` (new key staged) + `PendingInactive` (old key retiring) are
  BOTH honored during the transition → **no flag-day, zero downtime**.
- **`Standby`** = a pre-staged spare key → the **1-of-2 redundancy** ("lose one, promote the spare").
- **`Consistent` / `Inconsistent`** = the **fleet-consensus** state: has the new key state propagated
  + been agreed across all holders.
- **`KeyBase`** keys are **indexed + timestamped** (`KeyIndex`, `KeyID`, `Created`) — versioned.
- **Selectors filter by state** (`…FirstOrDefault(k => k.KeyState == Active || Consistent)`).
- **`SKMS` rollover orchestration** (`RequestKeyRollover`, `RequestKeyRolloverByDevice`,
  `RequestSharedKeyRolloverTask`, `IKeyManagementService`) — rollover is an explicit, requested,
  task-driven server operation, not an ad-hoc swap.

## Map to Zeta (Itron concept → our substrate)

| Itron | Zeta expression |
|---|---|
| `KeyState` enum lifecycle | a **Z-set of key-state events** — each transition is a delta; the live key set = the fold; "current active key" = fold filtered to `Active`/`Consistent` |
| Overlap (`PendingActive`+`PendingInactive` both valid) | **zero-downtime rotation** — both keys honored during the window (the 2026-06-15 overlap-window dual-key decision, now anchored) |
| `Standby` spare | the **1-of-2 seed/key redundancy** — a pre-staged key/seed promotable on loss |
| `Consistent`/`Inconsistent` | **fleet consensus = DBSP incremental-view convergence** — the rotation is "done" when the view converges to Consistent across holders |
| `KeyIndex` + `Created` | **SchemaEvolution versioning** of the key/path/state schema |
| `SKMS` rollover request/task | rotation as a **DU/workflow transition** (event-sourced, requested, auditable) — not an ad-hoc swap |
| `DeviceHandoverPackage` | the **handover/rollover transfer** primitive (signed control transfer) |

## "SchemaEvolution but for keys" — the 0-downtime guarantee

Key rotation IS a SchemaEvolution migration applied to the **key-state schema**: the active-key
set is a materialized view over the Z-set of state events; rolling a key appends
`PendingActive(new)+1` then `PendingInactive(old)` then `Inactive(old)−1` — **both valid during
the overlap**, so readers/signers never see a gap (the 0-downtime guarantee, identical in shape to
how SchemaEvolution migrates a data schema with an overlap rather than a flag-day). Replayable
(DST), idempotent (re-applying a transition is a no-op via the state key), revocable (retraction).
Applies uniformly to **every key layer**: derived identity keys, crypto wallet keys, the CA, AND
the 1Password **service-account tokens** (Aaron's "2nd one per vault" = the `Standby`→`Active`
overlap at the token layer).

## Where it lives in the architecture

Rotation sits behind the **`KeyCustody`/`CertAuthority` ports** (hexagonal decision) — so the
SAME KeyState lifecycle drives rotation regardless of adapter (local file / 1Password / Vault /
DB-PKI). It composes ABOVE the event-sourced authorization fold (grant/revoke) — rotation is
another class of Z-set event. The endgame DB-as-PKI adapter implements SKMS natively.

## Build (backlog the implementation)

Adopt the `KeyState` lifecycle as the rotation state machine; model transitions as Z-set events;
overlap-window dual-key from the start; `Standby` for 1-of-2; `Consistent` = fleet-convergence
gate; rotation = a requested DU/workflow transition (SKMS-shaped). Compose with the
identity+crypto unify build (081KVNXBR4S08QG0R0015DHBBN), vault separation (081KVNTNTDQ0), the
2026-06-15 dual-key rotation decision, and the hexagonal ports. (New build workitem to follow.)

## Anchors

**Human anchor:** the maintainer's Itron `Itron.Security` (`KeyState`, `KeyBase`,
`DeviceHandoverPackage`) + `ISM/SKMS` (Secure Key Management Server, key-rollover request/task
model). Beacon: NIST SP 800-57 (key states: pre-activation/active/deactivated/destroyed — the
same lifecycle); overlap-window rollover (BLESS-style short-lived certs). In-repo: DBSP/Z-sets,
SchemaEvolution (schemas-as-rows), the zero-downtime-id-rotation decision (2026-06-15), the
hexagonal + event-sourced + identity-crypto-synthesis decisions (2026-06-21).
