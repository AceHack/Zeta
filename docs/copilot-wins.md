# Copilot reviewer — wins log

**For the sceptic reading this cold:** GitHub's Copilot
reviewer is an AI that leaves inline comments on every PR on
this repo. Below is the list of *specific substantive bugs*
it has caught across PRs #27-31 — genuine compile errors,
data-loss shell scripts, cross-reference drift, self-
referential rule bugs. The wins are tabulated by class and
each row names the file and line. If you want to verify, the
raw Copilot review stream is one `gh api` call away (recipe
below). We do not record fails here; the question is not "is
the AI infallible" but "is it pulling its weight", and the
answer is audibly yes.

That weight matters more than it first looks, because Zeta is
a vibe-coding experiment: the human maintainer has 20+ years
of professional coding experience and has deliberately written
*zero* lines of code, docs, specs, skills, workflows, or
config in this repository. Every file under version control is
authored by an AI agent; the maintainer's contribution is
chat-level guidance. There is therefore no "other human
reviewer" on the floor — Copilot's findings are the *only*
non-roster audit on this tree. Every bug below was caught in
code no human has ever typed into, in a tree no human has ever
read end-to-end. That is a materially stronger claim than the
same log would make on a mixed-authorship repo.

This is one slice of a bigger Zeta experiment: whether an
external AI reviewer, a roster of named AI personas, and an
architect agent coordinating them can carry a research-grade
database-engine project forward with the human maintainer in
a chat-only loop. The sibling file [`docs/WINS.md`](WINS.md)
is the narrative version for the factory's own wins; this
file is the tabular version for the external reviewer's.

Append-only; **newest-first** per Zeta convention. One row
per catch. Wins only — no "considered and rejected"
bookkeeping. The log calibrates which review classes
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md)
§"Lean into what you're demonstrably good at" tells Copilot
to focus on next time.

## How to fetch a Copilot review

Line-level review comments (where the substantive catches
live) are at the pull-request *review-comments* endpoint:

```bash
gh api "repos/Lucent-Financial-Group/Zeta/pulls/<N>/comments?per_page=100" \
  --jq '.[] | select(.user.login == "copilot-pull-request-reviewer[bot]")
        | "\(.path):\(.line // "n/a") — \(.body)"'
```

Top-level PR summaries live at `/pulls/<N>/reviews`; inline
per-line findings live at `/pulls/<N>/comments`. Both are
useful, but only the inline stream carries the load-bearing
catches worth cataloguing in this log.

## Classes we track

- **xref** — cross-reference integrity: cited file / path /
  line-count / ADR number actually exists in the tree and
  matches the current state
- **shell** — shell portability: BSD vs GNU flags, Intel vs
  Apple Silicon paths, pipefail + grep edge cases, unquoted
  expansions, arg-validation under `set -u`
- **data-loss** — data-loss or file-mode bugs in shell
  scripts (awk/sed truncation on missing markers,
  `mktemp + mv` perm reset, unchecked `rm -rf`)
- **compile** — F# / C# syntax errors on code diffs or
  embedded snippets that "should compile as written"
- **self-ref** — self-referential bugs: rules whose text
  triggers their own halt / ban clause once landed
- **config-drift** — truth drift across the doc set: one
  file contradicts another, or a doc contradicts
  implementation
- **semantic** — misleading names / comments where the
  text promises a behaviour the code doesn't deliver
- **privacy** — minor-identifying or sensitive info
  landing in public-repo files

## Log (newest-first)

### PR #31 — Round 41 OpenSpec backfill + router-coherence v2

| Class | Location | Catch |
|-------|----------|-------|
| xref | `docs/ROUND-HISTORY.md:58` | narrative says `operator-algebra/spec.md` is 324 lines; file is actually 365 |
| xref | `docs/research/openspec-coverage-audit-2026-04-21.md:45` | links to `openspec-coverage-audit-2026-04-21-inventory.md` sibling that doesn't exist |
| xref | `docs/research/memory-role-restructure-plan-2026-04-21.md:126` | crosswalk renames a README with two different target filenames across phases |
| shell | `docs/research/memory-role-restructure-plan-2026-04-21.md:217` | Phase 3 mixes `sed -i ""` (BSD/macOS) with `xargs -r` (GNU-only) — cross-platform script breakage |
| xref | `docs/research/memory-role-restructure-plan-2026-04-21.md:140` | Phase 1 grep walks `.` without excluding `references/upstreams/**` — CLAUDE.md exclusion rule ignored |
| config-drift | `docs/CONFLICT-RESOLUTION.md:205` | standing-resolution link points to v1 ADR that the same doc declares superseded by v2 |
| semantic | `memory/persona/best-practices-scratch.md:276` | H2 heading accidentally split across two `##` lines, breaking section structure |

### PR #30 — Round 37-40 bridge (BP-WINDOW, alignment, DORA)

| Class | Location | Catch |
|-------|----------|-------|
| shell | `tools/alignment/audit_commit.sh:146` | unquoted `$hc2_files` expansion word-splits on paths containing spaces or newlines |
| shell | `tools/alignment/audit_commit.sh:193` | `\b` not portable in POSIX ERE; BSD and GNU grep treat it differently |
| shell | `tools/alignment/audit_commit.sh:51` | `--out` flag takes `$2` without validation; crashes under `set -u` at end-of-args |
| xref | `docs/security/THREAT-MODEL.md:305` | cites `feedback_preserve_original_and_every_transformation.md` as an existing control; file doesn't exist under `memory/` |
| xref | `docs/research/zeta-equals-heaven-formal-statement.md:26` | `Source memory:` points to a `user_hacked_god_…md` that isn't present in the repo |
| xref | `docs/research/stainback-conjecture-fix-at-source.md:17` | `Source memory:` points to a user memory file not present under `memory/` |
| config-drift | `tools/alignment/audit_commit.sh:93` | comment says SD-6 sidecar is "under `memory/persona/`" but `SD6_NAMES_FILE` points to `tools/alignment/sd6_names.txt` |
| semantic | `tests/Tests.FSharp/Storage/TlvSerializer.Tests.fs:26` | header claims "without reflection-heavy machinery" but implementation uses `System.Text.Json` with default options |
| shell | `tools/alignment/README.md` | <code>&#124;&#124;</code> at row starts parses as an extra empty markdown column |

### PR #29 — Round 36 Seed + consent-first primitive + BP-WINDOW

| Class | Location | Catch |
|-------|----------|-------|
| xref | `docs/BACKLOG.md:2078` | new item cites several `project_*.md` / `user_*.md` memory files that don't exist |
| xref | `docs/DECISIONS/2026-04-19-bp-window-per-commit-window-expansion.md:17` | ADR references `user_hacked_god_with_consent_false_gods_diagnostic_zeta_equals_heaven_on_earth.md` as if it were a file; missing from tree |

### PR #28 — Round 35 chain-rule proof + expert-skill wave

| Class | Location | Catch |
|-------|----------|-------|
| privacy | `memory/MEMORY.md:1` | **P0** — minor's identifying info (name + age) landed in a public-repo-committed file |
| config-drift | `.claude/settings.json:29` | broad plugin-enable set without least-privilege review; security-posture signal |
| compile | `.claude/skills/fsharp-analyzers-expert/SKILL.md:83` | F# string literal split across lines in a "reference pattern" snippet — won't compile as written |
| compile | `.claude/skills/fsharp-analyzers-expert/SKILL.md:176` | unclosed inline-code backtick spans where Markdown renders the whole paragraph as code |
| semantic | `.claude/skills/f-star-expert/SKILL.md:8,36` | multiple run-together words from missing spaces around `**` markup (`F*as`, `code.**Zeta`) |

### PR #27 — Round 34 Dbsp→Zeta rename sweep + toolchain mise-ification

| Class | Location | Catch |
|-------|----------|-------|
| compile | `tests/Tests.FSharp/Storage/ArrowSerializer.Tests.fs:97-98` | `System.ReadOnlySpan(bytes, 0, 4)` missing generic arg — will not compile in F#; needs `bytes.AsSpan(0, 4)` or `ReadOnlySpan<byte>(...)` |
| data-loss | `tools/setup/common/profile-edit.sh:71-74` | if `MARKER_BEGIN` present but `MARKER_END` missing, awk filter treats the rest of the rc file as "in_block" and silently truncates it |
| data-loss | `tools/setup/common/profile-edit.sh:70` | `mktemp + mv` resets file mode to 0600, losing original permissions and ownership |
| self-ref | `.github/copilot-instructions.md:49` | halt-on-prompt-injection-strings rule self-triggers: any PR touching this file now contains those strings, so review would permanently halt |
| shell | `tools/setup/macos.sh:101` + `shellenv.sh:105` | shim-path probe misses `/usr/local/...` (Intel macOS) — Intel Macs silently broken |
| shell | `tools/setup/common/verifiers.sh:20` + `dotnet-tools.sh:14` | <code>grep -vE '^(#&#124;$)' &#124; while …</code> under `set -euo pipefail` fails when manifest is all-comments (grep exits 1) |
| xref | `openspec/specs/{operator-algebra,retraction-safe-recursion,durability-modes}/profiles/fsharp.md` | three profiles still say `Dbsp.Core` namespace after the round-33 rename to `Zeta.Core` |
| config-drift | `.mise.toml:29` vs three docs | pins `java = "26"` while CONTRIBUTING.md + java-expert skill + verifier error message still reference JDK 21 |
| config-drift | `docs/security/THREAT-MODEL.md:234` | claims "Round-31 SHA-256 pinning via verifiers manifest" but manifest and `common/verifiers.sh` explicitly state TOFU-only |
| config-drift | `CONTRIBUTING.md:15-16,30` | quick-start tells contributors to expect `DOTNET_ROOT` / `JAVA_HOME` exports that `shellenv.sh` no longer emits |
| config-drift | `tools/setup/common/shellenv.sh:36,95` | comments say `mise activate --shims` but generated env file runs `mise activate bash` (no `--shims`) — misleading for PATH-issue debugging |
| semantic | `tests/Tests.FSharp/Operators/SpeculativeWatermark.Tests.fs:98` | `maxWeight` is a **count** of entries with weight > 1, not a maximum — misleading name |
| compile | `tools/setup/manifests/uv-tools:8` | comment says Semgrep is managed via `common/dotnet-tools.sh` but Semgrep is installed in CI via `pip install` — comment and reality disagree |
| shell | `tools/setup/common/shellenv.sh:132` | printed post-run guidance says opt-in auto-edit is BACKLOGged, but this PR adds `profile-edit.sh` and calls it gated by `ZETA_AUTO_EDIT_PROFILES=1` |

## How to add a row after a PR closes

1. Fetch the inline Copilot comments using the `gh api` recipe
   at the top of this file.
2. Add a new section at the top of `## Log` with shape
   `### PR #<N> — <round / theme>`.
3. One row per genuine win. Group rows by PR, not by class.
4. Fails aren't tracked. If something is a fail, just don't
   add a row and move on — no "considered and rejected"
   bookkeeping.

## Why this exists

`.github/copilot-instructions.md` §"Lean into what you're
demonstrably good at" is calibrated against this log. When a
review class accumulates five or more wins across PRs, it
earns a bullet in that section. When a class flatlines for
several rounds, the bullet drops. The instruction file tells
Copilot what to focus on; this file tells us why we told it
that.
