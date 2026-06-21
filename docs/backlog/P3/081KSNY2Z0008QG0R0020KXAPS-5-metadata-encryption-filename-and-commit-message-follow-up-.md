---
id: 081KSNY2Z0008QG0R0020KXAPS
priority: P3
status: open
title: Metadata encryption follow-up — filename + commit-message encryption; deferred from 081KSNY2Z0008QG0R002JKH50A v1 (content-only) per operator 2026-05-28
effort: L
ask: aaron 2026-05-28 (Q5 decision locked: "just content right now we can think about filename and such later")
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0008EJDW1
  - 081KSNY2Z0008QG0R0030V5ZVS
  - 081KSNY2Z0008QG0R0037X4DP4
tags:
  - metadata-encryption-follow-up
  - filename-encryption
  - commit-message-encryption
  - gitattributes-leak
  - content-only-for-v1
  - deferred-to-follow-up-row
  - operator-decision-locked-2026-05-28
---

## Operator decision 2026-05-28

> *"just content right now we can think about filename and such later and decompose it into backlog"*

Locks Q5 of 081KSNY2Z0008QG0R0037X4DP4 library landscape audit. **Content-encryption only for v1.** Metadata encryption deferred to this follow-up row.

## What metadata leaks in v1

With content-only encryption (081KSNY2Z0008QG0R002JKH50A v1), the following STILL LEAK to anyone with git-read access:

1. **Filenames** — `docs/agent-state/otto/2026/05/28/event-0a3f.json.enc` reveals the path, persona, date, and event-id pattern
2. **Directory structure** — repo layout is visible; `.zeta-private/` directories are obvious
3. **Commit messages** — full prose; cite paths + reasoning + persona + intent
4. **`.gitattributes` patterns** — which paths get the encryption filter is openly visible
5. **Commit metadata** — author, committer, timestamps, parent commits, tree hashes
6. **File sizes** — ciphertext length often correlates to plaintext length (modulo block-cipher padding)
7. **Commit graph topology** — branching + merging patterns leak workflow shape

For Otto's private state (081KSNY2Z0008QG0R0030V5ZVS), most of this is acceptable v1 — Otto's existence is public-known; the content is what needs protection. Multi-recipient cases or sensitive-workflow cases would care more.

## Three encryption layers for full metadata protection

### Layer 1 — Filename encryption (this row's primary scope)

- Directory-blob pattern: entire dirs encrypted as opaque blobs; filenames inside hidden
- Encrypted-manifest pattern: `dir.enc` is encrypted JSON of `{realname → cipher_hash}`; opens to reveal child file list only with decryption key
- Trade-off: breaks git's path-aware operations (rename, move) within encrypted dirs; reviewer can't see "what files changed" at filename level

### Layer 2 — Commit-message encryption (separate substrate)

- Out-of-band store: `commit-msgs/{commit_sha}.enc` lives in separate path; main commit messages become `[encrypted-msg sha:abc123]` placeholder
- Lookup table fetched + decrypted client-side on `git log`
- Trade-off: requires git-side textconv-like filter for log; breaks per-commit operations that depend on message content; new substrate to maintain

### Layer 3 — Directory structure obfuscation

- Single opaque blob per "encrypted scope" (e.g., one `.zeta-private.enc` file at repo root)
- Internal structure inside the blob; git sees just one file
- Trade-off: terrible for git diff (whole blob churns); incompatible with normal git workflow; really only for "this entire scope is encrypted" cases

## What this row tracks

Design + implement Layer 1 (filename encryption) as the primary v2 follow-up to 081KSNY2Z0008QG0R002JKH50A content-only v1. Layer 2 (commit-message encryption) is its own sibling row. Layer 3 (full directory obfuscation) is even-further-out (likely composes with 081KSNY2Z0008QG0R0008EJDW1 content-addressed-store substrate).

## Acceptance criteria (Layer 1 — filename encryption)

- `tools/crypto/better-git-crypt/filename-encryption.ts` — encrypted-manifest pattern (`dir.enc` is encrypted JSON manifest of `{realname → cipher_hash}`)
- Git `clean` filter writes encrypted manifest + ciphertext per file (named by hash)
- Git `smudge` filter reads manifest + decrypts to recover filenames + content
- Git `textconv` filter (per 081KSNY2Z0008QG0R002JKH50A v1 design) extended to handle filename-encrypted dirs
- Tests cover: round-trip with filenames preserved; encrypted-dir survives `git rm`/`git mv` (content-level moves; filename changes within encrypted dir are opaque to git)
- Composes with 081KSNY2Z0008QG0R002JKH50A's recipient-set substrate (filename encryption uses same recipient keys)
- README documents Layer 1 + how it composes with Layer 2 (when authored separately)

## Sibling rows (deferred until activated)

- **B-NNNN Layer 2** — commit-message encryption (out-of-band store + textconv for `git log`)
- **B-NNNN Layer 3** — full directory obfuscation (single opaque blob per encrypted scope)

These ROWS will get specific B-NNNN numbers when activated. Today: just this Layer 1 row.

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate; content-only v1)
- **081KSNY2Z0008QG0R0008EJDW1** (content-addressed-store substrate — when that lands, full-metadata path opens via Option A there)
- **081KSNY2Z0008QG0R0030V5ZVS** (agent private encrypted state — beneficiary)

## Substrate-honest framing

P3 — deferred from v1 per operator decision. Filed for prioritization when needed.

Activation triggers: multi-recipient substrate where filename reveals sensitive workflow shape; compliance/legal requirements for metadata protection; cross-team substrate where path-structure leakage matters.

## Full reasoning

Operator 2026-05-28: *"just content right now we can think about filename and such later and decompose it into backlog"* — explicit defer to follow-up row.

The bound is substrate-honest: ship 081KSNY2Z0008QG0R002JKH50A v1 with content-only for ASAP 081KSNY2Z0008QG0R0030V5ZVS delivery; Layer 1 follows when scope requires.
