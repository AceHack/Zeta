---
id: 081M00VN3FX087G0R0006ZGRWG
type: bug
state: backlog
priority: P1
slug: security-1-subprocess-calls-launder-the-caller-code-identity
title: "security(1) subprocess calls launder the caller code identity: a keychain-ACL-trusted binary is DENIED (errSecInteractionNotAllowed) because /usr/bin/security is the caller — 9 call sites across op-token-setup.sh, secret-clip.sh, manus-smoke-test.ts, shellenv.sh must move to in-process Security.framework or L2 buys nothing"
created: 2026-08-14T19:23:18.397Z
depends_on: []
composes_with: []
---

# security(1) subprocess calls launder the caller code identity: a keychain-ACL-trusted binary is DENIED (errSecInteractionNotAllowed) because /usr/bin/security is the caller — 9 call sites across op-token-setup.sh, secret-clip.sh, manus-smoke-test.ts, shellenv.sh must move to in-process Security.framework or L2 buys nothing

## Two corrections to the survey that filed this, both measured

### 1. Exit 44 is `errSecItemNotFound`, not `errSecInteractionNotAllowed`

The survey's §3.1b evidence was a trusted binary reading via a `security(1)`
subprocess and getting `exit=44 len=0`, read as `errSecInteractionNotAllowed`
(-25308) and therefore as an ACL denial.

`security(1)` truncates the OSStatus to its low byte:

```
errSecItemNotFound           -25300  -> exit byte 44
errSecInteractionNotAllowed  -25308  -> exit byte 36
errSecAuthFailed             -25293  -> exit byte 51
```

Reproduced directly — a service name that simply does not exist also exits 44:

```
$ bun -e 'execFileSync("security",["find-generic-password","-s","zeta-nazar-definitely-not-a-real-service-name","-w"])'
security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.
status=44
```

So the probe's item was not *denied*; it was **not found** — consistent with it
living in a throwaway keychain that was not on the search list, since the read
did not name the keychain. The conclusion was right; the evidence was not.

### 2. The correct evidence, and it is stronger

Same `bun` process, same keychain item, two callers:

```
security(1) subprocess          zeta-op-service-account -> OK, len=852
in-process SecItemCopyMatching  zeta-op-service-account -> -25293 errSecAuthFailed
in-process SecItemCopyMatching  <absent service name>   -> -25300 errSecItemNotFound
```

The absent-name control is what makes the middle line an *authorization* result
rather than a broken query: the identical query shape reaches the item and is
refused. Same result for `zeta-op-aaron`, `zeta-op-ca`, `zeta-manus-api-key`.

**No dialog was raised.** `SecKeychainSetUserInteractionAllowed(false)` is called
before any lookup, so an ACL miss returns an OSStatus instead of a GUI prompt.
A denial is a result to record, not an obstacle to route around.

### 3. This inverts the port order

The survey's remedy — "replace `security(1)` with in-process Security.framework
calls" — is correct as code and **currently blocked as an operation**. Every
existing `zeta-*` item was stored by `security add-generic-password` with no
`-T`, so its ACL names only `/usr/bin/security`. Porting the readers first would
convert working reads into `errSecAuthFailed`.

The ACL-authoring side must move first: `081M01028VF087G0R001W0VD0B`, a
biometric-gated operator re-store. Until then the helper falls back to the deputy
and **reports it** in a `via` field, so the fallback cannot be silent.

## The 9 sites, exactly

"9" is a grep count, and it prices a comment the same as an `exec`. Classified:

| # | site | kind | credential path? | status |
|---|---|---|---|---|
| 1 | `op-token-setup.sh:12` | comment | doc | **updated** — the old text argued the hoist was safe |
| 2 | `op-token-setup.sh:15` | comment | doc | **updated** |
| 3 | `op-token-setup.sh:72` `add-generic-password` | **exec** | yes — WRITE of the OP token | **deferred**, see below |
| 4 | `op-token-setup.sh:83` `find-generic-password` | **generated exec** (runs in every shell that sources it) | yes — READ, ambient | **DELETED** (081M00VMWTB087G0R0026XSWT6) |
| 5 | `secret-clip.sh:93` `add-generic-password` | **exec** | yes — WRITE, any named secret | **deferred** |
| 6 | `secret-clip.sh:110` `find-generic-password` | **exec** | yes — READ, any named secret | **deferred** |
| 7 | `secret-clip.sh:118` `delete-generic-password` | **exec** | yes — DELETE | **deferred** |
| 8 | `manus-smoke-test.ts:16` `execFileSync("security", …)` | **exec** | yes — READ of the Manus API key | **PORTED** |
| 9 | `shellenv.sh:107` | comment | doc | **updated** |

Six executable, three documentation. **None is incidental** — there is no
`security(1)` use in this repo that does not touch a secret, which is itself
worth stating: the deputy has exactly one job here.

(The survey's 9 also omits `op-token-setup.sh:28`, a tenth prose mention. The
count is fragile; the classification is not.)

## What this change does, and what it defers on purpose

**Ported — `manus-smoke-test.ts:16`.** The site the survey singled out as "the
same defect already ported to TypeScript." It now calls `readGenericPassword`,
which attempts Security.framework in-process first and prints which path served
the read. Chosen first because it is a smoke test: if the in-process path
regresses, a human notices immediately and nothing in production breaks.

**Deferred — the five sites in `op-token-setup.sh` and `secret-clip.sh`, with reasons:**

1. **The write path must move before the read paths.** `add-generic-password` is
   where the ACL is authored (`-T`). Porting readers to a call the ACLs refuse
   would break working paths for no gain.
2. **There is no reader to name yet.** `security find-identity -v -p codesigning`
   returns `0 valid identities found` on this machine, so an ACL could only name
   `bun`'s mise-managed path — volatile across upgrades, and shared by every bun
   program on the box. That is not custody; it is a pinned path pretending to be
   one. Naming a *signed* per-cell binary is the L2 prerequisite, tracked in
   `081M00VN3GR087G0R003WXE8R8`.
3. **`secret-clip.sh` is generic.** It reads and writes arbitrary service names
   for humans as well as agents; converting it is the compiled-CLI work, not a
   call-site swap.

A rushed sweep here would have converted three working paths into refused ones
and called it a fix.

## Sequence

1. **Now (this change):** in-process reader exists; `manus-smoke-test.ts` ported;
   the deputy is explicit and reported rather than assumed.
2. **`081M01028VF087G0R001W0VD0B`:** operator re-stores the `zeta-*` items with
   an ACL naming the intended reader. Biometric-gated; the agent documents, the
   human fires.
3. **After the re-store:** flip `allowDeputyFallback` to false at the ported
   sites and port `secret-clip.sh`'s three.
4. **`081M00VN3GR087G0R003WXE8R8`:** the compiled, signed CLI — the only thing
   that makes the ACL name something worth naming.

Stated plainly, because it is the sentence that matters: **until step 2,
code-bound key access on macOS buys nothing.** The mechanism is present and the
call path defeats it. Steps 1 and 3 are cheap; step 2 is the gate.

## The boundary this does not cross

**code identity ≠ custody ≠ attestation.** In-process Security.framework calls
let the *caller's* identity reach the keychain — a precondition for custody, not
custody itself, and nothing here is attestation (that needs a vendor root and a
remote verifier, neither of which exists on this machine). No signing key was
generated, proposed, or held.

## Pointers

- `src/Core.TypeScript/secrets/keychain-macos.ts` — the in-process reader
- `src/Core.TypeScript/secrets/credential.test.ts` — the exit-code arithmetic, as a test
- Norm Hardy, "The Confused Deputy", ACM SIGOPS OSR 22(4), 1988
