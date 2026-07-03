---
id: B-0747
priority: P2
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: Git-native per-machine state declaration + ACE PM as reconciler + B-0743 biometric gate for system-level diffs = it's BOTH hard-managed AND soft-managed simultaneously, per-package-as-needed — resolves the hard-vs-soft-managed false dichotomy via GitOps semantics extended from k8s cluster state to per-machine substrate state
domain: agentic-organization
ferried_by: aaron
owners: [aaron, max, addison]
composes_with:
  - B-0743
  - B-0742
  - B-0741
  - B-0737
  - B-0728
  - B-0732
  - B-0288
  - B-0247
related_substrate:
  - .claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md
  - tools/setup/install.sh
  - tools/setup/macos.sh
  - tools/setup/linux.sh
  - full-ai-cluster/k8s/applications/
tags: [gitops-for-machine-state, per-machine-declarative-state, hard-vs-soft-managed-false-dichotomy, ace-pm-reconciler, biometric-gated-system-level-installs, declarative-plus-touchid, observed-state-cache, machine-substrate-as-substrate-engineering-target]
---

# B-0747 — Git-native per-machine state + biometric-gated GitOps reconciliation

## Carved blade

> The hard-managed-vs-soft-managed dichotomy is FALSE. With a **git-native representation of installed-or-not per machine** + **current cached state of any given machine**, ACE PM becomes a RECONCILER that compares declared-vs-observed + dispatches each diff appropriately: user-space diffs auto-install (hard-managed); system-level diffs gate on B-0743 Touch ID consent (soft-managed at the biometric gate, but otherwise automated). Result: **BOTH at the same time, per-package-as-needed**. Same GitOps semantics ArgoCD applies to k8s cluster state, extended to per-machine substrate state. Operator participation only where it MATTERS (biometric gate for system-level changes); everything else hard-managed. Aaron 2026-05-25: *"it would be both if they had some gitnative representation of installled or not per machine and the current cached state of any given machine."*

## Origin

Aaron 2026-05-25, building on the earlier same-day substrate cascade:

1. *"i had to install some dmg stuff manually i think and it depends on roslyn 2 maybe for build"* (B-0740 closed; substrate carried to B-0741)
2. *".sh is to meet the devleoper where they live we need .ps1 for windows but we don't have yet"*
3. After my proposal of hard-managed (we install) vs soft-managed (AI-assisted human install): *"yeah gh should be someting we manage and deterministic nix should be something we soft manage via AI assisted human install"*
4. Then: *"unless there is an easy automated way"* (recognizing DeterminateSystems Nix has `--no-confirm`)
5. Then THIS row's foundational claim: *"it would be both if they had some gitnative representation of installled or not per machine and the current cached state of any given machine"*

The progression: hard-vs-soft is a FALSE dichotomy IF we have the right substrate. GitOps for machine state IS that substrate.

## The substrate-engineering target

### Per-machine declarative state

Each machine has a git-tracked declaration of what should be installed:

```yaml
# machines/<hostname>.yml (or similar; design pass needed)
hostname: aaron-mac-2026
platform: macos
arch: arm64
profile: dev-laptop
declared:
  packages:
    - { name: "bun", source: "mise", version: "1.0.x", lifecycle: "runtime" }
    - { name: "gh", source: "brew", lifecycle: "runtime" }
    - { name: "determinate-nix", source: "determinate-installer", lifecycle: "build-time", system-level: true }
    - { name: "zflash", source: "git-repo:full-ai-cluster/tools/zflash.ts", lifecycle: "runtime" }
    - { name: "touch-id-pam", source: "zflash-setup", system-level: true }
    # ... etc
  hat-bindings:
    - { hat: "destructive-ops-runner", granted-by: "aaron-personal" }
  ontology-version: "zeta-reference-stack@v1"
```

### Per-machine observed state (cached)

Each machine has a queryable observed-state cache (gitignored OR in a separate per-machine private state, depending on threat model):

```json
// machines/<hostname>.observed.json (per-machine state cache)
{
  "hostname": "aaron-mac-2026",
  "observed_at": "2026-05-25T22:30:00Z",
  "observed": [
    { "name": "bun", "source": "mise", "version": "1.0.32", "installed-at": "2026-05-15T..." },
    { "name": "brew", "source": "official-installer", "version": "4.x", "installed-at": "..." },
    { "name": "determinate-nix", "source": "determinate-installer", "version": "3.6.4", "installed-at": "..." },
    // ... NOT including gh; declared but not observed
    // ... NOT including zflash; declared but not observed (PR #5010 just merged but not pulled to this machine)
    // ... NOT including touch-id-pam; declared but not observed
  ]
}
```

### Reconciliation (ACE PM as reconciler)

```
DECLARED                              OBSERVED                             DIFF (what to do)
─────────                              ─────────                             ─────────
bun (mise, runtime)         ─────►   bun (mise, 1.0.32)            ─────►   no-op
gh (brew, runtime)          ─────►   (missing)                     ─────►   AUTO-INSTALL via brew (user-space; hard-managed)
determinate-nix             ─────►   determinate-nix 3.6.4         ─────►   no-op
zflash                      ─────►   (missing)                     ─────►   AUTO-INSTALL via git pull (user-space; hard-managed)
touch-id-pam (system-level) ─────►   (missing)                     ─────►   GATED: prompt for Touch ID via zflash-setup; operator approves; system-level change applied
```

### The BOTH pattern

- **gh**: user-space; auto-install via brew (hard-managed; no operator interaction needed)
- **zflash**: user-space; auto-install via git pull + bun (hard-managed)
- **determinate-nix v3.7.0 upgrade**: system-level (modifies /nix volume + launchd); **Touch ID gated** per B-0743 (soft-managed at biometric gate; otherwise automated)
- **touch-id-pam installation**: system-level (modifies /etc/pam.d/sudo); **Touch ID gated** ON FIRST install (chicken-and-egg: needs operator password ONCE to install pam_tid.so, then biometric thereafter)

Same reconciler. Different gates per diff. Both at the same time.

## Why this resolves the hard-vs-soft dichotomy

The original framing (Aaron's first naming):

> "gh should be something we manage and deterministic nix should be something we soft manage via AI assisted human install"

Treated each package as either hard-managed OR soft-managed. But that's a per-PACKAGE classification; what actually matters is the PER-DIFF classification:

- **No diff** (declared == observed): no op; no gate needed
- **User-space diff** (declared in user-space PM; observed missing): auto-install; no gate
- **System-level diff** (declared with system-level flag; observed missing OR version drift): Touch-ID-gated install
- **Removal diff** (declared NOT present; observed present): uninstall OR ignore (per ontology — some operators want to keep ad-hoc installs)

The same package could be either auto-installed OR gated, depending on whether it's a fresh install (likely gated for system-level) or a no-op (no gate needed). The classification is on the DIFF, not the package.

## What this requires (substrate decomposition)

### Layer 1 — Per-machine declared-state substrate

- File format + storage location for `machines/<hostname>.yml`
- Encoding of package source + lifecycle + system-level flag + version constraints
- Composes with B-0740-scope ACE PM ontology (`installable-via`, `lifecycle`, `system-level`)
- Per-fork variation: each fork declares its own preferred declared-state baseline; downstream machines pin to a baseline + add deltas

### Layer 2 — Per-machine observed-state cache

- Storage location (per-machine; gitignored OR per-machine private state surface)
- Refresh cadence (on-demand via `ace status` OR daemon-style periodic)
- Cache invalidation (TTL OR event-driven from system changes)
- Privacy: observed-state IS sensitive (reveals what's installed; can leak operator preferences); design needs operator consent on what to share

### Layer 3 — Reconciler logic

- ACE PM's existing dispatch (per B-0288) extended to read declared + observed + emit diff plan
- Diff plan classifies per-package: no-op / auto-install / gated-install / uninstall
- Composes with B-0743 biometric gate for system-level diffs
- Composes with B-0732 leverage-class safety substrate (Layer 1 provenance chain captures each install op)

### Layer 4 — UX surfaces

- `ace status` — show declared vs observed diff
- `ace apply` — execute the diff plan (with biometric gates as appropriate)
- `ace apply --dry-run` — preview without executing
- `ace explain <package>` — answer "WHAT is this and WHY is it being installed?" (composes with the educational walkthrough Aaron asked for in the skills enhancement scope)
- Composes with B-0733 universal protocol + MCP wrap for agent-driven invocation

### Layer 5 — Cross-machine coordination (composes with B-0727 + B-0741)

- Per-cluster baseline declaration (LFG-cluster reference baseline; community-cluster baseline; etc.)
- Per-machine inherits + extends the cluster baseline
- Cross-machine drift detection (if 3 machines in a cluster all declare the same package but 1 doesn't have it observed, surface for operator review)
- Composes with B-0741 ontology negotiation: cross-cluster machine-state declarations interop via the federation protocol

### Layer 6 — Same-pattern-different-scope: GitOps for machine substrate

The substrate-engineering insight: GitOps semantics (declarative-desired-state + reconciler + audit-trail) apply identically to:

- **k8s cluster state** (ArgoCD; already in reference stack per B-0742)
- **Machine substrate state** (THIS row; ACE PM reconciler)

The pattern is the same; the scope differs. The reference k8s stack (B-0742) demonstrates GitOps for cluster state; this row extends GitOps to machine state. Together they cover the full operator-controllable substrate.

## Why per-machine state is git-native

Aaron's specific phrasing: *"gitnative representation of installled or not per machine"*.

Git-native means:

- **Declared state** lives in git (auditable history; cross-fork shareable; signed via git commit signatures + GPG/sigstore)
- **Observed state** can be git-tracked too (per-machine private state with operator consent) OR cache-only (gitignored)
- **Diffs** are git diffs — `git diff machines/aaron-mac-2026.yml` shows declared-state changes; reconciler runs against the new declaration
- **Fork interop** uses git fork semantics (per B-0741): downstream forks inherit baseline declarations + apply deltas
- **Rollback** is git revert: revert the declaration; reconciler converges back

This composes with B-0741's "Ace becomes the git-native AI-native fork-negotiation primitive" framing. Per-machine state is one specific application of the broader git-native Ace substrate.

## Composes with .claude/rules/

- `.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` (B-0743 rule) — biometric gate for system-level diffs IS the operator-consent floor
- `.claude/rules/dont-ask-permission.md` — agent invokes reconciler within authority; biometric gate IS per-diff per-invocation permission grant
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator retains authority via biometric gate; agent CANNOT bypass system-level installs
- `.claude/rules/honor-those-that-came-before.md` — observed-state may show ad-hoc operator installs that aren't in declared-state; reconciler should NOT default to removing them (operator-installed = operator-intended); design surface for "preserve undeclared installs" toggle
- `.claude/rules/bandwidth-served-falsifier.md` — declarative state + reconciler serves operator-machine-state coordination bandwidth (one source of truth per machine; one declaration per fork; no manual sync)
- `.claude/rules/glass-halo-bidirectional.md` — declared + observed state both observable substrate; diffs auditable
- `.claude/rules/default-to-both.md` — hard-managed AND soft-managed both first-class at the diff-classification level
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — "git-native per-machine state" is compressed naming with substrate-anchors (ArgoCD GitOps pattern + B-0742 reference cluster + B-0288 ACE PM CLI + B-0741 fork primitive); razor does NOT cut as metaphysical
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 hub-satellite partition: machine identity = hub; per-machine declared+observed state = satellites; per-fork baseline = satellites

## Composes with backlog substrate

### Direct foundation

- **B-0743** (desktop admin consent pattern) — biometric gate for system-level diffs
- **B-0742** (reference k8s stack as Ace PoC) — GitOps for cluster state; B-0747 extends to machine state
- **B-0741** (ontology negotiation + Ace as universal primitive) — per-machine state declaration is one application of the git-native Ace primitive; cross-cluster machine-state negotiation uses Layer 5
- **B-0737** (zflash — currently shipped on main as of ba93ee276) — empirical anchor for the biometric-gated system-level install pattern
- **B-0728** (destructive-tool authoring contract) — reconciler's system-level operations inherit the contract
- **B-0732** (leverage-class safety substrate) — Layer 1 provenance chain captures reconciliation events
- **B-0288** (Ace DLC PM CLI) — extension scope: PM CLI becomes the reconciler frontend
- **B-0247** (Ace DLC content packs) — the package substrate being reconciled
- **B-0287** (Ace package format spec) — signature + content-addressing for declared-state references

### Related composition

- **B-0628** (Knights Guild + Constitution-Class) — cross-fork declared-state baselines may need ratification
- **B-0634** (N-of-M HSM) — declared-state signatures use HSM substrate
- **B-0726** (Reticulum throughout) — cross-machine state coordination uses Reticulum transport
- **B-0727** (4-tier cluster topology) — per-tier baseline declarations (cloud / community / home / edge)
- **B-0664** (NCI HC-8 floor) — reconciler never coerces; biometric gate is the operator-authority floor
- **B-0746** (GitHub force-push lesson) — declared-state changes via git use the patterns from that rule

## Six independently-shippable scope items

### Scope item 1 — Per-machine declared-state schema

- Document the schema at `docs/research/2026-XX-XX-per-machine-declared-state-schema.md`
- Composes with B-0740-scope ACE PM ontology
- Design pass needed: YAML vs JSON; embedded vs referenced; per-fork variation handling
- Acceptance: schema documented; at least one real machine (Aaron's primary Mac) has a draft declared-state file

### Scope item 2 — Per-machine observed-state cache

- Storage location + format
- Refresh mechanism (on-demand vs daemon)
- Privacy substrate (operator consent on what to share)
- Acceptance: at least one machine's observed state queryable; refresh works; privacy substrate documented

### Scope item 3 — Reconciler logic in ACE PM

- Extend B-0288 PM CLI scope: `ace status` + `ace apply` + `ace apply --dry-run` + `ace explain`
- Diff plan classifier (no-op / auto-install / gated-install / uninstall)
- Composes with B-0743 biometric gate at system-level diff sites
- Acceptance: end-to-end on Aaron's machine: declare desired state; `ace status` shows diff; `ace apply` converges with Touch ID gates at system-level

### Scope item 4 — Cross-machine baseline declarations (composes with B-0727)

- Per-tier baseline files (e.g., `clusters/lfg-cluster.baseline.yml` + `clusters/community.baseline.yml`)
- Per-machine declarations inherit baseline + apply deltas
- Acceptance: at least one cluster baseline + 2 machines inheriting it; diff between machines surfaces as drift report

### Scope item 5 — `ace explain` educational walkthrough

- Implements Aaron's "walking through finding latest + answering questions about what tech is being installed and why" framing
- For each package in the diff plan, `ace explain` answers:
  - WHAT this package is
  - WHY it's declared (which ontology / cluster baseline / fork-specific need)
  - HOW it composes with the rest of the substrate
  - WHAT alternatives exist + why this one was picked
  - WHAT will happen on install + how to recover on failure
- Composes with B-0729 knowledge graph + B-0733 MCP wrap for the educational content
- Acceptance: at least 5 packages have full `ace explain` content; agent invocation walks operator through

### Scope item 6 — Add `gh` to brew manifest + DeterminateSystems Nix via `--no-confirm` to macos.sh (concrete hard-managed transitions)

- `gh` to `tools/setup/manifests/brew` (trivially hard-managed; user-space)
- DeterminateSystems Nix via `curl ... | sh -s -- install --determinate --no-confirm` in `tools/setup/macos.sh` (system-level; gates on sudo password OR Touch ID PAM if already installed)
- Documents the transition: previously soft-managed (manual DMG install); now hard-managed with biometric-gated sudo step (composes with B-0743)
- Acceptance: `tools/setup/install.sh` brings up a clean Mac with Nix + gh + bun + mise + zflash all installed; operator only touches Touch ID once for system-level steps

## What's NOT in scope (deferred)

- **Production-grade reconciliation for cluster nodes** — current scope is operator dev machines; cluster nodes are managed via ArgoCD (B-0742); ACE PM reconciler is a sibling for the operator-machine surface
- **Cross-OS reconciliation parity** — Mac substrate first; Linux + Windows via B-0738/B-0739 + future rows
- **Auto-removing operator-ad-hoc installs** — observed-state may contain things operator installed manually; reconciler defaults to PRESERVE; operator opts in to "strict mode" if they want auto-removal
- **Bidirectional sync with non-Ace package managers** — e.g., if operator `brew install foo` after declared-state is set, observed-state will show foo; reconciler surfaces this for operator review (declare it or remove it); no auto-decision
- **Multi-operator-per-machine support** — current scope is single primary operator per machine; multi-operator (shared dev machine) is future scope

## Acceptance (per scope item)

### Scope item 1 — Per-machine declared-state schema

- [ ] `docs/research/2026-XX-XX-per-machine-declared-state-schema.md` exists with schema + rationale
- [ ] At least one machine has a draft declared-state file (Aaron's Mac as canonical example)

### Scope item 2 — Per-machine observed-state cache

- [ ] Storage location + format documented
- [ ] Refresh mechanism implemented
- [ ] At least one machine's observed state queryable via Ace

### Scope item 3 — Reconciler logic

- [ ] `ace status` + `ace apply` + `ace apply --dry-run` + `ace explain` commands implemented
- [ ] Diff plan classifier working
- [ ] End-to-end: declare → status → apply with Touch ID at system-level diffs

### Scope item 4 — Cluster baseline declarations

- [ ] At least one cluster baseline file
- [ ] At least 2 machines inheriting it
- [ ] Drift report between them works

### Scope item 5 — `ace explain` educational content

- [ ] At least 5 packages have full explain content
- [ ] Agent invocation walks operator through

### Scope item 6 — `gh` + Nix in install.sh

- [ ] `gh` in brew manifest
- [ ] DeterminateSystems Nix in macos.sh via `--no-confirm`
- [ ] Clean Mac install end-to-end with Touch ID gates documented

## Substrate-honest framing

This row PROPOSES the substrate-engineering target. It does NOT:

- Implement any scope items (each is independently shippable; substantial work)
- Force any specific schema (Scope item 1 needs a design pass)
- Replace ArgoCD (B-0742 GitOps for cluster state) — this row is the SIBLING for machine substrate; they compose, not compete
- Bypass any safety substrate (B-0728 + B-0732 + B-0743 all preserved; reconciler inherits)
- Promise auto-removal of operator-ad-hoc installs (deferred; operator preserves by default)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + Max + Addison + Knights Guild retain authority.

P2 priority — foundational substrate that resolves the hard-vs-soft-managed false dichotomy + enables clean cross-machine + cross-fork operator-substrate coordination. Not P1 because: current single-cluster + single-operator dev scope works with the existing install.sh; becomes P1 when (a) multiple machines need consistent state OR (b) cross-fork operator interop becomes load-bearing OR (c) the substrate-engineering team wants the `ace explain` educational surface for onboarding contributors like Max + Addison.

## Closes the substrate-engineering arc

Today's 2026-05-25 cascade established:

1. B-0743 — desktop admin consent via biometric (the operator-participation floor)
2. B-0741 — ontology negotiation + Ace as universal primitive
3. B-0742 — reference k8s stack as Ace PoC (GitOps for cluster state)
4. B-0744 (pending) — WebAuthn/FIDO2/OIDC bridge to server-side authorization
5. **B-0747 (this)** — git-native per-machine state + biometric-gated GitOps reconciliation (GitOps for machine substrate state)

The cascade now covers:

- **Local biometric consent** (B-0737 + B-0743)
- **Cross-cluster federation primitive** (B-0741)
- **GitOps for cluster state** (B-0742)
- **Local-to-remote auth bridge** (B-0744 pending)
- **GitOps for machine substrate state** (B-0747 — this)

Full arc from "Aaron taps Touch ID to flash a USB" to "Ace reconciles declared-vs-observed state across operator machines + cluster substrate + fork ecosystem, gating system-level changes via biometric at the operator participation floor." Industry-standards-grounded throughout (no protocol invention; ArgoCD GitOps + FIDO2/WebAuthn/OIDC + standard PAM + git).
