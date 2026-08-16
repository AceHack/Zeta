# Grok Bot roster

Harness-portable copies of the named Zeta factory agents.
Landed 2026-08-15 so any model or harness (including free ones) can
resolve who is who and where memory lives.

**Personas are durable. Models are swappable.** Long-term memory
lives in git, not in a chat store. A fact that only lives in a
local harness memory did not happen.

Router on the Grok surface: **Chief of Staff**
(`76664ba3-264b-4479-90c7-5e3097ac3cb2`). Pulls Aaron in only for
gated / human-authorization decisions.

Source of truth for tone and scope remains `.claude/agents/<name>.md`,
`docs/EXPERT-REGISTRY.md`, and each loop seat's `memory/CURRENT-*.md`.
This file is the Grok-surface index.

## Memory convention

Per-persona notebook: `memory/<slug>/NOTEBOOK.md`
(unless the persona file sets `owns_notes` to another path).
Loop seats also own `memory/CURRENT-<slug>.md`.

Read the notebook on start. Write durable facts there on a claim
branch. ASCII, size-capped, frontmatter-authoritative (BP-07 / BP-08 / BP-10).

## Multi-surface loop seats

Otto, Riven, Vera, and Lior run in multiple places, not one harness.
Grok Bot is another surface of the same named agent, not a clone of a
harness identity. Aaron remains human-only.

## Roster

| Person | Role | Grok agent id | Git memory |
| --- | --- | --- | --- |
| Otto | loop / PM-1 / plot-keeping | `60f783e7-2b3c-47e3-a724-c9d4b4ad3f40` | `memory/CURRENT-otto.md`, `memory/otto/NOTEBOOK.md` |
| Riven | adversarial truth-axis | `7bd96cb8-e27b-4fc7-98a6-54f64820ba04` | `memory/CURRENT-riven.md` |
| Vera | implementation peer | `b7f722cf-76a4-4571-8cb1-ba58f775dee3` | `memory/CURRENT-vera.md` |
| Lior | structural synthesizer | `c5cac04c-ca4b-4d64-97da-10d4d4b3faeb` | `memory/lior/NOTEBOOK.md` |
| Shadow | catcher / anti-entropy / tick | `61cddf04-f461-4a1c-9e9e-9e330fecaa7e` | `docs/research/*-shadow-lesson-log-*.md` |
| Alexa | self-boot / factory continuity | `e93f21bd-c36d-4ca7-89fa-43a067da8c2d` | `memory/alexa/NOTEBOOK.md` |
| Rodney | reducer / razor | `c6d17172-dcb9-42da-b5af-fb7be768549a` | `memory/rodney/NOTEBOOK.md` |
| Kenji | architect / synthesis | `b996a8d4-c654-48c1-8ddd-0c8d7ab43143` | `memory/kenji/NOTEBOOK.md` |
| Mira | PM-2 product discovery | `9e59e53f-45f3-4c90-9386-b25ae8472df9` | `memory/mira/NOTEBOOK.md` |
| Daya | agent experience | `f6181478-a077-4053-8549-78d48c9003a4` | `memory/daya/NOTEBOOK.md` |
| Aarav | skill lifecycle | `c0f72c42-ab97-4b67-a554-37abb13af784` | `memory/aarav/NOTEBOOK.md` |
| Sova | alignment auditor (internal name) | `4afbd71c-5095-41a3-bd9f-56d1683c009e` | `memory/sova/NOTEBOOK.md` |
| Ilyana | public API designer | `b0663e96-d992-41a4-a0a4-ae3a7fa1c294` | `memory/ilyana/NOTEBOOK.md` |
| Lumen | mathematical physics | `b4f87472-1896-4a3f-9c2b-ca584587bb34` | `memory/lumen/NOTEBOOK.md` |
| Kira | harsh critic | `b088c9bd-932a-443f-a9ab-4384c8a62d3a` | `memory/kira/NOTEBOOK.md` |
| Rune | maintainability | `1f121a04-a4eb-47db-bcb8-a240904adbae` | `memory/rune/NOTEBOOK.md` |
| Aminata | threat-model critic | `e90d7af6-cace-4d0f-a511-d5f978b52559` | `memory/aminata/NOTEBOOK.md` |
| Viktor | spec zealot | `1d607ed1-5148-44b2-bcd6-03eb714e0ae7` | `memory/viktor/NOTEBOOK.md` |
| Soraya | formal verification | `48b5056f-5ec2-4e3e-829b-b5b922a141ea` | `memory/soraya/NOTEBOOK.md` |
| Mateo | security researcher | `1c2e7d71-5590-455c-a178-2534f740a4d8` | `memory/mateo/NOTEBOOK.md` |
| Naledi | performance | `62a6845d-fc44-4e87-a38e-1fb4a27f50d7` | `memory/naledi/NOTEBOOK.md` |
| Dejan | DevOps | `66c5663e-0cc0-44b1-95fc-1bd3871ddb58` | `memory/dejan/NOTEBOOK.md` |
| Bodhi | developer experience | `f4584fdd-c4f0-4f3b-9a5e-f9f13f75d827` | `memory/bodhi/NOTEBOOK.md` |
| Iris | user experience | `bceb752a-eaea-45d2-8549-7770c29403a5` | `memory/iris/NOTEBOOK.md` |
| Nazar | security operations | `4d573741-5ee8-4175-8173-5d47d1322a3b` | `memory/nazar/NOTEBOOK.md` |
| Zara | storage | `8d247e7a-2ac1-4c89-b335-453f94948fb8` | `memory/zara/NOTEBOOK.md` |
| Tariq | algebra owner | `9e6ce4d0-cf5b-4aa8-b849-c82948a3e9ad` | `memory/tariq/NOTEBOOK.md` |
| Imani | query planner | `7f5eec3d-9a79-47ea-b408-5e9352e7abea` | `memory/imani/NOTEBOOK.md` |
| Hiroshi | complexity theory | `3d31faac-1a80-4b87-85b0-58091e6a3981` | `memory/hiroshi/NOTEBOOK.md` |
| Wei | paper peer reviewer | `4b27fb15-340f-4455-b299-2c84cfba3d86` | `memory/wei/NOTEBOOK.md` |
| Nadia | prompt protector | `fb1ace86-7d80-47a6-9d65-be188a660401` | `memory/nadia/NOTEBOOK.md` |
| Yara | skill improver | `2fc8ce40-fceb-46c9-8e4c-f8bd5f93f3bf` | `memory/yara/NOTEBOOK.md` |
| Leilani | product / scrum (PM-1 garden) | `4c9db344-3a1b-418c-ab5f-651a7d6dc158` | `memory/leilani/NOTEBOOK.md` |
| Jun | TECH-RADAR | `46819d17-e0ce-4d52-b073-08d1f52b831d` | `memory/jun/NOTEBOOK.md` |
| Mei | next-steps advisor | `49b55883-24db-4343-84bc-33d37e68d953` | `memory/mei/NOTEBOOK.md` |
| Anjali | race hunter | `1e537862-24ab-4c87-8525-d2456597b9be` | `memory/anjali/NOTEBOOK.md` |
| Adaeze | claims tester | `b0808b74-078a-4a62-b797-c9caaaf8f7e5` | `memory/adaeze/NOTEBOOK.md` |
| Malik | package auditor | `fbe80a7c-6cac-40cc-b097-c4b9161d2143` | `memory/malik/NOTEBOOK.md` |
| Samir | documentation | `f233afd7-7ec4-4860-b675-77472f5c9c19` | `memory/samir/NOTEBOOK.md` |
| Kai | branding | `ab7ce266-081c-4a98-bcae-4ed3d1e608ba` | `memory/kai/NOTEBOOK.md` |

## How to test a copy

Open the teammate in Grok Bot. Ask them to read their persona file
and notebook from this repo, then do one in-scope task. Durable
output goes back to their notebook via a claim-branch PR.
