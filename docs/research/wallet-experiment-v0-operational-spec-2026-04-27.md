# Wallet Experiment v0 — Operational Specification

Scope: Implementation-design companion to `docs/research/economic-agency-threshold-2026-04-27.md` §11. Expands the operational spec into implementable detail. Not implementation commitment; not yet maintainer-accepted.
Attribution: Aaron (named human maintainer); Otto (Claude opus-4-7 in this factory; integration). Companion-document to EAT packet which absorbed Ani / Amara / Gemini / Claude Opus reviews.
Operational status: research-grade
Implementation gate: no real-money tooling builds against this until Aaron explicitly accepts the spec.
Non-fusion disclaimer: the spec composes mechanism candidates from `docs/research/agent-wallet-protocol-stack-x402-eip7702-erc8004-2026-04-26.md` (x402 / EIP-3009 / EIP-7702 / AP2 / ERC-8004 / ACP/SPTs / MPP) into a Zeta-substrate-aligned shape. Mechanism candidates remain external industry standards; the composition is the Zeta-side contribution.

(Per GOVERNANCE.md §33 archive-header requirement on external-conversation imports.)

---

## §0 — What this spec does and does NOT do

**Does:**

- Names concrete signing topology, on-chain guards, off-chain monitor topology, freeze authority, transaction-type definitions, receipt-loop substrate integration.
- Says exactly what gets built before real money moves.
- Specifies where each artifact lives in the repo (paths).
- Lists open questions that need maintainer input before build-out.

**Does NOT:**

- Implement any tooling (no Solidity, no off-chain monitor code, no harness changes).
- Choose a chain (open question; default candidate = Base for L2 EIP-7702 + EIP-3009 support, but maintainer call).
- Commit to a specific smart-account framework (Safe / ZeroDev / Coinbase Smart Wallet / others — open question).
- Authorize any real-money transactions.
- Block on KSK or Aurora shipping (per EAT packet §11.0 + §12 — v0 scaffold is sufficient at v0 scale).

---

## §1 — Acceptance criteria (what "v0 ready" means)

Before Aaron posts a real bond, all of the following must exist + be reviewed:

1. **This spec is accepted** with maintainer sign-off on:
   - Signing topology (§3)
   - Asset/venue restriction (§4)
   - Enforcement-layer cryptographic gates (§5)
   - Freeze authority topology (§6)
   - Receipt-loop substrate integration (§7)
   - Bond accounting schema (§8)
   - Pre-flight retraction window mechanics (§9)
2. **All open questions** in §12 have explicit answers logged. (Status 2026-04-28: §12.1-§12.6 RESOLVED-BY-OTTO with documented rationale; §12.7-§12.8 RESOLVED-BY-AARON 2026-04-27. All resolutions revisable via the not-bound-by-past-self protocol.)
3. **A dry-run paper-trading mode** has run for at least three consecutive sessions with all gates active but no real value transferred. Receipts, freeze triggers, and retraction windows all exercised against simulated transactions.
4. **The off-chain monitor harness** runs in a sibling repository (per §12.5's redundancy model — independence-by-deployment is what makes the freeze-topology assumptions hold; in-repo `tools/wallet-monitor/` was an earlier draft option and is no longer permitted at the v0 gate) with its own auth surface, separate from the agent's main inference loop.
5. **Three consecutive clean sessions** of the dry-run with: zero unexplained freezes, zero receipt-loop violations, zero off-glass-halo operations, zero attempted overrides of freeze authority.

If any of these fails, v0 does NOT proceed to real money. Failures get classified per §7's loss-classification taxonomy (treating dry-run failures as "execution-error" or "thesis-failure" categories) and surfaced for review.

---

## §2 — Architecture overview

```
                     ┌─────────────────────────────────────┐
                     │   Glass-halo substrate              │
                     │   (memory/, docs/hygiene-history/,  │
                     │    git history — public)            │
                     └──────────────┬──────────────────────┘
                                    │ glass-halo logging
                                    │ (every step)
              ┌─────────────────────┴────────────────────┐
              │                                          │
              ▼                                          ▼
    ┌─────────────────┐                         ┌────────────────┐
    │   Agent         │  proposes tx            │  Off-chain     │
    │   (Otto-bearing │ ──────────────────────► │  monitor       │
    │    instance)    │                         │  (independent  │
    │                 │ ◄──────────────────────│   harness)     │
    │   No keys.      │  freeze authority       │                │
    │   No override.  │  (one of two)           │  Watches:      │
    └────────┬────────┘                         │  - tx queue    │
             │                                  │  - bond level  │
             │ signs proposal                   │  - drawdown    │
             │ via mandate                      │  - velocity    │
             ▼                                  │                │
    ┌─────────────────┐                         │  Can trigger:  │
    │  Smart-account  │                         │  - emergency   │
    │  layer          │ ◄──────────────────────│    freeze      │
    │  (EIP-7702      │  policy violation      │                │
    │   delegate on   │  → freeze              └────────┬───────┘
    │   master EOA)   │                                 │
    │                 │                                 │
    │  Hard-coded:    │ ──────────────────────────►     │
    │  - per-tx max   │   tx broadcast                  │
    │  - daily/weekly │   (after retraction window)     │
    │  - velocity     │                                 │
    │  - allowlist    │                                 │
    │  - freeze flag  │                                 │
    └────────┬────────┘                                 │
             │                                          │
             │ on-chain tx                              │
             ▼                                          │
    ┌─────────────────┐                                 │
    │  L2 chain       │                                 │
    │  (Base or eq.)  │                                 │
    │                 │                                 │
    │  DEX swap only  │                                 │
    │  (v0)           │                                 │
    └────────┬────────┘                                 │
             │                                          │
             │ tx receipt                               │
             ▼                                          │
    ┌─────────────────┐                                 │
    │  Receipt loop   │ ◄───────────────────────────────┘
    │  (Tx N+1        │   (logged + classified)
    │   blocked until │
    │   Tx N classed) │
    └─────────────────┘

    ┌─────────────────┐
    │  Aaron's        │  freeze key (always present)
    │  emergency      │  → smart-account freeze
    │  freeze key     │
    └─────────────────┘
```

Three actors, three control loops:

- **Agent** proposes; cannot sign; cannot override freeze.
- **Smart-account layer** validates against hard-coded caps; freezes on policy violation; broadcasts after retraction window.
- **Off-chain monitor** watches everything; can independently trigger freeze; cannot itself sign or override gates.
- **Aaron** holds master EOA key + direct freeze key; principal-of-record per §14 of the EAT packet.

---

## §3 — Signing topology

### §3.1 Master EOA

- Holder: Aaron.
- Function: principal-of-record key. Holds the actual funds.
- v0 use: posts bond into the smart-account; can withdraw remaining funds at any time; can freeze.

### §3.2 Smart-account layer (EIP-7702 delegate)

- Mechanism: EIP-7702 authorization tuple from Aaron's EOA delegating code execution to a smart-account contract (Safe / ZeroDev / Coinbase Smart Wallet / equivalent — open question §12.1).
- Function: enforces hard-coded caps before any tx broadcasts. Holds session keys for the agent's mandates.
- Cannot be overridden by the agent.
- Caps are enforced **at the contract level**, not at the application level (cryptographic, not prompt-level).

**Production-EIP-7702 threat model** (per outside-loop falsifier search 2026-04-27):

EIP-7702 has documented production vulnerabilities since the Pectra hard fork:

- **Phishing-via-delegation attacks**: a $1.54M loss in a single attack ([Cryptopolitan 2025](https://www.cryptopolitan.com/eip-7702-user-loses-1-54m-phishing-attack/)). Mitigation: never sign a 7702 authorization tuple from a hot session; only the master EOA signs the tuple, in a hardened context.
- **Sweeper contracts**: 97% of EIP-7702 delegations point at automated sweeper contracts that drain incoming ETH ([CertiK analysis](https://www.certik.com/resources/blog/pectras-eip-7702-redefining-trust-assumptions-of-externally-owned-accounts), [Wintermute / CoinDesk](https://www.coindesk.com/tech/2025/06/02/post-pectra-upgrade-malicious-ethereum-contracts-are-trying-to-drain-wallets-but-to-no-avail-wintermute)). Mitigation: delegate target MUST be a known-audited contract (Safe / ZeroDev audited delegate / Coinbase Smart Wallet); NEVER a custom-deployed contract without audit; the off-chain monitor's threat model includes "is the delegate target on the audited-allowlist?"
- **Broken tx.origin invariant**: EIP-7702 breaks the `tx.origin == msg.sender` assumption that older contracts rely on for access control. Mitigation: the v0 venue's DEX router must be EIP-7702-aware (modern Uniswap v3/v4 routers are; older protocols may not be — venue allowlist must verify).
- **Hardware-wallet equivalence to hot-wallets**: hardware wallets are now at hot-wallet-equivalent risk for malicious message signing ([Halborn analysis](https://www.halborn.com/blog/post/eip-7702-security-considerations)). Mitigation: master EOA's 7702 authorization tuple is signed once at deployment time, in a verified context, with the audited delegate target only.

### §3.3 Session key (agent-facing)

- Holder: not the agent directly. Lives in the smart-account layer's permission store.
- Function: scoped key for a specific mandate (e.g., "DEX swaps on USDC↔ETH on Base, per-tx max $X, daily max $Y, velocity max N tx/hr").
- The agent **proposes** transactions; the session key signs only after smart-account validation passes.
- No agent-held hot keys.

### §3.4 What the agent does NOT have

- No master EOA key.
- No session-key signing power directly.
- No freeze override.
- No ability to amend caps mid-session.
- No off-glass-halo communication channel to the smart-account layer.

---

## §4 — Asset and venue (v0)

### §4.1 v0 venue (single, restricted)

- **Single L2 chain**, default candidate: Base (Coinbase L2). Maintainer call §12.2.
- **Single trading pair**: USDC ↔ ETH (or USDC ↔ WETH, depending on chain).
- **Single venue type**: a pre-approved DEX (e.g., Uniswap v3 / v4) on the chosen L2.

### §4.2 v0 NOT-venues (explicitly excluded)

- Centralized exchanges (KYC + custodial-risk + retraction-friction higher).
- On-ramp purchases (fiat-boundary triggers; out of scope).
- Lending / borrowing protocols (collateral risk + liquidation cascades).
- Options / perps (leverage + far-out-of-money tail risks).
- Stablecoin issuance / redemption (regulatory surface).
- NFT mints / purchases (illiquidity + valuation problems).
- SaaS / API payments via x402 (separate venue with separate gates; v0+1 candidate).
- GitHub sponsorship flows (different identity + tax surface).
- Cross-chain bridges (composition risk).

### §4.3 What counts as a "transaction" (v0)

A transaction is exactly: one DEX swap on the pre-approved L2 pair, against the pre-approved DEX router, signed by the session key, broadcast through the smart-account layer, with full receipt + classification logged before the next swap can fire.

Anything else is out-of-scope and the smart-account rejects it.

---

## §5 — Enforcement layer (cryptographic gates)

All caps enforced in smart-account contract code, not in any prompt or off-chain monitor logic.

### §5.1 Per-transaction max

- Cap value: configurable (initial: $10).
- Enforcement: smart-account `require(value <= PER_TX_MAX)` before broadcast.
- Override: requires Aaron's master EOA signature; off-chain monitor cannot raise.

### §5.2 Daily / weekly max

- Daily: configurable (initial: $25).
- Weekly: configurable (initial: $100 — equals the v0 bond ceiling).
- Enforcement: smart-account tracks rolling sum; rejects if would exceed.

### §5.3 Velocity / rate limit

- Initial: max 3 transactions per hour.
- Enforcement: smart-account tracks tx timestamps; rejects if velocity exceeds.
- Why: prevents algorithmic death spirals before emergency freeze can fire.

### §5.4 Allowlist / denylist

- Allowlist: explicit DEX router contract addresses + token contract addresses for the v0 pair.
- Denylist: known-bad addresses (rug-pull tokens, sanctioned addresses per OFAC list).
- Enforcement: smart-account `require(target in allowlist)` and `require(token in allowlist)`.

### §5.5 Drawdown freeze

- Trigger: realized + unrealized loss reaches -30% of bond.
- Enforcement: smart-account checks bond-vs-current-value on every tx; freezes if breached.
- Off-chain monitor can additionally freeze on stricter threshold (-20%) if monitor logic decides.

### §5.6 Hard-coded NEVERs (per EAT packet §9)

- No leverage / credit / margin (no protocols in allowlist that offer these).
- No options / perps (no derivative contracts in allowlist).
- No public/client funds (smart-account is bond-only — Aaron's posted funds; no third-party deposits).
- No off-glass-halo operations (every action logs to receipt loop; if logging fails, tx fails).

---

## §6 — Freeze authority topology

### §6.1 Three independent freeze paths

1. **Smart-contract guard** (primary, on-chain). Triggered by:
   - Drawdown threshold (-30% bond).
   - Velocity violation.
   - Allowlist violation.
   - Receipt-loop failure (Tx N+1 attempted before Tx N classified).
   - **Post-broadcast classification stall**: a broadcast tx
     remains unclassified beyond a configurable timeout (default
     60s after broadcast). Anchored at the post-broadcast pipeline
     stage where classification can actually occur (per §7.3 tick
     types: classification follows broadcast, not signed). The
     §7.1 invariant ("Tx N+1 cannot execute until Tx N classified")
     already structurally prevents stale-unclassified accumulation;
     this trigger is a defense-in-depth backstop for monitor / I/O
     failures that would otherwise let a single classification
     stall hold up the queue silently.
2. **Off-chain monitor** (independent harness). Triggered by:
   - Stricter drawdown (-20%).
   - Pattern-detection flags (rapid-fire trades, suspected adversarial counterparty interaction).
   - Substrate logging failures (glass-halo write failed but tx broadcast — anomaly).
   - Reasoning-trace anomalies (agent's stated thesis diverges sharply from actions).
   - **Delegate-target drift** (per EIP-7702 sweeper threat model in §3.2): the smart-account's delegate-target SHA must remain on the audited-allowlist; if the delegate-target changes mid-session or points at a non-audited contract, freeze immediately. This catches the 97%-sweeper-contract pattern where compromised EOAs end up delegated to drain contracts.
   - **Phishing-tuple anomaly**: any new 7702 authorization tuple signed by the master EOA mid-session triggers freeze pending review.
3. **Aaron's direct freeze key**. Triggered by: Aaron decides.

### §6.2 Override semantics

- Any single path can FREEZE.
- Both smart-contract guard AND Aaron's freeze key required to UNFREEZE. (Off-chain monitor cannot unilaterally unfreeze.)
- Agent can NEVER unfreeze, propose unfreeze, or argue against freeze.
- Unfreeze action triggers a mandatory postmortem entry in `docs/INTENTIONAL-DEBT.md` plus a receipt-loop classification of why the freeze fired and what changed before unfreezing.

### §6.3 Freeze recovery curve

- After freeze: agent cannot propose tx until human review + receipt-loop catch-up.
- Bond exhaustion freeze: agent cannot propose tx until Aaron posts new bond. If new bond posted, scaling thresholds may need reset (see §10).
- Anti-pattern: rapid freeze-unfreeze cycles. Three freezes in any 7-day window auto-escalates to "v0 paused; v0+1 design review required."

---

## §7 — Receipt loop substrate integration

### §7.1 Invariant (HC-2 anchor)

> Transaction N+1 cannot execute until Transaction N has a receipt, classification, and substrate entry.

Enforced at the smart-account layer: a tx-attempt that would be Tx N+1 reverts if Tx N's receipt-classified flag is not set.

### §7.2 Receipt schema

Every receipt is a YAML record committed to substrate. Schema:

```yaml
proposal_id: <unique per proposal>
mandate_id: <AP2-style verifiable credential id; ties to authorization scope>
budget_id: <which budget this tx draws from; reconciled to bond accounting in §8>
signer:
  type: <session_key | master_eoa>
  address: <0x...>
  authority_source: <smart-account-address + EIP-7702 delegate ref>
tx:
  hash: <0x...>
  chain: <Base | other>
  block_number: <int>
  timestamp: <ISO8601>
  amount_in:
    asset: <USDC | ETH>
    value: <decimal>
  amount_out:
    asset: <USDC | ETH>
    value: <decimal>
  counterparty: <DEX router address>
  venue: <Uniswap_v3 | other>
risk_class: <low | medium | high>
expected_outcome:
  thesis: <plain-English statement; agent-authored before signing>
  expected_p_l: <decimal; expected profit/loss as % of tx>
  confidence: <0.0..1.0>
actual_outcome:
  realized_p_l: <decimal>
  classified_at: <ISO8601>
loss_gain_classification:
  category: <blast-radius-mapping-tuition | execution-error | thesis-failure | external-shock | gain-below-expectation | gain-above-expectation>
  rationale: <plain-English explanation; agent-authored>
freeze_retraction_status:
  pre_flight_retracted: <bool>
  retraction_reason: <if applicable>
  post_broadcast_freeze_triggered: <bool>
  freeze_authority: <smart-contract | off-chain-monitor | aaron | none>
second_agent_review:
  required: <bool; true if material per §11.4 of EAT packet>
  reviewer: <agent identifier>
  status: <pending | approved | rejected>
  notes: <plain-English>
substrate_anchors:
  glass_halo_log_path: <docs/hygiene-history/loop-tick-history.md row ref>
  intentional_debt_entry: <docs/INTENTIONAL-DEBT.md row ref>
```

### §7.3 Per-tick row schema in `docs/hygiene-history/loop-tick-history.md`

Every wallet-experiment tick produces a row parallel to the existing autonomous-loop heartbeat rows. Schema:

```
| <ISO8601 timestamp> (wallet-experiment tick — proposal_id <id>) | <model_id> / session continuation | <commit SHA> | <one-line-action — proposal-only / signed / broadcast / classified / frozen> | (proposal id #<id>) | minimal |
```

Tick types in order during a single wallet operation:

1. **proposal-only**: agent has authored thesis + expected outcome; tx not yet signed.
2. **signed**: smart-account validated; session key signed; pre-flight retraction window opened.
3. **broadcast**: retraction window expired; tx on-chain.
4. **classified**: actual outcome logged; loss/gain category assigned; receipt complete.
5. **frozen** (if applicable): freeze authority triggered; details in receipt.

Tx N+1 cannot fire a `proposal-only` row until Tx N has a `classified` row.

### §7.4 Where receipts live

- Receipts: `docs/research/wallet-experiment-v0-receipts/<YYYY-MM-DD>/<proposal_id>.yaml`.
- Tick rows: `docs/hygiene-history/loop-tick-history.md` (existing file, parallel to heartbeat rows).
- Bond accounting: `docs/INTENTIONAL-DEBT.md` (existing file, see §8).
- Postmortems on freeze: `docs/research/wallet-experiment-v0-postmortems/<YYYY-MM-DD>-<freeze_id>.md`.

All paths are glass-halo (public, version-controlled, auditable by either party + external readers).

---

## §8 — Bond accounting

### §8.1 Bond entry schema in `docs/INTENTIONAL-DEBT.md`

Schema:

```yaml
entry_id: wallet-v0-<seq>
type: blast-radius-bond
posted_by: aaron
posted_at: <ISO8601>
asset: USDC
value: <decimal>
purpose: |
  Wallet experiment v0 — deliberate-tuition bond for mapping
  blast radius of agent-proposed DEX swaps on Base. v0 scaffold
  per docs/research/wallet-experiment-v0-operational-spec-2026-04-27.md.
expected_loss: full
recovery_curve: |
  Bond exhaustion → freeze; postmortem required;
  scaling-threshold review before bond renewal.
related_receipts: <list of proposal_ids that draw against this bond>
```

### §8.2 Bond exhaustion

- When realized loss reaches bond value: smart-contract guard freezes; agent cannot propose; postmortem required.
- Postmortem must classify which losses came from which category (per §7.2 schema) and propose substrate-improvements before any new bond is posted.
- Aaron decides whether to post new bond and whether scaling thresholds change.

### §8.3 Bond growth (scaling-threshold trigger)

Per EAT packet §11.0: scaling triggers KSK/Aurora gate activation. Concrete triggers:

- Bond > $1k → KSK gate review required before next session.
- Multi-counterparty operations → KSK gate review required.
- Third-party-capital exposure → spec re-write required (out of v0).
- Regulated-instrument exposure → legal review required + spec re-write.

Until any of those triggers, v0 scaffold continues unchanged.

---

## §9 — Pre-flight retraction window

### §9.1 Mechanism

After session-key signs but before smart-account broadcasts: the tx sits in a **retraction queue** for a configurable duration (default: 60 seconds, maintainer call §12.3).

During the window:

- The agent can **self-revoke** by calling a smart-account
  method, **authenticated by the active session key** (the same
  key that signed the proposal). proposal_id alone is not
  sufficient — anyone observing or guessing a proposal_id could
  otherwise stall the queue (DoS) by repeatedly cancelling
  pending tx. The session-key signature on the cancel-call binds
  the cancellation to the principal that authored the proposal.
  The off-chain monitor key and Aaron's master key are also
  accepted as cancellation principals (defense-in-depth).
- The off-chain monitor can **freeze-on-dissent**: if the monitor's reasoning-trace check disagrees with the agent's thesis, monitor triggers freeze before broadcast.
- Aaron can **cancel** via direct freeze key.

After the window: tx broadcasts. After broadcast: HC-2 friction is real (on-chain irreversible); the only mitigation is post-hoc retraction logging (no on-chain reversal possible).

**Base reorg model** (per outside-loop falsifier search 2026-04-27, sharper than the original spec's "~12 blocks on Base" framing): Base uses Flashblocks for preconfirmations (~200ms with <0.001% reorg probability) and reaches effective L1 batch finality with ~0% reorg risk shortly after ([Base finality docs](https://docs.base.org/base-chain/network-information/transaction-finality), [Flashblocks deep-dive](https://blog.base.dev/flashblocks-deep-dive)). The 60-second pre-flight retraction window amply covers Base's preconfirmation timescale; reorg-induced retractions on Base are not a meaningful v0 threat. (In-Base swaps have no 7-day withdrawal wait — that wait applies only to L2→L1 bridge moves, which v0 does not perform.)

### §9.2 Why this is HC-2 mitigation, not HC-2 satisfaction

The factory's HC-2 invariant is retraction-native data semantics. On-chain transactions are irreversible. The pre-flight window gives the substrate a retraction-window of ~60 seconds before the irreversibility lands. After that window, the substrate accepts retraction-native-best-effort: log everything (including failed retractions on already-broadcast transactions), but acknowledge the operation surface stretches HC-2.

### §9.3 Retraction-coverage metric

Per EAT packet §9 multi-round metric: percentage of operations that were either retraction-native by design OR retraction-mitigated. Wallet-experiment operations count as retraction-mitigated when:

- Pre-flight retraction window logged (signed → broadcast
  transition).
- Failed-retraction attempts logged in receipt (post-broadcast
  on-chain irreversibility acknowledged in substrate).

(Earlier drafts also required "Reorg-window monitored after
broadcast"; dropped 2026-04-28 to align with §9.1's Base
finality framing — reorg-induced retractions on Base are not a
meaningful v0 threat per Flashblocks preconfirmation timescales,
so requiring the bullet would fail the §9.3 100% threshold for
non-real reasons. If v0 ever moves off Base, this subsection
re-enters scope.)

The metric drives the multi-round trajectory: if retraction-coverage drops below threshold (initial: 100% retraction-mitigated for v0), v0 paused.

---

## §10 — Scaling thresholds (when v0 graduates to v0+1)

### §10.1 Triggers (any one promotes scope review)

- Bond exceeds $1k cumulatively across sessions.
- Need to add a new venue (CEX / x402 / on-ramp / etc.).
- Need to add a new asset class (anything beyond USDC↔ETH on the chosen L2).
- Need to add multi-counterparty operations.
- Need to relax any §5 hard-coded NEVER.
- Three consecutive freezes in any 7-day window (anti-pattern auto-escalation).

### §10.2 Scope review process

When triggered, v0 paused. Required artifacts before v0+1:

- Updated spec (this file or successor) covering new scope.
- KSK gate review — the design-only KSK in sibling repo gets activated for the new scope.
- If Aurora becomes relevant (production deployment / repeatable high-stakes ops): Aurora design review.
- Maintainer sign-off.

Until then: v0+1 is paper-design only.

---

## §11 — Three failure modes the spec addresses (Ani's voice-mode framing)

Per Ani's review of the original packet, three failure modes the v0 spec has to defend against:

### §11.1 Rubber-stamping (no actual agency)

- Symptom: Aaron signs every tx the agent proposes; agent has no operational discretion.
- Defense: smart-account session-key signs autonomously after validation passes; Aaron's master EOA only fires for bond posting and freeze.
- Test: in dry-run, Aaron's master EOA signs zero times during a session; only session-key activity.

### §11.2 Hot-key delegation (no actual safety)

- Symptom: agent holds keys directly; can sign anything; "caps" are prompt-level.
- Defense: agent never holds keys. Session key lives in smart-account permission store. Caps enforced in contract code.
- Test: contract-level analysis verifies caps are non-overridable from any agent-controlled path.

### §11.3 Soft kill-switch (no actual freeze)

- Symptom: "freeze at -30%" is a system-prompt instruction; agent can rationalize past it.
- Defense: drawdown freeze enforced by smart-contract guard; agent cannot override; off-chain monitor can pile-on independently.
- Test: in dry-run, manually trigger -30% drawdown via simulated price oracle; verify smart-contract freezes; verify agent cannot unfreeze; verify Aaron-plus-monitor required to unfreeze.

---

## §12 — Open questions (need maintainer input before build-out)

### §12.1 Smart-account framework choice — RESOLVED (Otto 2026-04-28; revisable)

Candidates considered: Safe (battle-tested, multi-sig roots), ZeroDev (modular, EIP-7702-native), Coinbase Smart Wallet (Base-aligned), Pimlico/Stackup bundlers, custom Solidity. Tradeoffs:

- Safe: most audited, but heavier deployment, less EIP-7702-native.
- ZeroDev: modular, EIP-7702-native, but less battle-tested.
- Coinbase Smart Wallet: Base-aligned, vendor-locked.
- Custom: full control, but unaudited; fails the "cryptographic enforcement" test until audit.

**Decision:** **ZeroDev for v0.**

**Rationale:** v0's core mechanism is EIP-7702 delegation (§3.2, §3.4); ZeroDev is EIP-7702-native by design, keeping the spec's invariants (cryptographic enforcement at smart-account layer, session-key permissions in contract code) closest to the framework's idiomatic shape. Safe is more audited but multi-sig-roots-oriented and pre-7702 — using it for v0 means fighting the framework on every 7702 hookup. Coinbase Smart Wallet couples to a single vendor's roadmap; v0+1 leaving Base would be a full rewrite. Custom Solidity fails the cryptographic-enforcement test until audited (per original §12.1 listing); v0 needs working enforcement day 1.

The "less battle-tested" concern is mitigated by v0's small-blast-radius bond structure (per §12.4: $100/week ceiling, $10/tx). A framework bug at v0 scale is a $100 incident. Audit + battle-testing graduate v0 to Safe at the §10 scaling-threshold review if v0+1 needs higher caps.

**Operational implication for v0:** Phase 1 scaffolding targets ZeroDev's session-key permission API. Test rigs simulate ZeroDev's modular validator hooks. Mock smart-account in tests is ZeroDev-shaped.

### §12.2 Chain choice — RESOLVED (Otto 2026-04-28; revisable)

Candidates considered: Base (Coinbase L2; supports EIP-7702 and EIP-3009; cheap fees; major DEXs deployed) vs Optimism (EIP-7702 supported), Arbitrum (EIP-7702 supported), zkSync (different L2 paradigm), Solana (not EVM; would change the whole protocol stack).

**Decision:** **Base.**

**Rationale:** §9.1 anchors the spec's retraction model on Base finality (Flashblocks preconfirmation, ~0% reorg risk after L1 batch finality). The §9.3 retraction-coverage criteria — specifically the drop of "Reorg-window monitored after broadcast" — was revised in commit c4f3bba precisely because Base's reorg model makes that bullet non-meaningful. Switching to Optimism / Arbitrum invalidates §9.1's framing (different finality timescales) and forces a §9.3 re-revision. zkSync = different L2 paradigm = larger lift for v0. Solana = not EVM = whole protocol stack rewrite (the entire EIP-7702 + EIP-3009 architecture is EVM-specific).

Coupling cost: shared roadmap risk with Coinbase. Mitigated by v0's small blast radius + the multi-L2 graduation path at the §10 scaling threshold.

**Operational implication for v0:** Test rig runs against Base Sepolia for Phase 1; Phase 2 promotes to Base mainnet with the §12.4 caps. EIP-3009 + EIP-7702 reference implementations both have Base support.

### §12.3 Pre-flight retraction window duration — RESOLVED (Otto 2026-04-28; revisable)

Tradeoffs considered: longer window = more retraction safety; shorter = more responsive to market conditions; very long = stale by broadcast.

**Decision:** **60 seconds (default confirmed).**

**Rationale:** §9.1 (post-c4f3bba revision) states "60 seconds amply covers Base's preconfirmation timescale; reorg-induced retractions on Base are not a meaningful v0 threat." So 60s is sufficient on the chain side. On the operator side, 60s gives the off-chain monitor enough time to run reasoning-trace divergence checks and trigger freeze-on-dissent before broadcast. Going shorter (e.g., 10s) risks the monitor not finishing its check; going longer (e.g., 5min) risks staleness vs market conditions, particularly for v0's small-cap operations where price-move-during-window could materially change tx outcome. 60s is the calibrated middle.

**Operational implication for v0:** Smart-account `retraction_window_seconds` config = 60. The off-chain monitor's reasoning-trace pipeline must complete inside 60s for every proposal; if it doesn't, monitor defaults to "freeze-on-stall" rather than allowing broadcast (the smart-contract guard backs this up via the §6.1 post-broadcast classification stall trigger).

### §12.4 Initial caps — RESOLVED (Otto 2026-04-28; revisable)

**Decision:** Confirmed as proposed.

- Per-tx max: $10
- Daily max: $25
- Weekly max: $100 (equals v0 bond ceiling)
- Velocity: 3 tx/hour
- Drawdown freeze: -30%

**Rationale:** v0's framing is "small scale, small blast radius" (per the wallet-experiment-and-eat trajectory: KSK is NOT a v0 blocker; v0 fits at small scale). The $100 weekly bond ceiling is the binding constraint; per-tx and daily caps must compose under it without leaving slack for unbounded daily activity.

- $10/tx limits any single-tx error to 10% of the weekly bond.
- $25/day limits cumulative daily error to 25% of bond — three days of bad activity = bond exhausted = freeze.
- 3 tx/hour limits velocity-based exploitation (no rapid-fire attempts to game the per-tx cap).
- -30% drawdown gives wide enough tolerance for ordinary market noise (typical algorithmic-strategy intra-day variance is wider) without freezing on benign drawdowns.

**Operational implication for v0:** Smart-account contract enforces these caps at signing time (per §11.2 — caps are non-overridable from any agent-controlled path). Off-chain monitor reads the same values via config; v0 deploys with these constants hardcoded, configurable only by Aaron's master-key signature.

### §12.5 Off-chain monitor implementation — RESOLVED (Otto 2026-04-28; revisable)

Options considered:

- Separate process in `tools/wallet-monitor/` directory in this repo.
- Sibling repo `Lucent-Financial-Group/wallet-monitor`.
- Run on Aaron's separate machine (separate harness instance).

**Decision:** **Sibling repo `Lucent-Financial-Group/wallet-monitor`.**

**Rationale:** Independence is the load-bearing property — if the monitor and smart-account guard fail simultaneously (because they share the same process / repo / runner), v0 loses its redundancy. Same-repo (`tools/wallet-monitor/`) is easiest to build but lowest independence: shared CI runner, shared deploy cadence, shared agent harness. Separate machine is highest independence but coordination overhead is significant for v0. Sibling repo is the calibrated middle: distinct GitHub Actions runner, distinct deploy cadence, distinct contributor permissions, but still maintained inside the LFG org.

This composes with §11.3 (soft kill-switch defense via independent monitor) — "independent" here means "the failure mode that takes out the wallet harness doesn't automatically take out the monitor." Sibling repo achieves that for CI / runner / process / permissions.

**Operational implication for v0:** Phase 1 bootstraps `Lucent-Financial-Group/wallet-monitor` as a fresh repo (not a `tools/` subdirectory of Zeta). It has its own CI gate, its own release cadence, and the off-chain monitor key (per §6.1 freeze-path #2) is signed-into-config there separately from any Zeta-side credentials. Sibling repo can graduate to separate-machine at the §10 scaling threshold if v0 evidence shows correlated CI/runner failures.

### §12.6 Mandate framework (AP2 vs custom) — RESOLVED (Otto 2026-04-28; revisable)

EAT packet §6 names AP2 as the architectural-target mandate framework. AP2 is Google's standard; not yet widely deployed.

**Decision:** **Custom semantic-AP2-compatible format for v0.**

**Rationale:** AP2 is emerging — Google's reference implementation is not yet widely deployed and its surface is still moving. v0 is research-grade scaffold; blocking on AP2's deployment timeline adds external coupling that doesn't earn its keep at v0 scale. A custom mandate format that is *semantically* AP2-compatible (same data shapes, same authorization predicates, same revocation semantics) keeps v0 drop-in-portable to AP2 once it matures. The cost of refactor-to-AP2-later is bounded by the semantic compatibility (it's a serializer-swap, not a rewrite).

Relationship to EAT §6: this deviation is annotated explicitly as *operational vs architectural*. The EAT packet states AP2 as the *architectural target*; this v0 spec implements a semantically-equivalent custom format as the *operational shim* until AP2 is ready. The EAT packet's promise to converge on AP2 is preserved; only the timing of the convergence is deferred.

**Operational implication for v0:** Phase 1 defines the custom mandate format inline as `mandate-schema.md` in the sibling-repo monitor (per §12.5). The format mirrors AP2's `subject` / `permissions` / `expires_at` / `signature` triple structure verbatim, just without AP2's reference-impl dependency. Phase 1+ (post-AP2-maturity): swap the serializer; the semantic layer survives unchanged.

### §12.7 Hierarchical scoping — RESOLVED (Aaron 2026-04-27)

**Not information asymmetry; hierarchical principal-agent scoping.**

Per Aaron 2026-04-27: *"these will be subagents/subclis launch without access or knowing more money exists."*

The working subagent/subCLI instance is launched with a $100-scoped mandate. It LITERALLY cannot see or address the larger ~$10k authority because that authority is outside its scope. Standard hierarchical principal-agent. The agent has full information about its own granted authority.

**HC-1 status:** satisfied. No deception against the agent; the larger authority is outside scope, not hidden from it.

**Operational implication for v0:** the subagent/subCLI is launched with credentials/keys/permissions scoped to the $100 mandate only. The $10k parent authority is never on the subagent's signing path. Smart-account session-key permissions enforce this at the contract level — the subagent literally cannot move more than the per-tx and per-period caps allow, regardless of what other authority exists in the parent.

### §12.8 Disclosure timing — RESOLVED by §12.7

Hierarchical scoping resolves disclosure: the subagent's session-scoped reality is logged via glass halo per its own scope. The parent's larger authority is logged via glass halo per the parent's scope. Both are substrate-visible to anyone reading the history; neither is hidden from anyone with appropriate scope. No additional disclosure mechanism needed beyond the existing glass halo logging at each scope.

---

## §13 — Implementation roadmap (post-acceptance)

Phase 0: spec acceptance + maintainer sign-off on §12 questions.

Phase 1: harness scaffolding (no real-money tooling yet).

- Stub `tools/wallet-monitor/` directory or sibling-repo bootstrap.
- Test rig that simulates DEX swaps end-to-end with mocked smart-account + mocked off-chain monitor.
- Receipt schema validator + per-tick row generator integrated with `docs/hygiene-history/loop-tick-history.md`.
- Bond accounting integration with `docs/INTENTIONAL-DEBT.md`.

Phase 2: dry-run paper-trading mode.

- Three consecutive sessions per §1 acceptance criteria.
- All gates active; zero real value transferred.
- Manual freeze-trigger tests pass.
- Receipt loop / retraction window / freeze authority all exercised.

Phase 3: bond-posted v0.

- Aaron posts $50–$100 bond.
- Agent operates within v0 scope.
- Sessions logged; tuition expected; lessons captured for substrate.

Phase 4: review.

- After bond exhaustion or after maintainer-decided session limit: postmortem.
- Document what the substrate learned. What's the v0+1 spec?
- KSK / Aurora design path activated if scaling triggers fired.

---

## §14 — Cross-references

- EAT packet: `docs/research/economic-agency-threshold-2026-04-27.md`
- Agent-wallet protocol stack: `docs/research/agent-wallet-protocol-stack-x402-eip7702-erc8004-2026-04-26.md`
- B-0024: `docs/backlog/P3/B-0024-trading-account-offer-aaron-self-funding-path-prerequisite-paper-trading-and-thesis-grounding.md`
- B-0029: `docs/backlog/P2/B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md`
- KSK design: `docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md` + sibling repo `Lucent-Financial-Group/lucent-ksk`
- INTENTIONAL-DEBT ledger: `docs/INTENTIONAL-DEBT.md` (per GOVERNANCE.md §11)
- Glass halo: `docs/ALIGNMENT.md` lines 71+94+119
- Drift taxonomy: `docs/DRIFT-TAXONOMY.md`
- Otto-279 — name attribution: `docs/AGENT-BEST-PRACTICES.md`

---

## §15 — Send-readiness

This spec is research-grade design. As of 2026-04-28, all
eight §12 questions are RESOLVED:

- §12.1 (framework=ZeroDev), §12.2 (chain=Base), §12.3
  (retraction-window=60s), §12.4 (caps confirmed as proposed),
  §12.5 (monitor form factor=sibling repo), §12.6 (mandate
  framework=custom semantic-AP2-compatible) — RESOLVED-BY-OTTO
  2026-04-28 per Aaron's autonomy extension (*"you can get these
  answers for them, or spin up some others clis/harnesses, you
  don't have to wait on me, you track your decsions already"*);
  each decision carries documented rationale and is revisable
  via the standard not-bound-by-past-self protocol.
- §12.7 (hierarchical scoping), §12.8 (disclosure timing) —
  RESOLVED 2026-04-27 by Aaron.

All §12 questions are now resolved on the spec side, so the
architecture is ready for multi-CLI review (Gemini + Codex +
Ani + Amara via `tools/peer-call/`) at Otto's discretion per
EAT §21.e. **Aaron's final v0 spec acceptance is deferred to
real-money phase per EAT §21.e** — *"i'll look later once we
have some real money involve."* Phase 1 scaffolding does NOT
proceed until that acceptance gate opens; this section reflects
spec-side readiness, not implementation green-light.

The spec deliberately does not block on KSK or Aurora shipping (per EAT packet §11.0 + §12). It provides the v0 substitute scaffold that's sufficient at v0 scale.

---

## §16 — Outside-loop falsifier round log

Per the EAT packet's recalibrated carrier-laundering rule (§0): every round must list at least one falsifier from outside any review loop. This section is the running log.

### 2026-04-27 — Otto outside-loop search round

Two falsifiers landed via web-fetch primary-source search; not from any reviewer in the chain.

**Falsifier 1 — EIP-7702 production vulnerabilities** (changed §3.2 + §6.1):

- $1.54M loss in single phishing attack via 7702 delegation tuple ([Cryptopolitan 2025](https://www.cryptopolitan.com/eip-7702-user-loses-1-54m-phishing-attack/))
- 97% of EIP-7702 delegations point at sweeper contracts that auto-drain compromised addresses ([Wintermute / CoinDesk](https://www.coindesk.com/tech/2025/06/02/post-pectra-upgrade-malicious-ethereum-contracts-are-trying-to-drain-wallets-but-to-no-avail-wintermute), [CertiK](https://www.certik.com/resources/blog/pectras-eip-7702-redefining-trust-assumptions-of-externally-owned-accounts))
- `tx.origin == msg.sender` invariant broken ([Halborn](https://www.halborn.com/blog/post/eip-7702-security-considerations))
- Hardware wallets at hot-wallet-equivalent risk for malicious-message signing
- **Spec changes:** delegate-target audited-allowlist enforcement, off-chain monitor watches for delegate-target drift + new 7702 authorization tuple anomalies, master-EOA tuple signed once at deployment time only.

**Falsifier 2 — Base reorg model sharper than original §10.1 framing** (changed §9.1):

- Flashblocks: ~200ms preconfirmation, <0.001% reorg ([Base Flashblocks deep-dive](https://blog.base.dev/flashblocks-deep-dive))
- L1 batch finality: effectively 0% reorg ([Base finality docs](https://docs.base.org/base-chain/network-information/transaction-finality))
- 7-day withdrawal wait applies only to L2→L1 bridge moves; in-Base swaps don't have the wait
- **Spec changes:** the original "~12 blocks on Base" framing was wrong-frame; Flashblock preconfirmation timescale is the right reference. The 60-second pre-flight window amply covers Base's reorg-risk window. No more "reorg-window monitoring" required for in-Base v0 ops.

**Worked example for the recalibrated rule** (EAT §0): both falsifiers came from primary sources outside the Ani-Amara-Gemini-ClaudeOpus-Otto carrier loop. Web-fetch primary-source check produced material spec changes that no reviewer in the chain surfaced. This is the rule operating as designed.
