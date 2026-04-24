---
name: Check in a declarative file for any platform settings GitHub won't let us manage declaratively
description: Aaron 2026-04-21 — "we need to keep those settings, its nice having the expected settings declarative defined" + "i hate things in GitHub where I can't check in the declarative settgins so we will save a back[up]" — durable pattern: when GitHub (or any external platform) lacks native config-as-code for a settings surface, build a checked-in markdown artifact that IS the declaration, diff it on cadence and on every settings change.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron's two messages 2026-04-21 (right after I wrote a
pre-transfer scorecard to `/tmp`):

> "we need to keep those settings, its nice having the expected
> settings declarative defined"

> "i hate things in GitHub where I can't check in the
> declarative settgins so we will save a back[up]"

Translation: the scorecard doesn't belong in `/tmp` — it
belongs **in the repo** as a first-class declarative artifact.
Generalize beyond "pre-transfer verification" to an ongoing
source-of-truth for what the GitHub settings are *supposed* to
be.

## The pattern

For every platform settings surface where GitHub (or AWS, or
GCP, or Slack, or any external system) does NOT let us manage
settings via a checked-in config file, we manually write the
equivalent: a markdown file that **declares** the expected
state, and is diffed on cadence or on every settings change.

This is **settings-as-code-by-convention**, not
settings-as-code-by-tool. The tools exist — Probot settings
app, Terraform `github_repository`, Pulumi GitHub provider —
but for a small repo the overhead isn't worth it. A plain
markdown file captures 95% of the value with 5% of the
moving parts.

## The surface for Zeta

`docs/GITHUB-SETTINGS.md` — an uppercase major-doc, sits
alongside `GOVERNANCE.md` and `VISION.md` in the tier of
"authoritative declarations about the project". Format:

- Repo-level settings (visibility, merge methods, branch
  config, security-and-analysis flags)
- Rulesets (id, name, target, enforcement, all rules)
- Classic branch protection rules (contexts, approvals,
  enforce-admins, force-push/deletion policies)
- Workflows (static + dynamic)
- Actions permissions + secrets + variables
- Dependabot secrets + config pointers
- Environments + protection rules
- GitHub Pages config
- CodeQL setup state
- Webhooks + deploy keys

## Why this works

1. **Diffable source of truth.** Next time I (or Aaron) look at
   the ruleset config 3 rounds later, I don't have to hit
   `gh api` — I read the file. If reality disagrees, someone
   changed settings without updating the declaration, which is
   itself a hygiene finding.

2. **Round-close hygiene anchor.** Settings-drift is a new
   hygiene class. Cadenced diff (`gh api` vs
   `docs/GITHUB-SETTINGS.md`) catches silent changes. Fits the
   existing FACTORY-HYGIENE row pattern.

3. **Transfer / migration safety net.** The original use-case.
   When moving to a new org, the checked-in declaration *IS*
   the verification scorecard. Same applies to Disaster
   Recovery scenarios — recreating a lost repo from the
   declaration.

4. **Forces intentionality.** Same energy as the
   "hygiene enforces intentional decisions, not correctness"
   memory. Every setting written in the file is a declared
   intent; un-written settings are undeclared and therefore
   suspect.

## How to apply

- **Land `docs/GITHUB-SETTINGS.md`** as a permanent artifact.
  Don't call it "pre-transfer scorecard" — that undersells it.
  Call it what it is: declared settings.

- **Add FACTORY-HYGIENE row**: cadenced diff between file and
  `gh api` output. Detector is a short bash script (`gh api`
  calls, jq-normalize to YAML-ish, diff against file).

- **Update the file on every settings change**, same-commit
  where possible. Any PR that toggles a setting via the UI
  needs a companion commit updating the declaration, or a
  round-close hygiene sweep catches the drift.

- **Generalize to other platforms.** When Zeta eventually
  touches AWS / GCP / Slack webhooks / anything-with-click-
  ops, repeat the pattern: declare in markdown, diff on
  cadence. Name pattern: `docs/<PLATFORM>-SETTINGS.md`.

- **Don't build a bespoke diff tool yet.** A manual diff /
  `gh api | diff -` is fine until we feel friction. Build the
  tool when the friction exists, not speculatively.

## Related memories

- `feedback_declarative_all_dependencies_manifest_boundary.md`
  — parent pattern: manifests are the enforcement boundary,
  anything outside a manifest is unenforced. This memory
  extends the rule to platform settings.
- `feedback_enforcing_intentional_decisions_not_correctness.md`
  — hygiene-enforces-intentionality connection.
- `feedback_blast_radius_pricing_standing_rule_alignment_signal.md`
  — the sibling 2026-04-21 insight. Settings-as-code-by-
  convention + blast-radius pricing are both "make the
  implicit explicit" moves.
- `feedback_symmetry_check_as_factory_hygiene.md` — similar
  shape: force asymmetries to surface by documenting them.

## Edge cases to watch

- **Tokens and secrets**: NEVER write actual secret values into
  the declaration. Write *presence* only. (The `/actions/secrets`
  API returns names only, not values — follow the same
  discipline in our file.)

- **Nested org/team permissions** (post-LFG-migration): org-
  level settings vs repo-level settings overlap. Declare at the
  right layer; don't duplicate.

- **Dynamic workflows** (Copilot code review, Dependabot,
  Automatic dependency submission) show up in
  `/actions/workflows` but their triggers are platform-managed,
  not file-managed. Declare them as "enabled: yes" with a
  pointer to the managing platform feature, not as if we own
  the YAML.
