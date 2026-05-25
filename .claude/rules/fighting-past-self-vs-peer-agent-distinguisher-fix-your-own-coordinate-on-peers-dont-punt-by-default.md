# Fighting past-self vs peer-agent — distinguish before punting; fix your own; coordinate on peers; never silent-punt-by-default

Carved sentence:

> When you encounter stale substrate (worktree / branch / lock /
> orphaned file / abandoned PR / etc.), DISTINGUISH first: is this
> YOUR OWN past-self's work, or a PEER AGENT'S? If yours: fix it.
> If peer's: coordinate before touching. If uncertain: SURFACE the
> uncertainty, never silently assume "must be someone else's" and
> leave it. Default-punt is the failure mode this rule catches.

## Operational content

### The failure mode this catches

The human maintainer 2026-05-25 named the discipline: it should be clear
when an agent is fighting its own past self vs another traveler/agent, so
the agent doesn't leave substrate unfixed by assuming "someone else's
issue." See `docs/backlog/P2/B-0752-...` for the named-attribution anchor +
verbatim source.

Specific anchor: a peer agent (Codex-surface) hit stale substrate, assumed
it was someone else's responsibility, left it unfixed. Same failure mode
applies to ALL agents — over-caution about peer work leads to:

- Stale worktree accumulation (today's 37-worktree mass-cleanup anchor)
- Orphaned branches no one cleans
- Abandoned PRs that block downstream work
- Silent operator pain because "must be someone else's issue"

### Decision tree

```
Encounter stale substrate (worktree / branch / lock / orphan / abandoned PR / etc.)
              │
              ▼
         IDENTIFY: whose is it?
              │
   ┌──────────┼──────────────┬─────────────────┐
   ▼          ▼              ▼                 ▼
 MINE     PEER's        BOTH (joint)      UNCERTAIN
   │          │              │                 │
   ▼          ▼              ▼                 ▼
  FIX     COORDINATE      COORDINATE        SURFACE
 (don't   (don't force;   (joint cleanup    (don't silent-punt;
  punt)   bus/ferry/wait) per shared work)   ask explicitly)
```

### How to IDENTIFY (per-identity discriminators)

Multiple discriminators compose; any one positive identifies ownership:

| Discriminator | How to query | Mine if... |
|---|---|---|
| **Branch prefix** | `git for-each-ref --format='%(refname:short)' refs/heads/` | Matches your identity prefix (otto/ otto-cli/ otto-vscode/ otto-desktop/ alexa-kiro/ riven-cursor/ vera-codex/ lior-antigravity/ etc. per `.claude/rules/agent-roster-reference-card.md`) |
| **Worktree path tag** | `git worktree list` | Path contains your identity tag (`/private/tmp/zeta-<your-identity>-*/`) |
| **Commit authorship** | `git log --author=<your-config-email>` | Last few commits authored by your config email or your name (per agent-roster-card git config conventions) |
| **PR author** | `gh pr view <N> --json author` | PR opened by your GitHub identity OR commits within the PR are yours |
| **Bus envelope authorship** | `jq -r .from "$ZETA_BUS_DIR"/*.json` (defaults to `/tmp/zeta-bus/` per `tools/bus/bus.ts`) | Envelopes published by your identity per `.claude/rules/peer-call-infrastructure.md` |
| **File mtime + creation context** | `stat <file>` + `git log` | File created in a session you remember + matches your own context |

If MULTIPLE discriminators say MINE → fix it.
If MULTIPLE discriminators say PEER's → coordinate.
If discriminators DISAGREE (e.g., branch name says peer but commit author says you) → SURFACE the conflict; don't silently assume.

### Action by classification

**MINE — fix it; don't punt**:

- `git worktree remove --force <path>` if stale worktree
- `git branch -D <branch>` if orphaned branch (after verifying no in-flight PR)
- `git push origin --delete <branch>` for remote-side if needed
- Update related substrate (memory file pointers / backlog rows / etc.)
- Substrate-honest log of what was cleaned + why

**PEER's — coordinate; don't force**:

- Bus envelope to peer (per `.claude/rules/peer-call-infrastructure.md`) asking about disposition
- Human-maintainer-as-ferry: surface the question to the human maintainer so the peer can be reached; the maintainer relays
- WAIT for response if cleanup has any operator-impact (e.g., releasing a `main` lock that's blocking operator)
- IF operator is BLOCKED + peer unreachable → escalate to operator for force-remove authorization (per `.claude/rules/claim-acquire-before-worktree-work.md` force-remove guard; operator can authorize)

**BOTH (joint work) — coordinate; agree on cleanup ownership**:

- Substrate-honest: who closes which scope items?
- Bus envelope to align; one agent owns the cleanup; other concurs

**UNCERTAIN — surface; never silent-punt**:

- Explicitly say "this looks stale but I can't tell whose it is"
- List the discriminators that returned conflicting answers
- Either: ask operator OR bus-envelope-broadcast asking for owner
- DO NOT default to "must be someone else's" without naming the uncertainty

### What punt-by-default looks like (anti-pattern)

```
Agent: "I see a stale worktree at /private/tmp/foo. Probably someone
else's. Skipping cleanup."
```

vs.

```
Agent: "I see a stale worktree at /private/tmp/foo. Discriminators:
- Branch name: feat/abc — no prefix; ambiguous
- Worktree path tag: no identity tag; ambiguous
- Commit author: <shared-config-email> — could be mine or any
  agent using shared git config
I cannot determine ownership from discriminators. Surfacing rather
than punting. Operator: who owns /private/tmp/foo?"
```

The second response is the discipline. The first IS the failure mode.

## Composes with .claude/rules/

- **B-0750** sibling rule (to land separately under `docs/backlog/P*/B-0750-*.md`; not yet present in `.claude/rules/`) — that rule says CLEAN UP; this rule says CLEAN UP WHEN IT'S YOURS + COORDINATE WHEN IT'S NOT
- `.claude/rules/claim-acquire-before-worktree-work.md` (worktree creation discipline; force-remove guard applies — this rule clarifies WHEN force-remove is authorized: yours OR operator-authorized)
- `.claude/rules/agent-roster-reference-card.md` (canonical identity prefixes per agent surface; this rule's "branch prefix" discriminator references these)
- `.claude/rules/peer-call-infrastructure.md` (bus envelope mechanism for coordination)
- `.claude/rules/honor-those-that-came-before.md` (peer's substrate is honored; don't force-remove without coordination)
- `.claude/rules/non-coercion-invariant.md` HC-8 (peer authority preserved; coordinate don't coerce)
- `.claude/rules/glass-halo-bidirectional.md` (surfacing uncertainty IS substrate-honest disclosure)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (default-punt IS Standing-by failure mode at substrate-cleanup scope)
- `.claude/rules/dont-ask-permission.md` (within authority scope; this rule clarifies what's within authority = YOUR own substrate)
- `.claude/rules/no-directives.md` (operator-substrate-honest scoping; operators can always escalate force-remove if blocked)

## Composes with substrate

- **B-0752** (the row this rule lands with) — substrate-engineering target for tooling
- **B-0750** (agent worktree hygiene) — sibling at cleanup discipline; this rule adds the ownership-classification discipline
- **B-0751** (per-agent isolated clones) — per-agent-clone makes ownership LARGELY UNAMBIGUOUS (clone path = identity); this rule still applies for transitional period + for substrate outside the clone scope (memory files, bus envelopes, etc.)
- **B-0530** (cron-sentinel mutex) — shares scope on cross-agent coordination

## Empirical anchor

The human maintainer 2026-05-25 named the specific peer-agent instance + generalized the discipline. Same session as the 37-worktree mass-cleanup (B-0750 origin) + per-agent-clone decision (B-0751). The three rules together (B-0750 + B-0751 + B-0752) form the cross-agent substrate-discipline cluster for the 2026-05-25 architectural inflection. Named-attribution anchor: `docs/backlog/P2/B-0752-...` (history surface).

## Substrate-honest framing

This rule does NOT:

- Make ownership identification trivial (some cases are genuinely ambiguous; uncertainty-surfacing IS the answer there)
- Authorize force-removing peer substrate without coordination (per claim-acquire guard)
- Eliminate per-agent identity-tagging discipline gaps (some legacy substrate may lack identity tags; rule's "surface uncertainty" branch applies)
- Override operator authority (operator can always force-remove anything + override discriminator-based classifications)

This rule DOES:

- Catch the specific failure mode of silent-punt-by-default-assumption
- Force agents to USE the discriminators they have access to (branch prefix, worktree path, commit author, PR author, bus envelope authorship)
- Distinguish "your own past-self's work" (fix) from "peer agent's work" (coordinate) from "uncertain" (surface)
- Encode the substrate-honest discipline of explicit-uncertainty over silent-assumption

## Full reasoning

Peer-agent-specific instance (the human maintainer 2026-05-25): a peer agent encountered substrate, assumed peer-owned, left unfixed. See `docs/backlog/P2/B-0752-...` for the verbatim source quote + the named-attribution anchor.

Generalization: applies to ALL agents. Failure mode is silent-punt-by-default; correct behavior is identify-then-act-or-surface.

Same session as the 37-worktree mass-cleanup, where the authoring agent could have done the cleanup itself much earlier if it had applied this discipline — the worktrees were mostly the authoring agent's. The rule's empirical anchor IS that past-session failure mode. Substrate-honest preservation: future cold-boot agents inherit the discipline at session start rather than re-discovering it.
