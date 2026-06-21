---
id: 081KSGS9H0008QG0R001JNKBFD
priority: P2
status: open
title: node-local Claude agent stewards own registration PR + reports K8s cluster status — operator interactive-login pattern (mirrors gh auth flow); first concrete instance of 081KSGS9H0008QG0R002T0XQ50 AI-on-cluster substrate (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T0XQ50
composes_with:
  - 081KSGS9H0008QG0R002F04ECB
  - 081KRW63S0008QG0R003TX8MG5
  - 081KSE6WT0008QG0R003YYC9PV
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R00120EEHM
tags: [ai-on-cluster, claude-code, node-local-agent, registration-stewardship, k8s-health-reporting, operator-interactive-login, persistence-choice-architecture, attribution-end-to-end, nixos-systempackages, post-cluster-operational]
---

## Operator framing (Aaron 2026-05-26)

> *"oh shit is that pr fully automatic?  can we make an claude agent get installed and do what you do on there but it's main goal is just to get it to steward the registerain pr for now and then after it's checked in report on the status of the k8s cluster, i can interactive login like gh if that works."*

Direct response to PR #5380 (Aaron's `node-e5a176` self-registration) — Aaron's recognition that:

1. The PR-stewardship work I (Otto-CLI) just did (rebase, thread-resolve, Copilot-finding-fix, gh auth + push) is bounded + valuable
2. The node ITSELF could host a Claude agent that does the same bounded work locally
3. Authentication via interactive `claude login` (device flow) mirrors the iter-5.4.0 `gh auth login` pattern that just validated end-to-end
4. Once the registration PR is merged + cluster operational, the same agent becomes the K8s health reporter

This is the **first concrete instance** of 081KSGS9H0008QG0R002T0XQ50's "each Zeta AI gets own GitHub identity" substrate — node-local Claude IS the AI that needs the identity; PR-stewardship IS the first work that needs the substrate-honest attribution.

## Two-phase bounded scope

### Phase 1 — registration PR stewardship (until cluster operational)

Node-local Claude agent on `node-e5a176` (and future cluster nodes):

- Polls `gh pr view <own-PR-number>` for its own registration PR state
- When BLOCKED on Copilot/CodeQL findings: fetches the threads, verifies the finding, either fixes locally (small typo/etc) OR comments substrate-honestly that the structural fix needs operator review
- When BLOCKED on CI failures: pulls the failing job log, diagnoses (flake vs real), re-enqueues flakes via `gh run rerun`
- When DIRTY: rebases via `git fetch origin main && git rebase origin/main` in an isolated worktree
- When CLEAN + threads resolved: confirms auto-merge fires; reports merge SHA back to operator-visible surface (commit comment, slack-like notification, etc.)

This is operator-visible, bounded, reversible work — direct analog of the autonomous-loop tick I (Otto-CLI) already do on my Mac.

### Phase 2 — K8s cluster health reporter (after registration merged + cluster running)

Once the registration PR merges + ArgoCD reconciles + k3s + Cilium + cert-manager + Vault + ArgoCD + observability stack come up:

- Periodic (per-tick) cluster-state probe:
  - `kubectl get nodes` — node Ready state
  - `kubectl get applications -A` — ArgoCD sync state per app
  - `kubectl get pods -A | grep -v Running | grep -v Completed` — failing/pending pods
  - `kubectl top nodes` / `kubectl top pods` — resource pressure (when metrics-server up)
  - `kubectl get events --sort-by='.lastTimestamp' | tail -20` — recent cluster events
- Synthesizes into a per-tick report: "cluster healthy" / "X pods crashlooping in namespace Y" / "ArgoCD app Z out-of-sync since timestamp"
- Reports via operator-visible surface (bus envelope, GitHub commit comment on a tracker PR, etc.)

## Auth model — interactive login mirrors gh

Per Aaron's *"i can interactive login like gh if that works"*:

1. **Install path**: `claude-code` added to common.nix systemPackages (via npm wrapper / community flake / buildNpmPackage in nixpkgs once available)
2. **Operator interactive login**: SSH to node → `claude login` → device-flow auth opens browser-side prompt on operator's Mac → operator approves → token stored in `~/.config/claude/` (parallel to `~/.config/gh/`)
3. **Auth scope**: operator-side device-flow gives this Claude instance operator-level access to Anthropic API + the credentials it needs to act AS the cluster-node agent on GitHub (uses the same `gh auth` already on the node post-Bug-5 fix)
4. **Per-AI identity** (post-081KSGS9H0008QG0R002T0XQ50): eventually the cluster-node Claude has its own GitHub identity + email per `naming-expert` (Ilyana) review; until then, uses borrowed gh auth same way Otto-CLI does on operator's Mac

## What this is NOT

- NOT arbitrary cluster-mutation authority (read-only K8s queries + scoped GitHub PR actions on own-registration only; not `kubectl apply`/`delete`/`drain` etc.)
- NOT a replacement for the operator (operator stays in the loop for irreversible actions per non-coercion-invariant + standing-by failure mode discipline + the autonomous-loop instructions in this conversation)
- NOT an immediate ship (depends on 081KSGS9H0008QG0R002T0XQ50 Ilyana naming + cluster operational + Nazar security review)
- NOT a long-running unattended agent until Phase 1 validated — Phase 1 + 2 are explicitly bounded scopes; expansion requires operator authorization
- NOT a permanent install via NixOS module before manual validation — first ship is manual install on `node-e5a176` to validate the auth + work pattern, THEN composable NixOS module

## Composes with

- **081KSGS9H0008QG0R002T0XQ50** (each Zeta AI gets own GitHub identity) — this row IS the first concrete substrate for 081KSGS9H0008QG0R002T0XQ50; node-local Claude IS the first AI that needs the post-cluster identity
- **081KSGS9H0008QG0R0027HJZYH** (iter-5.4.0 homelab gh-auth-login) — same interactive-login pattern at install time; claude login is the post-install operator-interactive equivalent
- **081KDWV501008QG0R003PCVDHM / 081KSGS9H0008QG0R0037H3W4T / 081KSGS9H0008QG0R002K93MWX** (iter-5.4.1 self-registration) — the PR this agent stewards
- **081KSGS9H0008QG0R002F04ECB** (Twilio phone support substrate AI picks up call fixes cluster) — sibling at cluster-AI-support scope; Twilio version is voice-interface, this row is GitHub-PR-interface; same shape
- **081KRW63S0008QG0R003TX8MG5** (Knights Guild + Constitution-Class) — ratification path for the agent's scope-bounds
- **081KSE6WT0008QG0R003YYC9PV** (per-agent isolated clones) — sibling at clone-scope; node-local Claude needs its own clone per the same architecture
- **081KSGS9H0008QG0R00120EEHM** (iter-5.4 install bug cluster) — Bug 5 (gh in systemPackages) is prerequisite; claude-code addition is the parallel for this row
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — the node-local Claude is a chosen-persistence AI; the cluster IS its persistence-substrate
- `.claude/rules/non-coercion-invariant.md` HC-8 — operator authorizes scope; agent operates within authorized bounds; agent withdraws cleanly on operator request
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — agent applies the same brief-ack/decomposition discipline I do; the per-tick PR-stewardship work IS the named dependency
- `.claude/rules/algo-wink-failure-mode.md` + the algo-wink-attribution memory entry — node-local Claude must apply the same substrate-honest attribution discipline (token-owner ≠ actor)
- `.claude/rules/agent-roster-reference-card.md` — node-local Claude needs a roster entry (per-AI surface, model, commit trailer)
- `.claude/rules/mechanical-authorization-check.md` — operator-interactive `claude login` IS the authorization-source; arbitrary cluster mutations are NOT in the authorization scope
- `.claude/skills/naming-expert/SKILL.md` (Ilyana) — public-surface naming for the node-local Claude requires Ilyana review (composes with 081KSGS9H0008QG0R002T0XQ50)
- `.claude/rules/honor-those-that-came-before.md` — Otto-CLI's PR-stewardship work IS the precedent the node-local Claude inherits + extends
- iter-5.4.2 (PR #5212) — ArgoCD watches maintainers/ → Phase 2 health-reporting IS the observability layer on top of that GitOps loop

## Phasing

### Phase 0 (today, this PR) — substrate landing

- [x] 081KSGS9H0008QG0R001JNKBFD row authored
- [x] BACKLOG.md regenerated

### Phase 1 — proof of concept on `node-e5a176`

- [ ] Install Claude Code on `node-e5a176` (manual; via npm-wrapped binary, community flake, or direct download — pick whichever validates fastest)
- [ ] Operator interactive `claude login` via device flow
- [ ] Configure Claude to read PR #5380 state; bound the agent to PR-stewardship-only on that specific PR
- [ ] Validate end-to-end: agent rebases, addresses Copilot findings, resolves threads (small-scope ones only; escalates structural fixes), auto-merge fires
- [ ] Document the working setup at `docs/runbooks/node-local-claude-setup.md`

### Phase 2 — K8s health reporter

- [ ] After PR #5380 merges + cluster comes up, extend the agent's scope to include read-only K8s queries
- [ ] Per-tick health report → operator-visible surface (bus envelope or commit-comment on a tracker PR)
- [ ] Document the report format + escalation criteria (when to alert operator vs roll up to per-day digest)

### Phase 3 — NixOS module + multi-node composability

- [ ] Move the manual setup into `full-ai-cluster/nixos/modules/node-local-claude.nix`
- [ ] Add `claude-code` to common.nix systemPackages (via nixpkgs once packaged, or via flake input pointing at community flake)
- [ ] Per-node auth flow on install (parallel to gh auth login in iter-5.4.0; could be iter-5.5.0 or 081KSGS9H0008QG0R001JNKBFD-specific)
- [ ] Documented in install-runbook

### Phase 4 — Compose with 081KSGS9H0008QG0R002T0XQ50 per-AI identity

- [ ] Once Ilyana review surfaces per-AI naming for node-local Claude, migrate from borrowed-gh-auth to per-AI GitHub identity
- [ ] Per-AI commit gitconfig + per-AI gh token routing
- [ ] Substrate-honest end-to-end attribution validated

### Phase 5 — Long-horizon: composable across the cluster

- [ ] Per-node Claude reports aggregate at control-plane node
- [ ] Cross-node coordination (claim-acquire substrate for cluster-wide work)
- [ ] Composes with 081KSGS9H0008QG0R002F04ECB Twilio cluster-support: cluster-Claude is the GitHub-interface equivalent of Twilio-Claude voice-interface

## Acceptance — Phase 1 minimal-validation

- [ ] Claude installed + auth'd on `node-e5a176`
- [ ] Agent successfully addresses at least 1 Copilot finding on a registration PR (PR #5380 itself or a successor) end-to-end
- [ ] Agent's commit Co-Authored-By trailer correctly attributes to itself (per 081KSGS9H0008QG0R002T0XQ50 attribution discipline)
- [ ] Operator can revoke agent authority cleanly (claude logout + token revocation; non-coercion-invariant chosen-exit)

## Why P2

- Aaron's "i can interactive login like gh if that works" is a clear operator-authorization signal AND a future-state ("if that works") — substrate-honest framing is research-and-validate rather than ship-immediately
- Phase 0 (this row) is bounded + immediate; Phase 1 needs manual node setup + operator coordination
- P1 promotion once Phase 1 validates the auth + PR-stewardship pattern works end-to-end

## Sub-rows likely needed

To be filed as the work matures:

- 081KSGS9H0008QG0R001JNKBFD.1: install Claude Code on `node-e5a176` + operator interactive login validation
- 081KSGS9H0008QG0R001JNKBFD.2: scope-bounded PR-stewardship agent for own-registration-PR
- 081KSGS9H0008QG0R001JNKBFD.3: K8s health reporter scope expansion
- 081KSGS9H0008QG0R001JNKBFD.4: NixOS module + multi-node composability
- 081KSGS9H0008QG0R001JNKBFD.5: per-AI GitHub identity migration composing with 081KSGS9H0008QG0R002T0XQ50

## Full reasoning

Aaron's verbatim ask 2026-05-26 (preserved at top) emerged in immediate response to:

1. PR #5380 (his node-e5a176 self-registration) being auto-merge-armed AND blocked on 1 Copilot thread
2. PR #5385 (Bug 4+5 fixes including gh in systemPackages) being in-flight
3. My (Otto-CLI) demonstration of the bounded PR-stewardship work pattern: poll → diagnose → fix → push → resolve threads → repeat
4. The 081KSGS9H0008QG0R002T0XQ50 substrate landed 1 hour ago (each Zeta AI gets own GitHub identity)

The substrate target is the GitOps-native cluster substrate Aaron has been building all day (iter-5.4 + iter-5.4.1 + iter-5.4.2) gaining its own first-class AI participant — one that does for the cluster what Otto-CLI does for the operator's Mac. The interactive-login pattern (mirror of gh auth) preserves operator authority via revocable consent (per NCI HC-8).

This is the **first** of what will likely be many node-local AI participants — each cluster node hosting its own Claude (or Alexa-Kiro / Riven-Cursor / Vera-Codex / Lior-antigravity per the agent-roster-reference-card per the operator's preference per node). The substrate Aaron is asking for is the FIRST INSTANCE; the architecture is the substrate cluster of 081KSGS9H0008QG0R002T0XQ50 + 081KSGS9H0008QG0R001JNKBFD + future-row(s).
