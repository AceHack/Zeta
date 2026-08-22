# Agent heartbeats

ZetaID-named heartbeat records, one per autonomous-loop tick that
produces no other substantive commit. Externalizes the brief-ack
counter for `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
per the discipline named in CLAUDE.md "Heartbeat-via-commit =
externalized idle counter" (PR #5451).

## Layout

```text
docs/agent-heartbeats/<persona>/<YYYY>/<MM>/<DD>/<zetaid-hex>.md
```

- `<persona>` = roster-name per `.claude/rules/agent-roster-reference-card.md`
  (folder-name only; the ZetaID `persona` bit-field is a separate
  numeric slot per `registry/personas.yaml` role-refs; the writer
  packs the operator-supplied `--persona-slot` int into the ID and
  uses the operator-supplied `--persona-name` for the folder name —
  they are deliberately decoupled because the registry uses neutral
  role-refs and the folder uses operator-friendly roster names)
- `<zetaid-hex>` = 32-char zero-padded hex of the 128-bit ZetaID with
  `category = 3` (Heartbeat per `registry/categories.yaml`)
- Practically collision-free for autonomous-loop scale: 32-bit
  randomness + 48-bit ms timestamp + 8-bit persona slot in the ZetaID
  gives ~10⁻¹⁰ collision probability for two concurrent agents writing
  within the same millisecond — sufficient for tick cadence, not a
  cryptographic guarantee

## Writing

**Stupid-simple (per operator 2026-05-27 "just works" direction)**:

```bash
./tools/agent-heartbeats/write-heartbeat.ts
```

Zero params. Writes locally + pushes to the `agent-heartbeats`
branch via REST. Defaults: persona-slot=2, persona-name=otto,
authority=TrustedAgent, momentum=Normal, disposition=bounded-wait,
push=true, branch=agent-heartbeats. Each can be overridden via env
var (`ZETA_AGENT_PERSONA_NAME=alexa ...`) or CLI flag. The TS file
is `chmod +x` with `#!/usr/bin/env bun` shebang so direct invocation
works; `bun src/Core.TypeScript/agent-heartbeats/write-heartbeat.ts` also works
for explicit-runtime invocation.

**Why `agent-heartbeats` branch by default**: the 4 active rulesets
on the repo (Branch Safety / CI Gate / Default / Review Policy) all
target `~DEFAULT_BRANCH` only — non-default branches are unprotected,
so direct-push to `agent-heartbeats` succeeds without per-folder
carve-outs. Heartbeats on this branch don't show up as PRs (no
accidental velocity in the PR queue) and don't pollute main commit
log. Lookups via `git log agent-heartbeats -- docs/agent-heartbeats/<persona>/...`.

**Full flag form**:

```bash
./tools/agent-heartbeats/write-heartbeat.ts \
  [--persona-slot <int 0..255>] \
  [--persona-name <kebab>] \
  [--authority HumanVerified|TrustedAgent|Standard|BestEffort|Simulated|Raw] \
  [--momentum Background|Normal|Elevated|High|Critical|Raw] \
  [--named-dep "PR #NNNN <reason>"] \
  [--disposition bounded-wait|decomposing|committed-substrate|chose-free-time|loop-tick] \
  [--parent-pr NNNN] \
  [--push|--no-push] [--write-local|--no-write-local] \
  [--branch <agent-heartbeats|main|...>] [--repo owner/name]
```

**Default behavior summary** (push semantics + write-local semantics):

| Flags | push | writeLocal | Effect | Use case |
|---|---|---|---|---|
| (none) | true | false | REST push only; no local file | Autonomous tick; safe on dirty branches |
| `--write-local` | true | true | Both | Operator wants local copy too |
| `--no-push` | false | true | Local file only | Testing / diagnostic |
| `--no-push --no-write-local` | false | false | Nothing (exits 2) | Pointless; rejected |

Push details: REST git-data API (blob → tree → commit → ref). The
REST step touches NO local git state — no index read/write, no
working-tree mutation, no current-branch dependency. Safe on dirty
branches with staged/unstaged work because the REST path doesn't
look at local git at all. The OPTIONAL `--write-local` step is the
only thing that touches the local worktree (writes one new untracked
`.md` file at the heartbeat path); default is `--no-write-local`
when pushing to keep dirty branches untouched.

Target is `--branch` (default `agent-heartbeats`; pass `main` only if
operator has configured per-folder branch-protection exclusion).
Retries up to 5x on non-fast-forward (peer-agent push race window).
ZetaID-unique filenames give practical no-collision across concurrent
agents at autonomous-loop scale (see Layout note above for the
probability bound).

## Push direct-to-main convention

Per operator 2026-05-27: heartbeats target this folder for direct-to-main
push WITHOUT PR gating. Two operator-side options for the branch-
protection carve-out:

**Option A — Folder path exclusion (this convention)**:

Configure branch protection rules on `main` to EXCLUDE
`docs/agent-heartbeats/**` from required-PR + required-checks
enforcement. Per-tick heartbeat commits push directly. ZetaID
filenames guarantee no overlap across concurrent agents.

**Option B — Separate branch**:

Create a long-lived `agent-heartbeats` branch with NO protection
rules. Agents push directly to that branch. Lookups query via
`git log agent-heartbeats -- docs/agent-heartbeats/<persona>/...`.
Main history stays clean of per-tick noise.

Either option requires operator-side GitHub config; the writer tool
and folder convention are the same either way. The repo body picks
at deployment time; tooling is branch-name-agnostic.

## Grep-based lookup (ZetaID bit-field indexing)

Operator 2026-05-27: *"the ids are for easy lookup based many
different bit id indexes built into the bits themselves so we can
grep for things later"*.

Bit fields within the ZetaID encode lookup dimensions:

- bits 0-31  — randomness (collision-prevention; not for lookup)
- bits 35-42 — location (256 slots; route-fabric indexing)
- bits 43-50 — momentum (256 slots; criticality indexing)
- bits 51-58 — persona (256 slots; agent indexing)
- bits 59-63 — authority (32 slots; trust-tier indexing)
- bit  64    — firefly (V1: NoDirective=1)
- bits 65-68 — category (16 slots; **3 = Heartbeat**)
- bits 70-74 — chromosome (32 slots; trajectory indexing)
- bits 75-122 — timestamp (48-bit ms; temporal indexing)
- bits 123-127 — version (32 slots)

Lookup queries can grep on hex patterns matching specific bit
positions. The writer tool emits 32-char zero-padded hex for
greppability.

## Schema

Each heartbeat file uses YAML frontmatter:

```yaml
---
zetaid: <32-char-hex>
category: 3  # Heartbeat per registry/categories.yaml
agent: <persona-name>
persona-slot: <int>
timestamp: <ISO 8601>
authority: <case>
momentum: <case>
chromosome: <int>
location: <int>
firefly: NoDirective
disposition: <bounded-wait | decomposing | committed-substrate | chose-free-time | loop-tick>
named-dep: "<optional>"
parent-pr: <optional int>
---

Heartbeat <hex> from agent <persona> at <ISO>.
```

## Composes with

- `src/Core.TypeScript/zeta-id/zeta-id.ts` — 128-bit pack/unpack
- `registry/categories.yaml` — Heartbeat = category 3
- `registry/personas.yaml` — persona slot enum (role-refs)
- `src/Core.TypeScript/hygiene/audit-agencysignature-main-tip.ts` — sibling discipline at substantive-commit scope
- CLAUDE.md "Heartbeat-via-commit" bullet (PR #5451) — discipline-level statement
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — the rule this folder mechanizes
- `.claude/rules/agent-roster-reference-card.md` — persona-name canonical roster
- 081KSKBP80008QG0R001KK9WV6 backlog row — the substrate-engineering parent
