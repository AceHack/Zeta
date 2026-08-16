---
id: 081M00QDD20087G0R002A90QT5
type: task
state: backlog
priority: P2
slug: ace-capability-manifest-signed-capability-declaration-naming
title: "ace capability manifest: signed capability declaration naming code, not entity kind"
created: 2026-08-14T18:09:11.744Z
depends_on: []
composes_with: []
---

# ace capability manifest: signed capability declaration naming code, not entity kind

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QDD20087G0R002A90QT5-*.md` glob. -->

## What landed

`src/Core.TypeScript/ace/capability-manifest.ts` — a self-declared, signature-bound capability
declaration on an ace package. Singularity's **manifest** half without its **verified-kernel**
half (integration note §7).

- **Expresses:** what code (`ace:<signer key_id>/<name>`) declares it may touch, in a closed
  `<scheme>:<resource>` grammar with no wildcards.
- **Deliberately does NOT express:** authorization (a declaration is `source`, only a key's
  holder may attach a grant), enforcement (nothing consults it at key-access time), runtime
  identity (bytes at rest only), or a kind of holder (there is no entity scheme — the structural
  form of the `holderKind` removal in `frost-custody-contract.ts`).

**No crypto was added.** `signing.ts` `canonicalManifestBytes` already covers the whole manifest
minus `signature`, so `capabilities` is bound the moment the field exists. Verified empirically
before the module was written.

**Update case (no forced upgrade):** identity is signer+name, invariant under version bump and
content change, so an agent re-signing its OWN code keeps its capabilities with no third party in
the loop. A stranger re-signing the same name gets a DIFFERENT identity and inherits nothing —
`describeUpdate` reports those capabilities as `orphaned` rather than carrying them, because a
mechanism that carried them across would BE the forced-upgrade path (note §6a design test).

**Read by something:** `ace verify` re-verifies the signature (it previously only checked
presence — a check that could not fail) and gained `--capability` / `--require-signature`;
`ace install` gained a capability-declaration gate before extraction.

## Open question 4, resolved

Ace's install-time verification **cannot** support a runtime capability claim, and the gap is not
closeable inside ace. Three reasons, stated as `INSTALL_TIME_VS_RUNTIME`: time-of-check/time-of-use
(the store is ordinary files under the same user as every agent), no process binding (ace has no
notion of a running process, and a PID is not an identity), and the unmeasured interpreter. Ace can
supply the **policy** an external enforcer names; it cannot be that enforcer.

## Not done, deliberately

OS/TPM enforcement (unanswered prerequisites), the grant side (only a key's holder may write one),
wildcards, and capability hierarchy.
