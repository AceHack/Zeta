---
name: "Can we just use git for that?" eliminates entire proposed subsystems
description: Aaron's load-bearing elimination pattern — before proposing an index / tracker / registry, ask whether git (log, blame, history, diff, grep) already is one. Confirmed 2026-04-21 on the hot-file-path detector.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Before proposing any new indexing / tracking / registry
subsystem, ask: **is git already an index for this?** Git keeps
commit-by-file history, per-line authorship, chronological
ordering, and atomic merge semantics. A one-liner over git log
often replaces an entire would-be subsystem.

**Why:** Aaron 2026-04-21, confirming my insight block on PR #37
(hot-file-path detector): *"nice insight — One-liner detectors
beat index-builders. The hot-file hygiene row doesn't ship any
new code — `git log --name-only | sort | uniq -c | sort -rn` is
cadenced and durable because git history is the index. Aaron's
pattern of asking 'can we just use git for that' is load-bearing:
it routinely eliminates entire proposed subsystems."*

The pattern surfaced on the hot-file-path detector
(`feedback_hot_file_path_detector_hygiene.md`): instead of
building a churn-index side-file with a schema, a writer, and
a reader, `git log --since="60 days ago" --name-only | grep -v
'^$' | sort | uniq -c | sort -rn` is the whole detector. No
index, no schema, no maintenance.

**How to apply:**

When someone (me included) proposes a new tracker / registry
/ index / log, check git first:

| Proposed subsystem | Git one-liner that already does it |
|---|---|
| Churn index | `git log --name-only \| sort \| uniq -c \| sort -rn` |
| Who-touched-this ledger | `git blame` / `git log --follow` |
| Activity-per-author | `git shortlog -sn --since="60 days ago"` |
| File-age inventory | `git log --diff-filter=A --name-only` |
| Regression fingerprint | `git bisect` |
| Merge-conflict pattern | `git log --merges --name-only` |
| Retirement log (deleted files) | `git log --diff-filter=D` |
| Rename history | `git log --follow --find-renames` |
| Stale-branch inventory | `git branch -a --sort=-committerdate` |
| Cross-round diff | `git diff <tag-round-N>..<tag-round-N+1>` |

If the proposed subsystem is **covered by a git primitive plus
sort/grep**, the subsystem is accidental complexity (Rodney's
Razor). The one-liner is the deliverable; the only durable
output is (a) the command itself (in a hygiene row, skill, or
script) and (b) the decision to run it on a cadence.

**Counter-cases (where an index is genuinely needed):**

- Cross-repo queries (git is single-repo).
- Semantic-level queries git doesn't know about (e.g. "which
  files mention the ZSet algebra in their docstrings" — needs
  content analysis, though `git grep` often still wins).
- Derived / computed signals that would re-run expensively
  per query (but usually cache the one-liner's output rather
  than build an index).
- External-system tracking (GitHub issues / PRs, which `gh`
  CLI + `gh api` often covers as another "it already exists"
  primitive).

**Pairs with:**

- `feedback_hot_file_path_detector_hygiene.md` — the original
  instance.
- `feedback_crystallize_everything_lossless_compression_except_memory.md`
  — same spirit: reduce proposed structure to the minimum
  lossless form.
- Rodney's Razor (essential-vs-accidental cut) — git primitives
  are the essential layer; bespoke indexes are often the
  accidental layer.
- `feedback_practices_not_ceremony_decision_shape_confirmed.md`
  — reject over-built subsystems mid-research.

**Scope:** `factory` — applies to every factory subsystem
proposal. Also ships as a general pattern to adopter projects
(git is the shared substrate).
