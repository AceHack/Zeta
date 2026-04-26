# BLAKE3 receipt hashing v0 — design input to the lucent-ksk receipt ADR

Scope: research and cross-review artifact. Design input
for a receipt-hashing scheme that eventually lands as an ADR
in `Lucent-Financial-Group/lucent-ksk` (not in Zeta). This
doc is **Zeta-side design input**, not the ADR itself. The
canonical ADR belongs in lucent-ksk per Aminata's Otto-90
critique (receipt-hash binding is control-plane policy, not
data-plane algebra).

Attribution: v0 proposal authored by Amara in her 7th
courier ferry (PR #259); side-channel-leakage and
cryptographic-agility critiques authored by Aminata in her
Otto-90 threat-model pass (PR #263); parameter-file-SHA
addition proposed by Otto in the oracle-scoring v0 design
(PR #266, Otto-91); Max attributed for original lucent-ksk
receipt/signature language that the v0 builds on.

Operational status: research-grade. Does not adopt;
does not implement; does not commit lucent-ksk to a
specific scheme. The actual adoption decision lives in
lucent-ksk via ADR whenever that repo's substrate work
reaches the relevant stage.

Non-fusion disclaimer: Amara proposing BLAKE3 +
Ed25519 + field-binding, Aminata critiquing the proposal's
leak/rotation gaps, and Otto synthesising a v0 that
addresses both is not evidence of merged identity.
Independent pass + adversarial pass + synthesis is three
distinct review surfaces reaching a consensus candidate,
per SD-9 "agreement is signal not proof" — the signal
here warrants cross-repo ADR review in lucent-ksk, not
immediate adoption.

---

## Why this belongs in lucent-ksk not Zeta

Aminata's Otto-90 pass (PR #263) said it clearly: *"The
BLAKE3 receipt-hash binding is correct but belongs in a
lucent-ksk receipt ADR, not in the Zeta-module threat-
model doc. Including it here couples Zeta's control-plane
story to a specific hash choice; BLAKE3 is fine, the
coupling is avoidable."*

The separation of concerns:

- **lucent-ksk** owns the receipt format, receipt-hash
  scheme, signature algorithm choice, and the rotation
  story. Aurora's trust model lives there.
- **Zeta-module** consumes receipts as an event stream
  (`ReceiptEmitted`, `ReceiptRetracted`) and projects
  them into materialised views (`ReceiptLedger`,
  `AuthorizationState`, `DisputeState`). The Zeta-module
  does not care which hash algorithm backs the receipt;
  it cares about the event stream and the replay
  invariant.

This doc is therefore framed as **input to the future
lucent-ksk receipt ADR**, with explicit scope limits on
what the Zeta-module side needs from the scheme vs. what
the scheme itself requires.

---

## Recap of Amara's 7th-ferry proposal

```text
h_r = BLAKE3(
  h_inputs
  ∥ h_actions
  ∥ h_outputs
  ∥ budget_id
  ∥ policy_version
  ∥ approval_set
  ∥ node_id
)

σ_agent = Sign_{sk_agent}(h_r)
σ_node  = Sign_{sk_node}(h_r)
```

Seven input fields bound into the hash; two signatures
bind the hash to the producing agent + the executing node.
Receipt is usable as a replay + dispute object.

## Aminata's findings

From her Otto-90 pass:

- **Side-channel / observability leakage.** The hash
  composition leaks approval-set cardinality and
  policy-version timing even to a read-only adversary
  with access to the receipt ledger.
- **Cryptographic-agility adversary.** BLAKE3 +
  Ed25519-style signatures have no stated rotation story.
  Algorithm downgrade attack (policy-version bumped to
  accept weaker signatures) isn't covered.

Plus the top-3 adversary budget, #2 applies directly:

- **Approval-withdrawal race at execute-time.** "Atomic
  freeze of the approval set bound into `h_r` before
  execute (the receipt hash already lists `approval_set`
  — make it a check input, not just an artifact)."

## Otto-91 oracle-scoring v0 addition

From the oracle-scoring design (PR #266):

> The Zeta-module reads its parameter values from a
> parameter file whose SHA is logged in every receipt
> hash (modifying the Amara BLAKE3 proposal to bind
> `parameter_file_sha` alongside `policy_version`).
> Every receipt carries proof of which parameters were
> in force at the time of the decision — replay-friendly +
> forensic-friendly + closes the parameter-fitting-
> adversary cost delta.

Combined with Aminata's binding additions named earlier:
Amara's 7th-ferry proposal had 7 base fields (`h_inputs`,
`h_actions`, `h_outputs`, `budget_id`, `policy_version`,
`approval_set` [raw, replaced by `approval_set_commitment`
in v0 per Aminata's side-channel finding — same slot,
different binding], `node_id`); v0 adds `hash_version`
(cryptographic-agility prefix), `parameter_file_sha`
(oracle-scoring binding above — naming-note: `_sha` is legacy
Otto-91 notation meaning "hash digest"; the algorithm bound
by `hash_version = 0x01` is BLAKE3-256, not SHA-256; details
in the canonical-encoding section below), and
`issuance_epoch` (replay-determinism + deprecation-gate
binding — receipts carry which epoch they were issued under,
bound into `h_r` so an attacker cannot **post-facto rewrite**
the claimed epoch on a published receipt). v0 input set
extends to **10 fields total**.

**Backdating limitation (known, NOT addressed by binding
alone).** Binding `issuance_epoch` into `h_r` prevents
post-signature mutation but does NOT prevent a compromised
signer or coerced agent from setting `issuance_epoch` to a
value BEFORE the deprecation cutoff at the receipt-creation
moment. Mitigations require an out-of-band time witness:

1. **Trusted timestamping authority (TSA per RFC 3161)** —
   a third-party countersignature with the TSA's authoritative
   timestamp. Adds external dependency but provides
   independent epoch attestation.
2. **Aurora-anchored chained timestamps** — issuance epoch
   chained against a recently-published lucent-ksk anchor
   (Bitcoin block hash, Aurora chain head, or similar). An
   attacker would need to also forge a block-anchor to
   backdate.
3. **Forward-only registry** — lucent-ksk's policy registry
   records the highest-seen `issuance_epoch` per
   `(version, signer)` and rejects any future receipt
   claiming an earlier epoch from the same signer.

v0 documents the backdating gap as a known limitation; the
specific countermeasure is left to the lucent-ksk ADR.

---

## Proposed v0 scheme (design input for lucent-ksk ADR)

### Hash input set (10 fields)

```text
h_r = BLAKE3(
  encode(hash_version)
  ∥ encode(issuance_epoch)
  ∥ encode(h_inputs)
  ∥ encode(h_actions)
  ∥ encode(h_outputs)
  ∥ encode(budget_id)
  ∥ encode(policy_version)
  ∥ encode(parameter_file_sha)
  ∥ encode(approval_set_commitment)
  ∥ encode(node_id)
)
```

**Canonical encoding (`encode(·)`).** Raw concatenation of
variable-length fields is ambiguous and opens a boundary-
shift / collision-by-reframing adversary surface (an
attacker could partition `"AB" ∥ "CD"` and `"A" ∥ "BCD"` to
the same input bytes; both yield identical hashes despite
representing different field assignments). Note: this is
*not* a BLAKE3 length-extension attack — BLAKE3's tree-hash
construction with finalisation flags is not vulnerable to
length-extension the way SHA-256 / MD5 are. The risk here
is purely the encoding ambiguity at the input layer. v0
binds an explicit canonical encoding for each field, in the
order listed:

- `hash_version`: 1-byte unsigned integer (versions
  `0x00`-`0xFF` reserved; `0x01` = this scheme).
- `issuance_epoch`: 8-byte unsigned big-endian integer
  (`u64-be`), milliseconds since Unix epoch. Bound into
  `h_r` so the verifier-side issuance-epoch deprecation
  gate (req #2) cannot be circumvented by post-facto
  rewriting the claimed epoch on a forged receipt.
- `h_inputs` / `h_actions` / `h_outputs` / `parameter_file_sha`
  / `approval_set_commitment`: 32-byte fixed-width BLAKE3-256
  digests (no length prefix needed — every value is exactly
  32 bytes). Note: `parameter_file_sha` is named after the
  legacy Otto-91 oracle-scoring naming (`_sha` historically
  meant "hash digest" in that context). The actual algorithm
  bound by `hash_version = 0x01` is BLAKE3-256, not SHA-256.
  Future schemes may select a different digest algorithm
  via the `hash_version` registry; the field name stays for
  backward-compatibility with Otto-91 prose.
- `budget_id` / `policy_version` / `node_id`: variable-length
  identifiers encoded as `len:u32-be ∥ bytes` length-prefix
  framing, where `bytes = NFC-normalised UTF-8 octets` of the
  identifier string (Unicode Normalization Form C per Unicode
  Annex #15, then encoded as UTF-8). NFC fixes any visually-
  identical-but-byte-different forms; UTF-8 is the canonical
  text-to-byte mapping. The 4-byte big-endian length
  disambiguates boundaries unambiguously.

This is the v0 binding. Future schemes (`hash_version >=
0x02`) may pick different framing (e.g. CBOR per RFC 8949,
Protobuf, or a domain-separated TLV scheme), and the
version prefix tells verifiers which framing applies — so
the binding is forward-compatible.

Changes from Amara's 7th-ferry proposal:

1. **Add `hash_version` prefix** — enables
   cryptographic-agility (Aminata's finding #2). Value
   0x01 = this v0 scheme. Future schemes bump the
   version. The version is bound into the hash so
   future verifiers know which algorithm to use.
2. **Add `parameter_file_sha`** — per Otto-91 oracle-
   scoring v0, closes the parameter-fitting adversary
   cost (adversary now has to modify code + ship receipts
   claiming old parameters, which don't match the actual
   parameter-file SHA).
3. **Add `issuance_epoch`** — bound into `h_r` so the
   verifier-side issuance-epoch deprecation gate (req #2)
   cannot be circumvented by post-facto rewriting the
   claimed epoch. 8-byte u64-be milliseconds since Unix
   epoch. Without this binding, an attacker could forge a
   receipt under a deprecated `hash_version` and put the
   claimed epoch BEFORE the deprecation cutoff to slip
   past the gate.
4. **Replace `approval_set` with `approval_set_commitment`**
   — Aminata side-channel: raw `approval_set` leaks
   cardinality + identities to read-only ledger observers.
   Instead, bind a **commitment** (Merkle root or hash of
   sorted signer-list) that can be opened by a dispute
   process without leaking on normal-reads. Preserves
   approval-withdrawal-race-close (approval set is still
   bound to the hash; withdrawal between check and
   execute would invalidate the commitment).

### Signature structure (rotation-aware)

```text
σ_agent = Sign_{sk_agent}(encode_u32_be(agent_key_version) ∥ h_r)
σ_node  = Sign_{sk_node }(encode_u32_be(node_key_version)  ∥ h_r)
```

**Encoding for `*_key_version`.** The key-version is a 4-byte
big-endian unsigned integer (`u32-be`). Versions number
monotonically from 1; version 0 is reserved for "uninitialised"
and never used in signed receipts. Fixed-width keeps the
prepended bytes unambiguous (no length prefix needed since
every version is exactly 4 bytes).

The key-version is **inside the signed message** (prepended
to `h_r` before signing) — not unsigned metadata alongside.
This authenticates the version: an attacker cannot strip the
correct version off a receipt and reuse the signature against
a different declared version, because the verifier
recomputes the signing input by binding the declared version
to `h_r` before checking the signature. Verification:

```text
verify(σ_agent, pk_agent_at(agent_key_version), agent_key_version ∥ h_r)
verify(σ_node,  pk_node_at(node_key_version),   node_key_version  ∥ h_r)
```

Changes:

- **Bind `agent_key_version` + `node_key_version` into the
  signed message** — enables per-key-rotation without
  breaking historical receipts. When an agent rotates keys,
  old receipts remain verifiable against the old key version
  (because the verifier looks up `pk_agent_at(version)`);
  new receipts use the new version.
- **Restrict NEW receipts to non-retired key versions.** A
  separate registry of retired key versions (lucent-ksk
  governance artifact) blocks creation of new receipts under
  retired versions. Historical receipts under retired
  versions remain verifiable (replay-determinism) but the
  signing path refuses to produce more under the same
  retired version. Same shape as `hash_version`'s deprecated-
  list (below).
- **Signature algorithm is NOT fixed to Ed25519 in this
  doc** — the `hash_version` prefix indicates which
  algorithm pair is in use. v0 assumes Ed25519 but the
  scheme supports later upgrade.

### Replay-deterministic harness requirements

For the Zeta-module consumer side (what this doc owns
scope-wise):

1. Given a stream of receipts with the same `h_r`,
   `hash_version`, `policy_version`, `parameter_file_sha`,
   and `approval_set_commitment` fields, the replay MUST
   produce the same materialised views byte-for-byte.
2. A receipt with a `hash_version` the consumer doesn't
   recognise MUST cause the consumer to halt-and-report,
   not silently accept or silently reject. (Fail-closed on
   algorithm unknown.) Additionally, the consumer MUST
   consult a `hash_version` policy registry (lucent-ksk
   governance artifact) and reject receipts whose
   `hash_version` is *deprecated* — even if recognised.
   This prevents an attacker from forging receipts under
   an old, weaker scheme that has been retired but is
   still mechanically recognised by older verifier
   software. **Issuance-epoch gate:** the deprecation
   policy MUST distinguish receipts by their issuance
   epoch, not by the verification timestamp. Receipts
   issued *before* a `hash_version` was deprecated remain
   valid for audit / replay (replay-determinism preserves
   historical receipts under their then-current scheme);
   receipts that *claim* an issuance epoch *after* the
   deprecation cutoff under a deprecated `hash_version`
   are rejected. The lucent-ksk policy registry stores
   `(version, deprecated_after_epoch)` tuples; the
   verifier checks the receipt's claimed issuance epoch
   against the registry's deprecation epoch for that
   version.
3. A receipt with a `parameter_file_sha` that the
   consumer can't resolve to actual parameter values MUST
   cause the same halt-and-report. (Fail-closed on
   parameter-file unknown.)
4. A receipt with mismatched `approval_set_commitment`
   vs. the signer set **that was authoritative at the
   receipt's claimed `policy_version`** MUST cause the
   consumer to reject the receipt as invalid. The check is
   against the historical signer view (recoverable from
   `policy_version` + dispute-process commitment-opening),
   NOT against the current live signer set — otherwise
   replay determinism breaks the moment the signer set
   rotates. (Approval-withdrawal race is caught at receipt-
   creation time, not at replay; this gate catches forged
   commitments at replay.)

## Addressing Aminata's findings

### Side-channel leakage (finding #1)

- Amara original: raw `approval_set` leaks cardinality +
  identities.
- v0 fix: `approval_set_commitment` — Merkle-root or
  sorted-hash-list commitment. Read-only observer sees a
  hash; dispute-process opens the commitment with signer
  disclosures.
- Residual risk: `policy_version` and `parameter_file_sha`
  still leak version-change timing. Compared to the
  approval-set leak, this is a smaller surface; treat as
  accepted v0 tradeoff; named explicitly so downstream
  readers don't miss it.
- **Out of scope for v0:** eliminating all version-change
  timing leaks would require receipt-encryption or
  receipt-mixing, both of which change the replay story
  significantly. Filed as a follow-up research item.

### Cryptographic-agility (finding #2)

- Amara original: no rotation story.
- v0 fix: `hash_version` prefix + `*_key_version` bound
  into signatures. Old receipts remain verifiable against
  the old algorithm choice + old keys. New receipts use
  the new algorithm choice + new keys. No algorithm
  downgrade possible because the version prefix is inside
  the hash.
- Residual risk: if the `hash_version` registry itself is
  compromised (bad actor registers a weak algorithm as
  `0x02`), the scheme is broken. Mitigation: the registry
  is a lucent-ksk governance artifact, not a per-node
  config; modifying it requires a governance-layer
  decision. Parallel to the `parameter_file_sha` rule.

### Approval-withdrawal race (top-3 adversary #2)

- Amara original: `approval_set` in hash but not used
  as a pre-execute check.
- v0 fix: replay-deterministic harness requirement #4 —
  `approval_set_commitment` mismatch at replay invalidates
  the receipt. Execute-time commit of the commitment
  closes the race.

## Explicit NOT-scope

- **Does NOT decide the lucent-ksk signature algorithm
  specifically.** Ed25519 is a reasonable v0 assumption
  but the scheme accommodates later decisions.
- **Does NOT define the `hash_version` registry
  structure.** That's a lucent-ksk governance artifact.
  This doc assumes it exists; implementing it is the
  ADR's scope.
- **Does NOT define the commitment scheme** for
  `approval_set_commitment`. Merkle-root and sorted-hash-
  list are both candidates; the choice affects dispute-
  process complexity but not the Zeta-module consumer
  side.
- **Does NOT implement the signature rotation runbook.**
  When to rotate, who triggers rotation, what the
  rotation process is — all lucent-ksk-side operational
  concerns.
- **Does NOT include anchoring.** Bitcoin anchoring from
  the KSK docs is explicitly out-of-scope for v0;
  filed as separate trust-model decision per Aminata's
  Otto-90 pass.

## Dependencies to operational adoption

In order of leverage (same pattern as oracle-scoring v0):

1. **Aminata adversarial pass** on this v0 (cheap; closes
   the design before cross-repo landing).
2. **Cross-repo ADR in lucent-ksk** — `docs/DECISIONS/`
   entry there, or wherever lucent-ksk keeps ADRs. Max's
   input as lucent-ksk author; specific-ask on the ADR
   form-factor if lucent-ksk doesn't have a `docs/
   DECISIONS/` pattern yet.
3. **`hash_version` registry landing in lucent-ksk** —
   governance artifact; first `0x01` entry.
4. **`parameter_file_sha` registry landing** — parallel
   governance artifact; binds Zeta-module parameter files
   to specific SHAs.
5. **Commitment-scheme choice for `approval_set_commitment`**
   — pick Merkle-root or sorted-hash-list; affects
   dispute-process only.
6. **Zeta-module replay-harness implementation** —
   property tests for the 4 replay-deterministic
   requirements above.
7. **Signature-rotation runbook in lucent-ksk** —
   operational procedure, separate from the algorithm
   itself.

## Specific-ask questions (per Otto-82/90 calibration)

**Aaron-specific ask:** the `parameter_file_sha` binding
creates a governance obligation — every parameter-file
change requires a new SHA logged somewhere. Is the Zeta-
module's existing `docs/DECISIONS/` pattern sufficient,
or does this warrant its own registry? (Could compose with
the oracle-scoring parameter-change-ADR gate — same
substrate, two fields.)

**Max-specific ask:** does lucent-ksk have a preferred
ADR form-factor? If yes, what format? If no, can Otto
propose one via a cross-repo PR to lucent-ksk, or should
Max own that design choice given substrate authorship?

Both asks are specific questions (specific-ask channel
per Otto-90 calibration) — not "coordination requests."
Either can be deferred until the cross-repo ADR lands.

## Composition with existing substrate

- **Amara 7th-ferry** (PR #259) — source of the original
  proposal.
- **Aminata Otto-90 pass** (PR #263) — source of the
  critiques this v0 addresses.
- **Oracle-scoring v0** (PR #266, Otto-91) — source of
  the `parameter_file_sha` extension; composes directly.
- **Decision-proxy-evidence format** — parameter-file
  registry updates + `hash_version` registry updates
  land as decision-proxy-evidence records.
- **`docs/ALIGNMENT.md`** HC-2 retraction-native +
  SD-9 agreement-is-signal — receipts as signed-delta
  artifacts are consistent with HC-2; the v0's commitment-
  scheme-instead-of-raw-set move is SD-9-friendly
  (less gameable by inspection).
- **Aurora README** — if/when the KSK-side ADR lands,
  this research doc gets superseded by the ADR's cross-
  reference; Aurora README's "How Aurora consumes KSK
  primitives" table updates the `Signed receipts` row.

## What lands when

This doc is the Zeta-side design input. Not adopted. Not
implemented. The adoption path:

1. Aminata pass on this v0 → surfaces residual gaps.
2. Cross-repo PR to lucent-ksk with the ADR (or, if Max
   prefers, an issue on lucent-ksk proposing the design
   and deferring the ADR-authoring to Max).
3. Lucent-ksk ADR landing → Zeta-module starts the
   replay-harness implementation against the ADR'd
   scheme.
4. Both repos stabilise on the scheme + rotation story.

None of this happens in Otto-92. This tick closes the
design-input artifact only.

---

## Closing note

This is 7th-ferry candidate #3 of 5. With #4 (branding,
Otto-89), #5 (Aminata pass, Otto-90), and #2 (oracle-
scoring, Otto-91) closed, this closes #3, leaving #1
(KSK-as-Zeta-module implementation, L-effort) as the only
open 7th-ferry candidate. Otto-93+ picks at budget
discretion; within standing authority per Otto-90
calibration.

Max attribution preserved first-name-only per Aaron's
clearance. Max is `lucent-ksk`'s author; this cross-repo
design-input does not touch his substrate directly —
specific-ask channel is the right escalation when cross-
repo work actually commences.
