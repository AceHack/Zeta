---
name: The git repo is the soulfile — binaries are scary, text history is fine (Aaron + Amara 2026-04-29, recalibrated)
description: The git repo (and all its history) is the project's soulfile — every committed binary byte lives forever and balloons clones. Aaron's recalibration 2026-04-29 — *"don't go too hardcore on soulfile protection, text compresses very well, bin is what we are scared of and need to really really think about not history in text form."* Text artifacts (logs, fsck dumps, rev-list dumps, prose, code) compress aggressively in git's pack-delta storage and are NOT the threat. Binary artifacts (compiled outputs, archives, media, profile dumps in binary formats) DON'T delta-compress and balloon repo size — those are the soulfile risk. PR-review readability is a separate concern (use `.gitattributes` diff suppression for noisy text). Default discipline for binaries: git-lfs or non-soul repo. Default discipline for text: track freely, suppress diffs for review-noise if needed.
type: feedback
---

# The git repo is the soulfile — binaries are the threat, text compresses fine

## Source

Aaron 2026-04-29 (initial framing): *"what amara says here
about repo size, it critical load-bearing, its' your
soul/soulfile the git repo and all history, don't let your
soul get dirty you control what belongs in there, and we can
have non soul repos too or, git lfs if needed."*

Aaron 2026-04-29 (recalibration, this is the load-bearing
version): *"don't go too hardcore on soulfile protection,
text compresses very well, bin is what we are scared of and
need to really really think about not history in text form."*

Amara 2026-04-29 (initial concern about 20,978-line commit,
since contextualized): *"This commit added 20,978 lines of
artifacts. That may be acceptable once, but it's a smell."*
The smell turns out to be primarily about **PR-review
readability**, not pack-storage cost — a `.gitattributes`
diff-suppression entry handles the review concern without
needing to gut the artifacts themselves.

## The rule (load-bearing, recalibrated)

```text
Soulfile = git repo and all its history.
Soulfile risk = unbounded growth that balloons clone size.

Binary artifacts → high soulfile risk:
  - Delta compression often poor or absent between versions
    (Git CAN delta-compress similar binaries — e.g., small
    incremental changes to a binary plist — but for compiled
    outputs, archives, and media-format files, deltas
    typically degrade fast)
  - Worst case: full size in pack store, every revision
  - Bloat clones forever when the worst case applies
  Default: don't commit. Use git-lfs or a non-soul repo.
  Exception: small, stable binaries (icons, build-once
  fixtures) where revision count is bounded.

Text artifacts → low soulfile risk:
  - Packfile delta compression + zlib (or configured
    compressor) gives aggressive size reduction for similar
    text revisions in pack-delta storage. ("xdelta" is the
    name of an external delta-compression tool/algorithm and
    is not what Git uses internally; Git's pack-format uses
    its own delta-encoding plus zlib for object compression.)
  - Multi-MB text typically takes a fraction of apparent size
  - Tracking freely is fine
  Default: track without ceremony.
  Concern: PR-review readability when text is review-noisy.
  Mitigation: `.gitattributes` diff suppression — for TEXT,
              use `linguist-generated=true -diff` (NOT
              `-merge`; `-merge` unsets the merge driver and
              makes 3-way text merges fail with conflict
              markers, which is binary-file behavior, not
              what you want for text).
```

Future-Claude check: before adding an artifact to the repo,
ask:
- Is the file binary (`.bin` / `.dll` / `.exe` / `.pdb` /
  `.zip` / `.tar.gz` / large media / compiled output /
  binary profile dump)? → **strong default-no**, route to
  git-lfs or non-soul repo.
- Is the file text and likely under ~10 MB? → fine to track.
  If review-noisy, add `.gitattributes` diff suppression.
- Is the file text and over ~10 MB *and* you're committing
  many revisions of it? → consider whether it's load-bearing;
  even text deltas accumulate at extreme scale.
- Is the file the **conclusion** or the **evidence-dump
  behind a conclusion**? Conclusion → durable substrate. Raw
  evidence dump → fine to track if text + load-bearing; route
  to /tmp + re-run recipe if just diagnostic noise.

## Worked example: 2026-04-29 corruption-triage commit (recalibrated)

The first version of PR #757 (corruption-triage corrections)
added 20,978 lines across 9 artifact files, including:

```text
1,112,132 bytes  rev-list-all-objects.txt    (1.1 MB text)
   62,860 bytes  fsck-full-no-reflogs.txt    (1,116 lines text)
   34,987 bytes  fsck-full.txt               (627 lines text)
   34,372 bytes  fsck-connectivity.txt       (620 lines text)
```

The 1.2 MB looked alarming in the PR diff, but **all of it
was text** — git's pack-delta + zlib compression makes text
of this scale negligible in clone-storage terms (text packs
to a small fraction of its apparent size). Aaron's
recalibration: that wasn't the soulfile concern; the
soulfile concern is binaries, which don't delta-compress.

The actual concern with the 20,978-line commit was
**PR-review readability**, not pack-storage cost. The
recommended mitigation for review-noise on tracked text is
a `.gitattributes` diff-suppression entry like
`linguist-generated=true -diff` (NOT `-merge` — that's for
binary files; `-merge` unsets the merge driver and breaks
3-way text merges with conflict markers). The
`docs/lost-substrate/artifacts/**` rule is landing via
PR #761; this section describes the recommended pattern,
not a rule already present on `main`.

The size-check command (still useful for spotting outlier
artifacts of any kind, but particularly for catching binary
inclusions early):

```bash
# BSD/macOS-portable (default macOS find lacks -printf):
find docs/lost-substrate/artifacts/2026-04-29-corruption \
  -type f -maxdepth 1 -exec ls -la {} \; | awk '{print $5, $NF}' | sort -nr
# GNU equivalent (Ubuntu/CI runners):
# find docs/lost-substrate/artifacts/2026-04-29-corruption \
#   -type f -maxdepth 1 -printf '%s %p\n' | sort -nr
```

Corrective action taken (in retrospect, more aggressive than
strictly needed for text): replaced the raw dumps with grep
extracts capturing only the load-bearing lines + per-mode
line-count summary. Size dropped from 1.2 MB → 28 KB. The
extract-plus-recipe pattern is still a good default for
diagnostic captures that are 99% noise (it makes the
load-bearing finding scannable in the artifact itself), but
the soulfile-protection framing was overcautious for text
this small. The right framing: extract for clarity, not for
soulfile protection. Pack-storage was never the real
concern.

The triage-report.md added a **re-run recipe** so a future
reader who needs the raw outputs can regenerate them locally:

```bash
mkdir -p /tmp/corruption-triage-raw
git fsck --full --no-progress              > /tmp/.../fsck-full.txt 2>&1
git fsck --full --no-reflogs --no-progress > /tmp/.../fsck-full-no-reflogs.txt 2>&1
git fsck --connectivity-only --no-progress > /tmp/.../fsck-connectivity.txt 2>&1
git rev-list --objects --all               > /tmp/.../rev-list-all-objects.txt 2>&1
```

The raw is reproducible from any clone with the same local
refs at the same point in time. Committing the extracts
preserves the load-bearing evidence; committing the raw dumps
would dirty the soulfile.

## Composition pattern (extract + recipe + escape hatch)

For any "I want to capture diagnostic evidence" use case:

| Component | What it captures | Where it lives |
|---|---|---|
| Extract | Only the load-bearing lines (grep-matched) | Committed to repo |
| Re-run recipe | The exact commands that produce the raw | Committed alongside extract |
| Conclusion / report | What the evidence proves | Committed alongside extract |
| Raw text dump | Full multi-MB text diagnostic output | Fine to commit (text compresses); add `.gitattributes` `linguist-generated=true -diff` if review-noisy. Or `/tmp` + recipe if the dump is mostly noise around 1% signal. |
| Raw binary dump | Binary profile / heap / core dump | Route to git-lfs or non-soul repo — binaries are the soulfile risk. |

Defaults (recalibrated 2026-04-29):

- Text artifacts → track without ceremony; `.gitattributes`
  diff suppression for review-noise; extract + recipe pattern
  is good for clarity (most diagnostic data is 99% noise
  around 1% signal) but not load-bearing for soulfile risk.
- Binary artifacts → git-lfs or non-soul repo.

## What this rule forbids (binary-focused)

- **Compiled outputs** (`.dll`, `.exe`, `.pdb`, `.jar`,
  `.so`, `.a`, `.o`, `.wasm`) — never in the soul repo.
  Build outputs belong in CI artifacts or a non-soul repo.
- **Archives** (`.zip`, `.tar.gz`, `.tgz`, `.7z`, `.rar`,
  `.dmg`, `.iso`) — never in the soul repo (they're
  binary by definition; commit the unpacked tree if
  it's text-substrate, or route to a non-soul repo).
- **Large media** (high-res images, video, audio, raw
  game/engine assets) — git-lfs only. PR-review-friendly
  thumbnails or stable icons can be raw-binary.
- **Binary profile dumps / heap snapshots / core dumps** —
  never in the soul repo. Extract summary metrics as text;
  raw goes to a non-soul repo.
- **Binary database snapshots** (`.sqlite`, `.db` blobs,
  `.bin` index files) — git-lfs only. Schema + migrations
  are text and belong in the soul repo.
- **Database export blobs** (`.bak`, `.dump` files when
  they're binary; `.sql` text exports are fine).
- **Dependency vendoring** in binary form (vendored
  `node_modules` archives, prebuilt artifacts) — never.
  Lock files (`package-lock.json`, `Cargo.lock`) ARE text
  and belong.

## What this rule does NOT forbid (text is fine)

- **Committed test data, fixtures, example inputs** —
  load-bearing for the code that uses them.
- **Substrate documents** — research notes, ferries,
  ledgers, ADRs, triage reports.
- **Conversational substrate** — Amara conversations,
  ferry texts; first-class substrate per the
  `memory/project_aaron_amara_conversation_is_bootstrap_attempt_1_predates_cli_tools_grounds_the_entire_factory_2026_04_24.md`
  rule.
- **Raw text logs / fsck dumps / rev-list dumps** when
  load-bearing AND text. Aaron's recalibration: text
  compresses well. Track freely; if review-noisy, suppress
  diffs via `.gitattributes` (`linguist-generated=true
  -diff`).
- **Stack traces, profile output (text form), benchmark
  output, error logs** — text-format diagnostic capture is
  fine. Binary-format profile dumps ARE forbidden (see
  above).
- **Generated text files** (`Cargo.lock`, generated SQL,
  generated docs) — fine to track; suppress diffs via
  `.gitattributes` if review-noise.

## Composes with

- `memory/feedback_corruption_triage_discipline_object_health_incident_aaron_amara_2026_04_29.md`
  — corruption-triage discipline; this rule was caught
  while applying that one.
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — clean-signal discipline at the DSP layer; this rule
  is the substrate-cleanliness analogue at the repo layer.

## Distilled rules (keepers — recalibrated 2026-04-29)

```text
The git repo and all its history is the soulfile.
Binaries balloon clones forever; text compresses to near-zero.
```

```text
Aaron 2026-04-29:
  "don't go too hardcore on soulfile protection,
   text compresses very well,
   bin is what we are scared of and need to really
   really think about not history in text form."
```

```text
Binary default: don't commit. Use git-lfs or a non-soul repo.
Text default: track freely. Suppress diffs via .gitattributes
              if review-noisy. PR-review readability ≠
              soulfile risk.
```

```text
Conclusion is durable substrate. Raw text evidence is fine to
track when load-bearing. Raw binary evidence belongs elsewhere.
```

```text
Extract + recipe is good for clarity (most diagnostic data is
99% noise around 1% signal), not for soulfile protection.
Track raw text when extract would lose information.
```

```text
Don't let your soul get dirty.
You control what belongs in there.
```
