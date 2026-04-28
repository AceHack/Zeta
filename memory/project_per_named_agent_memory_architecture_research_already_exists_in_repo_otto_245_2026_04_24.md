---
name: Per-named-agent memory architecture research — Aaron asked "how would per-named-agent memories change things" and "please research this one a lot"; **EMPIRICAL FINDING: the repo already has this**, per-persona directories under `memory/persona/<name>/` with `NOTEBOOK.md` + `MEMORY.md` + `OFFTIME.md` per persona (18+ personas live: aarav, aaron, aminata, bodhi, daya, dejan, ilyana, iris, kenji, kira, mateo, nadia, naledi, nazar, rodney, rune, soraya, sova, viktor); shared cross-role scratchpad at root (`best-practices-scratch.md` = functional GLOBAL_CONTEXT.md); Google Search AI proposal is partial rediscovery + some new primitives (per-persona merge drivers, identity header, writes-own-reads-all formal enforcement) worth considering; Aaron Otto-245 2026-04-24
description: Aaron Otto-245 fourth Google Search AI share on per-named-agent memory architecture. Quality assessment: what Google AI proposed is already partially built in the repo — per-persona `memory/persona/<name>/` directories exist, formalized in `memory/persona/README.md` (promoted from Kenji-only to every persona in round 32). Google AI's genuinely new contributions: (1) per-persona merge drivers via `.gitattributes` glob patterns, (2) identity header `[AgentName: CommitHash]` (composes with Otto-243 `repoSha:`), (3) formal writes-own-reads-all boundary lint, (4) per-persona AutoDream triggers. Requires the no-symlink rule from Otto-244.
type: project
---
## What Aaron asked

Direct quote:

> *"please research this one a lot, could have big
> implications for us. now imagine i have per named agent
> memories how would that change things"*

Aaron explicitly directed "research this one a lot" — so
this memory goes beyond just absorbing the Google AI share
and grounds the analysis in what actually exists in the
repo today.

## Ground-truth finding: the repo already does this

Empirical check (via `ls memory/persona/` + reading
`memory/persona/README.md`):

```
memory/persona/
├── aarav/          # skill-expert
├── aaron/          # human maintainer
├── aminata/        # threat-model-critic
├── bodhi/          # developer-experience-engineer
├── daya/           # agent-experience-engineer
├── dejan/          # devops-engineer
├── ilyana/         # public-api-designer
├── iris/           # user-experience-engineer
├── kenji/          # architect
├── kira/           # harsh-critic
├── mateo/          # security-researcher
├── nadia/          # prompt-protector
├── naledi/         # performance-engineer
├── nazar/          # security-operations-engineer
├── rodney/         # reducer
├── rune/           # maintainability-reviewer
├── soraya/         # formal-verification-expert
├── sova/           # alignment-auditor
├── viktor/         # spec-zealot
├── best-practices-scratch.md  ← shared cross-role scratchpad
└── README.md       ← documents the pattern
```

Each persona directory has:
- **`NOTEBOOK.md`** — running notebook (3000-word cap per
  BP-07; prune every third substantive entry)
- **`MEMORY.md`** — one-line index of the directory's files
- **`OFFTIME.md`** — GOVERNANCE §14 off-time log

Personas can also add typed entries
(`feedback_*.md`, `project_*.md`, `reference_*.md`,
`user_*.md`). Kenji is furthest along on this pattern.

Canonical source of truth: agent frontmatter in
`.claude/agents/<role>.md`. Notebook is supplementary
memory, not canon (BP-08).

**This pattern was promoted from Kenji-only to every
persona in round 32** (per README.md line 5). It's been in
place for months. Google AI's proposal is a partial
rediscovery of what Zeta has already built.

## What the Google AI proposal actually adds

Mapping Google AI's proposal against current reality:

| Google AI proposal | Zeta repo today | Gap? |
|---|---|---|
| `.claude/agents/<name>/MEMORY.md` | `memory/persona/<name>/MEMORY.md` | Location different; content present |
| `.claude/agents/<name>/session_logs/` | No session-logs per persona | Not a gap — Anthropic AutoMemory handles global; per-persona session-logs would duplicate |
| `GLOBAL_CONTEXT.md` at root | `best-practices-scratch.md` at `memory/persona/` root | Present, different name |
| Identity header `[AgentName: CommitHash]` | NOT YET — memories currently have `name:`/`description:`/`type:` frontmatter | **Genuine gap** |
| Per-persona merge drivers via `.gitattributes` | `.gitattributes` has no merge drivers currently | **Genuine gap** |
| Writes-own reads-all boundary | Implicit discipline in skill files; not enforced | **Soft gap — formalization opportunity** |
| Per-persona AutoDream triggers | AutoDream runs at global level (`[AutoDream last run: 2026-04-23]` in MEMORY.md top-line) | **Genuine gap** — but "trigger only when agent's folder has changes" not obviously valuable |
| `git blame` for memory attribution | Native git — already works | Already have |
| Branching for agent isolation (feature-architect branch) | Works today via normal git branches | Already have |

## The genuinely new primitives worth considering

1. **Identity header in frontmatter** — extend existing
   memory frontmatter with an `author:` or `agent:` field:
   ```yaml
   ---
   name: ...
   description: ...
   type: feedback
   agent: kenji
   repoSha: abc123def  # per Otto-243
   ---
   ```
   Composes with Otto-243's commit-hash provenance. Allows
   `grep 'agent: kenji'` as a query primitive. Doesn't
   require migration of existing files (new field, optional
   on old, required going forward).

2. **Per-persona merge drivers via `.gitattributes`** — a
   real, implementable improvement. Example:
   ```
   # Persona notebooks: union merge (simple concat)
   memory/persona/*/NOTEBOOK.md merge=union

   # Persona MEMORY.md indexes: require manual review
   memory/persona/*/MEMORY.md merge=binary

   # Shared scratchpad: append-dedup (custom driver)
   memory/persona/best-practices-scratch.md merge=timestamp-dedup

   # Tick-history (per-writer per Otto-240): union
   docs/hygiene-history/tick-history/*.md merge=union
   ```
   Note: `merge=binary` in git means "don't auto-merge;
   require manual resolution." `merge=union` is the built-in
   driver that concatenates both sides. `timestamp-dedup`
   would be a custom driver we'd need to write.

   Composes with Otto-243 merge-driver proposal;
   Otto-245 specifies which files get which driver. Needs
   per-file-type design (NOT naive `cat|sort -u` from
   Otto-243 — that destroys narrative markdown).

3. **Formal writes-own-reads-all boundary** — could be
   a lint rather than runtime enforcement:
   - Pre-commit hook: check that any change to
     `memory/persona/<A>/` was authored by a session
     wearing agent-<A>'s hat (how? hard to detect without
     a runtime marker — would need `agent:` header from
     #1 above + commit message convention).
   - Alternative: just document in `memory/persona/README.md`
     as an invariant and rely on discipline (current state).
   - Verdict: not worth automation effort until we see
     actual cross-persona writes happening. Low priority.

4. **Per-persona AutoDream triggers** — Google AI proposed
   "if git diff --name-only shows 5+ changes in
   /agents/reviewer/, run /dream specifically for that
   agent context."
   - **Verdict: probably not useful in our harness.**
     AutoDream is Anthropic's global consolidation of
     `~/.claude/projects/<slug>/memory/MEMORY.md`. It
     doesn't have per-persona hooks. We can't redirect it.
   - What COULD work: a `/dream-persona <name>` custom
     skill that consolidates only `memory/persona/<name>/`
     using the same consolidation logic. That's a new
     skill, not a trigger hook.
   - Low priority until we see AutoDream-index quality
     issues that per-persona consolidation would fix.

## Composition with prior memory — the big picture

| Memory | Concern | How per-agent memory composes |
|---|---|---|
| Otto-227 (cross-harness skill home) | Per-harness canonical copy of SKILL.md bodies | Per-agent memory is **per-persona** not per-harness; orthogonal |
| Otto-240 (per-writer tick-history) | Per-writer-instance audit-trail files | Per-agent memory is per-ROLE (persona); tick-history is per-WRITER-INSTANCE (harness+machine+session). Both use file-isolation; different partitioning |
| Otto-241 (session-id scrub) | `originSessionId:` removed from frontmatter | Identity-header proposal uses `agent: <name>` + `repoSha:` — different fields from the forbidden `originSessionId:` |
| Otto-242 (sidecar sync) | Cross-machine sync via gitignored ledger | Per-agent memory is in-repo and git-tracked; orthogonal to cross-machine sync pattern |
| Otto-243 (git-native merge driver) | `.gitattributes` custom drivers | **Direct composition** — per-agent memory specifies which files get which driver. The merge-driver design crystallizes around the per-agent folder boundaries |
| Otto-244 (no symlinks) | Hard veto on symlink cross-refs | **Required dependency** — the Google AI "symlink agents/ to .claude/agents/" proposal is rejected. Copy or pick one canonical location |

## Skill-placement implication for Codex/Gemini canonical homes

Aaron's remark: *"Also this might be the case for splitting
codex and genimi into their connonical skills to."*

Current state (Otto-227):
- `.claude/skills/<name>/SKILL.md` — Claude Code canonical
- `.agents/skills/<name>/SKILL.md` — Codex + Gemini
  canonical (both harnesses read this path)
- Shared data source: `docs/` tree (text-referenced from
  each body)

Potential future state if Aaron wants harness canonical
homes:
- `.claude/skills/` — Claude Code canonical
- `.codex/skills/` — Codex canonical (hypothetical)
- `.gemini/skills/` — Gemini canonical (hypothetical)
- Shared data source: `docs/` tree

Per Otto-244 (no symlinks): each harness gets its own
copy of the SKILL.md body. Per Otto-227 (behaviour/data
split): small behaviour tweaks per harness are fine;
shared rule tables / worked examples / reference material
live in `docs/` and get text-referenced.

Maintenance cost: three near-duplicate SKILL.md bodies
(behaviour diffs tracked per-harness). One shared `docs/`
tree. Collapse-point: if a skill is 100% identical across
all three harnesses and has been stable for ≥3 rounds, can
consolidate to a single canonical location that all three
harnesses can be taught to read (if harnesses learn to
cross-reference).

**Not acting on this today.** Otto-227's current
`.agents/skills/` shared-for-Codex+Gemini arrangement is
fine; split to `.codex/` and `.gemini/` only if Aaron
directs explicitly.

## Correction: Google AI's "token waste / index bloat" claim is wrong

Google Search AI claimed: *"The Claude Code harness uses
specific glob patterns to index files. If you put agents at
the root ... Token Waste: Every time you ask 'summarize the
project', Claude will spend tokens reading thousands of
lines of agent 'dreams' instead of your code. Index Bloat:
The local vector store will prioritize agent ramblings over
your actual functions."*

**This is FUD for Claude Code specifically. But Aaron pushed
me to verify cross-harness; research results below qualify
the picture.**

### Claude Code default (verified via research 2026-04-24)

- Claude Code has **no local vector store** by default.
  Vadim's blog ("Claude Code Doesn't Index Your
  Codebase") confirms: *"Claude Code does not pre-index
  your codebase or use vector embeddings. Early versions
  used RAG + a local vector db, but it was found that
  agentic search generally works better."*
- Uses Glob + Grep + Read on demand. No embeddings DB,
  no pre-computed similarity index.
- The harness does have conventions that respect
  `.claude/` (settings, skills, agents, hooks), but those
  are explicit pattern lookups, not general-purpose
  indexing.

### Codex CLI (different — HAS opt-in indexing)

- OpenAI Codex CLI ships a `codex index` command that
  builds a local FAISS index at `.codex_index/` using
  OpenAI embeddings.
- `codex search` does nearest-neighbor retrieval over the
  index.
- If Aaron runs `codex index` against the repo,
  root-level `memory/` and `memory/persona/**` content
  IS embedded and consumes search context. The Google
  AI "token waste" concern is **real here**.

### Gemini CLI (experimental RAG)

- `gemini labs rag index --source ./my-codebase` creates
  a persistent vector database (ChromaDB / SKLearn /
  similar).
- Shipping experimentally; behavior depends on whether
  Aaron runs `rag index`. Currently not standing in
  Zeta's workflow.

### Third-party Claude Code MCP plugins

- `zilliztech/claude-context` (LanceDB), `danielbowne/
  claude-context`, `evanrianto/claude-codebase-indexer`,
  MCP-based indexers, `claude-mem` 65.8K-star persistent-
  memory plugin — all add vector indexing to Claude Code.
- NOT currently installed in Zeta's .claude/settings.json.
- If any get installed, default no-index behavior
  changes; memory content would be swept into embeddings.

**What IS a real ergonomic concern with root placement:**

1. IDE / editor file-search clutter — VS Code "Go to
   File", ripgrep default scope, etc. Root dirs appear in
   every result list; dot-dirs are filtered by most tools'
   defaults.
2. Build-tool and linter defaults often ignore dot-dirs
   but sweep root dirs.
3. **Agent-side grep sweeps** — when I or a subagent runs
   `grep` across `**/*.md`, root-level memory/agent dirs
   DO get swept. This is a *decision-time* cost (how I
   scope my greps), not a harness-indexing cost.
4. Cognitive overhead — root dirs look like "part of the
   codebase" to a human opening the repo; dot-dirs look
   like plumbing.

**Zeta's choice is deliberate and correct:**

- `.claude/agents/` holds canonical persona frontmatter
  (hidden, harness-convention) — this is where the harness
  looks for agent definitions.
- `memory/persona/<name>/` holds memory notebooks (at
  root, visible) — Aaron explicitly chose the clutter cost
  for visibility; humans and agents both see them without
  grepping dot-dirs.

The split-by-concern (config in `.claude/`, memory in
`memory/`) is better than Google AI's all-in-one
`.claude/agents/<name>/MEMORY.md + session_logs/` proposal
because it respects the different access patterns of the
two file classes.

### Structural insight worth keeping

**Memory content is high-volume, low-signal for
code-search use cases.** It should be excluded from
semantic code indexing across all three harnesses — not
because Claude Code has a vector store (it doesn't by
default), but because when OTHER harnesses or plugins add
one, memory noise drowns out actual code.

Mitigation when it matters (peer-agent mode, MCP plugins,
`codex index` / `gemini labs rag index`):

- **Codex**: check for `.codexignore` or index-scope
  flags; exclude `memory/**`, `memory/persona/**` from
  embedding. If Codex supports `--source src/ docs/`
  instead of `./`, use that.
- **Gemini**: use `gemini labs rag index --source` with
  a narrow scope — `src/ docs/ tools/` rather than the
  whole repo.
- **Claude Code MCP plugins**: if `claude-context` or
  similar gets installed, check its config for exclude-
  patterns and blacklist memory paths.

**If root-clutter starts biting** in IDE searches or
ripgrep defaults, the fix is `.gitignore`/`.ignore`
tweaks and per-tool search scoping — **NOT** migration
to hidden directories, because memory visibility was
chosen deliberately.

Future Otto: reject any proposal to move `memory/` into
`.claude/` on grounds of "token waste" for Claude Code
default — the claim is false. But when peer-agent mode
ships, proactively design per-harness exclude-patterns
for memory paths before indexing happens.

## Location debate: `.claude/agents/` vs root `agents/`

Google AI asked "root folder or hidden `.claude/agents/`?"
and proposed symlink hybrid.

**Aaron vetoes symlink hybrid (Otto-244).**

Reality in Zeta:
- `.claude/agents/` — persona SKILL.md files (17 of them,
  per Claude Code convention; CLAUDE.md harness section
  names this location explicitly)
- `memory/persona/<name>/` — per-persona memory notebooks
  (at repo root, NOT under `.claude/`)
- No root `agents/` directory

So Aaron's repo already answers the debate: **canonical
frontmatter in `.claude/agents/` (where the harness
expects it), memory in `memory/persona/` (where humans
and agents both see it without grepping the
dot-directory).** Split by file-type, not by hierarchy.

This is actually BETTER than Google AI's proposal because
it separates two concerns (canonical frontmatter vs
memory) that the Google AI mashed together.

## What this memory does NOT authorize

- Does NOT authorize implementing the new primitives this
  tick. They're research findings for future BACKLOG rows.
- Does NOT authorize moving `memory/persona/` to
  `.claude/agents/<name>/memory/` or any other location.
  Current location works and is already populated.
- Does NOT authorize adopting `[AgentName: CommitHash]`
  inline header format. Prefer frontmatter `agent:` +
  `repoSha:` fields (cleaner, parseable, matches existing
  convention).
- Does NOT authorize per-persona AutoDream hooks —
  Anthropic AutoMemory writes globally; we can't redirect.
- Does NOT supersede Otto-240's per-writer tick-history
  design. Tick-history is per-WRITER-INSTANCE (harness +
  machine + session); per-persona memory is per-ROLE.
  Different axes.
- Does NOT supersede Otto-244's symlink veto. Every
  implementation variant must respect copy-don't-symlink.
- Does NOT force Codex/Gemini into separate canonical
  skill homes. Otto-227 shared-`.agents/skills/` pattern
  stands until Aaron directs otherwise.

## BACKLOG rows owed

1. **Frontmatter `agent:` + `repoSha:` fields** —
   extension to memory frontmatter schema. New fields
   optional on old memories, written on new memories.
   Compose with Otto-243 commit-hash provenance + this
   memory's per-agent discipline. Size: S (doc change +
   lint for new memories).
2. **Per-file-type merge drivers in `.gitattributes`** —
   design document + worked drivers for:
   - `memory/persona/*/NOTEBOOK.md` → `merge=union`
   - `docs/hygiene-history/tick-history/*.md` → custom
     timestamp-sort driver
   - `memory/persona/*/MEMORY.md` → `merge=binary` (manual)
   Size: M (custom driver implementation + testing).
3. **`/dream-persona <name>` skill** — per-persona
   consolidation skill. Low priority; file if
   per-persona notebooks show consolidation-pressure.
   Size: M.

All three file on the current or next tick's tick-close.

## Direct Aaron quotes to preserve

> *"i don't like the symlink option, it's not reliable we
> already tried it, this is another one where claude just
> needs to keep it's own version. Also this might be the
> case for splitting codex and genimi into their
> connonical skills to. please research this one a lot,
> could have big implications for us. now imagine i have
> per named agent memories how would that change things"*

Three directives in one message:
1. No symlinks — captured in Otto-244.
2. Codex/Gemini may eventually get canonical skill homes
   — captured here + in Otto-244's scope section.
3. Per-named-agent memory architecture — **this memory's
   core content**; finding is "we already do it, and the
   existing substrate is arguably better-designed than
   what Google AI proposed."

Future Otto: when executing the BACKLOG rows above,
start by reading `memory/persona/README.md` (the
existing formal documentation of the per-persona
pattern). That document is the baseline; Otto-245
research identifies the increments.
