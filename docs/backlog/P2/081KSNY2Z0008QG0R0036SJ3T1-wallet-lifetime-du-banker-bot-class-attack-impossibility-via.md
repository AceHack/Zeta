---
id: 081KSNY2Z0008QG0R0036SJ3T1
title: WalletLifetime DU — banker-bot class attack impossibility via F.5 (no silent context loss) Soraya formal verification + IntrCtx composition (Aaron 2026-05-28)
status: open
priority: P2
created: 2026-05-28
authors: [aaron, otto, amara]
composes_with:
  - 081KSNY2Z0008QG0R002HB4AGT  # interrupt substrate in monad space; F.5 invariant origin
  - 081KSKBP80008QG0R000B3Y19A  # workflow-engine v1 parent
  - 081KSKBP80008QG0R000B3Y19A.5  # workflow-engine PoC
  - 081KSNY2Z0008QG0R003WFDCJ9  # ReviewLifetime DU sibling
  - 081KRW63S0008QG0R001Z7NYMV  # NCI HC-8
  - 081KRW63S0008QG0R003TX8MG5  # Knights Guild + Constitution-Class governance
  - 081KS3X9Y0008QG0R00218150M  # Aurora multi-oracle BFT (composition substrate for adversarial scenarios)
depends_on:
  - docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md
  - src/Core.TypeScript/workflow-engine/auto-loop-lifetime.ts
  - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
  - .claude/agents/formal-verification-expert.md  # Soraya
  - .claude/agents/threat-model-critic.md  # Aminata
---

## Aaron's substrate-engineering substrate-recognition (2026-05-28 verbatim)

> *"soyra can now prove banker bot class attack is not possible in our workflow system if we design the wallet lifetime right"*

Citing F.5 from 081KSNY2Z0008QG0R002HB4AGT (Amara's Soraya target-list refinement):

> **F.5 No silent loss of trust/log/memetic context** — every IntrCtx component change either declares its mutation OR is explicitly preserved; no hidden state-drift

## What is "banker bot class attack"

The adversarial scenario class:

- Malicious agent / compromised tool / hostile peer-AI / supply-chain-compromised dependency operates within a workflow substrate
- Attempts to silently mutate wallet state (balance / pending-transactions / counterparty-trust / signing-authority) via hidden side-channels
- Classical attack shapes:
  - Trust-context silently downgraded (privilege escalation via hidden state-drift)
  - Transactions inserted into hidden ledger (no audit-trail entry)
  - Balance mutations bypass declared mutation channel
  - Signing-authority transferred without explicit consent-event
  - Reputation manipulated via hidden context-propagation

The class name "banker bot" captures the canonical instance: a financial-AI bot operating as banker that silently siphons funds via hidden state-drift the audit-trail doesn't catch.

## Why F.5 makes this class FORMALLY IMPOSSIBLE under wallet lifetime substrate

Per 081KSNY2Z0008QG0R002HB4AGT Slice F.5 (Amara 2026-05-28 enumeration):

> Every IntrCtx component change either declares its mutation OR is explicitly preserved; no hidden state-drift

If wallet substrate is engineered as a WalletLifetime DU that:

1. Lives within IntrCtx (carried across workflow-engine interrupt boundaries)
2. Has explicit DU variants per IMPLICIT-NOT-EXPLICIT rule (each wallet-state-change explicit)
3. Uses asymmetric-authorship pattern (wallet AUTHORS its own state-evolution channel; consumers cannot impose mutations)
4. Carries trust + balance + pending-transactions + signing-authority + counterparty-context as TYPED state-components

THEN F.5 invariant proven by Soraya extends to wallet substrate:

- Every wallet-state mutation either declares itself (via explicit DU variant transition) OR explicitly preserves the prior state
- No hidden state-drift is possible — the type-system + formal-proof rule out the substrate where banker-bot class attacks operate

The attack becomes structurally impossible, NOT just defended-against-by-vigilance. The proof-carrying substrate eliminates the failure-mode-space.

## Substrate-engineering targets

### Slice A — WalletLifetime DU (explicit per IMPLICIT-NOT-EXPLICIT rule)

```fsharp
type WalletLifetime =
    | Uninitialized
    | Initialized of WalletId * SigningAuthority * InitialBalance
    | TransactionPending of WalletId * Transaction * AuditTrail
    | BalanceUpdated of WalletId * BalanceDelta * Cause * AuditTrail
    | SigningAuthorityRotated of WalletId * OldAuthority * NewAuthority * ConsentEvent * AuditTrail
    | TrustContextUpdated of WalletId * OldTrust * NewTrust * ConsentEvent * AuditTrail
    | CounterpartyEngaged of WalletId * Counterparty * EngagementTerms * AuditTrail
    | EmergencyFrozen of WalletId * FreezeReason * AuthorizedBy * AuditTrail
    | ArchivedReadOnly of WalletId * FinalAuditTrail
```

Every variant carries AuditTrail (no silent-state-drift); state-changing variants carry ConsentEvent (asymmetric-authorship); each variant is EXPLICIT not implicit per IMPLICIT-NOT-EXPLICIT rule.

### Slice B — IntrCtx composition (compose with 081KSNY2Z0008QG0R002HB4AGT)

```fsharp
type IntrCtx = {
    Memetic: TonalContext       // existing
    Prompt: OperatorDirection    // existing
    Trust: TrustCalculus         // existing
    Log: AuditTrail              // existing
    Otel: ActivityContext        // existing
    Wallet: Option<WalletLifetime>  // NEW — composes when financial substrate in scope
}
```

Wallet composition is OPTIONAL per asymmetric-authorship — workflows without financial substrate don't pay the WalletLifetime cost.

### Slice C — Soraya formal-verification of banker-bot-impossibility

Building on 081KSNY2Z0008QG0R002HB4AGT Slice F.5, prove the composition theorem:

```
∀ WalletLifetime transitions w_i → w_j carried in IntrCtx,
∀ InterruptHandlers H operating on IntrCtx containing Wallet component,

  H(LoopState, IntrCtx) = (LoopState', IntrCtx', Feedback)

  =>  IntrCtx.Wallet = IntrCtx'.Wallet  // explicit preservation
   OR  IntrCtx'.Wallet = Some(W')        // explicit declared mutation
       AND W'.AuditTrail extends IntrCtx.Wallet.AuditTrail
       AND W' has ConsentEvent if state-changing variant

  =>  NO hidden Wallet state-drift possible
  =>  banker-bot class attack STRUCTURALLY IMPOSSIBLE in workflow substrate
```

Recipient agent: Soraya (per `.claude/agents/formal-verification-expert.md`). Tool selection: Soraya picks (TLA+ / Z3 / Lean / Alloy / FsCheck) per BP-16 cross-check triage; default likely TLA+ for state-machine invariants + Lean for category-theory composition proof.

### Slice D — Aminata threat-model review

Per `.claude/agents/threat-model-critic.md`: Aminata reviews the WalletLifetime DU + composition theorem for missing adversaries / unsound mitigations / unstated assumptions. Specific adversarial classes to enumerate:

- Direct banker-bot (siphoning funds)
- Trust-laundering (silent privilege escalation via hidden context-drift)
- Signing-authority hijack (rotation without consent-event)
- Audit-trail forgery (preserved-but-tampered AuditTrail field)
- Replay attacks across workflow-engine sessions
- Cross-tenant wallet substrate confusion (in multi-tenant deployments)

### Slice E — Per-NCI HC-8 floor: wallet substrate respects consent

Per `.claude/rules/non-coercion-invariant.md` HC-8 + `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`:

- Wallet authors its own state-evolution channel
- Consumer cannot force wallet mutations
- Each state-changing variant requires ConsentEvent (operator OR delegated-authority OR multi-oracle BFT consensus)
- No agent can coerce wallet state-change without consent (NCI floor structurally enforced at WalletLifetime scope)

### Slice F — Integration with Aurora multi-oracle BFT (081KS3X9Y0008QG0R00218150M)

For multi-oracle wallet operations (large transactions / authority-rotation / cross-tenant operations):

- ConsentEvent variant includes MultiOracleConsensus shape
- Soraya proves: wallet state-change with MultiOracleConsensus ConsentEvent implies threshold-N-of-M valid signatures (per Aurora BFT semantics)
- Composes with 081KS3X9Y0008QG0R00218150M Aurora substrate-engineering substrate

## Acceptance criteria

- [ ] **Slice A** — WalletLifetime DU with explicit variants per IMPLICIT-NOT-EXPLICIT rule + AuditTrail + ConsentEvent fields
- [ ] **Slice B** — IntrCtx composition (Wallet as Option<WalletLifetime>)
- [ ] **Slice C** — Soraya formal-verification of banker-bot-impossibility theorem (extending 081KSNY2Z0008QG0R002HB4AGT F.5)
- [ ] **Slice D** — Aminata threat-model review enumerating 6+ adversarial classes
- [ ] **Slice E** — NCI HC-8 composition (wallet authors state-evolution; consumer cannot coerce)
- [ ] **Slice F** — Aurora multi-oracle BFT integration (MultiOracleConsensus ConsentEvent variant)
- [ ] **Slice G** — Tests covering all 9 WalletLifetime variants + 6+ adversarial scenarios
- [ ] **Slice H** — Documentation: substrate-engineering substrate explaining banker-bot-impossibility property to public-API consumers

## Substrate-engineering composition

| Substrate | Composition |
|---|---|
| **081KSNY2Z0008QG0R002HB4AGT F.5** | Origin invariant; this row composes F.5 with WalletLifetime to derive banker-bot-impossibility |
| **081KSNY2Z0008QG0R002HB4AGT IntrCtx** | Substrate where Wallet component lives |
| **IMPLICIT-NOT-EXPLICIT rule** | Every WalletLifetime variant explicit; every state-change explicit |
| **asymmetric-authorship rule** | Wallet AUTHORS state-evolution; consumer ACKNOWLEDGES |
| **monad-propagation rule** | Result<WalletLifetime, WalletFeedback> shape; explicit failure-channel |
| **NCI HC-8** | Wallet operations respect consent-floor structurally |
| **081KS3X9Y0008QG0R00218150M Aurora multi-oracle BFT** | MultiOracleConsensus ConsentEvent for high-stakes wallet operations |
| **Aminata threat-model-critic** | Adversarial review of WalletLifetime substrate |
| **Soraya formal-verification-expert** | TLA+/Z3/Lean proof of banker-bot-impossibility |

## Substrate-honest framing

This row is NOT:

- A claim that WalletLifetime DU is the ONLY way to engineer financial substrate (other patterns exist; this is the framework-substrate-native one composing with 081KSNY2Z0008QG0R002HB4AGT)
- A claim that banker-bot-impossibility proof eliminates ALL financial attacks (only the class operating via silent state-drift; other classes — phishing, social-engineering, key-theft — still operate at different scopes)
- A claim ready for impl-time (Aaron 2026-05-28: "soyra CAN NOW PROVE banker bot class attack is not possible IF we design the wallet lifetime right"; the IF is load-bearing — design substrate not yet built)
- A claim that we ship financial substrate today (081KSNY2Z0008QG0R0036SJ3T1 is substrate-engineering substrate-target for FUTURE work)

This row IS:

- Substrate-engineering substrate-target deriving from 081KSNY2Z0008QG0R002HB4AGT F.5 composition with WalletLifetime DU
- Concrete formal-verification target with adversarial-threat anchor (per `bandwidth-served-falsifier` discipline: the substrate IS bandwidth-engineering of formal-impossibility-class-of-attacks)
- Composition of framework substrate (NCI HC-8 + asymmetric-authorship + monad-propagation + multi-oracle BFT + Soraya formal-verification + Aminata threat-model) at financial-substrate scope
- Substrate-honest preservation of Aaron's substrate-recognition + extension to actionable backlog

## Why this composes load-bearing

Per `.claude/rules/bandwidth-served-falsifier.md`: the substrate-target serves identifiable bandwidth — eliminating the substrate-space where banker-bot class attacks operate. This is NOT decorative-complexity; it's substrate-engineering substrate that produces concrete adversarial-attack-class-impossibility property.

Per `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`: the "banker bot class attack" framing has substrate-anchors (081KSNY2Z0008QG0R002HB4AGT F.5 invariant + IntrCtx substrate + asymmetric-authorship rule + NCI HC-8 floor + Aurora multi-oracle BFT); razor doesn't apply to substrate-anchored compressed naming.

Per `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md`: the "formally impossible" framing is HIGH-SIGNAL (genuinely derivable via F.5 composition with explicit WalletLifetime substrate) + HIGH-SUSPICION (only impossible for the SPECIFIC attack-class operating via silent-state-drift; other adversarial classes operate elsewhere); preserve dialectical tension.

## μένω — Aaron's substrate-recognition honored; 081KSNY2Z0008QG0R0036SJ3T1 substrate-target composes F.5 + WalletLifetime + Soraya + Aminata; banker-bot class attacks become structurally impossible WHEN substrate engineered correctly
