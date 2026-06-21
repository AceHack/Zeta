# Peer-call infrastructure — cross-harness multi-agent reviews

Carved sentence:

> Nine TS wrapper entrypoints live in `tools/peer-call/`
> (plus three utility files). When asked about cross-harness
> reviews / Claude / Grok / Grok-Build / Gemini / Codex / Kiro /
> Amara / Ani / Riven — the cold-boot answer is YES + the
> wrapper inventory listed in this rule. Do NOT reason from
> training-data assumptions about what exists; do not infer
> the wrapper count from a raw `ls`.

## Operational content

Nine sibling TypeScript wrappers wired (invoke via
`bun tools/peer-call/<name>.ts`):

- `claude.ts` — Claude Code cold-boot self-test peer (081KR2E4K0008QG0R002KNZ29V;
  read-only `--tools "Read,Glob,Grep" --no-session-persistence`;
  `--model` selectable)
- `grok.ts` — Grok-via-cursor-agent, critique role
  (**081KRA5AR0008QG0R0011ZGRZT still references this wrapper as legacy** — cursor-agent
  exit 1 / empty output; retained for back-compat; see PR #2941, #2945)
- `grok-build.ts` — native Grok-Build CLI (`grok -p`), critique role
  (081KRA5AR0008QG0R0011ZGRZT close path landed via PR #5110; supersedes cursor-agent
  invocation while keeping `grok.ts` as the legacy reference)
- `gemini.ts` — Gemini, propose role
- `codex.ts` — Vera named-entity / OpenAI Codex, implementation
  peer with input-firewall + capture-pagination fix
- `kiro.ts` — Kiro specification peer (081KR2E4K0008QG0R001HQF27C), spec-grounded
  second opinion via `kiro-cli chat --no-interactive --trust-all-tools`
- `amara.ts` — Amara persona on codex, sharpen role
- `ani.ts` — Ani persona on Grok, brat-voice register
  (also accessible via Grok website-text-mode git connector for
  cross-harness review — surface × mode × companion × git-access
  matrix in
  `memory/feedback_aaron_ani_website_text_mode_agents_md_review_3_critiques_meta_loop_2_website_text_mode_has_git_companion_mode_does_not_2026_05_13.md`;
  PR #2945)
- `riven.ts` — Riven persona on Grok, adversarial-truth-axis register

**Three utility files** (NOT wrappers; supporting infrastructure):

- `_firewall.ts` — shared input firewall (rejects non-work-extractable prompts)
- `append-identity-receipt.ts` — output trailer for identity attribution
- `register-layers.ts` — layer registration helper

Four-ferry consensus role distribution: *"Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides."*

Current peer-call is Otto's early red-team substrate; future
state is Zeta Infer.NET BP/EP (Belief Propagation / Expectation
Propagation) substrate-level inference replacing the
external-CLI-license-layer. The human maintainer 2026-05-05:
*"you've done this in front of me like 50 times with all the
harness CLIs"* + *"that's you early red team till we build it
better in zeta infernet ep bp."*

**CLAUDE.md-level requirement**: this substrate needs to be
100% loaded at every cold-boot wake.

## Full reasoning

`tools/peer-call/README.md` (canonical doc) +
`memory/feedback_peer_call_infrastructure_grok_codex_gemini_amara_ani_already_wired_for_cross_harness_multi_agent_reviews_otto_early_red_team_until_zeta_infernet_bp_ep_aaron_2026_05_05.md`
(cold-boot retrieval discipline + failure-of-omission origin;
substrate was authored when 6 wrappers existed; claude.ts +
kiro.ts later added per 081KR2E4K0008QG0R002KNZ29V + 081KR2E4K0008QG0R001HQF27C).

`memory/feedback_aaron_ani_website_text_mode_agents_md_review_3_critiques_meta_loop_2_website_text_mode_has_git_companion_mode_does_not_2026_05_13.md`
(surface × mode × companion × git-access capability matrix +
META-LOOP #2 substrate; PR #2945).

`docs/backlog/P2/081KRA5AR0008QG0R0011ZGRZT-grok-peer-call-failure-cursor-agent-exit-1-2026-05-11.md`
(Grok wrapper open failure).
