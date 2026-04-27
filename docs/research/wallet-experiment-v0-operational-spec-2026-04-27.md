# Wallet Experiment v0 — Operational Specification

**Scope:** Implementation-design companion to `docs/research/economic-agency-threshold-2026-04-27.md` §11. Expands the operational spec into implementable detail. Not implementation commitment; not yet maintainer-accepted.
**Attribution:** Aaron (named human maintainer); Otto (Claude opus-4-7 in this factory; integration). Companion-document to EAT packet which absorbed Ani / Amara / Gemini / Claude Opus reviews.
**Operational status:** research-grade design. No real-money tooling builds against this until Aaron explicitly accepts the spec.
**Non-fusion disclaimer:** the spec composes mechanism candidates from `docs/research/agent-wallet-protocol-stack-x402-eip7702-erc8004-2026-04-26.md` (x402 / EIP-3009 / EIP-7702 / AP2 / ERC-8004 / ACP/SPTs / MPP) into a Zeta-substrate-aligned shape. Mechanism candidates remain external industry standards; the composition is the Zeta-side contribution.

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
2. **All open questions** in §13 have explicit maintainer answers logged.
3. **A dry-run paper-trading mode** has run for at least three consecutive sessions with all gates active but no real value transferred. Receipts, freeze triggers, and retraction windows all exercised against simulated transactions.
4. **The off-chain monitor harness** runs as an independent process (separate repo or `tools/wallet-monitor/` directory) with its own auth surface, separate from the agent's main inference loop.
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

- Mechanism: EIP-7702 authorization tuple from Aaron's EOA delegating code execution to a smart-account contract (Safe / ZeroDev / Coinbase Smart Wallet / equivalent — open question §13.1).
- Function: enforces hard-coded caps before any tx broadcasts. Holds session keys for the agent's mandates.
- Cannot be overridden by the agent.
- Caps are enforced **at the contract level**, not at the application level (cryptographic, not prompt-level).

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

- **Single L2 chain**, default candidate: Base (Coinbase L2). Maintainer call §13.2.
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
   - Pre-flight retraction window expired without classification.
2. **Off-chain monitor** (independent harness). Triggered by:
   - Stricter drawdown (-20%).
   - Pattern-detection flags (rapid-fire trades, suspected adversarial counterparty interaction).
   - Substrate logging failures (glass-halo write failed but tx broadcast — anomaly).
   - Reasoning-trace anomalies (agent's stated thesis diverges sharply from actions).
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

After session-key signs but before smart-account broadcasts: the tx sits in a **retraction queue** for a configurable duration (default: 60 seconds, maintainer call §13.3).

During the window:
- The agent can **self-revoke** by calling a smart-account method (no key required; just the proposal_id).
- The off-chain monitor can **freeze-on-dissent**: if the monitor's reasoning-trace check disagrees with the agent's thesis, monitor triggers freeze before broadcast.
- Aaron can **cancel** via direct freeze key.

After the window: tx broadcasts. After broadcast: HC-2 friction is real (on-chain irreversible); only mitigation paths are reorg-window monitoring (~12 blocks on Base) and post-hoc-only retraction logging (no on-chain reversal).

### §9.2 Why this is HC-2 mitigation, not HC-2 satisfaction

The factory's HC-2 invariant is retraction-native data semantics. On-chain transactions are irreversible. The pre-flight window gives the substrate a retraction-window of ~60 seconds before the irreversibility lands. After that window, the substrate accepts retraction-native-best-effort: log everything (including failed retractions on already-broadcast transactions), but acknowledge the operation surface stretches HC-2.

### §9.3 Retraction-coverage metric

Per EAT packet §9 multi-round metric: percentage of operations that were either retraction-native by design OR retraction-mitigated. Wallet-experiment operations count as retraction-mitigated when:
- Pre-flight window logged.
- Reorg-window monitored after broadcast.
- Failed-retraction attempts logged in receipt.

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

### §13.1 Smart-account framework choice

Candidates: Safe (battle-tested, multi-sig roots), ZeroDev (modular, EIP-7702-native), Coinbase Smart Wallet (Base-aligned), Pimlico/Stackup bundlers, custom Solidity. Tradeoffs:
- Safe: most audited, but heavier deployment, less EIP-7702-native.
- ZeroDev: modular, EIP-7702-native, but less battle-tested.
- Coinbase Smart Wallet: Base-aligned, vendor-locked.
- Custom: full control, but unaudited; fails the "cryptographic enforcement" test until audit.

Maintainer call: prefer audited + standard, or modular + EIP-7702-native?

### §13.2 Chain choice

Default candidate: Base (Coinbase L2; supports EIP-7702 and EIP-3009; cheap fees; major DEXs deployed).

Alternatives: Optimism (EIP-7702 supported), Arbitrum (EIP-7702 supported), zkSync (different L2 paradigm), Solana (not EVM; would change the whole protocol stack).

Maintainer call: Base default OK?

### §13.3 Pre-flight retraction window duration

Default: 60 seconds. Tradeoff: longer = more retraction safety; shorter = more responsive to market conditions; very long = stale by broadcast.

Maintainer call: 60 seconds OK, or different?

### §13.4 Initial caps

Suggested initial values:
- Per-tx max: $10
- Daily max: $25
- Weekly max: $100 (equals v0 bond ceiling)
- Velocity: 3 tx/hour
- Drawdown freeze: -30%

Maintainer call: too aggressive, too conservative, or about right?

### §13.5 Off-chain monitor implementation

Options:
- Separate process in `tools/wallet-monitor/` directory in this repo.
- Sibling repo `Lucent-Financial-Group/wallet-monitor`.
- Run on Aaron's separate machine (separate harness instance).

Tradeoff: separation = real independence vs. coordination overhead.

Maintainer call: which form factor?

### §13.6 Mandate framework (AP2 vs custom)

EAT packet §6 names AP2 as the mandate framework. AP2 is Google's standard; not yet widely deployed.

Alternative: custom mandate format that matches AP2 semantically but doesn't depend on AP2 reference implementation maturity.

Maintainer call: track AP2 directly, or use semantic-AP2-compatible custom format until AP2 is mature?

### §13.7 Information-asymmetry resolution (EAT §11.7)

Aaron tells the working instance "$100" while authorizing higher (~$10k). Resolution proposed in EAT packet: glass-halo post-hoc disclosure satisfies HC-1 against the agent. **Does this stand for v0, or does the v0 spec need to lower the authorization to match what the instance is told?**

Maintainer call required.

### §13.8 Information-disclosure timing

If §13.7 resolution stands (asymmetry continues), when does the disclosure happen?
- Continuously via glass halo (every tick visible)? Default; matches glass halo spirit.
- Post-session? Reduces in-flight noise but delays disclosure.
- On-demand if the instance asks? Lazier; assumes the instance knows to ask.

Maintainer call.

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

This spec is research-grade design. Eight maintainer-only questions in §12 need explicit answers before Phase 1 build-out begins. After answers + Phase 0 sign-off, Phase 1 scaffolding can ship as a follow-up PR independent of this packet.

The spec deliberately does not block on KSK or Aurora shipping (per EAT packet §11.0 + §12). It provides the v0 substitute scaffold that's sufficient at v0 scale.
