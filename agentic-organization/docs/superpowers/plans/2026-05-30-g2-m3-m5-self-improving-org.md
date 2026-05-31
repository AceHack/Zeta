# G2/M3/M5 Self-Improving Org Plan

## Goal

Ship the first closed self-improvement loop:

1. G2: deterministic Class A/B model-eval harness.
2. M3: decision optimizer that reads eval + KPI signals and proposes a tenant-config delta as a ChangeSet artifact.
3. M5: layered tenant config resolution (org -> department -> hat -> work item) with first-non-nil overrides, integer stacking, and blocking inheritance.

## Tasks

### Task 1: Layered Tenant Config (M5)

- Add domain DUs for config layers, directives, overlays, and resolved decision policy.
- Write tests for:
  - first-non-nil model override;
  - integer-stacked budget adjustment;
  - blocking inheritance;
  - specificity order org -> department -> hat -> work item.
- Keep the existing single-row `TenantConfig` store compatible by adding the layered fields to the JSON blob.

### Task 2: Model-Eval Harness (G2)

- Create `packages/model-eval` with pure eval cases and runner.
- Support Class A neutral evidence-only prompts and Class B directive prompts.
- Score against allowed action vocabulary and expected action, not free-form text.
- Emit a stable summary object suitable for org_event evidence and optimizer input.

### Task 3: Decision Optimizer (M3)

- Add `packages/application/src/decision-optimizer.ts`.
- Read eval summaries plus KPI summaries and propose a tenant-config policy delta.
- Output a ChangeSet with a config artifact; do not mutate config directly.
- Keep the cycle store-neutral: business logic depends on a generic JSON document/log store
  (`getJson`, `putJson`, `appendJson`), not Cockroach, SQL, or repository-specific classes.
  Cockroach, Git, and GitHub PR storage are adapters for that interface.
- Tests prove:
  - safe downgrade proposed only when Class A accuracy clears threshold and KPI is non-negative;
  - no downgrade when Class A fails even if Class B passes;
  - the proposal is a ChangeSet artifact for review.
  - the optimizer cycle runs against a recording generic document/log store and no-ops when the
    store lacks a current tenant-config document.

### Task 4: KIND Proof

- Add `deploy/run-model-eval-optimizer.ts`.
- Run seeded eval cases and KPI inputs.
- Resolve layered config before and after the proposed overlay.
- Persist / print a proof that model eval -> optimizer -> config ChangeSet works through the
  generic optimizer store interface, with Cockroach used only as the deploy adapter.

### Task 5: Verify, Review, Document, Commit

- `npm run typecheck`
- `npm test`
- Rebuild/redeploy worker image.
- Run deploy proof.
- Subagent review.
- Update `docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md` and `docs/ORCHESTRATION_MOAT_ROADMAP.md`.
- Commit with Codex co-author trailer.
