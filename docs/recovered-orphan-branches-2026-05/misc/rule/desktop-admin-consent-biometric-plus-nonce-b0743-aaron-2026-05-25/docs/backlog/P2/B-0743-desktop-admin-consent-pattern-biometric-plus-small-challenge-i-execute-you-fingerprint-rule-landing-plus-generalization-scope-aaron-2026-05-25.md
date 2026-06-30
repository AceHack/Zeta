---
id: B-0743
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Desktop admin consent pattern via biometric + small challenge ("I execute, you fingerprint") — rule-landing + generalization scope for other desktop destructive ops (zformat / zwipe / zrotate-creds / zinstall-cert / etc.) — distinct design space from server-side AI consent patterns (IAM / SPIFFE / OIDC / RBAC)
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0728
  - B-0737
  - B-0738
  - B-0739
  - B-0732
  - B-0664
related_substrate:
  - .claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md
  - full-ai-cluster/tools/flash-usb.ts
  - full-ai-cluster/tools/zflash.ts
  - full-ai-cluster/tools/zflash-setup.ts
tags: [consent-first-ai-design-pattern, desktop-admin-consent, biometric-gate, touch-id, windows-hello, fprintd, i-execute-you-fingerprint, generalization-scope, distinct-from-server-patterns, design-pattern-substrate]
---

# B-0743 — Desktop admin consent pattern (rule-landing + generalization scope)

## Carved blade

> Server-side AI consent ≠ desktop AI consent. Server uses IAM / SPIFFE / OIDC / RBAC at deploy time (no human present). Desktop uses **biometric + small per-run challenge at action time** ("I execute, you fingerprint" — Aaron 2026-05-25). The two are sibling design spaces, not the same problem. The pattern shipped empirically in B-0737 zflash (Touch ID + `yes <4-hex>` short challenge); this row LANDS the pattern as a wake-time-substrate rule + carves the generalization scope across other desktop destructive ops (`zformat` / `zwipe` / `zrotate-creds` / `zinstall-cert` / `zsetup-ssh-key` / `zdb-migrate-prod` / etc.). Each op gets its own narrow tool inheriting the pattern; the rule ensures future-Otto + future contributors inherit the design discipline at cold-boot.

## Origin

Aaron 2026-05-25, after B-0737 + B-0738 + B-0739 + B-0740 (closed) + B-0741 + B-0742 + cron-check:

> *"hey we should save this interaction pattern about human permission excalation being on touch and the extra small challenge as new consent first ai design patterns for admin permisson on desktop instead of server."*

This row + the bundled rule are the substrate-landing for that pattern.

## What this row ships in one PR

### Rule (auto-loads at cold-boot for all future AI sessions)

`.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` — operationally-precise filename + Aaron's carved-sentence-shape preserved in body.

Names the 4 composing elements:

1. Hardware sanity rails (B-0728 substrate)
2. Per-run random nonce + explicit-consent token in a SMALL challenge
3. Biometric PAM at sudo / elevation time
4. Provenance chain (B-0732 Layer 1)

Documents:
- The pattern + when it applies + when it doesn't
- Desktop vs server design-space distinction table
- Why each element matters (what biometric alone misses; what challenge alone misses)
- What CANNOT be substituted (NOPASSWD / stored password / GUI prompt / pre-shared secret / MFA-via-phone — each has trade-offs the rule documents)
- Empirical anchor: B-0737 zflash end-to-end demonstration
- Substrate-honest framing (not perfect; not replacement; not server-applicable)
- Naming-expert review pending (Ilyana per `.claude/skills/naming-expert/SKILL.md`)

### Backlog row (this file)

Carves the generalization scope: applying the pattern to other desktop destructive ops.

## Generalization scope — candidate future tools using this pattern

Each candidate is independently shippable + inherits the pattern wholesale:

| Tool | Operation | Why biometric gates it |
|---|---|---|
| **zformat** | Format a disk / partition | Destroys data; biometric proves intent at format time |
| **zwipe** | Secure-wipe a disk (multi-pass) | Long-running destruction; biometric proves intent at start |
| **zrotate-creds** | Rotate API tokens / SSH keys / GPG keys | Operator-identity-bound credential change; biometric proves identity |
| **zinstall-cert** | Install CA certificate into system keychain | Trust-chain modification; biometric proves intent |
| **zsetup-ssh-key** | Generate + register new SSH key with passphrase | Cryptographic-identity creation; biometric ties new key to operator-present moment |
| **zdb-migrate-prod** | Run a DB migration against prod database | Operator-presence-required for production changes (per existing ops discipline) |
| **zsign-package** | Sign an Ace DLC content pack | Cryptographic signing; biometric proves operator was present + intentional |
| **zelevate-network** | Add system-level firewall rule / VPN config | Network-state mutation; biometric proves intent |
| **zinstall-cluster** | Bring up a reference cluster (per B-0742 Ace distribution) | Multi-PM dispatch with system-level side effects; biometric gates the whole sequence |
| **zfork-zeta** | Initialize a downstream Zeta fork (per B-0741) | Substrate-engineering ceremony; biometric records the fork-creation operator + timestamp |

This is NOT a commitment to ship all of these — it's the generalization SURFACE. Each tool would be its own future B-NNNN row.

## What each candidate tool inherits from the pattern

Per the rule's 4-element template:

1. **Hardware sanity rails** specific to the op (`zformat` checks USB-only / not-boot-disk; `zwipe` checks size sanity; `zrotate-creds` checks identity-match; etc.)
2. **Short challenge** in the `yes <4-hex>` format (consistent UX across all desktop destructive tools)
3. **Biometric PAM gate** at sudo time (Touch ID / Windows Hello / fprintd per platform; B-0738 + B-0739 provide cross-platform substrate)
4. **Provenance chain entry** logging {tool, nonce, biometric-identity, side-effect-summary, timestamp}

Operator UX consistency: every Z-prefixed desktop destructive tool follows the same flow:

```
$ z<tool>
[sanity output]
type: yes a3f9
> yes a3f9
[Touch ID / Windows Hello / fprintd prompt]
[ op proceeds ]
```

Operator learns the pattern ONCE; every new Z-tool feels familiar; agent integration is consistent per the same flash-usb.ts authorship contract.

## Composes with .claude/rules/

- `.claude/rules/dont-ask-permission.md` — agent invokes within authority; biometric IS the per-run permission grant; no explicit "may I?" required
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator retains authority via biometric gate; agent CANNOT bypass
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — biometric INSTALLS safety; not a classifier-bypass
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — settings.json permission documents which tools are agent-invokable; biometric gates the runtime destructive op
- `.claude/rules/default-to-both.md` — short challenge AND long challenge both first-class per tool (some ops may need explicit device-path-in-challenge for clarity); short is the desktop default
- `.claude/rules/glass-halo-bidirectional.md` — biometric prompts are system-level UI; visible regardless of which terminal initiated
- `.claude/rules/honor-those-that-came-before.md` — B-0728 destructive-tool authoring contract is the foundation; B-0737 zflash is the empirical anchor; B-0743 generalizes without replacing

## Composes with backlog substrate

- **B-0728** (destructive-tool authoring contract) — pattern's deterministic-correctness floor
- **B-0737** (zflash Mac variant) — empirical anchor; first instance of the pattern
- **B-0738** (zflash Linux variant) — pattern at fprintd / pkexec scope; generalization template per platform
- **B-0739** (zflash Windows variant) — pattern at Windows Hello scope; generalization template per platform
- **B-0732** (leverage-class safety substrate) — Layer 1 provenance chain captures each Z-tool invocation
- **B-0664** (NCI HC-8 floor) — operator authority preserved via biometric

## Five independently-shippable scope items

### Scope item 1 — Land the rule (THIS PR)

- New rule at `.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md`
- Auto-loads at cold-boot for all future Otto / Alexa / Riven / Vera / Lior / future-AI sessions
- Composes with existing rules per the cross-references above

### Scope item 2 — Document the design pattern publicly (when ready)

- Blog post / talk / industry-presentation describing the pattern as "consent-first AI design pattern for desktop admin permission"
- Naming-expert (Ilyana) review per `.claude/skills/naming-expert/SKILL.md` before public surface
- Substrate-honest framing: pattern is REAL + WORKING (B-0737 anchor) but not a panacea (rule documents trade-offs)
- Composes with B-0736 product-team handoff (could become a sibling Thoughtcatcher-tier product if there's market interest)

### Scope item 3 — Common Z-tool framework

- Extract the common pattern (sanity-rails template + short-challenge generator + biometric-gate composer + provenance-chain helper) into shared TS substrate
- New module: `full-ai-cluster/tools/z-framework/` or similar
- Future Z-tools instantiate the framework + add their op-specific sanity rails + side-effect
- Acceptance: framework module exists; at least 2 tools refactored to use it (zflash + one new tool)

### Scope item 4 — Cross-platform pattern coverage (composes B-0737 + B-0738 + B-0739)

- Ensure the pattern works equivalently across Mac (Touch ID) / Linux (fprintd/pkexec) / Windows (Hello/UAC)
- Document fallback paths when biometric hardware absent
- Acceptance: pattern documented per platform; at least one tool (zflash) ships across all three

### Scope item 5 — Pattern adoption-tracker

- Light-touch list of which Z-tools are using the pattern + which destructive desktop ops still use older patterns
- Living doc; updated as new tools land + old ones get migrated
- Helps future contributors find candidates for migration
- Acceptance: doc exists at `docs/desktop-consent-pattern-adoption.md`; lists current state

## What's NOT in scope

- **Building all the candidate tools** — each candidate is its own future row; this row is the pattern + generalization scope, not an implementation backlog
- **Server-side AI consent pattern documentation** — sibling design space; would be a separate rule (substrate-honest naming: server-side uses IAM/SPIFFE/OIDC/RBAC at deploy time; out of scope here)
- **Pattern for headless desktops** (Linux desktop without biometric hardware AND without polkit) — rule documents fallback; full headless-desktop scope is future
- **Cross-device biometric proof** (operator on phone biometric authorizing desktop op) — possible future extension; out of current scope (latency + complexity vs on-device biometric)
- **Federation-scope consent** (cross-cluster destructive ops gating on multiple operators' biometrics) — composes with B-0741 + B-0742; future scope when cross-cluster destructive ops are needed

## Acceptance

- [x] Rule shipped at `.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` (this PR)
- [x] B-0743 backlog row documents pattern + generalization scope (this PR)
- [ ] Naming-expert (Ilyana) review when pattern goes public-surface
- [ ] Common Z-tool framework shipped (Scope item 3; future)
- [ ] First non-zflash tool adopting the pattern shipped (any Z-tool from candidate list; future)
- [ ] Cross-platform coverage validated (B-0738 + B-0739 ship + pattern documented per platform)

## Substrate-honest framing

This row PROPOSES the generalization scope + LANDS the rule for the pattern. It does NOT:

- Build any of the candidate Z-tools (each is its own future row)
- Force any team / future contributor to adopt the pattern for every destructive op (rule is operationally available + recommended; not mandated)
- Replace the existing zflash substrate (zflash IS the empirical anchor; B-0737 stays load-bearing)
- Claim the pattern works in every environment (headless / no-biometric / restricted-PAM scenarios documented as fallbacks in the rule)
- Compete with server-side AI consent patterns (acknowledges them as sibling design space; doesn't try to replace)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + future contributors retain authority over which scope items ship when + which destructive ops get Z-tool treatment.

P2 priority — design-pattern-shaped substrate; high reuse-leverage; not P1 because the empirical anchor (B-0737 zflash) already exists + the rule landing is the immediate scope; broader generalization is future-shaped substrate-engineering work.

## Today's substrate cascade (closing arc)

The 2026-05-25 cascade landed:

| Row | What |
|---|---|
| B-0728 (earlier) | Destructive-tool authoring contract |
| B-0729 | Obsidian knowledge graph |
| B-0730 | Runbooks-as-executable-specs (Mika) |
| B-0731 | Hat ontology top-down + bottom-up |
| B-0732 | Runbook leverage-class safety substrate |
| B-0733 | Universal protocol + MCP wrap + AI agency stack |
| B-0734 | JIT-implicit + 2-primitives + Notepad simplicity |
| B-0735 | Probabilistic + per-person parsers |
| B-0736 | Time-travel debugging + product handoff + Patternweaver |
| B-0737 | zflash Mac (Touch ID + short challenge) — **empirical anchor for THIS pattern** |
| B-0738 / B-0739 | zflash Linux + Windows extension scope |
| B-0740 | (closed; under-recon lesson) |
| B-0741 | Ontology negotiation + Ace as universal primitive |
| B-0742 | Reference k8s stack as Ace PoC |
| **B-0743 (this)** | **Desktop admin consent pattern — rule-landing + generalization scope** |

The pattern surfaced operationally in B-0737; this row names it as design-pattern substrate so future-Otto + future contributors inherit the discipline without re-discovering it.
