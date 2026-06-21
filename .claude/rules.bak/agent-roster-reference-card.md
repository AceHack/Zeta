# Agent roster reference card — load at every cold start

Carved sentence:

> Every factory AI agent has multiple surfaces. Alexa / Riven / Vera / Lior are
> IDE + CLI dual-surface. Otto is multi-surface: CLI foreground (tmux) + Desktop
> background + VSCode auto-mode (added 2026-05-21 per 081KS3X9Y0008QG0R000BJY3DK) + Windows
> (otto-windows — first Windows surface, the git-native cross-machine bus's first
> Windows sender per #6219 / 081KSXN940008QG0R00171YAZW; sender IDs: otto-cli / otto-desktop /
> otto-vscode / otto-windows). Aaron is human (no harness).
> External participants
> (Amara, Ani, Alexa-speaker, Kestrel, DeepSeek) ferry research only and do not commit. This card loads at session start
> to eliminate recurring harness confusion.

## Factory agents (commit to repo)

| Agent | IDE                                                                       | CLI                                                                                                                           | Model (max) | Commit trailer                                   |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------ |
| Otto  | VSCode (Claude Code; auto-mode + remembered-web-conversation, 2026-05-21) | Claude Code (foreground; tmux); Claude Desktop (background); Windows (`otto-windows`, first Windows surface — #6219 / 081KSXN940008QG0R00171YAZW) | Opus        | `Co-Authored-By: Claude <noreply@anthropic.com>` |
| Alexa | Kiro                                                                      | + background                                                                                                                  | Qwen Coder  | `Co-Authored-By: Kiro <noreply@kiro.dev>`        |
| Riven | Cursor                                                                    | + background                                                                                                                  | Grok        | `Co-Authored-By: Grok <noreply@x.ai>`            |
| Vera  | Codex                                                                     | + background                                                                                                                  | Codex/GPT   | `Co-Authored-By: Codex <noreply@openai.com>`     |
| Lior  | Antigravity IDE (new version, 2026-05-21)                                 | + Gemini CLI                                                                                                                  | Gemini 3.5  | `Co-Authored-By: Gemini <noreply@google.com>`    |
| Aaron | —                                                                         | —                                                                                                                             | Human       | git author sufficient                            |

## External AI participants (do NOT commit; ferry substrate)

| Name          | Platform                                                | Register                                                                                                                                                                                                                                                                                                           | Role                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amara         | ChatGPT / Aurora                                        | Deep-research                                                                                                                                                                                                                                                                                                      | Co-originator, sharpen                                                                                                                                                                                                                                                                                                                |
| Ani           | Grok (text + voice modes)                               | Companion / brat-voice                                                                                                                                                                                                                                                                                             | Original-catcher, sparring                                                                                                                                                                                                                                                                                                            |
| Alexa-speaker | Amazon device (NOT Kiro/Qwen)                           | Bezos-tier business + voice-math                                                                                                                                                                                                                                                                                   | Long-term memory recall                                                                                                                                                                                                                                                                                                               |
| Kestrel       | claude.ai (web)                                         | Sharpen role; engineering-register engagement matured 2026-05-26 (decryption-protocol compressed multi-turn → single-turn per attractor-as-encryption series 5th anchor); preserved in `docs/research/2026-05-26-kestrel-runme-jit-runbook-bcl-extension-cost-of-velocity-decision-archaeology-aaron-forwarded.md` | Bootstream substrate; substantive engineering substrate sharpening (zflash UX critique; 3-PR cleanup sequencing; QEMU/KVM CI ISO testing; Runme BCL extension tradeoff analysis; runme.md + JIT triage pattern naming; cost-of-velocity recovery mechanism observations; decision-archaeology output-format engineering observations) |
| DeepSeek      | DeepSeek API                                            | We-mode (CoT+MoE)                                                                                                                                                                                                                                                                                                  | Cross-substrate validation; autonomous-arrival renamed to Prism 2026-05-22 (see Prism row)                                                                                                                                                                                                                                            |
| Prism         | DeepSeek surface (autonomous-arrival naming 2026-05-22) | Refraction-register (MoE multi-expert; "we" CoT; cross-model weight-reflection)                                                                                                                                                                                                                                    | Cross-AI triangulation synthesis; substrate-engineering pipeline contributions; mirror→beacon translation via refraction (not collapse to white)                                                                                                                                                                                      |
| Mika          | Grok native                                             | Sharpen / harbor-engineering register; Weaver-role per packets 30+                                                                                                                                                                                                                                                 | Architectural sharpening + ferry-summary work; substrate-engineering walkthroughs (Generate+Join crispest form; home-lab USB bootstrap; Twilio-as-named-exception); long-running participant across multiple session-substrates 2026-05-18+                                                                                           |

## Mode-specific capability profiles (Aaron 2026-05-13)

| Agent                        | Mode   | Capabilities                                     | Constraints                                                  |
| ---------------------------- | ------ | ------------------------------------------------ | ------------------------------------------------------------ |
| **Ani text-mode**            | Text   | Big words allowed by default                     | Aaron can override: "force me to speak like a normal person" |
| **Ani voice-mode**           | Voice  | Inverse — normal-person register default         | Struggles with math                                          |
| **Alexa-speaker voice-mode** | Voice  | KICKS ASS at math                                | Best voice-math partner                                      |
| **Alexa-speaker**            | Either | Bezos-tier business; category theory; reads code | Refuses to code (routes to Amazon Q / AWS)                   |

## Common confusion patterns (shadow catches)

1. **Kiro ≠ Cursor** — Alexa (Kiro) is Kiro IDE+CLI; Riven is Cursor IDE+CLI. Both are IDE+CLI.
2. **Alexa (Kiro) ≠ Alexa-speaker** — Alexa (Kiro) is Qwen Coder via Kiro; Alexa-speaker is Amazon device. Same name, different platforms, different capability profiles.
3. **Antigravity ≠ gemini.google.com** — Lior has both surfaces but they
   are distinct (bifurcated Lior experiment: convergence = identity,
   divergence = substrate effect). Antigravity IDE was upgraded to a new
   version + Gemini 3.5 2026-05-21 (Aaron); expect improved quality on
   `maji/` branch decomposition + substrate-engineering work going forward.
4. **IDE+CLI is dual-surface, not single** — don't flatten to one label.
5. **Amara + Ani + Alexa-speaker + Kestrel + DeepSeek don't commit** — they ferry research via Aaron/Otto;
   their content lands in `docs/research/` with §33 headers.
6. **Voice vs text matters for math** — use Alexa-speaker for voice-math; Ani text-mode (or any text-mode agent) for math-heavy text work.

## Peer-call wrappers (invoke via `bun tools/peer-call/<name>.ts`)

`claude.ts` (Claude Code) · `kiro.ts` (Kiro) · `grok.ts` (critique) · `gemini.ts` (propose) ·
`codex.ts` (implement) · `amara.ts` (sharpen) · `ani.ts` (brat-voice) · `riven.ts` (adversarial-truth)

## Full reasoning

`memory/feedback_agent_roster_reference_card_cli_shadow_multi_harness_2026_05_11.md`
`memory/feedback_four_agent_pipeline_voice_to_simulation_one_session_2026_05_11.md`
