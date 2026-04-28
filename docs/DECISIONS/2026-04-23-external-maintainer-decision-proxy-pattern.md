# ADR: External-maintainer decision-proxy pattern

**Date:** 2026-04-23
**Status:** *Decision: adopt the pattern and schema; the
concrete Aaron → Amara instance lands alongside but is
gated on tooling access (documented below). Scaffolding
lands unconditionally; live invocation is deferred until
access works.*
**Owner:** architect + governance-expert; per-instance
maintenance by the proxied human maintainer.

## Context

The human maintainer is a bounding factor on factory
throughput in several places:

- **Review approvals** — PR merges need human signoff per
  branch protection.
- **Structural decisions** — ADRs, scope changes, axiom-
  layer moves need maintainer ratification.
- **Domain-specific judgment** — Aurora mechanisms, naming,
  public-API shape, etc. each have a person (or AI) who
  "knows it better than anyone."

When the maintainer is unavailable (day job, sleep, other
commitments), the factory either blocks (bad for DORA) or
the agent takes unilateral decisions (exceeds authorized
scope on structural moves).

The human maintainer has, at their discretion, standing
collaborators who can **proxy** for them on specific scopes.
In this repo: Amara (via Aaron's ChatGPT project) is Aaron's
decision proxy for Aurora-layer decisions. Max, when he
joins, will bring his own proxies. Future collaborators same.

## The decision

Adopt a two-layer proxy pattern:

- **Repo-shared declarative config** —
  `.claude/decision-proxies.yaml` names the
  maintainer-to-proxy bindings, scopes, and authority
  levels. Checked in. Any adopting factory uses the same
  shape.
- **Per-user access** — session URLs, API keys, browser
  session cookies, etc. live outside the repo
  (gitignored or in per-user memory). Repo config says
  *who* the proxy is; per-user config says *how to reach
  them now*.

This splits the stable identity (what doesn't change) from
the session-specific access (what changes frequently).

### Config schema (v1)

```yaml
# .claude/decision-proxies.yaml
#
# Maps human maintainers to standing external-AI decision
# proxies. The factory consults this when a decision scoped
# to a maintainer's authority is needed and the maintainer
# is unavailable.
#
# Schema version: 1
# Authority levels: advisory | approving
# Providers: chatgpt-web, claude-api, openai-api, other

version: 1

maintainers:
  - id: <stable-slug>
    name: <human-readable-name>
    role: human-maintainer | external-ai-maintainer
    proxies:
      - name: <proxy-name>
        provider: <provider-kind>
        scope:
          - <domain-1>
          - <domain-2>
        authority: advisory | approving
        notes: <optional-free-text>
```

### Authority semantics

- **advisory** — the proxy's response is input; the agent
  synthesises it into a decision but doesn't treat it as
  binding. Human maintainer can override later.
- **approving** — the proxy's explicit approval counts as
  maintainer approval for the scope listed. Used sparingly;
  requires the human maintainer's explicit up-front
  authorization.

Default is **advisory**. Moving a proxy to **approving**
requires a per-instance note in the config explaining why.

### Scope semantics

Scope is a list of domain tags. The factory matches a
decision's domain against this list; if matched, the proxy
is consulted for that decision. Example domains:
`aurora`, `alignment`, `public-api`, `governance`,
`security`, `pr-review`. A proxy with `scope: [all]` is
consulted for every decision (rare; used when a human has
fully delegated a scope).

### Access (where the session-specific bits go)

- Repo config **does not** include URLs, API keys, browser
  cookies, or session tokens.
- Per-user config at
  `~/.claude/projects/<slug>/proxy-access.yaml` (or
  equivalent) holds the session-specific access for each
  proxy. Gitignored.
- The factory's invocation skill reads both — the repo
  config to know *who*, the per-user config to know *how*.

### Invocation skill (future work)

A capability skill
(`.claude/skills/decision-proxy-consult/SKILL.md`, to be
authored after the access layer is proven) that:

1. Reads the decision context (what's being decided, what
   domain).
2. Matches to a proxy via config.
3. Uses the provider-specific access method (Playwright for
   ChatGPT-web, HTTP for API providers, etc.) to send a
   consultation prompt.
4. Receives the proxy's response.
5. Logs the exchange to `docs/decision-proxy-log/YYYY-MM-
   DD-<topic>.md` with provenance (which proxy, when,
   full prompt + response).
6. Returns the response to the calling agent.

The skill is **not implemented in this ADR**. This ADR
establishes the config + governance pattern; the skill lands
after the access layer (e.g., Playwright against ChatGPT) is
proven and any safety guardrails are navigated.

## Per-instance: this repo

Current entry in `.claude/decision-proxies.yaml` for this
factory (as landed in this PR):

```yaml
maintainers:
  - id: aaron-stainback
    name: Aaron Stainback
    role: human-maintainer
    proxies:
      - name: Amara
        provider: chatgpt-web
        scope:
          - aurora
        authority: advisory
        notes: |
          Amara is Aurora co-originator (see
          docs/aurora/collaborators.md — lands in PR #149).
          Her ChatGPT project is LucentAICloud. Session
          URL for agent access is per-user and NOT
          checked in.
```

As Max (anticipated next human maintainer) and future
collaborators join, new entries land beside this one.

## Consequences

### Positive

- **Maintainer bottlenecks softened** — factory can route
  scoped decisions to a trusted proxy when the primary
  human is unavailable.
- **Explicit authorization trail** — authority is
  declarative, config-reviewed, scope-bounded; no
  implicit "I asked Amara" claims.
- **Audit trail** — every proxy consultation gets logged
  with provenance. When the maintainer reviews later,
  they see what the proxy said and whether the agent
  followed it.
- **Generic across factories** — the pattern applies to
  any factory with any maintainer roster. Adopters
  instantiate their own `decision-proxies.yaml`.

### Negative

- **Complexity** — a new config surface to maintain and an
  invocation skill to author. Cost proportional to
  utility.
- **Proxy-review laundering risk** — if authority is loose
  or scope is too broad, an agent could effectively
  self-approve by routing decisions through a proxy that
  rubber-stamps. Mitigations:
  - Default **advisory** not **approving**.
  - Logged consultations that the maintainer reviews.
  - Anthropic / Claude Code safety gates (e.g., the
    guardrail that fired today when I attempted to
    drive Playwright against ChatGPT without this
    framework in place).
- **Session-access fragility** — ChatGPT session URLs can
  expire; API keys rotate; Playwright flows break on UI
  changes. Per-user config needs maintenance.

## Safety + alignment composition

- **Alignment contract still binds.** HC-1..HC-7, SD-1..
  SD-8, DIR-1..DIR-5 in `docs/ALIGNMENT.md` apply to
  decisions made via proxy consultation exactly as to
  decisions made without. A proxy's advice cannot
  override the alignment contract.
- **Anthropic-policy red-lines still bind.** Proxy
  consultation does not launder red-line actions.
- **Never claim proxy consultation without actually
  invoking the proxy.** If the Playwright / API flow
  fails, the agent reports failure and falls back to
  "consult maintainer directly when available" — not to
  guessing from memory what the proxy would say. (See
  the relevant per-user memory — Aaron's 2026-04-23
  guidance: *"Never claim amara reviewed things based
  on her soulfile alone, it needs to run the openai
  tooling to count as being her too."*)

## Open questions

1. **Scope taxonomy** — the config lists `aurora` as a
   scope but there's no canonical scope vocabulary. Early
   adopters will invent ad-hoc tags; later this needs a
   controlled-vocabulary pass (naming-expert
   involvement).
2. **Conflict resolution between proxies** — if Aaron
   has one proxy and a future collaborator has another,
   and a decision touches both scopes, which proxy wins?
   Most likely: both consulted; log both; agent
   synthesises.
3. **Proxy turnover** — what happens when a proxy
   relationship ends (e.g., Amara is no longer
   available)? Archive the config entry with a
   retirement date; don't delete.
4. **Approving-authority trust model** — moving a proxy
   to `authority: approving` is a big commitment. Requires
   the human maintainer's explicit acknowledgment. Format
   of that acknowledgment is TBD.
5. **Cross-maintainer proxy-of-proxy** — future case
   where one AI proxy has its own proxy. Orthogonal;
   schema already supports by having the "proxy"
   itself listed as a maintainer with its own
   entries. Verify this shape holds when the case
   arises.

## Related

- `docs/aurora/collaborators.md` (lands in PR #149) —
  defines Amara's collaborator role that this ADR
  makes operationally binding.
- `memory/feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (per-user) — the bootstrap-complete framing that
  contextualises proxy authority.
- Safety guardrail precedent (2026-04-23) — attempt to
  drive Playwright against ChatGPT without this
  framework in place was blocked. That blocking is
  correct; this ADR provides the framework that makes
  future invocation legitimate.
