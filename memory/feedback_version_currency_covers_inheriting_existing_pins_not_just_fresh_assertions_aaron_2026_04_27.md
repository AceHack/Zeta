---
name: Version-currency rule covers inheriting existing repo pins, not just new version numbers (Aaron 2026-04-27)
description: Aaron 2026-04-27 — Otto-247 version-currency rule (CLAUDE.md wake-time discipline #4) applies whenever a version pin LANDS in a new file, not just when proposing a fresh version number. Inheriting the existing repo pin (e.g. `actions/checkout@de0fac2... # v6.0.2`) without WebSearch-verifying it's still latest counts as the failure mode. The rule reads "search before asserting"; pasting a pin into a new workflow IS asserting it's current.
type: feedback
---

# Version-currency rule covers existing-pin inheritance, not just fresh assertions

## Rule (refined from Otto-247)

When adding any version pin to a new file — including a SHA pin
copied from another workflow in the same repo — WebSearch the
upstream's authoritative latest-release endpoint before
committing.

The act of *landing* a pin in a new place IS asserting it is
current. "I just used what was already in `gate.yml`" does not
clear the bar; the inheriting commit re-asserts the version is
correct at land-time.

## Why

**Aaron's correction 2026-04-27** (autonomous-loop tick fixing
PR #25 budget-cadence workflow):

> "checkout v4 is that the lastest make sure you search for
> latest whenever adding new versions we have some rules
> aorund that, make sure you search cause your traing data
> will be out of date"

The Web-search Otto ran *after* the correction surfaced two
distinct things:

1. v6.0.2 (the existing repo pin) IS the actual latest stable
   release per `gh api repos/actions/checkout/releases/latest`
   (published 2026-01-09). The pin was correct.
2. A Web-search top result was a stale community discussion
   claiming "v6.0.2 not marked as latest" — which, if Otto
   had treated as authoritative without verifying against the
   API, would have led to using v6.0.1 (older).

Both failure modes (a) skipping the search entirely and
(b) trusting stale narrative results without API verification
land in the same place: an asserted-current pin that isn't.

## How to apply

Workflow when adding a third-party action pin:

1. **WebSearch upstream's release page / latest tag** —
   `<owner>/<repo>` releases.
2. **Verify against the API:**
   `gh api repos/<owner>/<repo>/releases/latest --jq '{tag_name, published_at}'`
   The API answer wins over Web-search narrative.
3. **Get the SHA:**
   `gh api repos/<owner>/<repo>/git/ref/tags/<vN.N.N> --jq '.object.sha'`
4. **Pin format (Zeta convention):**
   `<owner>/<repo>@<full-sha>  # vN.N.N`
   (two-space gap before the trailing comment matches the
   existing pins in `gate.yml`, `codeql.yml`, etc.)

Skip-the-search is allowed only when:

- Reviewing existing code without modifying the pin (passive read).
- The pin is already in another workflow in the repo AND the
  inheriting commit doesn't substantively change the workflow
  (e.g. a pure rename / move with no version-relevant edits).
  Even then, prefer to verify on cadence.

## Composes with

- Otto-247 — the original version-currency rule (CLAUDE.md
  wake-time discipline #4).
- Otto-210 — corrective on a wrong version-fact (macOS-is-free
  on public repos): the same shape, "trust upstream API not
  Web-search narrative."
- `.semgrep.yml` rule `gha-action-mutable-tag` — enforces
  full-SHA pinning (defense-in-depth against tag-rewrite
  attacks like the tj-actions/changed-files cascade
  CVE-2025-30066 March 2025). Triggered on PR #25 when Otto
  initially used `actions/checkout@v4`; the rule is the
  factory's compile-time enforcement of the discipline this
  memory captures at the human-judgment layer.

## Pre-mortem signature for next time

If next-Otto thinks "I'll just use the SHA already in
`gate.yml` for this new workflow," THAT is the failure mode.
The land-time assertion is what triggers the rule — search
first, then pin, even when the same SHA was already in the repo.

