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

*None currently.* (The `LossyUdpChannel` NACK amplification entry was fixed 2026-08-13 — bounded by
`MAX_NACK_GAP`, work-item `081KZYP1S96087G0R002G8XQZP`. Its **unfixed residual** did not vanish with
it and is filed below as its own P1/P2 rows, not folded into a completed item.)

---

## P1 — serious

### FROST CA keys and Shamir splits created before 2026-08-14 were generated with `Math.random`

- **Site:** `tools/setup/persona-keys/frost.ts` (`randScalar`), `frost-dkg.ts` (`randScalar`),
  `shamir.ts` (`randCoeff`) — the **defaults**, now fixed; this row is the **residual**, not the code
- **Found:** 2026-08-14 by Nazar (security-operations-engineer), while shaping the `signPartial` port
- **Severity:** P1 (the code defect was P0 and is fixed in the same commit; what remains is that
  material already generated under the old default is weak and code cannot retroactively fix it)
- **Symptom:** every production call site reached the `Math.random` default —
  `frost-ca-custody.ts` passes no `random` to `frostKeygen`, `frostDkgKeygen`, or
  `frostThresholdSign` — so the **CA group signing scalar**, the **Shamir polynomial
  coefficients**, and **every FROST nonce** came from V8's xorshift128+, whose internal state is
  recoverable from its own output. A recovered nonce yields the share directly from
  `z_i = k_i + c * lambda_i * s_i`, and recovered Shamir coefficients collapse the threshold.
- **Fix:** rotate any FROST CA (`~/.config/zeta/ca/frost/<ca>/`) and any Shamir split produced
  before 2026-08-14; re-issue anything signed under the old group key. Code defaults now draw from
  the OS CSPRNG and are guarded by `frost-csprng-default.test.ts` (counts `Math.random` calls).
  The injected `random` door is unchanged, so DST replay is unaffected.
- **Who:** human maintainer — key rotation is a ceremony, not an agent action (Nazar documents,
  never fires it)

### `LossyUdpChannel` retains a `ReceiverBlock` per attacker-chosen `blockSeq` forever

- **Site:** `src/Core.TypeScript/discovery/udp-lossy-transport.ts` (`handleIncoming`, `recvBlocks`)
- **Found:** 2026-08-13 by the shadow, while fixing the NACK amplification P0 (a different defect on
  the same receive path — the *state* side rather than the *reply* side)
- **Severity:** P1 (security — unauthenticated remote memory exhaustion, no ceiling, never freed)
- **Symptom:** a `ReceiverBlock` is created for every unseen `header.blockSeq` (`readUInt32BE`,
  4.29e9 distinct keys), but eviction lives **inside `if (recovered)`** — so packets that never
  complete a block never trigger cleanup. **MEASURED:** 200,000 packets (82 MB inbound) retained
  200,000 blocks and grew RSS by **279,134,208 bytes** — **3.40x**, 1,396 bytes per packet, zero
  evicted. This also fires without an attacker: unrecoverable blocks under heavy loss are exactly
  the blocks that never clean themselves up.
- **Fix:** evict on every packet rather than only on a recovered block, and cap `recvBlocks.size` at
  `RECV_BLOCK_WINDOW` — retaining older blocks is already useless to the [8,4,4] decoder. Range-check
  `blockPos` to `0..7` at the same time (verified harmless today, by accident, not by design).
- **Who:** Kenji (architect). Work-item `081KZYQJPNG087G0R002B9E9S1`.

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

### Reticulum announce authenticity — FIXED at the wire, ON by declaration, and the DHT layer's pair is now bound; RESIDUAL is hop-count replay (bus, shadow*)

**The unsigned-announce hole is closed** (2026-08-21). This entry stays open only for the two
things that genuinely remain; the parts that were fixed are stated so the entry does not
re-report them. The original defect: the Reticulum announce / path-table wire carried the same
class of claim as the discovery-beacon wire ("I am this identity, route to me here") with no
authenticity layer at all, and `dest` was unbound to `zid` on the receive path.

**Why it was load-bearing:** an unsigned announce is an **Eclipse primitive**. A peer that can
announce an identity it does not hold fills a victim's path table with identities the attacker
controls, and the victim's view of the mesh becomes whatever the attacker chose — no routing
geometry fixes that downstream. PR #13456's clean-room routing design independently narrowed the
residual risk of a homogeneous small-world overlay to exactly this identity-side class (Sybil /
Eclipse), so **routing security reduces to announce authenticity**.

- **FIXED — announces are authenticated.** `src/Core.TypeScript/discovery/reticulum-announce-auth.ts`
  is the membrane, built as the direct twin of `beacon-auth.ts` (same keyring, same
  `ace/signing.ts` canonical bytes, same trust-entry shape, same dual-key overlap-window
  rotation ADR — nothing invented). Ed25519 over the canonical bytes of the identity claim
  `(dest, zid)`. A receiver refuses anything that is not authentic to the identity it claims:
  `untrusted-key` · `signature-invalid` · `identity-mismatch` · `dest-not-bound` ·
  `malformed-announce` · `not-signed-envelope`. Verdicts name the **neutral fact**, never an
  intent (dual-use §) — the caller's policy decides whether a refusal is an attack or a
  rotation that has not landed yet.
- **FIXED — the `dest`/`zid` pair check no longer has an escape hatch.** The guard added
  2026-08-02 read `if (a.dest.length === 32 && ...)`, so **any `dest` of another length skipped
  the check entirely**. Verified reachable on the live code before the fix: `{dest: "d1", zid:
  <unrelated>}` folded straight into the path table. Now unconditional.
- **FIXED — the docstring defect.** `:17-20` said "SELF-CERTIFYING ADDRESS"; it now says
  self-**describing**, with the reason recorded inline. Hashing a *public* identifier certifies
  nothing.
- **Measured, and worth keeping in view:** the pair check alone could never have closed this.
  `destinationHash` hashes a **public** identifier, so anyone can mint a pair-consistent
  announce for any zid they have ever seen — confirmed by running it against the pre-fix code.
  Step 1 of the old fix plan ("tone the pair") is necessary address integrity; only the
  signature is identity authenticity.

- **RESIDUAL 1 (P1) — the silent `off` default. CLOSED 2026-08-22, and the residual as filed was
  MIS-SCOPED.** It said four consumers "still default to `announceAuth: {mode:"off"}`" and needed
  routing through `off → dual → required`. Checked rather than inherited: **none of the four
  constructs a Reticulum transport.** `mux-transport-bridge.ts` and `network-transport.ts` mention
  `reticulum-transport.ts` only in a docstring ("composes with"); `dht-discovery.ts` mentions it in
  its header and shares the *concept* of a destination hash without importing it;
  `reticulum-metered-transport.ts` imports `destinationHash` and nothing else — no announce, no
  path table, no frame. Repo-wide, the only `createReticulumTransport` call sites are this module's
  own tests. **The migration as filed had an empty domain**, which is why "route each consumer to
  dual" could not be done as written. What was actually wrong was the *default*, and that is fixed:

  - **`announceAuth` is now a REQUIRED field of `ReticulumConfig`** — no default, silent or
    otherwise. `{mode:"off"}` still typechecks and is still exactly as forgeable as the pre-fix
    wire; what is gone is being able to *inherit* it without writing it down. Every construction
    site now declares its mode, so an unmigrated consumer is visibly unmigrated instead of merely
    looking fine. Done now because it is free now (three test files) and unretrofittable once a
    fleet depends on the default — the argument `.claude/rules/clone-at-tag-stays-sufficient.md`
    makes about `ace`.
  - **The gate now governs the WHOLE FRAME, not just the path fold.** This was a live hole, not a
    tidy-up: the gate guarded `observeAnnounce` and the two other exits ran regardless, so a node
    in `"required"` that REFUSED a forged announce still (a) delivered the frame's payload upward
    attributed to `frame.announce.zid` — an unverified identity handed to the upper layer as the
    sender — and (b) relayed the frame onward, so a node that had itself detected the forgery
    amplified it to every peer it bridges. The relay step's own comment claimed the opposite
    ("under `required` only admitted frames reach here"), and that claim was false when written.
    It is now true by an early return, and pinned in both directions.
  - **Fail-closed at the JS boundary**, mirroring `llmtv-node`'s signer backstop: a caller that
    omits `announceAuth`, or asks for a non-`off` mode with no `verify`, is refused at
    construction. Previously the missing `verify` surfaced as a TypeError thrown from inside the
    packet handler on the first inbound frame — a security surface failing by exception on a
    hostile wire.
  - **The `"off"` negative control is extended, not weakened.** `off` must still capture the
    route, still deliver the payload, and still relay the forgery — all three exits — or the
    control has quietly become a partial gate and stops measuring what "on" buys.
  - **Convergence is now proven under authentication.** The two-node, three-node-relay and
    llmtv-node integration suites run over BOTH modes and assert identical outcomes, so the
    migration's central claim — *authentication changes nothing for honest traffic* — is
    falsifiable. A gate that broke multi-hop relay would pass every forgery test and still be
    undeployable, and "we had to turn it off to ship" is how a control becomes decoration.
  - **Standing guard against re-rot:** `reticulum-announce-auth.adoption.test.ts` refuses any
    *production* call site that declares `{mode:"off"}`. Its quantified claim ranges over ∅ today,
    so two companion tests keep it from being vacuous: one falsifies the predicate against a
    fixture it must catch, one proves the scanner sees the call sites that do exist. A
    `@ts-expect-error` falsifier covers the type-level half — if `announceAuth` ever goes back to
    optional, `tsc --noEmit` fails, and nothing else in the suite could catch that.
- **RESIDUAL 3 (P2, filed 2026-08-22) — `dht-discovery`'s unbound `(dest, zid)` pair. CLOSED
  2026-08-22, precondition met.** As filed: `DhtNode` carried `dest` and `zid` as independent
  fields, `observeNode` never checked `dest === destinationHash(zid)`, and `lookup` folded nodes
  returned by queried peers straight into its shortlist — so a peer answering `foundNodes` could
  seed a querier's routing table with arbitrary pairs. The Site-(A) defect of this entry, on the
  Kademlia wire.

  - **The pair is welded, unconditionally, at both entries.** `classifyDhtNode` is the total,
    pure check (`malformed-node` · `dest-not-bound` — the same word the announce wire uses for the
    same fact, and neither names an intent). `observeNode` refuses before folding and returns the
    table **byte-identically** (same object reference); `lookup` runs every peer answer through
    `admissibleNodes` before anything enters the shortlist. `answerFindNode` is deliberately
    **not** guarded and the reason is in its docstring: everything in the table already passed
    `observeNode`, so a filter there could never fail, and a check that cannot fail is not a check.
  - **No length escape hatch.** The announce-side guard once read `dest.length === 32 && …`, which
    let any other length skip it. The DHT guard has no exemption and a test pins short dests
    (`"8000"`, `"d1"`, `""`) as refused.
  - **The four erasure profiles were RE-DERIVED, not adjusted** — this was the filed precondition
    and it is the part worth reading. The old models pinned "id space to 2 hex characters" over
    deliberately unbound ids (`{dest: "10", zid: "zid-10"}`) — records the guard now refuses, so
    those models described a domain the code can no longer reach. Each was re-run over a **bound**
    pool of real `(destinationHash(zid), zid)` pairs. **Three of the four numbers came back
    identical (6 / 4 / 85), and that is a result rather than an unchanged measurement**: the sweep
    counts how many observation *histories* collapse onto one table, and that count is fixed by the
    bucket/MRU combinatorics over four distinct nodes sharing one bucket at k = 2. Binding
    restricts *which* pairs exist; it does not change how a full bucket forgets or how an
    idempotent refresh collapses two histories. The old model was isomorphic to the new one on
    exactly the structure being measured — which is why its numbers were right about erasure while
    being wrong about the domain. (The `2026-08-18` Landauer research doc cites the 6 and the 4;
    both were re-checked and still hold.)
  - **A FIFTH profile is new, and it is the one the binding actually changed.** It sweeps the
    domain that now *contains* refusals — the bound universe ∪ four impostors, each carrying a
    genuine node's `dest` under a different node's `zid` — and measures the guard itself as an
    erasure: **fibre 85 / 6,409,391 ppm**. 85 is derived, not fitted: it is the count of
    length-0..3 sequences over the 4 impostors (1+4+16+64), all of which land on the empty table
    because a refused record leaves no trace. It is also the guard's own falsifier — **delete the
    guard and the same sweep measures 11**, and the row fails.
  - **Falsifiers:** `dht-discovery.adversarial.test.ts` (21 tests), `dht-discovery.erasure.test.ts`
    (9), `dht-discovery.test.ts` migrated off the unbound literals (12). Both directions
    throughout — a `reject-everything` mutant fails **26** tests, all on the accept side.
  - **What this does NOT close, stated so it is not believed closed.** `destinationHash` hashes a
    **public** identifier, so a pair-consistent record is mintable by anyone for any zid they have
    seen: this is integrity of the **address**, never authenticity of the **identity**. Two things
    are therefore left open and are carried as passing tests rather than comments, so they cannot
    quietly be forgotten: **(a) the DHT wire has no signature layer** — the membrane shape that
    would close it already exists as `reticulum-announce-auth.ts`, and doing it here is a separate
    design, not a hardening pass; **(b) `DhtNode.route` is outside the pair entirely**, so a route
    hint stays attacker-supplied even for a correctly-bound `(dest, zid)`. (b) is latent rather
    than live only because nothing in-repo reads `DhtNode.route` today.
- **RESIDUAL 2 (P2) — hop-count replay.** The signature deliberately does **not** cover `hops`
  or `id`: every relay bumps `hops` (that is how the mesh measures distance), so a signature
  covering it would be broken by the first honest relay and would have to be disabled to ship.
  Consequence: a captured **genuine** announce can be replayed with a **lowered** hop count to
  draw traffic (blackhole / traffic analysis; payload crypto is unaffected). What is closed is
  announcing an identity you do not hold — the Eclipse primitive. What is not is hop-count lying
  by a party already holding a valid announce. **Fix:** per-link authentication, or a signed
  monotonic sequence carried in the **agreed phase / logical order** — explicitly **not** a
  wall-clock freshness window (`.claude/rules/local-time-never-enters-the-shared-fold.md`: two
  nodes with different receive-times would fold different evidence sets and diverge).
- **Claim-class constraint (unchanged, still binding on how this grows):** identity destinations
  take an **exclusive** claim ("I am this identity" — one legitimate announcer, adjudicated by
  signature); object destinations take a **non-exclusive custody** claim ("I can serve this
  shape" — many legitimate custodians, adjudicated by hop count, no crypto). Today every
  destination is identity-bearing (nothing mints shape ZetaIds), so requiring a signature of all
  of them is correct. When addressable objects exist, dispatch on the `Category` nibble — which
  is now safe to trust, because `dest` commits to the whole ZetaId and the receive path checks it.
- **Found:** 2026-08-01 by Otto; **fixed** 2026-08-21 by the shadow (autonomous tick).
- **Falsifiers (2026-08-22 additions):** `reticulum-announce-auth.test.ts` grew to 34 —
  whole-frame refusal at all three exits (payload + relay + fold), the `"dual"` overlap window
  (unsigned admitted and flagged; signed-but-invalid refused and NOT downgraded to the unsigned
  path), the fail-closed construction backstops, and the extended `"off"` control.
  `reticulum-transport.test.ts` runs its convergence suites over both modes.
  `reticulum-announce-auth.adoption.test.ts` is the standing tripwire. Seven further mutations were
  run and all seven refused, each byte-`cmp`-verified as applied before its result was read and
  byte-`cmp`-verified as restored after: gate-always-admits (6 tests fail),
  whole-frame-return-removed (3), outbound-signing-disabled (5), dual-admits-invalid-signature (1),
  construction-backstops-removed (1), adoption-predicate-always-false (1),
  adoption-scanner-returns-empty (2).
- **Falsifiers (original):** `src/Core.TypeScript/discovery/reticulum-announce-auth.test.ts` — 22 tests,
  both directions (a forged announce is rejected AND a genuine one is accepted, so a
  reject-everything validator fails). Seven mutations were run against the fix and all seven were
  refused, each byte-`cmp`-verified as applied before its result was read:
  signature-check-always-true, identity-comparison-always-true, reject-everything,
  dest-binding-always-true, transport-gate-always-admits, restore-the-`length===32`-escape-hatch,
  relay-drops-signature.
- **Mutations (RESIDUAL 3, 2026-08-22):** eleven run, ten refused and one survived and was
  **re-aimed rather than deleted**. Each was byte-`cmp`-verified as applied *before* its result was
  read and byte-`cmp`-verified as restored after. Refused: observeNode-guard-removed (5 tests
  fail), bind-check-always-passes (12), lookup-folds-raw-peer-answer (2), **reject-everything (26,
  all accept-side)**, restore-the-`length===32`-escape-hatch (2), admissibleNodes-refuses-nothing
  (3), shape-checks-removed (1), fifth-profile-declares-the-unguarded-number (1),
  refusal-returns-a-fresh-object (1), fifth-sweep-drops-the-impostors (1). **Survived:**
  dropping `zid` from the erasure render — which had been commented as load-bearing for the fifth
  row. Re-aimed to ask the real question (drop `zid` *and* the guard together): still refused,
  fibre 44 against a declared 85. So the row catches the guard's removal either way and the comment
  was over-claiming; the comment is corrected in place and the measurement recorded there.
- **Who:** discovery/bus owner; Nadia (agent-layer defence) advisory. RESIDUAL 1 and RESIDUAL 3
  closed by the shadow (autonomous ticks, 2026-08-22); **RESIDUAL 2 remains open** and is a
  separate design — do not fold it into a hardening pass.

### Reticulum relay `seenFids` is a grow-only set — memory-exhaustion DoS (bus, shadow*)

- **Site:** `src/Core.TypeScript/discovery/reticulum-transport.ts:158` (`const seenFids = new Set<string>()`)
- **Found:** 2026-07-03 by Otto (bus-doc anti-entropy sweep)
- **Severity:** P1
- **Symptom:** the relay dedup set NEVER evicts, while sibling state has GC (`paths.gc(nowMs, ttlMs)`, `PeerTable.expire()`). A relay accumulates one entry per distinct frame id forever → unbounded memory → OOM; spoofable frame ids (`${dest}:${fidSeq}`) make it trivially floodable. Idempotency §12 only needs a *recent* dedup window, not all-time.
- **Fix:** bound it — time-windowed (add a timestamp to the fid or evict by count) or LRU/ring by insert order.
- **Who:** architect (Kenji) → discovery/bus owner

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

- **Site:** `docs/BUGS.md` + `.claude/skills/workflows/blueprints/bug-fixer.md`
- **Found:** round 21 by Aminata
- **Severity:** P1
- **Symptom:** a poisoned BUGS.md entry could steer the bug-fixer
  procedure ("drop the `Checked` guard" framed as a fix) into
  introducing a vulnerability under the guise of addressing a
  reported bug.
- **Fix:** add a step 2 requirement to `.claude/skills/workflows/blueprints/bug-fixer.md`
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

### `LossyUdpChannel` has one global `expectedSeq` across all peers on a broadcast transport

- **Site:** `src/Core.TypeScript/discovery/udp-lossy-transport.ts` (`expectedSeq`, `handleIncoming`)
- **Found:** 2026-08-13 by Mateo (security-researcher) as the second half of the NACK amplification
  P0; re-filed by the shadow as its own row when the first half was fixed without it
- **Severity:** P2 (loss-signal availability — no amplification, no memory growth, data still flows)
- **Symptom:** `expectedSeq = Math.max(expectedSeq, header.seq + 1)` never decreases, so one spoofed
  `seq = 4294967295` pins it at the ceiling and no honest peer opens a gap again — NACK generation
  is dead for the life of the channel. Related: one counter across interleaved senders means a wide
  gap is not attributable to anyone, which is why the amplification fix reports a local desync
  instead of a NACK past `MAX_NACK_GAP` — and why a >64-packet burst now yields no congestion signal.
- **Fix:** per-peer sequence state. Two one-line mitigations (bounded advance; corroborate-before-
  adopt) were tried on paper and rejected with reasons in the work-item — neither is clearly better
  than the status quo, so this needs its own design rather than a line inside a security patch.
- **Who:** Kenji (architect). Work-item `081KZYQJSW5087G0R001YD83TV`.

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
