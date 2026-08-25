---
id: 081KTWFYC9108QG0R001C8RDPK
type: task
state: backlog
priority: P2
slug: chip8-9-boot-crypto-workload-identity-keys-injected-at-the-d
title: "chip8/9 boot crypto + workload identity — keys INJECTED at the door (never in cartridges); Reticulum-native identities; attestation at the host layer"
created: 2026-06-11T23:23:00.000Z
depends_on: []
composes_with: []
---

# chip8/9 boot crypto + workload identity

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWFYC9108QG0R001C8RDPK-*.md` glob. -->

Migrated from the accidental legacy `081KTSZN10008QG0R000YE3TBC` row so the item lives on the current
ZetaId workitem surface instead of extending the frozen sequential backlog.

Review required before build: Nazar (ops) + Mateo (research); security-sensitive.

Tags: security, identity, spiffe, reticulum, zflash, keys, membrane, red-light.

## Auth for the little machine, without teaching it crypto

> Aaron: "should we give it any crypto primitives inside, for initial boot and such — keys
> injected for auth, like workload identity?"

The design observation (to be red-teamed before any code):

1. **NOT inside the ISA.** chip8/9 stays tiny and deterministic; rolling crypto into a toy ISA is
   the roll-your-own-crypto smell wearing a cartridge. The machine never holds key material.
2. **Keys are INJECTED CAPABILITIES at the door** — an `io` line by ZetaId resolved up the ladder
   (Live/Injected/Mock), with the RED LIGHT showing when a signing capability is bound. NEVER a
   cartridge line: cartridges are public diffable text — a key in one is a secret on a visible
   surface, wrong by construction (the red-light law). The Mock rung = a rehearsal signer that
   cannot produce valid signatures (honest by construction, like the flat inference engine).
3. **Workload identity = the room's, not the machine's:** SPIFFE/SVID is the prior art — identity
   issued to the WORKLOAD at startup by the host (zflash maintainer-key chain + the warm-cache
   startup from 081KTSZN10008QG0R002J0GE0Z is exactly the issuance moment), scoped to the room's lifetime (the
   5-minute bound rotates credentials for free).
4. **Reticulum already speaks identity natively** (cryptographic identities are built into RNS) —
   the bus IS the auth surface; a crossing is signed at the membrane, metered and lit. Boot
   attestation stays at the HOST layer (zflash/SLSA lineage already in-tree).
5. Existing pieces to compose, not duplicate: Crypto.fs, Blake3/Sha256 treaty primitives,
   KeyStore.fs, AntiSybil, the headscale/github trust-bootstrap research, docs/security/.

Gate: Nazar + Mateo review the surface BEFORE implementation; no key handling lands without it.

## State of play (2026-08-17, Otto — the door half only)

**The gate above is UNMET and this item stays open.** What landed is deliberately upstream of it:
`src/Core.TypeScript/zflash/injection-rail.ts` performs **no cryptography and handles no key
material** — it classifies destinations and returns verdicts — so it is policy, not key handling.
Everything that would touch bytes is named as an open question rather than decided.

Landed:

- The **constitutional rail is a type**, exhaustive over `FileBackedEspWrite`'s destination union
  (`satisfies Record<EspDestination, InjectionContentClass>`). A seventh ESP destination without a
  declared content class is now a compile error — the #11485 shape (illegal state unrepresentable),
  applied to the #11477 gap.
- `runFileBackedZflash` **discloses** every secret-class ESP write at flash time. Disclosure, not
  refusal: turning either live case into a hard refusal removes a shipped operator workflow, which
  is a maintainer's call.
- **Point 3 above, answered from the prior art:** a SPIFFE workload identity is `SPIFFE ID` +
  `trust bundle` + `SVID private key`, and only the third is secret. Under SPIFFE the private key
  is _never transported_ — the workload generates it and only a CSR leaves. So "keys injected at
  the door" resolves to: the key is **not** injected; the public half and the node coordinate are.
  `deriveNodeWorkloadSpiffeId` composes the already-injected `/zeta-hostname.txt` into the identity
  treaty's Article 3 form and validates by round-trip through `parseSpiffe`.

Found while doing it — **an unrecorded divergence, not an exception**:
`full-ai-cluster/INJECTION-POINTS.md` §4
says WiFi credentials are secret material and NEVER on the USB ESP; `planFileBackedZflashImage`
writes the SSID and PSK to the ESP as plaintext JSON whenever `--wifi-ssid`/`--wifi-password` is
passed, and three existing tests assert that as expected behaviour. Recorded at §4a and in
`RAIL_DIVERGENCES`; **left unresolved on purpose**.

Not done, and blocked on this item's gate: the chip8/9 `io`-line / red-light half (point 2), any
trust-bundle ESP destination, and every custody decision (sealing, TPM binding, issuance authority,
governance class). Nothing has been flashed or booted.

## Revival (2026-08-25) — and ONE named decision the reviewers now have to make

The branch sat 3024 commits and was resynced. **The gate above is still UNMET and this item
stays open.** Nothing in the revival handles key material either.

**The totality guard fired while the branch waited, which is the best evidence it works.**
`EspDestination` grew from six variants to eight (`/zeta-bind-uefi-keyfile`,
`/zeta-qemu-creds-passphrase`, both from the zflash/USB lane, #15346), and
`satisfies Record<EspDestination, …>` turned the two unclassified arrivals into a compile
error rather than a silent gap. Under the prose-only rail they would simply have shipped
unclassified — which is exactly what `full-ai-cluster/INJECTION-POINTS.md` §4a records happening
to the WiFi PSK.

- `/zeta-bind-uefi-keyfile` → **`public-identifier`**, classified by reading its bytes:
  `planFileBackedZflashImage` writes the literal string `"1\n"` and nothing else. Pinned by a
  test that reads the planner rather than trusting the comment. Named limit recorded beside the
  classification: this rail measures CONFIDENTIALITY, and a behaviour-changing marker also has an
  INTEGRITY axis (anyone who can write the stick can set it) that neither the rail nor the catalog
  addresses.
- `/zeta-qemu-creds-passphrase` → **NOT CLASSIFIED. This is the decision that needs Nazar + Mateo.**

### The open decision, stated so it can be answered without re-deriving it

**What it carries, factually.** The plaintext passphrase for `/zeta-creds.enc`. Written by
`planFileBackedZflashImage` when `--qemu-creds-passphrase-file` is passed; read back off the boot
USB ESP by `src/Core.TypeScript/installer/uefi-keyfile-esp.ts`
(`QEMU_CREDS_PASSPHRASE_IMAGE_PATH`) so a
non-interactive QEMU run can bind the blob. `lib.ts` documents it as a QEMU-only test secret, not
a production operator path.

**Why it is a judgement and not a reading.** `/zeta-creds.enc` earns the `encrypted-envelope`
class _because the key is not on the medium_. This file is that key, on that medium. Whether a
QEMU-only, flag-gated path makes that acceptable — and whether the rail should model "test-only"
as a class at all — is a security call, so the rescue did not take it.

**The four options the rail can actually express** (enumerated in code as
`PENDING_CLASSIFICATIONS`, each with its mechanical consequence):

1. `secret-material` + an `ESP_RAIL_EXCEPTIONS` entry — ships as today, refused-then-rescued by a
   named exception, loud at flash time. Needs `neverImplicit` decided and the `recordedGap`
   written. Note it would also downgrade `/zeta-creds.enc` in practice whenever both are baked
   together, which no roster currently states.
2. `secret-material` + a `RAIL_DIVERGENCES` entry and no exception — ships as today and is REFUSED
   loudly on every use; the disposition the WiFi PSK already has.
3. A new class (e.g. `test-fixture-only`) — widens `InjectionContentClass`, and a class whose
   membership is decided by INTENT rather than by content is one a future caller can talk its way
   into. Would need its own falsifier.
4. Stop writing it — a behaviour change to a shipped CI lane (`QEMU_UEFI_KEYFILE_PICKER`), i.e. a
   maintainer call, not a classification.

**Until it is answered, undecided fails closed and stays loud:** the sentinel
`pending-security-review` is checked BEFORE the exception lookup (so a review gate cannot be
satisfied by a roster entry the reviewers never saw), the write is refused, and the flash-time
line reads `CONTENT CLASS NOT YET REVIEWED` rather than the ordinary refusal — a missing review
must never read as a completed one. A test asserts `decided: false`; a second asserts every
sentinel in the map has a roster entry, so a pending item cannot become invisible.
