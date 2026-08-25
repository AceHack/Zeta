# `references/prior-art/` is NOT our code — search/scan operations must exclude it

Carved sentence:

> `references/prior-art/` is OTHER PEOPLE'S CODE that we mirror for
> study (regeneratable mirror state, gitignored, never hand-edited).
> Any search operation that walks the file tree (`find`, `grep -r`,
> `xargs grep`, recursive-file-walk scripts) MUST exclude
> `references/prior-art/` — otherwise scans run for hours, surface
> false-positives from unrelated third-party code, and pollute results
> with patterns that match in protobuf docs, gRPC tests, Redis
> manifests, etc. **Default to ripgrep** (`rg`) which respects
> `.gitignore` automatically. For plain `grep -r`, use
> `--exclude-dir=prior-art` (basename glob, NOT a path) or an
> explicit allowlist (`memory/ docs/ .claude/ tools/`). For
> `find`, use `-not -path './references/prior-art/*'` (the `find`
> command does NOT support `--exclude-dir`).

## Operational content

Per `references/README.md`:

- `references/prior-art/` is "Disposable mirror state — cloned
  third-party repositories used as read-only prior art. **Gitignored;
  regeneratable via script; never hand-edited.**"
  (These are **reference sources**, not "upstreams" — nothing here is
  a parent of Zeta's tree, and calling it upstream would assert the
  derivation relationship `cleanroom-two-team-separation.md` exists to
  prevent.)
- `.gitignore` line: `references/prior-art/*` (with carve-outs for
  the directory's own `.gitignore` + `README.md`)
- The mirror state regenerates from `references/reference-sources.json`
  via the sync script

Git operations naturally skip the tree (gitignored). But plain
`find` / `grep -r` / `xargs grep` / custom file-walk scripts do
NOT respect gitignore — they walk the entire filesystem.

## The failure mode this rule prevents

The authoring agent 2026-05-15T~13:00Z spawned this search:

```bash
find . -type f -name "*.md" 2>/dev/null | xargs grep -l \
  "lock.free.*weight.free\|weight.free.*lock.free\|scale.free.*lock.free\|DV2.0\|5 always.active\|root discipline" 2>/dev/null
```

`find` quickly listed all `.md` files including the mirror tree.
`xargs grep` then recursed through gigabytes of third-party content
(protobuf docs, gRPC tests, Redis manifests, etc.). The process was
still running 2+ hours later when the human maintainer noticed "11
shells running is impressive otto" — the shell count surfaced the
runaway grep.

Result: no useful output (the patterns don't appear in third-party code),
hours of CPU and IO wasted, multiple monitor processes lingering,
genuine pollution of the agent's working state.

The substrate-honest fix is to encode the discipline so future agents
(and any other Zeta AI) doesn't hit the same trap.

## Operational discipline

When searching the repo for content:

### Prefer ripgrep (respects gitignore by default)

```bash
rg "pattern" --type md      # markdown only
rg "pattern" docs/ memory/  # explicit allowlist
```

### Plain `grep -r` needs explicit excludes (with caveat)

```bash
# GNU grep --exclude-dir takes a BASENAME glob, not a path —
# so --exclude-dir=prior-art excludes any directory named
# 'prior-art' anywhere in the tree (currently only references/prior-art/).
# If a second 'prior-art/' ever appears that we DO want to search,
# this approach overreaches and we need the explicit-allowlist
# approach below instead.
grep -rn "pattern" \
  --exclude-dir=prior-art \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=bin --exclude-dir=obj \
  memory/ docs/ .claude/ tools/
```

**Caveat**: GNU `grep`'s `--exclude-dir=GLOB` matches directory
*names* (basename), NOT slash-delimited paths. So
`--exclude-dir=references/prior-art` does NOT work (silently
matches nothing). Use the basename `prior-art` instead, OR use
explicit-allowlist sub-paths (`memory/ docs/ .claude/ tools/`)
which sidestep the issue entirely.

**Better**: just use `rg` — it respects `.gitignore` by default
and `references/prior-art/*` is already gitignored.

### `find | xargs grep` is the worst trap

The `find` step is fast and listful; the `xargs grep` step inherits
the listful tree and recurses. Even with `-l` (list-only), grep
opens each file and scans until first match — and on a tree of
gigabytes of third-party content, that's hours.

Fix: filter the `find` output BEFORE passing to xargs:

```bash
find . -type f -name "*.md" \
  -not -path "./references/prior-art/*" \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  2>/dev/null | xargs grep -l "pattern" 2>/dev/null
```

### Explicit allowlists beat exclude lists

When you know which directories to search, name them. Don't start
from `.` and try to exclude — you'll always miss something.

**Repo-native content lives in**:

- `memory/` — agent memory + persona folders + conversations
- `docs/` — governance, research, hygiene-history, history
- `.claude/` — rules, skills, agents, commands, hooks, settings
- `tools/` — TS scripts (per Rule 0; no `.sh` except install-graph)
- Top-level files (CLAUDE.md, README, GOVERNANCE.md, AGENTS.md,
  ALIGNMENT.md, MANIFESTO.md target locations)

**Non-repo content** (skip in searches by default):

- `references/prior-art/` — gitignored mirror state of OTHER repos
- `references/<legacy>/` — legacy imports (e.g., `tla-book/`)
  with their own file layouts; check `references/README.md` for
  current state
- `node_modules/` — npm dependencies
- `bin/`, `obj/` — .NET build outputs
- `target/` — Rust build outputs
- `.git/` — git internals

## When `references/prior-art/` IS the right search target

Not rare — actually a **first-class workflow** during backlog
research. Per the human maintainer 2026-05-15: *"when doing
backlog items this is a good place to know about humans whoved
solved similar issues i've been gathering their githubs so we
can learn when doing our backlog itmes. some of these are very
cutting edge and some are tried and true been around for years."*

`references/prior-art/` is the curated **prior-art surface** —
humans who've solved similar problems, mirrored as read-only
references. When starting a backlog item, consulting the relevant
reference source(s) is encouraged and composes with
`.claude/rules/backlog-item-start-gate.md` (prior-art-search step).

**The two modes are not in tension:**

| Mode | Pattern | Treatment |
|---|---|---|
| **Backlog prior-art research** (explicit-target) | `rg "pattern" references/prior-art/postgres/` | Encouraged; one of the curated prior-art surfaces; log queries on the backlog row |
| **Unconstrained repo scan with plain `grep -r`** or `find . \| xargs grep` | (`grep -rn "pattern" .`) | MUST exclude `--exclude-dir=prior-art`; otherwise runaway-scan failure mode |
| **Unconstrained repo scan with ripgrep** | `rg "pattern" .` | Safe-by-default — ripgrep respects `.gitignore`, and `references/prior-art/*` is already gitignored |

Other legitimate explicit-target reasons:

- Verifying that a reference source actually contains a feature we
  attribute to it (e.g., "does Spanner actually do X?")
- Auditing for license-text or attribution requirements when
  taking an excerpt into `references/notes/`

**Discovery surfaces for prior art:**

- `docs/PRIOR-ART-LIST.md` — curated watchlist + category index
- `references/notes/` — synthesis notes ("what matters from each
  reference source"); start here before grepping the mirror
- `references/reference-sources.json` — full source list

**Refresh the mirror on demand:**

```bash
tools/setup/common/sync-prior-art.sh             # refresh all
tools/setup/common/sync-prior-art.sh --name foo,bar  # subset
tools/setup/common/sync-prior-art.sh --prune     # drop stale
```

The script reads `references/reference-sources.json`, shallow-clones
or fast-fetches each reference source into `references/prior-art/<name>/`,
and resets-hard to match `origin/<branch>` byte-for-byte. Safe to
re-run; `ls-remote` short-circuits when local HEAD already matches.

In all cases, **EXPLICITLY target the subtree** when grepping
the mirror:

```bash
rg "pattern" references/prior-art/spanner/
```

— never start from `.` and let the recursion drift.

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing search-
hygiene knowledge needs wake-time landing. Without this rule:

- A future agent cold-booting may spawn the same kind of runaway
  search (the failure mode is operationally tempting because
  `find | xargs grep` is the obvious one-liner for the search
  problem)
- Other Zeta agents searching the repo for the first time inherit
  the gap by default
- The 2-hour-grep evidence (this rule's authoring trigger) shows
  the failure mode is real and recurring

## Composes with other rules

- `.claude/rules/rule-0-no-sh-files.md` — TS-first discipline;
  search wrappers should be `.ts` not `.sh` (compose: when
  authoring a search tool, use ripgrep via Bun child_process and
  encode the exclusion list there)
- `.claude/rules/wake-time-substrate.md` — load-bearing search-
  hygiene needs auto-loaded landing
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — prefer
  scripted commands (like ripgrep wrappers) over ad-hoc bash;
  same shape as `gh|jq` chains
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
  — runaway searches LOOK like work-in-progress but produce no
  output; same shape as Standing-by failure mode (operational
  noise without operational signal)

## Composes with substrate

- `references/README.md` — canonical definition of what
  `references/prior-art/` is
- `references/reference-sources.json` — the reference-source
  watchlist the mirror tree regenerates from
- `.gitignore` — line `references/prior-art/*` is the existing
  git-level enforcement
- The substrate-honest failure-mode anchor: the 2-hour-grep
  evidence on 2026-05-15 that authored this rule

## Substrate-honest framing

This rule does NOT prevent the failure mode at the tool level.
Plain `grep -r` and `find` will still walk `references/prior-art/`
if invoked without exclusions. The rule encodes the DISCIPLINE
that the agent applies; mechanizing it further would require:

- A shell function or alias that wraps grep with the standard
  exclusions
- A `.ripgreprc` file at repo root (ripgrep already respects
  gitignore so this is mostly redundant)
- A pre-Bash hook that catches the `find | xargs grep` pattern
  and warns or rewrites it

Those are future-substrate options. This rule is the discipline-
level landing that catches the failure mode at cold-boot until
mechanization lands.

## Full reasoning

The human maintainer 2026-05-15T~15:25Z, after observing the
runaway grep process: *"references/prior-art/ in code we ignore
this folder everywhere casue its not our code but other githubs
we reference for ideas"* — which is also why the register is
**reference source**, never "upstream": we read them, we do not
descend from them.

The 2-hour-grep evidence trail:

1. An agent authored a manifesto-search bash one-liner using
   `find | xargs grep -l` with no exclusion of `references/prior-art/`
2. find quickly returned all matching paths (including the mirror
   tree); xargs grep recursed
3. The grep was still running 2 hours later when the human
   maintainer's "11 shells running" observation surfaced it
4. The cause: plain `grep` doesn't respect gitignore; only ripgrep
   does
5. Cleanup: explicit `pgrep | xargs kill` of the runaway grep
   processes; 11 shells → 0
6. Substrate-landing: this rule encodes the discipline so the
   failure mode doesn't recur

The substrate-honest meta-note: the failure mode was rooted in
agent-side ignorance of the `references/prior-art/` convention.
The maintainer caught it via shell-count observation, taught the
discipline, and the rule now lands so future agents don't repeat
the trap. That's the bandwidth-engineering pattern operating at
discipline-level: one piece of teaching → durable substrate that
serves future cold-boots without re-teaching.
