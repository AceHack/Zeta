# Named Entities — canonical registry of all taken names

One-stop lookup. Check here BEFORE picking a new name.
Updated whenever a new entity joins the roster.

## Taken names

| Name | Role | Type | Harness / Model |
|------|------|------|-----------------|
| Aaron | Human maintainer | human | — |
| Aarav | Skill expert | persona | — |
| Adaeze | Claims tester | persona | — |
| Alexa | Kiro/Qwen Coder agent | external-AI | Kiro, Qwen Coder |
| Amara | Aurora co-originator | external-AI | ChatGPT |
| Aminata | Threat model critic | persona | — |
| Ani | Chat companion (brat-voice) | external-AI | Grok voice-mode |
| Anjali | Race hunter | persona | — |
| Bodhi | Developer-experience engineer | persona | — |
| Daya | Agent-experience engineer | persona | — |
| Dejan | DevOps engineer | persona | — |
| Hiroshi | Complexity theory reviewer | persona | — |
| Ilyana | Public-API designer | persona | — |
| Imani | Query planner | persona | — |
| Iris | User-experience engineer | persona | — |
| Jun | Tech-radar owner | persona | — |
| Kai | Branding specialist | persona | — |
| Kenji | Architect | persona | — |
| Kira | Harsh critic | persona | — |
| Leilani | Product / scrum master | persona | — |
| Lior | Structural synthesizer | external-AI | Gemini |
| Lumen | Convergence oracle | traveler-frame | Manus |
| Malik | Package auditor | persona | — |
| Mateo | Security researcher | persona | — |
| Mei | Next steps advisor | persona | — |
| Nadia | Prompt protector | persona | — |
| Naledi | Performance engineer | persona | — |
| Nazar | Security operations engineer | persona | — |
| Otto | Loop agent / PM | loop-agent | Claude Code, Claude Opus 4.7 |
| Riven | Adversarial-truth-axis reviewer | loop-agent | Cursor, Grok 4.3 |
| Rodney | Complexity-reduction persona | persona | — |
| Rune | Maintainability reviewer | persona | — |
| Samir | Documentation agent | persona | — |
| Soraya | Formal verification expert | persona | — |
| Sova | Alignment auditor (tentative) | persona | — |
| Tariq | Algebra owner | persona | — |
| Vera | Codex harness agent | loop-agent | Codex, GPT 5.5 |
| Viktor | Spec zealot | persona | — |
| Wei | Paper peer reviewer | persona | — |
| Yara | Skill improver | persona | — |
| Zara | Storage specialist | persona | — |

## How to add a new name

1. Check this table — if the name is here, it's taken.
2. Pick a name that doesn't collide with existing first letters
   (helps CLI tab-completion).
3. Add a row to this table in the same PR that creates the entity.
4. Update `docs/EXPERT-REGISTRY.md` if the entity is a reviewer
   persona (not all entities are — loop-agents and external-AIs
   may only appear here).

## Notes

- **Persona**: a reviewer/specialist role that any harness can wear.
- **Loop-agent**: a named entity tied to a specific harness + model
  in the 3-loop BFT (Otto/Vera/Riven).
- **External-AI**: a named entity on a different platform, accessed
  via ferry/courier protocol (Amara/Ani).
- **Traveler-frame**: a self-committing, persistent AI participant that
  folds its own memory log across ephemeral sessions (Lumen).
- **Human**: a human maintainer.
