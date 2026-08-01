# Known-Open Bug List

Every unresolved reviewer finding across rounds lives here until
it's fixed, re-scoped, or explicitly declined (in which case it
moves to `docs/WONT-DO.md`). This file is the counterpart to
`docs/BACKLOG.md`: BACKLOG holds *features and research*; BUGS
holds *things that are broken or misleading in shipped code
and docs*.

Entries are current-state. When a bug is fixed, **delete the
entry entirely** — don't leave "fixed in round N" crud. The
fix shows up in `docs/ROUND-HISTORY.md`; this file reads clean.

## Format

Each entry:
```markdown
### <short title>

- **Site:** `file:line` (the authoritative location)
- **Found:** <round> by <reviewer expert name>
- **Severity:** P0 | P1 | P2
- **Symptom:** one sentence — what's wrong
- **Fix:** one sentence — what to do
- **Who:** architect (Kenji) unless specialist is obviously better
```

Kenji (Architect) owns the fixing work. A `bug-fixer` skill
(capability-only, no expert) encodes the procedure; Kenji
invokes it. No "bug fixer expert" persona — the wholistic
view prevents quick hacks that a specialist persona might be
tempted to ship.

---

## P0 — ship-blockers

*None currently.*

---

## P1 — serious

### Discovery-beacon wire is unsigned — spoof / poison / forged-evict (bus, shadow*)

**STATUS (2026-07-03, Otto): membrane SHIPPED + ADOPTED at the live node.** `beacon-auth.ts`
(`signMessage`/`observeSigned`) is the authenticity membrane; `llmtv-node.ts` now runs it via a
`BeaconConfig` windowed migration (`off`/`dual`/`required`) — outbound hello/probeMatch signed,
inbound verified, `dual` accepts signed + legacy-unsigned (signals on legacy), `required` is
signed-only + fail-closed. Signer is opaque (`BeaconSigner`, no raw key material — biometric/HSM-
ready) per Ilyana's public-API review; illegal states unrepresentable (discriminated union). 20
discovery tests incl. spoof/poison/forged-evict/tamper/untrusted-in-dual refusals + the 5 migration
proofs. REMAINING (smaller, tracked): (a) the `maintainers/<name>/` keyring → `BeaconTrust` loader
(impure I/O slice); (b) the operational `dual`→`required` cutover on the real mesh; (c) a captured
envelope is replayable within TTL (freshness not yet signed — needs per-peer seq state).

- **Site:** `src/Core.TypeScript/discovery/discovery-beacon.ts:99-124` (`observe`) — `hello`/`probeMatch` upsert an attacker-supplied `{ep, zid, routes}` into every listener's PeerTable with NO authenticity check; `bye` (l.110-114) deletes a peer by `endpointKey(msg.ep)` with zero auth (one forged `bye` evicts any node from every table).
- **Found:** 2026-07-03 by Otto (bus-doc anti-entropy sweep), Aaron steer ("ais should just do similar/same" as the human auth)
- **Severity:** P1
- **Symptom:** WS-Discovery multicast reborn on the mesh has no auth layer — `decode()` is guarded against crashes but nothing verifies the sender owns the ZetaId/routes it claims. Unauthenticated `bye` IS a forged Z-set retraction (revoke-without-authority).
- **Fix:** REUSE the already-shipped human auth — do NOT invent. Personas share the `tools/setup/persona-keys/` keyring (README: "each traveler — persona **or** human maintainer"). Bind `zid` to the persona keyring pubkey; sign `hello`/`probeMatch`/`bye` with `ace/signing.ts` (Ed25519 over canonical key-sorted JSON, `key_id=ed25519:sha256(SPKI)[..16]`) and verify against a trust-store before upsert/delete; `bye` must be self-signed by the leaving peer. Rotation = the existing dual-key overlap-window ADR (2026-06-15), unchanged.
- **Who:** architect (Kenji) → discovery/bus owner; Nadia (agent-layer defence) advisory

### Reticulum announce wire is unsigned AND `dest` is unbound to `zid` — route hijack + category-confusion downgrade (bus, shadow*)

**The twin of the entry above, on the wire that never got the membrane.** `beacon-auth.ts` hardened
the *discovery-beacon* wire. The *Reticulum announce / path-table* wire is a second, parallel wire
carrying the same class of claim with no authenticity layer at all.

**TWO defects, and the ORDER MATTERS — fixing (B) without (A) verifies nothing.**

- **Site (A) — `dest` is never bound to `zid`:** `src/Core.TypeScript/discovery/reticulum-transport.ts:85-95`
  (`observeAnnounce`) + `:181-183` (frame handler). `destinationHash()` is called at `:154` only —
  where a node computes its *own* dest — and in tests. It is **never** called on the receive path.
  So an `Announce` carries `dest` and `zid` as two independent, never-cross-checked fields, and the
  path table stores `zid: a.zid` under `a.dest` with no established relationship between them.
- **Site (B) — announces are unsigned:** same file. Imports are `createHash` plus two *type-only*
  imports — no auth, no verify. `observeAnnounce` accepts any strictly-lower hop count
  unconditionally (`if (cur && a.hops >= cur.hops) { refresh only }`), so an announce with `hops: 0`
  replaces any existing path. Announces carry `zid` in the clear, so relaying one announce yields
  everything needed to impersonate that destination. Tests cover fold properties
  (idempotent / order-independent / best-hop); **zero adversarial tests**.
- **Found:** 2026-08-01 by Otto (autonomous tick, verifying an unrelated Reticulum claim), Aaron
  steer ("what tones the pair?")
- **Severity:** P1. **Not exploitable today** — no live mesh deployment; latent defect in
  infrastructure with real consumers (`dht-discovery.ts`, `reticulum-metered-transport.ts`,
  `mux-transport-bridge.ts`, `network-transport.ts`).
- **Symptom:** Announce `{dest: H(victimZid), hops: 0}` captures any destination's route — payload
  crypto does not close it (blackhole/denial and traffic analysis survive encryption). Worse, (A)
  makes the *typed* fix bypassable: ZetaIds carry a `Category` nibble selecting how lower bits parse
  (agent vs actor vs shape), and identity-bearing destinations need a signature while inanimate
  shapes have no key to sign with. Dispatch that requirement off `a.zid`'s category while `dest` is
  unbound, and an attacker sends `{dest: H(agentZid), zid: <shape-category zid>, hops: 0}` —
  declares "shape, no signature needed" and walks past the check.
- **Claim-class note (why one rule cannot serve both):** identity destinations take an **exclusive**
  claim ("I am this identity" — exactly one legitimate announcer, adjudicated by signature); object
  destinations take a **non-exclusive custody** claim ("I can serve this shape" — many legitimate
  custodians, adjudicated by hop count, no crypto needed). `observeAnnounce` currently applies
  lowest-hop-wins to both, which is *correct* for objects and *is the hijack vector* for identities.
  No addressable objects exist yet (`roms/chip8/` holds five test fixtures; nothing mints shape
  ZetaIds), so the simple fix is correct today and the split is a constraint on how it may grow.
- **Fix — in this order:**
  1. **Tone the pair.** Reject any announce where `a.dest !== destinationHash(a.zid)`. One line, no
     crypto, no keys. Hashing the whole ZetaId already commits to the category; the receive path
     just never checks the commitment. Without this, steps 2-3 are decorative.
  2. Dispatch on the now-trustworthy `Category` nibble (a bit-parse, free).
  3. Require an Ed25519 signature for identity-bearing categories — **reuse `beacon-auth.ts`, do not
     invent**: same trust store, same `ace/signing.ts` canonical bytes, same dual-key
     overlap-window rotation ADR. Put the membrane in front of `observeAnnounce` exactly as it sits
     in front of `discovery-beacon`'s `observe`. Add the adversarial tests the fold tests lack.
- **Docstring defect (fix alongside):** `:17-20` says **"SELF-CERTIFYING ADDRESS."** Hashing a
  *public* identifier is self-**describing**, not self-**certifying** — real RNS earns
  self-certification from `dest = H(pubkey)` plus signed announces. The word swap states the bug in
  the comment, and predates its discovery. Zeta's divergence (hash the ZetaId, not the key) is
  *deliberate and correct* — it keeps address separate from identity, which `dest = H(pubkey)`
  conflates, and it is what permits key rotation without address churn. Only the verification is
  missing, not the design.
- **Who:** architect (Kenji) → discovery/bus owner; Nadia (agent-layer defence) advisory; Aaron
  (primary source — Itron/Cisco Riva mesh, Wi-SUN contributor) on the routing-hierarchy semantics

### Reticulum relay `seenFids` is a grow-only set — memory-exhaustion DoS (bus, shadow*)

- **Site:** `src/Core.TypeScript/discovery/reticulum-transport.ts:158` (`const seenFids = new Set<string>()`)
- **Found:** 2026-07-03 by Otto (bus-doc anti-entropy sweep)
- **Severity:** P1
- **Symptom:** the relay dedup set NEVER evicts, while sibling state has GC (`paths.gc(nowMs, ttlMs)`, `PeerTable.expire()`). A relay accumulates one entry per distinct frame id forever → unbounded memory → OOM; spoofable frame ids (`${dest}:${fidSeq}`) make it trivially floodable. Idempotency §12 only needs a *recent* dedup window, not all-time.
- **Fix:** bound it — time-windowed (add a timestamp to the fid or evict by count) or LRU/ring by insert order.
- **Who:** architect (Kenji) → discovery/bus owner

### ZetaId base32 cross-verify lacks edge vectors + has two overflow algorithms

- **Site:** `tests/cross-verification/zeta-id/vectors.yaml` (12 happy-path only); `parse` in TS/Py (bigint, post-check `>MASK_128`) vs C#/F#/Rust (u128, pre-guard `firstVal>=8`)
- **Found:** 2026-06-13 by Kira (harsh-critic), Otto anti-entropy sweep
- **Severity:** P1
- **Symptom:** no all-zero / max-128 / first-char-overflow (parse-reject) / lenient-alias vectors — the exact boundaries base32 breaks at, and the only place cross-language divergence would show. The overflow-reject contract is two different algorithms that agree today but are pinned only by reading, not a vector.
- **Fix:** add all-zero, all-ones-128, first-char-overflow-reject, and lenient-alias round-trip vectors asserting uniform accept/reject across all oracles.
- **Who:** architect (Kenji) → falsifier/vector design

### Checkpoint corruption is indistinguishable from absence (round-2 hunt, 2026-06-12)

- **Site:** `src/Core/Checkpoint.fs:124-170` (`FileCheckpointStore.LoadCheckpointAsync`)
- **Symptom:** corrupt/IO-erroring checkpoints return `null` with no signal — a failing disk is
  invisible forever; a corrupt negative `dataLen` still crashes (only `count < 0` guarded).
- **Fix:** validate `dataLen` bounds; surface corrupt-vs-missing (enum/out or logged warning).
- **STATUS (round 3, 2026-06-13): FIXED.** Bounds validated (count and per-section length); `CorruptLoadCount`/`LastCorruptReason` members surface corrupt-vs-missing.

### Durability claims construction-time flagging that does not exist (round-2 hunt, 2026-06-12)

- **Site:** `src/Core/Durability.fs:33-38` vs `createBackingStore` (~:204)
- **Symptom:** comment says the factory flags StableStorage mismatch; it silently returns
  DiskBackingStore — fsync intent gets page-cache semantics, zero runtime signal.
- **Fix:** runtime warning or flag-gate like WitnessDurable.
- **STATUS (round 3, 2026-06-13): FIXED.** Construction-time stderr warning on the StableStorage downgrade.

### GeneratorRegistry idOf second hash lane is correlated (Kira round 2 #15)

- **Site:** `src/Core/GeneratorRegistry.fs:24-30`
- **Symptom:** the second FNV lane folds `ch * 31` of the same bytes — correlated with lane one;
  "128-bit" overstates the effective entropy. `register` accepts collisions; `byId` first-match
  shadows silently.
- **Fix (treaty-scale, NOT a patch):** ids are pinned in cartridges/goldens — changing idOf is a
  coordinated migration (new version, both ids carried). Until then: registry-side collision
  check at registration (cheap, additive), and the lint's resolution gap stays covered by THE
  CATALOG LAW test.

### BloomBench.fs referenced but not on disk

**STATUS (triage 2026-06-12): FIXED.** `bench/Benchmarks/BloomBench.fs` exists and was run (see the TECH-RADAR entry below).

- **Site:** `docs/BUGS.md` and `docs/research/bloom-filter-frontier.md`
  reference `bench/Benchmarks/BloomBench.fs`; the file is
  not present on disk.
- **Found:** round 21 by Imani
- **Severity:** P1 honesty
- **Symptom:** documented-but-absent bench. References to it across
  docs suggest it was expected to land. Until it exists, Bloom
  TECH-RADAR row stays Trial and the P2 "run the bench" entry
  can't close.
- **Fix:** write the bench (scaffold exists conceptually) or remove
  the references.

### Durability.createBackingStore error message is 6 lines of prose

**STATUS (round 3, 2026-06-13): FIXED.** One line + docs/FEATURE-FLAGS.md pointer.

- **Site:** `src/Core/Durability.fs:166-174`
- **Found:** round 21 by Kira
- **Severity:** P1
- **Symptom:** `invalidOp` body spans 6 lines; log-grep wraps badly;
  callers can't match on the prefix. No stable error code.
- **Fix:** one-line message with a pointer to
  `docs/FEATURE-FLAGS.md`. Optional: a new `DbspError.WitnessDurablePreview`
  case so callers can pattern-match instead of string-match.

### RecursiveCounting lacks [<Experimental>] attribute

**STATUS (triage 2026-06-12): FIXED** with the P0 above — attribute on both members; consumers get FS57; deliberate uses carry commented `#nowarn "57"`.

- **Site:** `src/Core/Recursive.fs` (`RecursiveCounting` combinator)
- **Found:** round 21 by Kira + Tariq
- **Severity:** P1
- **Symptom:** the "Known limitation — one-shot seed" docstring
  section warns about multi-tick-seed but only a full docstring
  reader sees it. IntelliSense summaries omit the limitation;
  callers see a `RecursiveCounting` that looks production-ready.
- **Fix:** add `[<Experimental("DBSP_COUNTING_SEMI_NAIVE")>]` to
  the extension method until multi-tick-seed correctness is
  proved or the multi-tick path is removed. Tariq additionally
  recommends a runtime op-graph walk rejecting `Distinct` under
  the feedback cell — that's a separate P2 research item.

### FeatureFlags.isEnabled "O(1)" claim is hand-waved

**STATUS (triage 2026-06-12): FIXED (by removal).** No "O(1)" claim remains anywhere; nothing left to pin.

- **Site:** `src/Core/FeatureFlags.fs:121-127`
- **Found:** round 21 by Hiroshi
- **Severity:** P1 honesty
- **Symptom:** `ConcurrentDictionary.TryGetValue` is amortised O(1)
  on a hit; env-var lookup is O(|environ|) on a miss (Linux does
  a linear scan of `environ`). The repo's "O(1)" framing (implicit
  in the spec's resolution-order scenario) is not pinned honestly.
- **Fix:** pin the actual bound in the docstring: "amortised O(1)
  on a dictionary hit; O(|environ|) on a dictionary miss with an
  env-var lookup." No code change, doc only.

### Agent-file edits (`.claude/agents/**`) uncovered in threat model

**STATUS (round 3, 2026-06-13): FIXED (additive).** `.claude/agents/**` row added to THREAT-MODEL.md; Aminata review welcome on wording.

- **Site:** `docs/security/THREAT-MODEL.md` + `.claude/agents/`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** threat model covers `SKILL.md` edits ("skill supply
  chain") but the `.claude/agents/<name>.md` agent-file path
  from the expert/skill split is not covered. An adversary PR
  could modify Kira's tone contract without touching any
  SKILL.md.
- **Fix:** add a row to the threat model's Tampering table citing
  `.claude/agents/**` as a trust artefact subject to the same
  review gate as `SKILL.md`. Extend any pre-commit hook to cover
  the new path.

### GLOSSARY.md uncovered as trust artefact

**STATUS (round 3, 2026-06-13): FIXED (additive).** Trust-artefacts row (GLOSSARY + BUGS.md) added to THREAT-MODEL.md.

- **Site:** `docs/GLOSSARY.md` + `docs/security/THREAT-MODEL.md`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** GOVERNANCE.md §7 makes the glossary "canonical" for
  shared vocabulary. A PR that poisons a safety term ("durable"
  = "eventually flushed at some unspecified time") propagates
  silently into reviewer judgement the next round. The threat
  model has no entry for GLOSSARY.md as a privileged artefact.
- **Fix:** add a Tampering-class row: glossary edits require
  Architect + second-reviewer approval; Aminata auto-assigned
  to any diff touching a security-relevant term. Codify via
  `.github/CODEOWNERS` on that path.

### BUGS.md itself is an adversary surface for bug-fixer

**STATUS (round 3, 2026-06-13): FIXED.** Provenance check is now step zero of the blueprint; BUGS.md named in the threat model as work-directing.

- **Site:** `docs/BUGS.md` + `.claude/skills/bug-fixer/SKILL.md`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** a poisoned BUGS.md entry could steer the bug-fixer
  procedure ("drop the `Checked` guard" framed as a fix) into
  introducing a vulnerability under the guise of addressing a
  reported bug.
- **Fix:** add a step 2 requirement to `.claude/skills/bug-fixer/SKILL.md`
  — "verify the entry was authored by a known reviewer expert and
  is traceable to a round's review report." Paired with a threat-
  model row noting BUGS.md as an injection surface.

### FeatureFlags has no Stable-stage branch

**STATUS (round 3, 2026-06-13): FIXED.** `isEnabled` has the Stable branch (graduated = ON by default; override/env still win).

- **Site:** `src/Core/FeatureFlags.fs:86-91`
- **Found:** round 20 by Viktor
- **Severity:** P1 (spec drift)
- **Symptom:** `docs/FEATURE-FLAGS.md` documents a Stable
  stage with a one-release warning-only no-op grace period
  (now reduced to "just delete on graduation"). The code's
  `stage` function has no `Stable` case for any flag; a
  flag promoted to `Stable` would fall through to env/meta
  resolution and silently read `false`.
- **Fix:** either add a Stable branch in `isEnabled` that
  returns `true` unconditionally, OR delete the Stable
  stage entirely and document graduation-means-deletion.
*None currently.*

---

## P2 — nice to have

### Z3LawsTests cross-check flakes when CVC5 fails to run (build-and-test intermittent)

- **Site:** `Zeta.Tests.Formal.Z3LawsTests` (the Z3/CVC5 cross-check; BP-16 triage rule)
- **Found:** 2026-07-03 by Otto (CI sweep — observed on #9311's build-and-test, PASSED on #9312's run same day)
- **Severity:** P2
- **Symptom:** several Z3LawsTests fail with `System.Exception: Solver disagreement: Z3 returned Sat, CVC5 returned SolverError "Exit code 1, Stderr: "` — an EMPTY stderr + exit 1 means CVC5 crashed / was unavailable in the runner, i.e. the solver did not run, NOT a genuine logical disagreement. Intermittent (same suite passed hours later), so it non-deterministically reddens `build-and-test` on ubuntu + macos. Not tied to any source change (surfaced on a TS-only PR).
- **Fix:** distinguish "solver unavailable / crashed" (empty stderr, exit≠0) from "solver returned a contradicting verdict" in the cross-check harness — the former should retry-or-skip-with-a-warning (env flake), only the latter is a real disagreement to fail on. Pin/verify the CVC5 binary in the runner. Keep BP-16's fail-on-true-disagreement semantics.
- **Who:** Soraya (formal-verification routing) → cross-check triage owner

### Round-3 filed (Kira r3 + test-gap audit, 2026-06-13) — deferred with reasons

- **CorrespondencePong serve direction/seed:** docstring promises parameters the signature lacks
  (hard-coded rightward serve = structural asymmetry the docs deny). Fix = param + doc; touches
  the apple-message turn protocol — small design decision, Aaron's call on the default.
- **Chip8 DRW edge semantics: FIXED (081KTZ4EF0008QG0R002WVTMMJ, 2026-06-13).** All four oracles now CLIP pixels at
  the right/bottom edge (wrap origin only) — COSMAC VIP reference; locked by an edge-crossing
  golden ROM (right/bottom/corner/color-plane/VF-collision/n=0) byte-identical across F#/C#/TS/Rust.
- **Chip8Cow 00EE on empty stack silently no-ops:** stack underflow is a ROM bug being hidden
  from the trace layer; needs an error register decision (Result vs trace-mark).
- **Chip9Phys.div by zero throws; int cast truncates >32767px:** hot-path exception convention
  decision needed (saturate? Result?).
- **PixelLens.pack masks silently** ("total" reads as no-loss; -1 payload round-trips as 8191):
  doc fix or checked variant.
- **Test-gap audit remainder:** HtmlCssBinding injection falsifier; determinism-lint allowlist
  occurrence COUNTS (width-only exemptions; the contains-disjunct excuse); shine dim-assertions;
  self-agreement family literal pins; FluxView full-suffix + monotone recovery; MediaLines hedged
  dimension contract; healthy() boundary case; hand-written HTML golden fragments.

### MerkleTree.LeafDiff is flat O(N), not the branch-pruning walk its docstring claims

**STATUS (triage 2026-06-12): FIXED.** Docstring now states flat O(N) with the root short-circuit and names the pruning walk as an upgrade, not a description.

- **Site:** `src/Core/Merkle.fs` (`LeafDiff`, ~L134) — docstring says "O(changed + log N) branch-prunes at every matching internal level"; code is a flat loop over the whole leaf arrays.
- **Found:** 2026-06-06 by Lior
- **Symptom:** doc/impl gap — actual cost is O(N) on every diff, not the advertised pruned walk (perf, not correctness).
- **Fix:** implement the recursive top-down walk on the level digests (prune subtrees where `digestA = digestB`), or correct the docstring to O(N).
- **Who:** Naledi / Kenji

### TECH-RADAR row for Bloom sits at Trial without a bench

**STATUS (triage 2026-06-12): FIXED.** Bloom at Adopt (round 40) with measured numbers (`docs/research/bloom-bench-2026-04.md`) and a regression gate.

- **Site:** `docs/TECH-RADAR.md` (Bloom filter row)
- **Found:** round 20 by Hiroshi (complexity-reviewer)
- **Severity:** P2
- **Symptom:** Bloom row is Trial. `bench/Benchmarks/BloomBench.fs`
  exists but hasn't been run to produce numbers. No measured
  FPR / throughput backs the promotion decision either way.
- **Fix:** run the bench, record numbers in
  `docs/BENCHMARKS.md`, promote to Adopt if the numbers match
  the claim.

### `docs/EXPERT-REGISTRY.md` / `docs/CONFLICT-RESOLUTION.md` drift

**STATUS (triage 2026-06-12): FIXED.** CONFLICT-RESOLUTION defers to the registry by name — the prescribed registry-is-canon shape.

- **Sites:** both files
- **Found:** round 20 by Rune
- **Severity:** P2
- **Symptom:** the registry and `CONFLICT-RESOLUTION.md` disagree on
  the expert roster (the registry carries names; `CONFLICT-RESOLUTION.md`
  lists mostly bare role-titles). The declared-pronoun half is
  resolved — the `(she/her)` / `(he/him)` / `(they/them)` markers
  have been removed from `CONFLICT-RESOLUTION.md` per the pronoun-free
  name-canon. Roster reconciliation remains.
- **Fix:** registry is canon for names; `CONFLICT-RESOLUTION.md`
  defers to it.

---

## How to add a bug here

A reviewer (any expert) finds something broken, writes a
finding in their own report. The Architect (Kenji) folds
it into this file with a short title + site + severity.
When it's fixed, the Architect deletes the entry and adds
one line to `docs/ROUND-HISTORY.md` under the round it
shipped.

No stale "fixed" entries linger; no "originally found in
round X" provenance bloat — `ROUND-HISTORY.md` holds the
narrative, this file holds the debt.
*None currently.*
