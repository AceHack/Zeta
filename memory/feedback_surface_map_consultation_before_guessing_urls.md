---
name: Consult the mapped surface before guessing URLs — a wrong URL on a mapped surface is a drift smell
description: Aaron 2026-04-22 after agent invented `/orgs/.../billing/budgets` (404) — "i'm supprised you got the url wrong given you mapped it" + "that should be a smell when that happen to a surface you already have mapped". Two orthogonal smells compound — (1) not-consulting an existing map, (2) consulting-but-stale map. Before `gh api <guessed-path>` on any surface that has a mapping doc under `docs/research/*-surface-map-*.md` or `docs/AGENT-*-SURFACES.md`, grep the map first. If the map lacks the path, that's a map-gap to fill, not a license to guess. If the map has the path but the API returns 410, that's map-drift to repair.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** Before calling `gh api <path>` (or equivalent) for a
surface that has a mapping doc, **grep the map first**. Guessing
a URL for a surface the factory has already mapped is a drift
smell and should fire a hygiene alarm.

Two orthogonal failure modes:

1. **Not-consulting.** A map exists, contains the correct path,
   but the agent invents a new path anyway. Root cause: agent
   didn't recall the map was available. Fix: make the map
   consultation a pre-call step. This is the *pure* smell.
2. **Consulting-but-stale.** The map has a path, but GitHub /
   the platform moved it. The `gh api` call returns `410 Gone`
   (often with a `documentation_url` pointing at the new
   endpoint). Root cause: map drift since author-time. Fix:
   auto-propose a map-update task on any 410.

**Why:** Aaron 2026-04-22, verbatim:

> "i'm supprised you got the url wrong given you mapped it"

and the meta-framing immediately after:

> "that should be a smell when that happen to a surface you
> already have mapped"

Context: agent tried `/orgs/Lucent-Financial-Group/billing/budgets`
(404 — path never existed; budgets are UI-only on GitHub's side,
`https://github.com/organizations/{org}/billing/budgets` in the
browser) after task #195 had already produced
`docs/research/github-surface-map-complete-2026-04-22.md` §A.17
enumerating the real billing endpoints. The agent didn't grep
the map; it guessed.

**Same incident revealed map-drift** on a separately-mapped
endpoint: `/orgs/{org}/settings/billing/actions` (map §A.17:317)
now returns 410 with a documentation_url pointing at
`https://gh.io/billing-api-updates-org`. That's failure mode 2,
distinct from the guessing smell.

**How to apply:**

1. **Pre-call check.** Before any `gh api <path>` targeting
   org/enterprise/Copilot/billing surfaces:
   ```bash
   # Does the map know about this kind of thing?
   grep -li "<surface-keyword>" docs/research/*surface*map*.md \
                                 docs/AGENT-*-SURFACES.md \
                                 docs/HARNESS-SURFACES.md \
                                 docs/GITHUB-SETTINGS.md
   # Then grep within the matched file for the exact endpoint.
   ```
   If the map lists the endpoint, use that one. If the map
   doesn't list it, **treat that as a map-gap finding**, not a
   license to guess.

2. **Post-call check on 410 / 301 / endpoint-moved responses.**
   When the platform redirects, file a map-update task:
   - Write the new path to the appropriate map doc.
   - Note the old path + 410 redirect URL + date of drift in a
     "Map drift log" section.
   - Link the moved endpoint to the factory-hygiene row that
     catches this class (see row added 2026-04-22).

3. **Surface-map-drift smell as a hygiene class.** Added to
   `docs/FACTORY-HYGIENE.md` as row "surface-map-drift smell".
   Two detectors pair with it:
   - **Pre-call**: grep-the-map discipline (manual, but
     reinforced by this rule).
   - **Post-call**: 410/301 responses from a mapped endpoint
     auto-propose a map-update.

4. **Missing-from-map is a map-gap finding, not a blocker.**
   When an audit needs an endpoint the map doesn't have, the
   agent may still call the endpoint if confident — *but* the
   audit output must include a "Map gap discovered" row so the
   next round-close sweep extends the map. Inventing a URL when
   confident is OK if also confident the URL exists; inventing
   a URL *and being wrong* because the real thing doesn't exist
   is the anti-pattern Aaron flagged.

5. **UI-only surfaces are legitimate map entries.** Budget
   management on GitHub is UI-only
   (`https://github.com/organizations/{org}/billing/budgets`)
   with no REST endpoint — that's a real surface characteristic,
   not a mapping gap. The map should document UI-only entries
   alongside API-enumerable ones so the agent knows "no API
   path exists" before trying.

**Artifacts this rule creates:**

- `docs/FACTORY-HYGIENE.md` — new row "surface-map-drift smell"
  cadence: on-every-gh-api-failure + cadenced sweep.
- `docs/research/github-surface-map-complete-2026-04-22.md` —
  add a "Map drift log" section capturing
  `/orgs/{org}/settings/billing/actions` 410 (moved 2026-04-22
  per `https://gh.io/billing-api-updates-org`).
- `docs/research/github-surface-map-complete-2026-04-22.md` —
  add "UI-only surfaces" subsection for org budget management.

**Cross-reference:**

- `reference_github_code_scanning_ruleset_rule_requires_default_setup.md`
  — prior drift finding where the map didn't initially capture
  the default-setup / advanced-setup split.
- `feedback_github_settings_as_code_declarative_checked_in_file.md`
  — the settings-as-code doc that should also track UI-only
  surfaces as declarative entries.
- `feedback_hot_file_path_detector_hygiene.md` — analogous
  git-as-index discipline (consult the cheap source first).
- `feedback_verify_target_exists_before_deferring.md` — same
  family of "verify before citing / calling" discipline.

**Source:** Aaron direct message 2026-04-22 during round-44
speculative drain, immediately after agent tried a guessed
budget endpoint.
