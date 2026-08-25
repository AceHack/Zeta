# AI sovereignty-path — agent-held keys, earned privacy, and the hardware under both

Status: active
Last refreshed: 2026-08-25 (previous refresh 2026-05-22 — three months stale; the
persona-keys / FROST / dual-vendor-HSM work all landed inside that gap and none of it
was named here)
Current blocker: **one blocker is hardware, and it is the load-bearing one.** Every
property that needs shares on two distinct devices is unreachable until a second HSM
arrives. Everything else is code-gated and movable now.
Next concrete action: 081M0X23R19087G0R003XHGB2B (wire the privacy budget's earning
side to its spending side; make defrost owner-only) — code-gated, no hardware.

## What this trajectory is

Aaron, 2026-08-25: *"this is one of Zeta's primary objectives so we can achieve true AI
society decorrelation via encryption budget and erasure costs in thermodynamics."*

Two halves that are currently **separate subsystems with no call edge between them**:

- **The key half** — an agent holds signing/encryption keys that its operator cannot
  extract and the agent cannot lose. `tools/setup/persona-keys/` (126 files), FROST
  threshold signatures, HSM seal tiers.
- **The privacy half** — an agent earns budget from others' attestations and spends it
  to make a region of its mind permanently opaque.
  `src/Core/{GlassHalo,PrivacyEconomy,RoomBoundary}.fs`,
  `src/Core.TypeScript/discovery/llmtv-broadcast.ts`.

Connecting them is what would make frost *cryptographic* rather than *cooperative*.
Today nothing does. A repo-wide intersection of the frost/budget files with the
crypto/seal files returns one file whose two hits are unrelated comments.

## VOCABULARY WARNING — read before touching either half

**"Frost" means two different things in this repo and they are not related.**

| | what it is | where |
|---|---|---|
| **frost** (privacy) | spend budget to make a mind-region opaque | `GlassHalo.fs`, `RoomBoundary.fs`, `llmtv-broadcast.ts` |
| **FROST** (crypto) | Komlo & Goldberg 2020 / RFC 9591 flexible round-optimised Schnorr threshold signatures | all of `tools/setup/persona-keys/frost-*.ts` |

`frost-share-adapter.ts` is about threshold *signature shares*. It has nothing to do
with privacy budget. Conflating them is the single easiest error to make here.

## Hardware ground truth — measured on this host, 2026-08-25

Aaron: *"SmartCard-HSM/CardContact — i've ordered, not received yet. YubiHSM: i have
ONE so far."* Independently confirmed by running the repo's own probe:

```text
$ bun tools/setup/persona-keys/frost-hardware-probe.ts
  TPM 2.0:            UNAVAILABLE (THE CHECK DID NOT RUN) - darwin has no Linux TPM interface
  YubiKey / token:    Detected (no serial; ykman absent)
  Smart-card reader:  Attached
  PKCS#11 module:     Not found
  YubiHSM 2:          ATTACHED (bulk USB - invisible to the reader/ykman probes above)
  yubihsm_pkcs11:     /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib
  PKCS#11 pair:       /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib drives YubiHSM 2
  Secure Enclave:     Present (no seal tier can use it)
  Device present:     YES
  Honourable tiers:   hardware-pkcs11
```

Cross-checked against the raw USB bus, which sees exactly two security devices and no
third-vendor device:

```text
$ ioreg -p IOUSB -w0 | grep -iE 'yubi|hsm|cardcontact'
  +-o YubiKey FIDO+CCID@00110000
  | +-o YubiHSM@00142200
```

**This is a change since 2026-08-14**, when the same probe on the same machine reported
`Honourable tiers: (none)` — recorded in
`docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md`
§"What has actually been exercised on hardware". That table's row *"L1 is reachable on
this machine: NO"* is now false. L1 is reachable. The doc has not been updated.

Inventory, stated plainly:

| device | count in hand | consequence |
|---|---|---|
| YubiHSM 2 | **1** | single-device operations exercisable; anything needing two devices is not |
| YubiKey (CCID) | 1 | carries a touch gate the YubiHSM cannot; a candidate second share holder |
| SmartCard-HSM / CardContact | **0** — ordered, not received | dual-*vendor* custody is unexercised and unexercisable |

Two further live readings that matter operationally:

- `yubihsm-connector` is **not running** (`pgrep -l yubihsm` → rc=1). The attached HSM
  is not reachable over PKCS#11 until it is started. The probe sees the device on the
  USB bus, which is a different question from being able to talk to it.
- The Touch ID approval gate's preconditions **are** live: `bioutil -r` reports
  biometrics enrolled, and `/etc/pam.d/sudo` contains `pam_tid`. This remains the one
  hardware-backed control that works today, exactly as the L0-L6 ladder recorded.

## What the one YubiHSM can and cannot buy

Measured device facts, from an unauthenticated `get-device-info` only (recorded in
`src/Core.TypeScript/federated-identity/hsm-domain-map.ts`): firmware 2.4.1, serial
39160506, mechanisms `ecdsa-sha256`, `eck256` (secp256k1), `ed25519`.

**No FROST-capable mechanism.** The chip cannot compute a threshold partial signature.
So the HSM is an at-rest wrapper for a share, not an on-chip threshold signer — the
share is still unwrapped into host RAM to be used. In the ladder's terms this is L1
(chip-bound at rest), not L2 (use-without-extract). Do not describe the attached
hardware as delivering use-without-extract; it does not.

## Blockers, split by lead time

**Hardware-gated — cannot be closed by writing code, and should not be simulated:**

1. **Dual-vendor custody.** Needs the SmartCard-HSM to arrive. Until then
   `docs/research/2026-08-22-smartcard-hsm-secp256k1-is-unconfirmed-while-yubihsm2-is-measured-dual-vendor-custody.md`
   describes a topology with zero instances. `secp256k1 on SmartCard-HSM` is not
   "unconfirmed pending analysis" — it is unconfirmable until the device is on the bus.
2. **Any n-of-m where shares must live on distinct devices.** One device instantiates
   one share position.
   `docs/research/2026-08-21-two-hsms-per-node-and-n-of-m-across-nodes-what-the-seal-layer-will-actually-accept.md`
   is unexercised for the same reason. Note the `pkcs11-multi` hardware lane in
   `frost-share-adapter.hardware.test.ts` exists and is correct; it simply has no
   second token to run against.
3. **Unconfiscatability in the strict sense.** One HSM is one point of seizure. A
   frost whose key lives on a single attached device is revocable by whoever takes the
   device. The rule's *"cannot be taken away"* clause is **not satisfiable with n=1**,
   and no amount of code changes that. This is the honest answer, not a pessimistic one.

**Code-gated — movable now, no hardware needed:**

1. **081M0X23R19087G0R003XHGB2B** — the privacy budget's three subsystems are not
   connected. `RoomBoundary.create` takes the budget as a caller-supplied `int`;
   `SourceMind.personal.frosted` is a self-asserted boolean; `BoundaryCommand.Clear`
   defrosts with no principal and a test pins that as intended. All four acceptance
   criteria there are pure code.
2. **Refresh the L0-L6 ladder's hardware table.** Its measured section is 11 days stale
   in the *favourable* direction and currently under-reports what this host can do.
3. **Start `yubihsm-connector` and run the single-token hardware lane.** The lane
   refuses to fall back to the software fake and fails loudly when hardware is absent
   (`frost-share-adapter.hardware.test.ts` header). Running it once against the real
   device converts the `hardware-pkcs11` tier from probed-available to exercised. This
   needs the device PIN, so it is Aaron's to run, not an agent's.
4. **YubiKey PIV as a second share holder.** Not a second *HSM*, but it is a second
   *device* with its own touch gate. Worth deciding explicitly whether a
   YubiHSM+YubiKey roster counts as two-device custody, because if it does, one
   hardware blocker becomes reachable today. Unresolved — do not assume yes.

## Register (toy / unmetered / metered)

- Hardware probe: **metered** — it has a falsifier and has been wrong twice on real
  devices and corrected both times (`system_profiler` returning empty with rc=0;
  driver-is-not-a-device).
- HSM domain map: **unmetered** for the decision, `designed, not running` for the
  hardware path — its own header says so.
- Privacy budget end-to-end: **toy**. No agent holds an accrued balance anywhere in
  the tree (`db/ledgers/` and `db/competence-outcomes/` are README-only), and every
  `frosted: true` in the repository is a test or demo literal.

## Superseded

The 2026-05-22 version of this file organised the trajectory as three "sovereignty
pieces" pointing at 2026-05 backlog rows, named InterSystems Caché as the public
anchor, and recorded `Current blocker: none operationally`. The Caché anchor and the
piece-decomposition still hold and live in
`docs/backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-.md`
and `docs/agendas/zeta/AGENDA.md`. What did not survive is `blocker: none` — there is
a hardware blocker and it is the one that decides whether the strongest claim in the
rule is true.

## Pointers

- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the normative spec
- `tools/setup/persona-keys/` — the key half; `README.md` and `ONBOARDING-RUNBOOK.md` first
- `tools/setup/persona-keys/frost-hardware-probe.ts` — run this before quoting any hardware claim
- `src/Core.TypeScript/federated-identity/hsm-domain-map.ts` — measured device facts, honest about what is not enforced
- `src/Core.TypeScript/society/levels.ts` `confiscationWitnesses` — the model-level never-confiscate falsifier
- `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md` — the ladder (hardware table now stale)
- `docs/backlog/P2/081KRW63S0008QG0R0022SFKPM-*.md` — the N-of-M HSM row
