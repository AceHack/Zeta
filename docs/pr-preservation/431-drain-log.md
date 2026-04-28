# PR #431 drain log — drain follow-up to #268: BLAKE3 receipt-hashing v0 issuance_epoch + Amara attribution + parameter_file_sha algo

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/431>
Branch: `drain/268-followup-issuance-epoch-and-attribution`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 3 substantive Codex post-merge findings on
parent #268 (BLAKE3 receipt-hashing v0 design input to Lucent-KSK ADR).
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the substantive
**cryptographic-protocol-design improvements** captured in the post-
merge cascade.

This PR is the **post-merge cascade** to #268 (research: BLAKE3
receipt-hashing v0 design input to lucent-ksk ADR — 7th-ferry
candidate #3). The parent introduced a cryptographic protocol design
for receipt-hashing; the cascade caught three substantive design-
correctness improvements that go beyond formatting / typo cleanups
into real protocol-design content.

---

## Threads — substantive cryptographic-protocol design improvements

### Thread 1 — `issuance_epoch` field added to receipt structure

- Reviewer: chatgpt-codex-connector
- Severity: P1 (cryptographic-protocol design)
- Finding: parent #268's receipt structure (8 fields → 9 fields →
  10 fields across iterations) needed an explicit `issuance_epoch`
  field to bind the receipt to a specific protocol-evolution epoch.
  Without it, a receipt verifier can't determine which epoch's
  signature-validation rules to apply, leaving the receipt
  vulnerable to cross-epoch replay during protocol upgrades.
- Outcome: **FIX (substantive design)** — added `issuance_epoch`
  as a numeric field bound into the signed message. Field count
  went from 8 → 9 with `issuance_epoch`. The signed message
  encoding (via `encode_u32_be`) was updated to include the new
  field. Backdating-limitation section also got 3 mitigations
  (RFC 3161 TSA / Aurora-anchored chained timestamps / forward-
  only registry) per the same Codex review.

### Thread 2 — Amara attribution preservation in parent absorb

- Reviewer: chatgpt-codex-connector
- Severity: P1 (Otto-227 verbatim-preservation + attribution
  accuracy)
- Finding: parent's design had drifted from Amara's original
  proposal in subtle ways during the absorption process; the
  attribution-of-authorship needed to be preserved more clearly,
  noting which design choices were Amara's vs which were Otto's
  refinements to her proposal.
- Outcome: **FIX** — attribution accuracy improved: explicit
  per-design-element attribution (Amara's original proposal vs
  Otto's refinement vs joint synthesis with Aaron's directive).
  Same shape as #430's verbatim-claim accuracy under absorbing-
  side annotation; the 3rd observation of the verbatim-vs-
  annotation pattern.

### Thread 3 — `parameter_file_sha` algorithm specification

- Reviewer: chatgpt-codex-connector
- Severity: P1 (cryptographic-protocol design)
- Finding: parent's `parameter_file_sha` field needed an explicit
  algorithm specification (SHA-256 vs SHA-3 vs BLAKE3); the
  algorithm-agility decision was implicit in the parent text.
  Cryptographic-protocol design needs algorithm-agility to be
  explicit at the field level + tied to `hash_version` for forward-
  compatibility.
- Outcome: **FIX (substantive design)** — added `parameter_file_sha`
  algorithm specification: BLAKE3 by default (matching the
  receipt-hashing primary algorithm); `hash_version` field
  determines the algorithm so future BLAKE3 → BLAKE4 (or BLAKE3 →
  SHA-3 fallback) transitions are clean. Same algorithm-agility
  pattern as `hash_version` field that was added in the parent.

---

## Pattern observations (Otto-250 training-signal class)

1. **Cryptographic-protocol design iterates through fields:
   8 → 9 → 10 fields across review waves.** #268 + #431 + earlier
   waves walked the receipt structure through three field-count
   evolutions:
   - 8 fields (initial)
   - 9 fields (added `hash_version` for algorithm-agility)
   - 10 fields (added `issuance_epoch` for cross-epoch replay
     resistance)
   Each addition fixes a specific adversary class. Pattern: when
   a cryptographic-protocol design surfaces in review, expect
   multiple field-count evolutions before the design stabilizes.
   This is healthy — the absence of these evolutions would be a
   smell that adversary-class enumeration is incomplete.

2. **Algorithm-agility-via-version-field is the standard pattern.**
   `hash_version`, `*_key_version`, and now `parameter_file_sha`'s
   algorithm-tied-to-hash_version all use the same template:
   numeric version field + dispatch on the field at verification
   time. Forward-compatibility comes for free; the verifier knows
   which algorithm to apply based on the version field's value.
   Same shape as Codex CLI's `default_tools_approval_mode` per-tool
   override + the runner-version-allow-list array of pinned
   versions: structural-version-field-driven dispatch.

3. **Per-design-element attribution preservation is a 3rd-
   observation of verbatim-vs-annotation.** #235 + #430 + #431 all
   had the same shape: absorbing side adds annotations / refines
   designs / makes claims about what was preserved verbatim;
   reviewer catches the absorbing-side modifications that aren't
   visibly attributed. Fix template: explicit per-element attribution
   ("Amara's original" / "Otto's refinement" / "joint synthesis with
   Aaron's directive") rather than blanket "preserved verbatim"
   claims.

4. **Real cryptographic-protocol design improvements emerge from
   collaborative Codex review.** #431's findings aren't formatting
   cleanups — they're real protocol-design improvements
   (cross-epoch replay resistance via `issuance_epoch`; algorithm-
   agility via `parameter_file_sha`-tied-to-`hash_version`). Codex
   functioning as a cryptographic-design reviewer is a high-value
   capability surface in this drain corpus.

## Final resolution

All threads resolved at SHA `a7982f8` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
