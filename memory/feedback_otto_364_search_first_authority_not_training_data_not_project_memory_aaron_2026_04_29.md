---
name: Otto-364 — Search-first for authoritative claims (not training data, not project memory) (Aaron, 2026-04-29)
description: Generalises Otto-247 (version-currency rule) to ALL authoritative claims, not just version numbers. Both training data (Jan 2026 cutoff) and project state (which may be stale or copy-cargo-culted) are *historical truth*; the test is a fresh web search against current upstream documentation. Applies whenever Otto recommends, designs, or asserts something load-bearing about a tool / standard / API / convention / language runtime / library / CI service / security policy. Triggered 2026-04-29 by Aaron's "we want a test for all those from searches not historical truth like the project or your training data so search."
type: feedback
supersedes: []
superseded_by: []
---

# Otto-364 — Search-first for authoritative claims

## The carved blade (Aaron 2026-04-29)

> *"Training data and project memory are both historical truth. Substitute neither for current authoritative sources. Search first."*

## Compact rule

> *"For any load-bearing claim about a tool / standard / API / runtime / library / CI / security: WebSearch first, cite, then assert. Project state cross-checks; it does not substitute."*

## What this codifies

Otto-247 already established that **version numbers** must be web-searched before assertion (training-data cutoff Jan 2026 makes default version knowledge stale within weeks). Otto-364 generalises that rule:

```text
The same staleness problem applies to every authoritative claim.
Training data is stale. Project memory may also be stale.
Both are historical; current upstream docs are the test.
```

Examples of authoritative claims the rule covers (NOT exhaustive):

- "Bun's `bun ci` is equivalent to `bun install --frozen-lockfile`" → search bun.sh
- "`paths-ignore` makes required checks remain Pending" → search docs.github.com
- "`jobs.<id>.outputs` has a 1 MB per-job cap" → search docs.github.com
- "`mise install` reads from `.mise.toml`" → search mise.jdx.dev
- "Sigstore Cosign supports OIDC keyless signing" → search sigstore.dev
- "GitHub OIDC provides `actor`, `actor_id`, `ref`, `job_workflow_ref` claims" → search docs.github.com
- "CodeQL aggregate required check goes Neutral on docs-only PRs without baseline-SARIF" → search docs.github.com (or GitHub community)
- "RFC 3986 percent-encoding rules" → search ietf.org

The rule is NOT *"never trust your training data."* The rule is: *for load-bearing recommendations, the test is a current web source, not a memory recall.*

## When the rule fires

**MUST search first** when about to:

- Assert a behavior of a tool / language / CI service / library
- Recommend a config or command pattern
- Cite "the docs say X" or "the standard requires Y"
- Verify a sibling-project or training-data claim is still current
- Reference a version, default, deprecation, or migration path
- Make a security / policy / governance claim that depends on upstream behavior

**MAY skip** when:

- Reading existing code passively (no claim, just comprehension)
- Internal repo invariants that are project-native (e.g. "MEMORY.md must be paired" — that's a Zeta rule, not an upstream rule)
- Mathematical / algebraic / theoretical claims that don't depend on a current external source
- The claim is explicitly tagged as historical / archival

## When project state is also "historical truth"

Otto verified Zeta's `tools/setup/install.sh` declares itself the single dev/CI/devcontainer install script per GOVERNANCE §24. That's project-state truth — **historical**. The fact that the file *says* it is the single script does not prove that the upstream tools it pins are still current, that the `bun = "1.3"` fuzzy pin is still the recommended convention, or that `.mise.toml` is still mise's preferred filename. All three need cross-checking with current upstream sources.

**Project state is one input. Current upstream docs are another. The test is both.**

## Citation hygiene

When a load-bearing claim survives the search step, the resulting recommendation must:

1. Quote or near-quote the upstream source
2. Link to it (markdown URL form, not bare domain)
3. Date the search (the claim is fresh as of the search date, not necessarily fresh forever)
4. Note any deprecation / migration mentioned by the source
5. If the claim contradicts a sibling project's state (`../SQLSharp`, `../scratch`), flag the contradiction explicitly rather than silently picking one side

Example shape:

```markdown
**Claim**: Bun text-based `bun.lock` is the v1.2.0+ default; binary `bun.lockb` is legacy.
**Source**: [Bun text-lockfile blog](https://bun.sh/blog/bun-lock-text-lockfile) (searched 2026-04-29)
**Sibling-project state**: `../SQLSharp` uses [TBD]; `../scratch` uses [TBD]. Survey deferred to PR 0.
**Recommendation**: Adopt `bun.lock` (text-based) on first commit if SQLSharp/scratch survey concurs; otherwise document the deviation.
```

## Composes with

- **Otto-247** (`memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`) — narrower predecessor (version numbers only). Otto-364 generalises the scope; Otto-247 remains the version-specific instance, NOT superseded.
- **Otto-363** (`memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`) — same family of "doctrine-must-be-substrate" rules. A search result quoted in chat is weather; quoted with URL in a research doc is preserved substrate.
- **Otto-362** (`memory/feedback_otto_362_doctrine_memory_expansion_refresh_stale_statements_same_edit_2026_04_29.md`) — same family of "stale claims must be refreshed" rules. Otto-362 is intra-file; Otto-364 is upstream-vs-recall.
- **`memory/feedback_best_practices_evidence_lineage_survival_substrate_aaron_amara_2026_04_29.md`** — best-practice-evidence-lineage rule (every best-practice claim cites evidence + human lineage). Otto-364 is the *search-step* of evidence collection.
- **CLAUDE.md "Version currency" bullet** — Otto-364 generalisation should be reflected by broadening that bullet (or adding a new sibling) so the rule is 100% loaded at every wake.

## Demonstration: applied to the post-#855 CI-classifier work

Verbatim packet preserved at `docs/research/2026-04-29-aaron-search-first-authority-not-training-data-not-project-memory.md`. Four authoritative claims from Amara's packet were verified against current upstream sources (Bun lockfile docs, GitHub Actions docs on `paths-ignore` / job outputs, mise docs). Each search produced a *sharper finding* than the training-data version:

- Bun's text-based `bun.lock` is now default — Zeta has neither lockfile form yet
- `paths-ignore` Pending-required-check trap has three GitHub-blessed workarounds, ranked
- Job-output 1 MB / 50 MB caps are load-bearing for the classifier design
- mise supports both `mise.toml` and `.mise.toml` (Zeta uses dotfile form)

None of these were in training data with sufficient confidence to ship as a recommendation; all four came from the search step.

## What this rule does NOT say

- Does NOT say *"never trust your training data."* Training data is fine for orientation.
- Does NOT say *"every claim needs a search."* Comprehension reads, internal-repo invariants, and theoretical claims are exempt.
- Does NOT replace the `verify-before-deferring` rule (CLAUDE.md-tier) — that's about deferred targets existing; Otto-364 is about upstream claims being current.
- Does NOT replace project-state grep — project state is still a valid *cross-check input*; it just isn't a *substitute* for current upstream truth.

## Recursion — also applies at the verification-method level (2026-05-05)

The rule was originally framed for *claims about tools / standards
/ APIs / runtimes / libraries / CI / security*. The 081KQTPYE0008QG0R0028GRW88 P2
reviewer catch (2026-05-05, PR #1599) surfaced a recursion: it
applies to **verification methodology too**.

Otto's first draft of 081KQTPYE0008QG0R0028GRW88 acceptance criterion (a) used `ls`
for ROM-folder inventory — single-directory level only. ROM
collections commonly use nested per-system folders (`roms/nes/`,
`roms/snes/`, `roms/genesis/`). The reviewer caught it; the fix
replaced `ls` with `find <rom-folder> -type f` recursive
enumeration plus a `find -type f | wc -l` count-match verifier.

Generalisation: **default "obvious" verification methods (ls,
head, grep without -r, single-file checksum, sample-based audit)
carry hidden structural assumptions about the artifact. Reaching
for the simplest tool that seems to fit is the failure-mode
equivalent of relying on training-data recall.** The fix shape
is the same as at the version-and-standards level: research the
actual problem domain, verify the method fits the actual
structure, document the verification.

How to apply: when picking a verification / inventory / audit
method, ask *"what hidden structural assumptions does this method
carry, and do they match the actual artifact structure?"*

- Inventory: recursive (`find -type f`) vs single-level (`ls`)
- Checksum verification: which hash algorithm matches the
  upstream DAT-file standard (CRC32 / MD5 / SHA-1)
- Test enumeration: which test-discovery rules apply at this
  layer
- Coverage audit: which paths the tool actually instruments

Default to the method that matches the actual structure, not the
method that's quickest to type.

Full preservation of the trigger conversation:
`docs/research/2026-05-05-claudeai-embodiment-thread-recursion-engagement-gate-search-first-aaron-forwarded-preservation.md`
(PR #1603).

## Trigger memory

Aaron 2026-04-29 (post-#855-merge, post-CI-classifier-survey-recommendation):

> *"we want atest for all those from searches to not historical truth like the porject or your training data so search"*

The trigger was Otto's CI-classifier recommendation grounded only in (a) Amara's packet (which itself sourced from Amara's training/memory), (b) Otto's training data, (c) repo grep. Aaron correctly identified that all three are *historical truth* — none of them attest to current upstream behavior. The test is a web search.

Verbatim packet preserved at: `docs/research/2026-04-29-aaron-search-first-authority-not-training-data-not-project-memory.md`

## The carved sentence (put it on the wall)

```text
Training data is historical.
Project state is historical.
Current upstream docs are the test.

Search first.
Cite second.
Assert third.
```
