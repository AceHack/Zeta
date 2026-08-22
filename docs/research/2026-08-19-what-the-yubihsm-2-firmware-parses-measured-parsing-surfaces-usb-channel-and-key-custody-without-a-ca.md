# What the YubiHSM 2 firmware parses: measured parsing surfaces, the USB channel, and key custody without a CA

**Author:** Nazar (security-operations). **Date:** 2026-08-19.
**Register:** Beacon (named humans, published work, checked anchors) where load-bearing;
Mirror where it is our own substrate vocabulary.
**Device:** YubiHSM 2, serial 39160506, firmware **2.4.1**, part 78CLUFX5000P — physically
attached, and, under Aaron's 2026-08-19 authorization, **exercised directly**. It holds no
production keys; it is a learning instrument and was reset to factory at the end of this work.
**No key material, PIN, wrap key, or password value appears in this document** — procedures and
observations only. The habit transfers to production, where a play credential in git history is
indistinguishable from a real one to a later reader.

This note advances the hardware-root-of-trust design against the three-channel taxonomy from
[`2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md`](2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md):
**parser in the trusted path** (undeclared *input* channel), **trusted peripheral** (undeclared
*authority* channel), **physical channel** (undeclared *physical* channel). The integration target
Aaron named is the **custom-hardware NixOS server fleet** — so every finding below is written toward
that destination, and connects to the existing `full-ai-cluster/nixos/modules/ssh-ca.nix` trust
anchor and the `zeta-self-register` path (#12248).

---

## 0. What changed from the documentation-only plan, and why it matters

The original brief was documentation-only: enumerate the parsing surfaces from public docs and label
every claim `unmetered`. Aaron lifted the device prohibition mid-task for this throwaway device. That
converts a set of *cited* claims into *measured* ones, and the distinction is the whole point of
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md): a
documentation claim about what firmware parses is `unmetered` until something fails when it is wrong.
Where a row below says **METERED**, it carries the exact observation on this device (fw 2.4.1) that
supports it. Where it says **unmetered**, the falsifier is named and was not run.

Tooling used: `yubihsm-shell 2.7.3`, `yubihsm-connector 3.0.7`, `openssl`. The device enumerated at
USB VID `0x1050` / PID `0x0030` (`ioreg`), Device-Serial `0039160506`, matching the constants in
`yubihsm.h` recorded in #12178.

---

## 1. The attack surface of what the firmware parses

A **surface** is wherever trusted code interprets structure it did not author (the sharpened GLOSSARY
definition from the Xbox note). The YubiHSM 2 firmware is trusted code; every command whose input it
*interprets* rather than merely *stores* is a surface. Enumerated from the public command reference
(58 commands) and then, where possible, exercised.

### 1a. The transport frame — SCP03, and the one thing before it

Every command except a small unauthenticated set travels inside a **GlobalPlatform SCP03** channel
(AES-128, encrypt-then-MAC, mutual authentication established by `Create Session` + `Authenticate
Session`). SCP03 is the outer parser: the firmware must parse the session-establishment messages
*before* any credential has been proven, because proving the credential is what those messages do.

- **METERED — the unauthenticated pre-session surface exists and answers.** `get-device-info`
  succeeds with **no session**: it returned firmware `2.4.1`, serial `39160506`, `Log used: 7/62`,
  the full supported-algorithm list, and part number `78CLUFX5000P`. This is the HSM analogue of the
  TPM's unauthenticated `TPM2_GetCapability` (#12179): the device describes itself to anyone who can
  put bytes on the wire. Classify: **parser in the trusted path (input channel)** — small, fixed,
  but pre-authentication.
- `Create Session` parses a 2-byte auth-key ID + 8-byte host challenge; `Authenticate Session` parses
  a session ID + 8-byte host cryptogram. These are the SCP03 handshake parsers and are reachable
  before authentication completes by construction. **unmetered** as an *attack* surface — I confirmed
  sessions open and close normally (many times), but did not fuzz the handshake framing; falsifier
  would be a malformed-cryptogram / truncated-challenge campaign against `yubihsm-connector`'s device
  endpoint with the response-code taxonomy asserted.

### 1b. The attestation template parser — the sharpest finding, and it is METERED

`Sign Attestation Certificate` (Tc `0x64`) takes two 2-byte object IDs: the key to attest and the
attesting key. It emits a **DER-encoded X.509** certificate. That much is documented. What is
load-bearing, and what I measured, is the *template* path:

- **METERED — the firmware parses a caller-supplied DER X.509 and copies fields from it.** When you
  attest with the built-in key (ID 0), the issuer is fixed: `CN=YubiHSM Attestation (39160506)`. When
  you attest with a **custom** attestation key, the firmware reads an **opaque `opaque-x509-certificate`
  object stored at the same object ID** and uses it as a *template*. I generated an RSA-2048 key at a
  chosen ID, stored a DER X.509 as its template, and attested a second key with it. The emitted
  certificate's issuer became `CN=YubiHSM Attestation id:<that-ID>` — **the subject DN of my template,
  parsed by the firmware and copied into the output.** That is an ASN.1/DER parser in the trusted path,
  fed a caller-controlled object. Classify: **parser in the trusted path (input channel)**, and it is
  the exact Xbox class — a font file is a caller *defining* a computation; a template certificate is a
  caller *defining* an issuer field the trusted firmware then interprets.
- **METERED — the emitted attestation carries Yubico OID extensions the firmware fills in.** The cert
  contained `1.3.6.1.4.1.41482.4.{1..6,9}`: firmware version, serial (Integer), origin (Bit String),
  domains (Bit String), capabilities (Bit String), object ID (Integer), label (UTF8String). The label
  I set on the attested key appeared verbatim in extension `.9`. So the attestation is a **signed,
  self-describing capability statement** — which is precisely the artifact a decentralized verifier
  wants (see §3), because it is checkable evidence rather than a boolean verdict.
- **METERED — validity is fixed, not clocked.** `Not Before: Aug 1 00:00:00 2025`, `Not After: Dec 31
  23:59:59 9999`. The device has no real-time clock; the lower bound is a build-time constant and the
  upper bound is "never". This is the same fact the audit log confirms (§1e) and it is load-bearing for
  §3: **a hardware attestation from this device carries no trustworthy time.**

The template parser is the one to worry about hardest, because it runs inside the firmware boundary
(below the non-existent update path — §2a of the Xbox note) and its input is attacker-shaped bytes. It
requires a session with `sign-attestation-certificate` capability, so it is not *unauthenticated* — but
a compromised legitimate tenant reaches it, and a DER parser is a rich target. **The residual unmetered
question, and the right next probe:** does a *malformed* template DER cause a firmware fault vs a clean
rejection? I proved the firmware parses *well-formed* templates; I did not fuzz malformed ones against
the device. Falsifier: a structured DER-mutation campaign against the template object with the device
response asserted per mutation (see the filed work item).

### 1c. The SSH-certificate template parser — the richest parser, exercised at the format layer

`Sign Ssh Certificate` is the most complex surface. The firmware parses **two** nested structures:

- an **SSH Template** object — a Tag-Length-Value blob with six tags (public confirmation from
  Yubico's OpenSSH-host-login guide): `0x01` timestamp key algorithm, `0x02` timestamp public key,
  `0x03` CA-key white-list, `0x04` not-before offset, `0x05` not-after offset, `0x06` principals
  black-list; and
- an **SSH Certificate Request** in the `ssh-rsa-cert-v01@openssh.com` wire format, from which the
  firmware extracts the not-before/not-after timestamps and the principals list.

And then it *makes a security decision on parsed, caller-supplied data*: it verifies a timestamp
signature against the template's timestamp public key, records `Now`, checks the CA-key ID against the
white-list, checks the request's validity window against `Now ± the template offsets`, and checks that
no requested principal appears in the black-list. This is a **policy engine driven by two parsers**,
inside the firmware. Classify: **parser in the trusted path (input channel)**, highest complexity of
any surface here.

- **unmetered.** I did not drive this end-to-end — it needs `yubihsm-ssh-tool` and a timestamp-signing
  authority to construct a valid request, which is a provisioning exercise, not a probe. Falsifier and
  next step are in the filed work item. Flagged as the **top parser-risk surface** precisely because it
  combines two wire-format parsers with an in-firmware authorization decision, and because it is the
  one that plugs directly into the NixOS SSH-CA (§4).

### 1d. The wrapped-object import parser — METERED, and it is behind the auth check (the good case)

`Import Wrapped` / `Put Wrapped` decrypt an AES-CCM-wrapped object and import it. The order of
operations is the security property:

- **METERED — the object-import parser sits behind AES-256-CCM authentication.** I created an
  AES-256-CCM wrap key, exported a wrapped EC key (a 184-byte blob: nonce + ciphertext + auth tag),
  deleted the original, and re-imported it cleanly. Then I flipped **one byte** of the blob and
  re-imported: the device returned **"Malformed command / invalid data"** and refused. So the CCM
  authentication tag is checked *before* the plaintext object structure is parsed. An attacker without
  the wrap key cannot reach the import parser with chosen bytes at all — this is **encrypt-then-parse**,
  the correct ordering, and it is why the wrapped-import surface is materially safer than the
  attestation-template and SSH-template surfaces, which parse data authenticated only by the session.
- This is the **BYOK / asymmetric-wrap** family that firmware 2.4 added (public release notes). The
  *asymmetric* wrap variant (import under an RSA public wrap key) is a larger parser and is **unmetered**
  here; falsifier: exercise `put-public-wrap-key` + asymmetric import with a tampered blob and assert
  the same rejection ordering holds.

### 1e. The opaque store, the audit log, and object namespacing — METERED

- **METERED — `opaque-x509-certificate` is DER-validated; `opaque-data` is not.** Storing 200 random
  bytes as `opaque-x509-certificate` was rejected ("Couldn't parse DER-encoded certificate"); the same
  bytes as `opaque-data` stored fine. Note this particular validation is *client-side* in `libyubihsm`
  (above the firmware boundary — the right place for a parser, per the Xbox repair-boundary lens: a
  parser bug there is a package upgrade, not a device replacement). The firmware still parses the stored
  DER later, during attestation (§1b) — so the *same object* is validated above the boundary on the way
  in and interpreted below the boundary on the way out.
- **METERED — the audit log is a hash-chained 62-entry ring with a monotonic tick, no wall-clock.**
  `get-logs` returned entries of the form `cmd / length / session-key / target-key / second-key /
  result / tick / hash`, where `hash` chains each entry to its predecessor and `tick` is a device
  counter (`0xffffffff` sentinel on the boot record, then increasing), **not** a timestamp. This
  confirms from a second direction that the device has no clock, and it means log integrity is
  self-verifiable (the chain) but log *time* is not (the tick must be correlated to wall-clock by the
  host at read time — an undeclared trust step worth naming).
- **METERED — the object namespace is (id, type), not id.** An `asymmetric-key` and an `opaque` object
  coexisted at the same ID `0x0200`; that co-residence is exactly what the custom-attestation-template
  mechanism relies on. A design that assumes object IDs are unique is wrong.
- **METERED — reset returns to a single well-known-credential auth key.** After `reset`, the device
  held exactly one object: the factory authentication key labelled "DEFAULT AUTHKEY CHANGE THIS ASAP",
  log reset to `2/62`. Reset is a **destroy-and-return-to-known-credential** operation — cheap, ~seconds,
  no credential required beyond the current session's reset capability — which is the erase-not-extract
  physical/logical property #12178 priced.

### The enumerated surface table

| # | Surface | Command(s) | Channel class | Behind SCP03 auth? | State |
|---|---|---|---|---|---|
| S1 | Device self-description | `Device Info` | input | **NO — pre-session** | **METERED** |
| S2 | SCP03 handshake framing | `Create/Authenticate Session` | input | is the auth | unmetered (framing not fuzzed) |
| S3 | **Attestation template DER** | `Sign Attestation Cert` + opaque template | input | session cap | **METERED (parses + copies)** |
| S4 | **SSH template TLV + cert-request wire format + policy** | `Sign Ssh Certificate` | input | session cap | unmetered (top risk) |
| S5 | Wrapped-object import | `Import/Put Wrapped` | input | **behind CCM auth** | **METERED (rejects tamper)** |
| S6 | Asymmetric-wrap import (BYOK) | `Put Public Wrap Key` + import | input | behind RSA-wrap | unmetered |
| S7 | Opaque X.509 store | `Put Opaque` | input | session cap (client-side DER check) | **METERED** |
| S8 | Audit log read | `Get Logs` | (output; chain integrity) | session cap | **METERED** |
| S9 | OTP AEAD create/rewrap | `Create/Rewrap Otp Aead` | input | session cap | unmetered (not exercised) |

The pattern: the surfaces that parse **session-authenticated but caller-shaped** data (S3, S4, S7) are
the ones that matter, and of those S4 is the deepest. The surface that parses **cryptographically
authenticated** data (S5) is safe by ordering. The **pre-session** surface (S1) is small but real.

---

## 2. USB as an undeclared physical channel

The Xbox note's third class is the physical channel — what the implementation emits that the logical
model does not mention. For a USB-attached root of trust, the threat model must assume the following,
and none of it is hypothetical for this device.

**What the model must assume about a USB-attached HSM:**

1. **The bus is a wire, and the Xbox lesson is that a secret with a wire attached is observable.** The
   YubiHSM's mitigation is that all sensitive traffic is inside SCP03 (end-to-end client↔device AES),
   so the wire carries ciphertext. This is genuinely better than the dTPM case (#12179), where secrets
   cross the LPC/SPI bus in the clear unless the caller opts into encrypted sessions — bus-sniffing a
   BitLocker VMK is a ~$300 documented recipe. **METERED distinction:** the YubiHSM has no plaintext-on-
   bus mode; SCP03 is mandatory for object operations. So the USB channel leaks *traffic analysis*
   (which commands, when, how large — the `tick` and log confirm command boundaries are observable) but
   not key material.
2. **The connector is not a trusted component and performs no caller authentication** (#12178, Yubico's
   own statement). On the NixOS fleet this is the load-bearing point: `yubihsm-connector` claims the USB
   device exclusively and multiplexes; *anything that can reach its listen address can submit bytes to
   the device*, and SCP03 is what stops those bytes doing damage. The connector's listen interface is
   therefore a real part of the attack surface and must be bound to the narrowest possible scope.
3. **Physical possession enables reset (erase), and — below fw 2.4.1 only — EUCLEAK (extract).** This
   device is fw 2.4.1, above the EUCLEAK boundary (established: CVE-2024-45678 affects ≤ 2.4.0, and the
   flaw is below the non-existent firmware-update boundary, so it is replace-only). Reset is free and
   erases; it needs the session's reset capability, not physical disassembly. **The USB port is the
   repair boundary** (#12179 §7a): everything inside the device is below it and unpatchable by design,
   which Yubico states is intentional.

**The decentralized (non-Itron) answer.** The centralized reflex is a broker/hub in front of the
connector that authenticates callers — which is topology T4 in #12178 and, at fleet scale, is the
Itron hub-and-agent shape (US10834144B2, assigned to Itron; citing is free, practicing the mediating-hub
claim is gated, and it is the wrong shape here regardless per
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)).
The portable half of that patent is what the answer keeps:

- **Outbound-initiated, closed command set.** The far side may *name* a command but never *define* one.
  The YubiHSM enforces exactly this in silicon: the command set is fixed (58 commands, S1–S9 above), and
  the one place the far side gets to *define* structure — the template parsers S3/S4 — is the residual
  risk this note isolates. A parser is an open command set wearing a data format's clothes; the
  decentralized design's job is to keep every such parser (a) authenticated, (b) above the repair
  boundary where possible, and (c) minimal.
- **One device per trust domain, not one shared device behind a broker.** #12178's T5. The partition
  that actually works is the physical one, and the roster's n−k wipe budget already pays for multiple
  devices. On the NixOS fleet this means: **the HSM is the node's own root of trust, reached over a
  connector bound to the narrowest local scope, never a fleet-wide key-service hub.** No mediating node
  brokers agent traffic; each node holds its own device and issues for itself (§3).

**METERED support for "no plaintext on the bus":** every object operation I ran required an open SCP03
session; `get-device-info` was the only thing that answered without one, and it exposes metadata, not
keys. That is the boundary between "USB leaks metadata" (true) and "USB leaks secrets" (false for this
device, true for a naively-configured dTPM).

---

## 3. Key custody in a decentralized topology: what hardware attestation means with no central CA

The design direction is *every node is its own identity provider* (2026-08-09): no central STS, cluster
membership derived from the repo, hats grant claims, bindings expire, keys rotate as `+1`/`-1` events on
the `KeyStore` Z-set. The open question that hardware forces: **what does hardware attestation mean when
there is no central CA to terminate the trust chain?**

The measured attestation (§1b) answers it precisely, and the answer is the one PR #10685 and the
self-fabrication note (2026-08-14) already reached from the other side — *every attestation terminates
in some vendor's self-signed key, and that vendor can be us.* Concretely:

- **METERED — the YubiHSM attestation is a signed capability statement, not a verdict.** The emitted
  X.509 carries firmware version, serial, origin, domains, capabilities, object ID, and label as
  checkable OID extensions, signed by the device's attestation key. A verifier receives *evidence it can
  check itself* — which key, with which capabilities, generated on-device (origin), in which domains.
  This is the **anti-DVD-drive property** the Xbox note demands (class 2, trusted peripheral): the
  device returns quotes and measurements, never a boolean "trust me." A decentralized verifier can
  therefore make its own decision from the extensions rather than delegating the verdict.
- **The root is unavoidable, so make it witnessed rather than pretend it is absent.** The built-in
  attestation key chains to Yubico's factory CA — a *third party*. For the custom-attestation path
  (§1b, METERED), the root is a key **we** hold, and the honest statement is the self-fabrication note's:
  self/custom attestation costs *third-party* attestation, not attestation. Integrity stays self-rooted;
  authenticity is rooted in our key, in a log we publish. The decentralized upgrade is to publish that
  root into a **transparency log** (Tillitis uses Sigsum; the shape this repo already wants) and let
  **witnesses stake privacy budget** on custody attestations (2026-08-09) rather than trusting a CA.
- **METERED — the attestation carries no trustworthy time.** `Not After 9999`, no device clock, log
  `tick` is a counter not a timestamp. So **binding expiry cannot come from the device.** This is a
  direct, measured constraint on the "bindings expire" design: expiry must be evaluated against
  *agreed phase*, never the HSM's notion of time (there is none), which is exactly
  [`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
  applied to hardware. The HSM proves *which key with which capabilities*; the cluster's phase-ordered
  fold decides *whether the binding is still live*. Two orders, never crossed.
- **The three-key rotation argument survives the hardware contact.** Without a hub to sequence a
  cutover, rotation needs `previous / current / next` overlap (2026-08-09). The HSM does not change
  this: it holds the key material and attests it, but the *cutover* is still a cluster-phase event, and
  the device's lack of a clock makes the "no synchronizing message" property mandatory rather than
  optional. A rotation that relied on the device knowing the time would be unbuildable — measured.

So hardware attestation with no central CA means: **the device produces checkable capability evidence
rooted in a key we witness publicly; the cluster, not the device, supplies time, membership, and
expiry.** The HSM answers "which key, which capabilities, generated where"; it must never be asked "is
this binding still valid" (it cannot know) or "who is this node" (that is the cluster's IdP fold).

---

## 4. Integration toward the NixOS fleet

The forward target is the custom-hardware NixOS servers. Two existing surfaces are the plug points, and
the parsing findings above bear directly on both.

- **`full-ai-cluster/nixos/modules/ssh-ca.nix`** — an SSH CA trust anchor (`TrustedUserCAKeys`,
  per-machine certs, `principal=zeta` + validity window). The YubiHSM's `Sign Ssh Certificate` (S4) is
  the hardware backing for exactly this: the CA private key lives in the HSM, and the **SSH template
  enforces principal white/black-lists and validity offsets inside the trusted boundary** — so a
  compromised CA *host* cannot mint a cert for an arbitrary principal or an unbounded lifetime, because
  the device refuses it. This is the strongest reason to metered-test S4 next: it is not an abstract
  parser, it is the enforcement point for the fleet's SSH trust. The module today keeps the CA private
  key operator-held (umask 077, never in git); the HSM upgrade moves it below the USB repair boundary.
- **`zeta-self-register` (#12248)** — the marker-is-now-a-receipt self-registration path. A node's
  self-registration is where it would present its **hardware attestation** (§3) as the evidence that its
  key was generated on-device with the claimed capabilities. The attestation's OID extensions (METERED)
  are the checkable content; the receipt is the cluster's phase-ordered acknowledgement.

Neither integration is built here. Both are filed as work items with the parser risk (S4) and the
no-clock constraint (§3) carried forward as design inputs.

---

## 5. What is metered vs unmetered — the honest ledger

Per [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md),
stated plainly: most of the *design* is `unmetered` and several of the *parsing facts* are now
`metered`. The distinction is the deliverable.

**METERED (observation on fw 2.4.1 supports it):**

- Firmware 2.4.1 / serial 39160506 / part 78CLUFX5000P; `get-device-info` answers with no session.
- Attestation emits DER X.509 with Yubico OID extensions (.1–.6, .9) and `Not After 9999` / no clock.
- The firmware parses a caller-supplied DER X.509 template and copies its subject DN into the emitted
  issuer — a DER parser in the trusted path (S3).
- Wrapped-object import is behind AES-256-CCM authentication; a one-byte tamper is rejected (S5).
- `opaque-x509-certificate` store is DER-validated (client-side); `opaque-data` is not (S7).
- Audit log is a hash-chained 62-entry ring with a monotonic `tick`, not wall-clock (S8).
- Object namespace is (id, type); reset returns to a single known-credential auth key.

**unmetered (implemented/documented, falsifier named, not run):**

- SCP03 handshake framing robustness (S2) — falsifier: malformed-cryptogram/truncated-challenge campaign.
- SSH template TLV + cert-request wire-format parsing and the in-firmware policy decision (S4) —
  falsifier: end-to-end signed-request exercise + structured mutation of template and request, response
  asserted per mutation. **Top parser-risk surface.**
- Malformed *attestation* template DER handling (S3 negative path) — I proved well-formed parsing;
  falsifier: DER-mutation campaign against the template object.
- Asymmetric-wrap (BYOK) import parser (S6) — falsifier: tampered asymmetric-wrapped blob, assert same
  auth-before-parse ordering as S5.
- OTP AEAD surfaces (S9) — not exercised.
- Every §3/§4 *design* claim (witnessed root, three-key rotation over HSM-held keys, SSH-CA backed by
  S4, self-register presenting attestation) — `unmetered` design direction; falsifier is a dogfooded
  enrol→issue→expire→rotate loop with the device in the loop, per 2026-08-09's cheapest-test-loop.

---

## 6. Anchors (Beacon) — each checked against the claim it carries

- **Andrew "bunnie" Huang**, *Keeping Secrets in Hardware: The Microsoft XBox Case Study* (MIT AI Lab
  memo / CHES 2002). Carries: the physical-channel class and "a secret with a wire attached is
  observable" (§2). Checked: the memo's tap of the CPU↔southbridge bus is exactly the wire-observation
  claim; it does **not** by itself entail the SCP03-ciphertext mitigation, which is why §2 sources that
  separately to Yubico's transport documentation.
- **Sassaman, Patterson, Bratus & Locasto**, *Security Applications of Formal Language Theory* (LANGSEC;
  IEEE Systems Journal 2013) and *The Halting Problems of Network Stack Insecurity* (;login: 2011).
  Carries: "a parser in the trusted path is an interpreter, and every interpreter is an attack surface"
  (§1, S3/S4). Checked: LANGSEC's thesis is precisely that input-handling code recognizing a nontrivial
  language is where memory-safety and logic bugs concentrate — it entails treating S3/S4 as the primary
  surfaces, and it does not speak to §3's custody design (not cited there).
- **Bellare & Namprempre**, *Authenticated Encryption: Relations among Notions* (ASIACRYPT 2000).
  Carries: the encrypt-then-parse ordering that makes S5 safe (§1d). Checked: their result that
  encrypt-then-MAC yields IND-CCA/INT-CTXT is the formal reason "authenticate before you parse the
  plaintext" is sound; the measured one-byte-tamper rejection is an instance, and the anchor entails
  *why* it is the right ordering rather than merely that it happened.
- **Whiting, Housley & Ferguson**, *Counter with CBC-MAC (CCM)* (RFC 3610). Carries: AES-CCM is the
  specific authenticated mode the YubiHSM wrap uses (§1d). Checked against the device's own algorithm
  list (`aes128/192/256-ccm-wrap`, METERED).
- **Saltzer & Schroeder**, *The Protection of Information in Computer Systems* (Proc. IEEE 1975).
  Carries: complete mediation, least privilege, economy of mechanism (§2, the closed command set and the
  narrow connector scope). Checked: their "economy of mechanism" is exactly the argument for a fixed
  command set and against a mediating broker; least privilege entails the domain+capability model
  #12178 measured. Does not entail the decentralization choice — that is §1/Itron, sourced there.
- **Goguen & Meseguer**, *Security Policies and Security Models* (1982). Carries: noninterference / the
  three-channel "undeclared channel" taxonomy (§1, §2). Checked: it is §13's anchor and the Xbox note's;
  used identically here.
- **Ken Thompson**, *Reflections on Trusting Trust* (CACM 1984). Carries: trust terminates somewhere you
  cannot inspect; the question is only *where* (§3, "the root is unavoidable"). Checked: entails "there
  is always a self-signed terminus," which is the §3 pivot; it does not prescribe the transparency-log
  remedy — that is Tillitis/Sigsum, cited in the 2026-08-14 note this leans on.
- **SPIFFE/SVID** (workload identity; CNCF) — the closer analogue for node-as-IdP without a human,
  carried from 2026-08-09. Referenced as a shape to read, not a checked theorem.

**External sources (public documentation, this session).**
YubiHSM 2 command reference `https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-cmd-reference.html` ·
OpenSSH-host-login SSH template TLV tags `https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-openssh-certs-host-login.html` ·
attestation OID arc `https://docs.yubico.com/hardware/oid/oid-product-arc.html` ·
v2.4 asymmetric-wrap / BYOK release note `https://www.yubico.com/blog/yubihsm-2-v2-4-expands-to-include-simplified-and-secure-backups-and-bring-your-own-key-support/` ·
software release notes `https://developers.yubico.com/YubiHSM2/Releases/Release_notes.html`.

## 7. Pointers

- [`2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md`](2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-and-a-parser-in-the-trusted-path.md) — the three-channel taxonomy this note applies and meters.
- [`2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md`](2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md) (#12178) — the connector-is-not-a-boundary + domain/capability enforcement this builds on.
- [`2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-isolation-architectures-are-inverted.md`](2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-isolation-architectures-are-inverted.md) (#12179) — the unauthenticated-enumeration and repair-boundary framing §1a/§2 reuse.
- [`2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md`](2026-08-09-every-node-is-its-own-identity-provider-repo-as-cluster-hats-grant-claims-bounded-duration-aaron.md) — the custody/rotation/IdP design §3 reconciles with hardware.
- [`2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md`](2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md) — integrity-self-rootable / vendor-is-a-parameter, the §3 root-of-trust argument.
- `full-ai-cluster/nixos/modules/ssh-ca.nix` · `full-ai-cluster/nixos/modules/zeta-self-register.nix` — the two NixOS plug points (§4).
- `tools/setup/persona-keys/frost-hardware-probe.ts` — `probeYubiHsm2`; the existing probe this integration would extend (referenced, not modified here).
- Rules: [`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md) · [`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md) · [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) · [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) · [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md).
