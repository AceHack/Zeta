---
name: AUTHORITY GRANT — github admin granted to loop-agent (Otto) by maintainer 2026-04-24; durable across sessions; covers admin-level GitHub operations (branch protection, repo settings, ruleset management); first explicit named-permission grant; future-self can run admin-level gh api commands without per-call permission prompts; harness-level deny may still trigger and require maintainer to add a Bash permission rule
description: Maintainer 2026-04-24 explicitly granted github-admin authority to the loop-agent. Save as durable per maintainer directive. Used 2026-04-24 to update branch-protection required-checks for #375 unblock. Composes with the BACKLOG row for the named-permissions-registry design (per-contributor scoped permissions, iterative hardening).
type: feedback
---

## The grant (verbatim)

Maintainer 2026-04-24:

> *"i give you github admin"*

Then immediately after I asked whether to durabilize it:

> *"save my permission as durable yes"*

Plus directive on the broader design:

> *"we shoud probbably have a list of named permissions
> you might need and thier names and descriptions and
> which ones are active for which contributro. this in
> not super safe yet but we can nake it more safe over
> time."*

## Scope of the grant

**github-admin** (named permission, this entry's
inaugural use):

- Branch protection PATCH (required status checks,
  required reviews, enforce admins, admin overrides).
  Verified working 2026-04-24 by updating
  `repos/Lucent-Financial-Group/Zeta/branches/main/protection/required_status_checks`
  to migrate from `build-and-test (ubuntu-22.04)` to
  the new 7-context list, unblocking PR #375.
- Repo settings PATCH (visibility, default branch,
  feature flags, security/SSH/Pages).
- Ruleset CRUD if needed (rulesets API).
- Workflow dispatch + cron triggers via `gh workflow run`.
- Branch-protection-related ops via `gh api`.

**NOT in scope** (separate grants required):
- Org-level admin (org settings, org-level rulesets).
- Repo deletion / transfer.
- Member management.
- Force-push to main.
- Bypass branch protection on a single PR.

## Used 2026-04-24

First use: PATCH `required_status_checks` on
`Lucent-Financial-Group/Zeta` `main` branch. Replaced
[`build-and-test (ubuntu-22.04)`, 4 lint contexts] with
[`build-and-test (macos-26)`, `build-and-test
(ubuntu-24.04)`, `build-and-test (ubuntu-24.04-arm)`,
4 lint contexts]. Unblocked PR #375 which had been
wedged for hours on the chicken-and-egg problem (PR
renamed matrix; live protection still required old
name).

## Harness-level deny risk

Even with this grant, harness-level Bash permission
checks may still deny specific gh api PATCH calls
because the harness scans for "Security Weaken /
Permission Grant on shared infrastructure" patterns.
**The grant is at the maintainer-policy layer; the
harness is a separate enforcement layer.** When the
harness denies despite this grant being in place:

1. Re-attempt with explicit-language confirmation in
   the recent maintainer message (the harness may
   require both the grant AND a recent
   explicit-authorization message).
2. If still denied, paste the exact command for the
   maintainer to run themselves.
3. If a pattern repeats often, ask the maintainer to
   add a Bash permission rule to settings.

Not a bug — defense in depth.

## Composes with

- **BACKLOG row** for the named-permissions-registry
  design (per-contributor scoped permissions, iterative
  hardening).
- **Otto-244 no-symlinks** (cross-cutting authority
  pattern — different domain but same "named-policy
  with explicit scope" shape).
- **GOVERNANCE** — factory-managed external surfaces
  discipline (the broader pattern; GOVERNANCE §31
  itself is specifically the Copilot-instructions case).
- **Aminata threat-model** — any expansion of granted
  permissions deserves an adversarial review pass.

## Future Otto reference

When attempting an admin-level GitHub operation: cite
this grant in the action's commit message or
PR-description so the audit trail is clear. Don't
expand scope silently — if a new admin op needs
authority that isn't in the listed scope above, ask
the maintainer first.

If the harness blocks despite this grant being on
file, retry once with maintainer's explicit
re-authorization in the recent context window; if that
fails, paste the command for them to run.
