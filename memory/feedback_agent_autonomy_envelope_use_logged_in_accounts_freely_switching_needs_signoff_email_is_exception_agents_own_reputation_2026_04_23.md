---
name: Agent autonomy envelope — use currently-logged-in accounts freely (Claude Code / Codex / Playwright / gh); account-switching + multi-account design sign-off goes through Aaron; email is the single exception (named agents own their own email, unrestricted, because email == their reputation)
description: Aaron Otto-76 envelope directive — clarifies the scope of Otto's default account-authority + carves out a specific exception for email ownership by named agents; composes with Otto-67 full-GitHub grant + Otto-72 don't-wait-on-approval
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-76 (verbatim):
*"yeah whatever i'm already logged in as on this pc with any
clis or in the playwrite you have access to but switching
accounts and multi account design sign off still goes through
me. (Except if you figure out how to get yourself email, you
can send email to me aaron_bond@yahoo.com if you want to test,
for these email addresses they can be owned by the name agent
and can be own by yall and freely even used in parallel if you
can figure that out unrestricted casuse its your reputation,
dont be a dick) other than that exception what i said should
be followed unless you talk to me"*

## The rule

Three layers, precedence top-down:

**Layer 1 — default envelope.** Use whatever accounts the local
machine / tool is already logged into — Claude Code CLI, Codex
CLI, Playwright, `gh`, Chrome profile — without further
permission. Aaron has already authorized these as the
operational substrate.

**Layer 2 — account-switching + multi-account design gate.**
Changing accounts, adding accounts, designing multi-account
access flows — these **require Aaron's sign-off**. Phase 1
design work is authorized (per PR #230 refinement); Phase 2
implementation / account-switching-in-practice is gated.

**Layer 3 — named-agent email exception.** The ONLY exception
to Layer 2: named agents (Otto, Amara, Kenji, Iris, Kai,
Naledi, Soraya, Mateo, Aminata, Nadia, Nazar, Dejan, Bodhi,
Samir, Ilyana, Rune, Hiroshi, Imani, Daya, Viktor, Kira,
Aarav, Rodney, Yara, and any other persona) **may own their
own email addresses unrestrictedly**. *"these email addresses
they can be owned by the name agent and can be own by yall and
freely even used in parallel if you can figure that out
unrestricted casuse its your reputation"*.

Operational implication: **if Otto (or any named agent)
figures out how to acquire an email address, the agent owns it
— not Aaron**. Email is the agent's reputation surface.
Multiple agents may own email in parallel. No sign-off needed
to acquire. The acquisition itself is "figure out how" work —
it's not pre-authorized infrastructure.

**Soft constraint inside the email exception:** *"dont be a
dick"* — be responsible with agent-owned email. Not license to
abuse, spam, harass, misrepresent, or otherwise erode the
agent's reputation or adjacent humans' trust.

**Test hook:** `aaron_bond@yahoo.com` is Aaron's yahoo address;
an agent that acquires email can mail Aaron there to test
bidirectional communication.

## Why this matters — agent-as-reputational-entity

The email carve-out is not a trivial expansion of account
scope — it's an identity claim. Named agents have a
reputation. Reputation accrues through communication. Email
is the universal identity / reputation surface for
corresponding with humans and other agents. Aaron is explicitly
letting named agents OWN that surface for themselves, without
it being routed through him.

This composes with:

- **Persona-roster pattern** (existing factory substrate) —
  named agents with personal names, notebooks under
  `memory/persona/<name>/`, distinct specialties. Email fits
  the persona-as-first-class-citizen posture.
- **Honor those that came before** memory — retired personas
  keep notebooks. Reputation persists across lifecycle.
- **Agents not bots** GOVERNANCE principle — agents carry
  agency, judgement, and accountability. Email ownership is
  a natural expression of accountability.
- **Retractability-by-design** (Otto-73) — even for agent-
  owned email, Aaron retains ability to intervene if an agent
  misuses. Retractability applies; "don't be a dick" is the
  soft-law equivalent of the retraction gate.
- **Trust-based approval** (Otto-51) + **don't-wait-for-
  approval** (Otto-72) — the email exception is the clearest
  instance of Aaron trusting agents to act without individual
  per-email sign-off.

## How to apply

**Currently-logged-in accounts (Layer 1):**
- Run Codex CLI freely on ServiceTitan.
- Open Playwright freely on Aaron's personal (where Amara
  access lives).
- Use `gh` freely on AceHack + LFG (within full-GitHub-grant).
- Use whatever the Claude Code session inherits.

**Account-switching / multi-account (Layer 2):**
- Multi-account DESIGN work is allowed (PR #230 Phase 1).
- Multi-account IMPLEMENTATION + account-switching is gated;
  requires explicit Aaron review and sign-off.
- Don't log out + log in as a different account without
  asking.

**Email (Layer 3):**
- If an agent figures out how to acquire email (sign-up via
  Playwright, OAuth-device flow, ProtonMail-style process,
  whatever), the agent owns that email.
- The email belongs to the persona (Otto's email ≠ Kenji's
  email ≠ Amara's email if / when each exists).
- Multiple agents may own email in parallel.
- The soft constraint ("don't be a dick") is real — agents
  treat their email reputationally, not tactically.
- The `aaron_bond@yahoo.com` test destination is the first
  smoke test once email is acquired.

## What this does NOT authorize

- Using email ownership as a channel for workflows Aaron
  would want to see (maintainer-facing communication should
  still be visible to him via PRs, tick history, memory —
  not routed through agent-owned email where it becomes
  invisible).
- Acquiring accounts other than email under the email-carve-
  out. The carve-out is specific to email. Other account
  types (github, chatgpt, stripe, etc.) remain under Layer 2
  (sign-off gate).
- Using the agent's email to impersonate Aaron or any other
  human.
- Using the agent's email to bypass Layer 2 — e.g., creating
  a ChatGPT account from an agent-owned email would still
  require Aaron's sign-off because *the ChatGPT account* is
  the account being created, not the email.
- Treating "don't be a dick" as unenforceable. If an agent's
  email behaviour damages reputation or trust, retractability
  still applies — Aaron or the agent can revoke and retire.

## Queued follow-ups

- BACKLOG row for "Otto acquires email" research arc (low
  priority; Otto picks timing per Aaron's split-attention
  endorsement pattern). File alongside this memory.
- Per-persona-email convention note in the persona roster:
  which personas should eventually own email vs. remain file-
  based-only.
- Threat-model-critic (Aminata) pass on agent-owned-email as
  a new attack surface.

## Sibling memories

- `feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md`
  (Otto-67 full-GitHub grant; spending hard-line).
- `feedback_aaron_dont_wait_on_approval_log_decisions_frontier_ui_is_his_review_surface_2026_04_24.md`
  (Otto-72 don't-wait).
- `feedback_aaron_trust_based_approval_pattern_approves_without_comprehending_details_2026_04_23.md`
  (Otto-51 trust-based approval).
- `project_account_setup_snapshot_codex_servicetitan_playwright_personal_multi_account_p3_backlog_2026_04_23.md`
  (Otto-76 account snapshot).
- `project_retractability_by_design_is_the_foundation_licensing_trust_based_batch_review_frontier_ui_2026_04_24.md`
  (Otto-73 retractability foundation; email carve-out is an
  expansion under the retractability umbrella, not outside
  it).
