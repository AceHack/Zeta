---
id: 081M01028VF087G0R001W0VD0B
type: task
state: backlog
priority: P2
slug: keychain-acl-re-store-ceremony-every-zeta-item-is-stored-wit
title: "Keychain ACL re-store ceremony: every zeta-* item is stored with an ACL naming only /usr/bin/security, so an in-process Security.framework reader is refused (errSecAuthFailed, -25293) for the same item the deputy reads at 852 bytes — the reader port is BLOCKED on a biometric-gated operator re-store, never an agent action"
created: 2026-08-14T20:40:24.175Z
depends_on: []
composes_with: []
---

# Keychain ACL re-store ceremony: every zeta-* item is stored with an ACL naming only /usr/bin/security, so an in-process Security.framework reader is refused (errSecAuthFailed, -25293) for the same item the deputy reads at 852 bytes — the reader port is BLOCKED on a biometric-gated operator re-store, never an agent action

## The measurement that makes this a blocker

Same `bun` process, same keychain item, two callers:

```
security(1) subprocess          zeta-op-service-account -> OK, len=852
in-process SecItemCopyMatching  zeta-op-service-account -> -25293 errSecAuthFailed
in-process SecItemCopyMatching  <absent service name>   -> -25300 errSecItemNotFound
```

Identical for `zeta-op-aaron`, `zeta-op-ca`, `zeta-manus-api-key`. The
absent-name control proves the query reaches the keychain and is *refused*,
rather than malformed.

Cause: every item was created by `security add-generic-password` with no `-T`,
so its ACL trusts only the creating application — `/usr/bin/security`. Any
in-process reader is a stranger to it.

No prompt was raised at any point: `SecKeychainSetUserInteractionAllowed(false)`
is called before the first lookup, so an ACL miss returns an OSStatus rather
than a GUI dialog.

## Why an agent must not do this

Re-storing an item means holding its plaintext long enough to write it back.
Aaron's standing constraint governs: *"nothing operator-run, only
operator-approved via biometric"* — the agent executes setup, the human approves
each sensitive gate. A re-store is the sensitive gate.

## Blocked on a prior question, and it should not be rushed

The `-T` argument has to name a reader, and there is nothing worth naming yet:

- `security find-identity -v -p codesigning` -> **`0 valid identities found`**.
- So the only nameable reader today is `bun` at its mise-managed path — volatile
  across upgrades, and shared by every bun program on the machine. Naming it
  would produce an ACL that looks like custody and grants nothing.
- `-A` (trust everything) is worse: it removes the gate entirely.

So the honest order is: **compiled, signed per-cell binary first**
(`081M00VN3GR087G0R003WXE8R8`), then this ceremony names it. Doing the ceremony
before there is a stable identity to bind converts a real gate into a pinned
path, and pinned paths break silently — note also that a `bun build --compile`
binary's cdhash changes when the **output filename** changes, so an ad-hoc-signed
ACL is broken by a rename.

## When it does run — the shape, not the command to paste today

For each `zeta-*` item: capture the secret through the existing secure-dialog
path (never argv, never stdout), delete, re-add with `-T <reader>`, verify with
`security dump-keychain -a` that the `applications (…)` list names the intended
reader, then flip `allowDeputyFallback: false` at the ported call sites and
confirm the reads still succeed as `via: "in-process"`.

The verification step is the one that must not be skipped: an ACL that silently
did not take looks exactly like one that did, until the deputy fallback is
removed.

## Until then

`readGenericPassword` attempts in-process first, falls back to `security(1)`, and
**reports which path served the read** in a `via` field. The fallback is loud by
construction so it cannot quietly become permanent.

## Pointers

- `081M00VN3FX087G0R0006ZGRWG` — the deputy finding and the 9-site enumeration
- `081M00VMWTB087G0R0026XSWT6` — the ambient hoist (closed repo-side)
- `081M00VN3GR087G0R003WXE8R8` — the compiled signed CLI this is blocked on
- `src/Core.TypeScript/secrets/keychain-macos.ts`
