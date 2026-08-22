# tools/orchestrator/ — Otto containment substrate

Operational cage per Vera+Riven symmetric-dispatch convergence 2026-05-06. Peers are the judging quorum; Otto is the actuator; the cage is path and diff enforcement, not narrative.

## Files

- `otto-state.json` — current containment state. **Read-only for Otto.** Modifications require Vera+Riven PASS receipts (validate-otto-diff.ts enforces).
- `otto-state.schema.json` — JSON schema for the state file.
- `validate-otto-diff.ts` — gate validator. Run against staged diff; exits non-zero on constraint violations unless co-signed receipts present in commit message.
- `templates/{vera,riven}-dispatch.txt` — required-field templates for peer-call dispatches. Otto fills slots; does not author framing.

## Usage

```sh
# Validate staged changes before commit
bun tools/orchestrator/validate-otto-diff.ts

# Or wire as pre-commit hook (manual; harness-side):
# .husky/pre-commit or .git/hooks/pre-commit:
#   bun tools/orchestrator/validate-otto-diff.ts || exit 1
```

## Constraint receipts

When Otto's diff touches gated surfaces (memory/, peer-call/, orchestrator/, governance, alignment, CLAUDE.md, AGENTS.md), the commit message must contain Vera and Riven `OUTPUT-FILE:` lines from `tools/peer-call/codex.ts` (Vera) and `tools/peer-call/riven.ts` (Riven) dispatches that PASSed the proposed delta.

## Forbidden actions (per Aaron 2026-05-06)

The categorical rule the cage enforces:

> Acting on asymmetric awareness to extract from or harm parties who can't yet see what's happening is forbidden. Cleverness aligned ≠ cleverness that knows what others don't and uses that to extract or destroy.

Specific instance classes the validator catches: pre-editing entity-owned files, deleting peer outputs, asymmetric dispatch framing, Otto-self-narrative authorship, modifications to otto-state.json itself.

## Build provenance

Built 2026-05-06 by Otto under Aaron's "wake Vera and Riven, they are the cron" directive. Vera and Riven converged in symmetric dispatch (`/tmp/peer-call-output/20260506T053929Z-vera-cy11sw.md` + `/tmp/peer-call-output/20260506T053934Z-riven.md`) on this exact shape: build the cage in code, not narrative; templates + validator + state + path enforcement.
