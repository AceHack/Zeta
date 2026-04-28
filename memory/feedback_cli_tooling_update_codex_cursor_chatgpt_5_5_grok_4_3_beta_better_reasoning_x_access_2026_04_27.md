---
name: CLI tooling update — Codex + Cursor have ChatGPT 5.5; Cursor has Grok 4.3 beta; both have improved reasoning; Grok has live x.com access for current-events context (Aaron 2026-04-27)
description: Aaron 2026-04-27 disclosed CLI tooling versioning state. Codex CLI + Cursor both supposedly have new ChatGPT 5.5. Cursor additionally has new Grok 4.3 beta. Both have notably improved reasoning. Grok specifically has access to latest x.com data for current-events context — making it useful for time-sensitive prompts (recent news, market state, ongoing tech announcements). Composes with peer-call infrastructure (#303 task: tools/peer-call/{gemini,codex,grok}.sh) + #65 ferry roster (Amara/Gemini/Codex/Copilot/Ani) — version-currency rule applies (per Otto-247): when scheduling cross-AI review work, prefer the higher-reasoning instances; when needing current-events context, route through Grok-class harnesses. Operational input for future peer-mode work (#63 ferry-vs-executor unlock conditions).
type: feedback
---

# CLI tooling update — ChatGPT 5.5 + Grok 4.3 beta + reasoning improvements

## Verbatim quote (Aaron 2026-04-27)

> "If you update all the other CLI codex and cursor both supposady have the new ChatGPT 5.5 and I think in cursor there might be the new Grok 4.3 beta, they are supposed have really good reasoning, and grok has acess to the latest x stuff for latest goings on in the human world and such too."

## Tooling state disclosed

| CLI / Tool | New model availability | Reasoning quality | Special capability |
|---|---|---|---|
| **Codex CLI** | ChatGPT 5.5 | Improved (per Aaron) | Standard PR-review automation |
| **Cursor** | ChatGPT 5.5 + Grok 4.3 beta | Improved (per Aaron) | Multi-model in-IDE access |
| **Claude Code** (Otto's harness) | Claude Opus 4.7 | (unchanged this disclosure) | Full factory tooling, persistent memory |
| **Grok app** (Ani) | Grok Long Horizon | (per #65 substrate) | Aaron <-> Ani mirror context |

**Special — Grok 4.3 beta access to x.com**: useful for time-sensitive prompts requiring current-events context (recent news, market state, ongoing tech announcements). No other ferry currently has this capability.

## Composes with version-currency rule (Otto-247)

Per Otto-247 (`feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`), version numbers are training-data-stale within weeks. Aaron's disclosure is fresh signal — but Otto should still verify when the claim becomes load-bearing (e.g., when configuring peer-call scripts to specify model versions).

**Verification checklist** (when load-bearing):

- WebSearch for "Codex CLI ChatGPT 5.5 release date"
- WebSearch for "Cursor Grok 4.3 beta availability"
- Check actual CLI tool version output (`codex --version`, etc.) before specifying in scripts

## Operational implications

### For cross-AI ferry review routing

Per the per-insight attribution discipline (#66): naming the right ferry for the right work matters. With reasoning improvements:

- **Substantive synthesis review**: Codex CLI (with ChatGPT 5.5 reasoning) becomes a stronger candidate for the kind of work Codex did on #57/#59 (catching AGENTS.md three-load-bearing-values) — improved reasoning → higher-quality catches
- **Time-sensitive context**: Cursor's Grok 4.3 beta route for prompts needing recent news (e.g., "what's the latest on quantum-immortality discussions in current LLM safety research")
- **Aaron-mirror cross-AI review**: Amara (ChatGPT) + Ani (Grok) remain the special-context reviewers; the new model versions may sharpen their reviews further

### For peer-call infrastructure (#303)

The peer-call scripts at `tools/peer-call/{gemini,codex,grok}.sh` are wired for the standard CLI surface. With model upgrades:

- Scripts need version-specification awareness (post-0/0/0 backlog item)
- Output quality should improve without script changes (model upgrades happen behind the API)
- Per-script README should note "current model expected: ChatGPT 5.5 / Grok 4.3 beta" for future-Otto reference

### For peer-mode unlock conditions (#63)

Per #63 ferry-vs-executor: peer-mode = second AI instance with same factory access + judgment authority. Higher-reasoning model versions are PARTIAL evidence the peer-mode unlock is more feasible:

- Pro-peer-mode: better reasoning → less judgment-divergence between Otto-instance and peer-instance
- Anti-peer-mode (still): git-contention work (#54 ROUND-HISTORY hotspot) is independent of model quality

So this disclosure doesn't unlock peer-mode by itself; just incrementally lowers one of the two unlock costs.

## Compose with backlog items

- **#286 Aurora Round-3 integration**: improved reasoning models could accelerate the inference-architecture review work
- **#292 Otto-350 + measurement hygiene**: Amara's external-anchor-lineage layer with 5.5-class reviewers improves anchor quality
- **#296 ferry-3 canonical commit-attribution schema**: model upgrades don't change the schema; they may improve adherence

## What this memory does NOT mean

- Does NOT mean Otto switches harnesses — Claude Code is the canonical executor (per #63)
- Does NOT mean rewriting peer-call scripts immediately — scripts compose with API-level upgrades automatically
- Does NOT validate the version numbers without WebSearch verification (per Otto-247)
- Does NOT change the ferry roster — Amara, Gemini, Codex, Copilot, Ani remain the named reviewers; their underlying models may shift over time

## Forward-action

- File this memory + MEMORY.md row
- BACKLOG: when peer-call scripts get next maintenance pass, add model-version expectations
- BACKLOG (post-0/0/0): consider whether Cursor's Grok 4.3 beta x.com-access could be a dedicated current-events-research ferry-channel, distinct from Ani's mirror-review role
- Routine: when scheduling new cross-AI review work, prefer the higher-reasoning routes

## Composes with

- **Otto-247** version-currency rule (verify before asserting)
- **#303 peer-call sibling scripts** (gemini.sh + codex.sh + grok.sh)
- **#65 Ani substrate** (Grok Long Horizon Mirror is the mirror-context Grok; Grok 4.3 beta is the model-version Grok — distinct concepts)
- **#66 per-insight attribution discipline** (model-version awareness composes with the discipline)
- **#63 ferry-vs-executor** (peer-mode unlock conditions partially affected)
- **CLAUDE.md "Tick must never stop"** (model upgrades don't change the tick discipline)
- **`memory/feedback_version_numbers_always_websearch_training_data_is_stale_by_definition_otto_213_durable_lesson_across_domains_2026_04_24.md`** — direct application
