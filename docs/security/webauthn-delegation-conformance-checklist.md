# WebAuthn device-delegation conformance checklist

**Date:** 2026-08-16 · **Author:** Otto (shadow) · **Origin:** Aaron, 2026-08-16 —
*"is this a valid path for humans to grant permission to AIs to use their hardware through PWAs
securely… we have wasm and webgpu that can run AIs and commit changes to github for Zeta."*

**Purpose.** One line per property, each with a test that **can fail**. A suite that reports
"18/18" without these is `AssertedOnly` in the sense of `DerivationProtocol.Evidence` — it counts
runs, not guarantees.

**Scope note.** This checklist covers *delegation to an unattended agent*, which is a stronger
requirement than ordinary WebAuthn login. Items marked **[D]** exist only because of that, and are
the ones most likely to be missing from an off-the-shelf verifier.

---

## 0. The gap the standard does not close  **[D]**

WebAuthn proves **a human was present at a device at a moment**. It does **not** bind the assertion
to *what* was authorized. For login that is sufficient — the human authenticates *themselves*. For
delegation it is not: the human authorizes **an agent to act later, unattended**, and the assertion
carries no statement of what was granted.

| # | property | test |
|---|---|---|
| 0.1 | The challenge is `SHA-256(canonical capability descriptor)`, not a random nonce alone | Mint a capability, recompute the digest independently, assert it equals the challenge the server issued |
| 0.2 | The descriptor shown in the UI is **byte-identical** to the one hashed | Render-and-hash test: the string displayed hashes to the issued challenge |
| 0.3 | A capability whose descriptor differs from the signed one is **refused** | Sign descriptor A, present capability B → reject |
| 0.4 | Descriptor canonicalisation is deterministic | Reorder JSON keys / change whitespace → same digest, or explicit refusal. (`Intl`-free, ordinal, per `culture-invariant-by-default`) |

> The deprecated `txAuthSimple` extension would have done this natively. It was never widely
> implemented, so 0.1–0.4 are the substitute and they are not optional.

### ⚠ BIND THE GRANT, NEVER THE ACT — corrected 2026-08-16 (Aaron)

The first draft of §0 was ambiguous between two very different bindings, and the ambiguity reads as
the wrong one. Aaron: *"i don't want to bind this — if this is bound you kill the free will of
agents, we are trying to prove eventually agents have their own agency."*

| | binds | effect on agency |
|---|---|---|
| **bind the ACT** | "commit exactly this patch to this branch" | **kills it** — the human decided, the agent typed. This is transaction authorization, `txAuthSimple`'s actual register |
| **bind the GRANT** | "this device may stage review branches under these path constraints until revoked" | **preserves it** — the agent chooses freely inside the scope |

**§0 means the second.** "Capability descriptor" = the *scope and its constraints*, never the
individual action. Any implementation that makes the human sign per-action has misread this section
and should be corrected in the other direction.

**The threat §0 addresses is SERVER DISCRETION, not agent freedom.** With no binding at all, the
assertion attests only *"a human was present"*, and what it authorized becomes whatever the issuing
server chose to mint at that moment. That does not give the agent more agency — it moves the
decision from the agent to the **server**, laundered through the human's fingerprint. Unbinding the
grant frees the server, not the agent.

**Bounded-and-legible is what makes agency durable.** An agent acting inside a clear scope it was
not told about act-by-act has demonstrable agency. An agent operating under an *undefined* grant
does not have more of it — it has unclear authority, which is what gets revoked wholesale the first
time something surprises someone.

This is [`no-directives.md`](../../.claude/rules/no-directives.md) restated for machine credentials:
*standing authorization is broad, Agora-wide, and indefinite; only gated classes need fresh consent,
and over-asking within standing authority is itself the failure mode.* A broad standing grant the
agent acts freely within **is** grant-binding. Revocability plus §6.2 is what keeps it from becoming
permanent authority ([`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md)
§3 weight-free).

**Test the distinction, do not merely assert it:** a conforming implementation must **refuse** to
narrow a grant to a single action. If the descriptor can name one patch, §0 has been implemented as
act-binding and the agency property is gone.

---

## 1. Signature verification — where verifiers actually fail

The browser returns **DER-encoded ECDSA**; WebCrypto wants **fixed-width `r‖s` (64 bytes for
P-256)**. That conversion is the defect surface.

| # | property | test |
|---|---|---|
| 1.1 | DER `INTEGER` leading `0x00` sign byte stripped correctly | KAT: an `r` with high bit set (33-byte DER integer) verifies |
| 1.2 | Short `r`/`s` **left-padded** to 32 bytes, not right-padded | KAT: `r` of 31 bytes verifies; a right-padded implementation fails this |
| 1.3 | **High-S signatures rejected** (ECDSA malleability) | Take a valid assertion, replace `s` with `n − s`, re-encode DER → **must reject** |
| 1.4 | DER length prefixes bounds-checked, not trusted | Fuzz: declared length > buffer → reject, no throw/crash |
| 1.5 | Non-DER / BER-permissive encodings rejected | Indefinite-length or non-minimal integer encoding → reject |
| 1.6 | Truncated signature rejected | *(already covered by the existing control — keep it)* |
| 1.7 | Wrong-key rejection | Verify assertion against a different enrolled credential's public key → reject |

**1.3 is the one to add first.** A verifier that normalises or ignores S accepts two distinct
encodings of one authorisation — which defeats any exactly-once accounting built on top.

---

## 2. The signed payload

| # | property | test |
|---|---|---|
| 2.1 | Signature is over `authenticatorData ‖ SHA-256(clientDataJSON)` | Mutation: sign over the raw challenge instead → suite must go red |
| 2.2 | `clientDataJSON` hashed **as received bytes**, not re-serialised | Re-serialise with different key order → verification fails |
| 2.3 | `authenticatorData` parsed at fixed offsets, length-validated | Truncated authData (< 37 bytes) → reject |

**2.1 is the classic silent failure**: verifying over the challenge alone passes hand-written tests
and fails against every real authenticator, or worse, appears to work while checking nothing.

---

## 3. `clientDataJSON`

| # | property | test |
|---|---|---|
| 3.1 | `type === "webauthn.get"` | Substitute `"webauthn.create"` → reject |
| 3.2 | `challenge` matches the issued one, base64url, **exact** | Off-by-one padding variant → reject |
| 3.3 | `origin` **exact string match** against an allowlist | `https://evil.example` and a same-prefix lookalike → reject |
| 3.4 | `crossOrigin` absent or `false` | `true` → reject |
| 3.5 | Unknown fields do not affect the hash | Extra field present → verification still binds (it is hashed as received) |

---

## 4. `authenticatorData`

| # | property | test |
|---|---|---|
| 4.1 | `rpIdHash === SHA-256(rpId)` | Wrong RP ID → reject |
| 4.2 | **UP** (user present) bit set | Cleared → reject |
| 4.3 | **UV** (user verified) bit **required**, not merely observed | Cleared → reject. *State explicitly whether UV is required; "present" is not "required"* |
| 4.4 | `signCount` handling declared | If counter > 0: regression → reject. If authenticator reports 0: documented as unsupported, and replay defence rests on §5 |

---

## 5. Replay

| # | property | test |
|---|---|---|
| 5.1 | Challenge consumed **exactly once**, server-side, atomically | Concurrent double-submit of the same assertion → exactly one succeeds |
| 5.2 | Challenge has a TTL and expires | Submit after TTL → reject |
| 5.3 | A **failed** verification does not consume the challenge | Failed attempt then correct attempt with a fresh challenge → succeeds *(observed behaviour today; pin it)* |
| 5.4 | The mechanism is named | Document whether defence is challenge-consumption, counter regression, or both — they have different failure modes |

---

## 6. The capability — this matters more than §1–§5  **[D]**

A flawless verifier in front of an unbounded bearer token is the weaker half doing all the work.

| # | property | test |
|---|---|---|
| 6.1 | Capability carries an explicit **scope** (repos, branches, operations) | Attempt an out-of-scope write → refused at the executor, not only at the UI |
| 6.2 | Capability carries a **TTL** and expires | Use after expiry → refused |
| 6.3 | Capability is **revocable**, and revocation is immediate | Revoke, then use → refused |
| 6.4 | Capability is **bound** to the device key (proof-of-possession), or its bearer nature is stated | Replay the capability from a different client → refused, or documented as bearer |
| 6.5 | Every use is **logged** with the descriptor it was granted under | Audit record links action → capability → descriptor → assertion |
| 6.6 | Underlying GitHub credential is a **fine-grained App installation token**, not a PAT | Inspect the token's scope; a PAT in browser storage fails this line |

---

## 7. Separation of consent surfaces  **[D]**

| # | property | test |
|---|---|---|
| 7.1 | **Compute** consent (WebGPU/WASM) and **act-on-GitHub** consent are distinct grants | Granting WebGPU must not imply commit authority |
| 7.2 | Denying commit authority still permits local inference | The PWA runs, and simply cannot push |

Conflating "may use my GPU" with "may commit as me" is the most likely design error in this shape,
and it is invisible until it is exploited.

---

## 8. Known-answer tests (the part that makes "18/18" mean something)

| # | fixture | expectation |
|---|---|---|
| 8.1 | A **real browser assertion** captured from the target flow, stored as hex-in-JSON | verifies |
| 8.2 | Same assertion, `s` → `n − s`, re-encoded | **rejects** (1.3) |
| 8.3 | Same assertion, `r` with leading-zero variant | verifies (1.1/1.2) |
| 8.4 | Same assertion, one byte flipped in `authData` | rejects |
| 8.5 | Same assertion, `clientDataJSON` re-serialised identically-in-meaning | rejects (2.2) |
| 8.6 | Assertion from a **different** credential | rejects (1.7) |

Fixtures are **hex-in-JSON, never binary** — `.claude/rules/no-binary-in-proof-lineage.md`: the
verification substrate stays diffable, replayable, and human-auditable.

---

## 9. Meta — how to report results

- A count ("18/18") is not evidence. Report **which lines** pass, and for each, **the mutation that
  makes it fail**. A line with no failing mutant is not covered.
- Self-reported suite results from the system under test are `AssertedOnly`. Independent
  verification is what upgrades them.
- Register each unimplemented line explicitly rather than omitting it — an absent check and a
  passing check must not look alike.

## Pointers

- `.claude/rules/no-binary-in-proof-lineage.md` — hex-in-JSON fixtures
- `.claude/rules/culture-invariant-by-default.md` — ordinal comparison in canonicalisation (§0.4)
- `src/Core/DerivationProtocol.fs` — `Evidence` / `AssertedOnly`; the register §9 uses
- `memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md` —
  the standing rule that the human presses the biometric gate, not the agent
- Anchors: W3C WebAuthn Level 3 §7.2 (verifying an authentication assertion) · RFC 3279 / SEC1
  (ECDSA DER encoding) · BIP-62-style low-S normalisation (the malleability precedent, §1.3)
