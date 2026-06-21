# Keyring as critical infra: 4lang×4serializer byte-lock (a 4×4 point of certainty), key status (test→self-custody), and human anchor (GitHub + FIDO/WebAuthn/Windows Hello)

**Register:** [grounded] design (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). **Status:** byte-lock seed + TS oracle + status
marking landed; the other oracles/serializers + the FIDO anchor ceremony are the
follow-on (intentional debt).

## Aaron's words

> "we need code around all this 4lang treat code bit perfect stuff cause this is
> critical infrastructure" · "it's one of our 4x4 points of certainty
> markov/homeostat chains" · "4langx4serializer" · "can you mark keys you generate
> as test until they are rotated and somehow the human anchors themselves to
> github and some biometrics or windows hello or fido... github is our first trust
> anchor/bootstrap of trust."

## 1. A 4×4 point of certainty — bit-perfect byte-lock

Key derivation is **critical infrastructure**, so it is a **point of certainty**
(deterministic SolidGround) in the otherwise-soft markov/homeostat system, and it
must hold across the **4×4 grid: 4 language oracles × 4 serializers**:

| | JSON | CBOR | Arrow | protobuf |
|---|---|---|---|---|
| **TS** (bun) | ✅ landed | ◻ | ◻ | ◻ |
| **F#/.NET** | ◻ | ◻ | ◻ | ◻ |
| **C#** | ◻ | ◻ | ◻ | ◻ |
| **Rust** | ◻ | ◻ | ◻ | ◻ |

- **Byte-lock seed:** `tools/setup/persona-keys/golden-vectors-keyring.json` — a
  known BIP-39 test seed → exact public outputs, **text/hex-in-JSON** (per
  `.claude/rules/no-binary-in-proof-lineage.md`: diffable, DST-replayable,
  human-auditable; never a binary blob). The test seed is the publicly-known
  vector (funds swept instantly), safe to commit.
- **Conformance:** every cell of the grid MUST reproduce `expected` **bit-perfect**
  from `input`. `gen.test.ts` is the **TS×JSON** cell (passing: deep-equal +
  determinism). The remaining 15 cells are the conformance matrix to fill (kin:
  the existing `golden-vectors-*.json` for cbor/arrow/merkle; 081KT07NV0008QG0R0032MCYER four-oracle
  multi-format seed doctrine).
- **Culture-invariant:** ordinal/byte-perfect throughout (per
  `.claude/rules/culture-invariant-by-default.md`) — required for 4-lang byte-lock.

## 2. Key status — test until rotated

`keyring-public.json` now carries **`status`**:

- **`bootstrap-test`** — Otto ran `generate`; **the human does not hold the seed**
  (it's in the sink). Provisional — *treat as test*.
- **`self-custody`** — the human ran `rotate` (or `import`) with a seed **they
  hold** (metal/physical). The real, trusted state.

Generate-then-rotate: bootstrap keys start `bootstrap-test`; rotation promotes them
to `self-custody`. Downstream trust consumers should distinguish the two.

## 3. Human anchor — GitHub (first trust root) + FIDO/WebAuthn/Windows Hello

`keyring-public.json.anchors` records how the **human is bound** to the keyring:

- **GitHub — the first trust anchor / bootstrap of trust.** Who can merge the
  pubkeys to `main` is the current root; the maintainer's GitHub identity is the
  anchor we already have.
- **FIDO / WebAuthn / Windows Hello — biometric/hardware anchor.** A passkey /
  platform authenticator (Touch ID, Windows Hello, a FIDO2 key) binds the keyring
  to a real present human. Recorded at **rotate/anchor time** (the `anchors.fido_webauthn`
  field). This is the step that turns "a keyring exists" into "this keyring is
  *that human*."

The anchor ceremony (run a WebAuthn registration, store the credential id +
attestation in `anchors`, optionally require it to authorize rotation) is the
follow-on; the schema field is in place now so the data has a home.

## Pointers

- `tools/setup/persona-keys/{gen.ts,keyring.sh,golden-vectors-keyring.json,gen.test.ts,README.md}`.
- Rules: `no-binary-in-proof-lineage`, `culture-invariant-by-default`; 081KT07NV0008QG0R0032MCYER
  four-oracle multi-format golden-vector seeds; the existing `golden-vectors-*.json`.
- Trust bootstrap = GitHub/main (the identity-trust-network-plane doc); SolidGround
  / points-of-certainty (the Seed kernel); the traveler frame (whose identity these keys are).
