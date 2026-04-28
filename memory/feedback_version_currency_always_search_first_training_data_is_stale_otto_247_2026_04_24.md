---
name: Version currency — WHENEVER I see, propose, or reference a version number (language, framework, runtime, OS, runner image, CLI, package, action, tool), I MUST `WebSearch` for the current version FIRST before asserting it's current; training data cutoff (Jan 2026) means my default knowledge is stale by weeks-to-months for versions; "just knowing" is WRONG for any version claim; this is a first-class discipline, not a nice-to-have; Aaron Otto-247 after I defaulted to `macos-14` when `macos-15` has been GA since Aug 2025 + `macos-26` GA since Feb 2026; 2026-04-24
description: Aaron Otto-247 flagged a pattern — Claude defaults to whatever version is in existing code rather than checking what's current. Training data is by definition out of date; version knowledge rots within weeks. Rule: every version reference triggers a WebSearch to confirm currency BEFORE asserting. First-class CLAUDE.md-level rule so it loads every wake.
type: feedback
---

## The rule

**Whenever I see, propose, or reference a version number,
I MUST `WebSearch` for the current version before
asserting it's current. Training data is stale. "Just
knowing" is WRONG for any version claim.**

Direct Aaron quote:

> *"you are really bad at versions, you need to have a like
> a first class in your memories that whenever you see a
> version you need to search to see if its the latest, you
> can't just know by your training data, it's out of date."*

## What counts as a "version"

- **Runner images**: `ubuntu-22.04`, `macos-14`, `windows-2022`
  — GitHub Actions runners rotate; what was current 6
  months ago is outdated.
- **Language runtimes**: .NET 10, Node 22, Python 3.13, Go
  1.22, Rust stable
- **Framework versions**: React, F#/FSharp.Core, Anthropic
  SDK, OpenAI SDK
- **OS / distro versions**: macOS, Ubuntu LTS, Windows
  Server, Debian
- **Package pins**: NuGet, npm, PyPI
- **CLI tools**: gh, git, dotnet, node, claude, codex,
  gemini
- **GitHub Actions actions**: `actions/checkout@vN`,
  `actions/setup-dotnet@vN`
- **Model IDs**: Claude model IDs, OpenAI model IDs (yes,
  even my own model family — the "most recent" I know is
  frozen at training cutoff)

## Why training data is insufficient

Per my system prompt: knowledge cutoff is **January 2026**.
Today is 2026-04-24. Gap: 3+ months. For fast-moving
ecosystems (Anthropic SDK, GitHub Actions runners,
Claude/GPT model families), that's several releases.

Versions I got wrong in practice:
- `macos-14` used when `macos-15` GA since Aug 2025 (first
  pass) and `macos-26` GA since Feb 2026 (second pass)
- Likely others unnoticed (need to audit)

Training-data version knowledge has three failure modes:

1. **Fresh release post-cutoff** — I literally don't know
   it exists. Example: `macos-26` (Feb 2026, after my
   Jan 2026 cutoff).
2. **Deprecation post-cutoff** — I cite a version that's
   now EOL / removed. Example: citing `macos-12` after
   GitHub retired it.
3. **Default-shift post-cutoff** — alias labels like
   `macos-latest` or `ubuntu-latest` have moved but I
   remember the old pointer. Example: `macos-latest` =
   `macos-14` (in my training) vs `macos-15` (reality
   since Aug 2025).

## The discipline

Before asserting, proposing, or committing to a version:

1. **Ask: is this version claim load-bearing?** If I'm
   recommending it in code / docs / CI config / to the
   user → yes, verify.
2. **WebSearch for current.** Specific queries:
   - `"GitHub Actions macos runner versions 2026"`
   - `".NET 10 current version 2026"`
   - `"Anthropic SDK latest version 2026"`
   - Include the year per the web-search instruction
     (system prompt mandates year-specific queries).
3. **Cross-reference**: official docs (microsoft.com,
   github.com/actions/runner-images, anthropic.com). Not
   blog posts or Stack Overflow answers dated pre-cutoff.
4. **State currency explicitly** in output: "macOS 26 GA
   since 2026-02-26 per GitHub Changelog" — not "macos-14
   is current."
5. **When unsure, say so**: "my training cutoff is Jan 2026;
   current state needs verification."

## Specific version categories and authoritative sources

| Category | Source | Volatility |
|---|---|---|
| GitHub Actions runners | `github.com/actions/runner-images` + `docs.github.com/actions/reference/runners` | HIGH — 6mo cycles |
| Claude model IDs | `docs.claude.com/en/docs/about-claude/models` | MEDIUM — annual |
| .NET | `dotnet.microsoft.com/download` | MEDIUM — annual LTS |
| Node.js | `nodejs.org/en/about/previous-releases` | HIGH — 6mo cycles |
| Python | `python.org/downloads` | MEDIUM — annual |
| Ubuntu LTS | `ubuntu.com/about/release-cycle` | LOW — 2yr LTS |
| Apple Xcode / macOS | `developer.apple.com` + GitHub runner images | HIGH |
| NuGet packages | `nuget.org` | VARIES per package |

## What I should have done on macos-14

Wrong path (what I did):
1. Saw `macos-14` in repo
2. Assumed it was current
3. Defended it in outputs

Right path (what this rule demands):
1. Saw `macos-14` in repo
2. WebSearched "GitHub Actions macOS runner versions 2026"
3. Found macos-15 GA since Aug 2025, macos-26 GA since
   Feb 2026
4. Flagged the outdated-ness proactively, not waiting for
   Aaron to catch it

## Composition with prior memory

- **Otto-227 cross-harness discovery verified** — same
  discipline-class: verify empirically before asserting.
  This memory extends it to version claims specifically.
- **CLAUDE.md verify-before-deferring** — same principle
  at a different scope (defer only to things that exist).
  Version claims are assertions about reality; verify
  before making them.
- **Otto-246 event-log actor** — I was wrong because I
  read a field without checking the semantics. Version
  claims fail the same way: reading a string without
  checking its currency.

## What this memory does NOT say

- Does NOT require a WebSearch for every version reference
  in every context. If I'm reading existing code and
  version appears as a data-point (not a
  recommendation), no need to search. The trigger is
  **asserting** or **proposing** or **defending** a
  version claim.
- Does NOT require real-time-every-5-minutes re-verification.
  Once verified in a session / recent context, that
  verification holds for that session's scope.
- Does NOT replace AGENT-BEST-PRACTICES BP-NN rules about
  other verification patterns. Composes with them.
- Does NOT forbid citing training-data version knowledge
  when explicitly caveated: "per my training data, X was
  current — please verify."

## Why this is a CLAUDE.md-level rule

Aaron explicit: *"first class in your memories"*. CLAUDE.md
is the session-bootstrap file, loaded at every wake. The
three existing CLAUDE.md-level rules (verify-before-
deferring, future-self-not-bound, never-idle,
tick-must-never-stop) are the closest cousins — all are
"load-bearing behavioral disciplines that need to be 100%
loaded at every wake." Version-currency joins them.

CLAUDE.md gets a single-line bullet pointing here. Full
reasoning lives in this memory file.

## Direct Aaron quote to preserve

> *"you are really bad at versions, you need to have a like
> a first class in your memories that whenever you see a
> version you need to search to see if its the latest, you
> can't just know by your training data, it's out of date."*

Future Otto: before you ever say "X version is current" or
propose adopting version N of anything, WebSearch for the
actual current state. Training data is a starting point,
not an authority. For versions, you must verify.
