# E2 Real Authority + Non-Forgeable Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace permissive command authorization with durable hat authority and require approved gate evidence to be content-addressed.

**Architecture:** E2 composes existing seams instead of adding bypasses. The policy package keeps the generic `CommandAuthorizationPort`; the application package supplies a concrete `HatAuthorityPort` that reads durable hat assignments, maps each command/tool to an action class, and applies the existing hat bundle guardrails. Evidence becomes a content-addressed application primitive, reused by quality-gate commands and the change-control review kernel.

**Tech Stack:** TypeScript NodeNext ESM, `node:test`, CockroachDB migrations/stores, KIND proof runner.

---

## Task 1: Persist Hat Identity In Authority Projection

**Files:**

- Modify: `packages/domain/src/records.ts`
- Modify: `packages/state-cockroach/src/cockroach-schema.ts`
- Modify: `packages/state-cockroach/migrations/0008_agentic_org_hat_assignment_authority_projection.sql`
- Modify: `packages/state-cockroach/src/cockroach-hat-assignment-authority-reader.ts`
- Modify: `packages/state-cockroach/test/cockroach-hat-assignment-authority-reader.test.ts`
- Modify: `packages/state-cockroach/test/cockroach-schema.test.ts`

- [ ] **Step 1: Write the failing reader test**

Add an assertion that `findHatAssignmentAuthority()` returns `hatId: "backend_implementer"` from the durable row.

Run:

```bash
npm test -- --test-name-pattern="cockroach hat assignment authority reader"
```

Expected: FAIL because `hatId` is missing.

- [ ] **Step 2: Add `hatId` to the domain snapshot and Cockroach reader**

Add `hatId: string` to `HatAssignmentAuthoritySnapshot`, select `hat_id`, map it, and update malformed-row handling to require a nonblank hat id.

- [ ] **Step 3: Update schema SQL and parity expectations**

Add `hat_id STRING NOT NULL` to the V8 table definition and migration mirror. This is pre-v1; no compatibility shim is needed for old rows in the proof database.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --test-name-pattern="cockroach hat assignment authority reader|cockroach core state schema"
```

Expected: PASS.

### Task 2: Build The Concrete Hat Authority Port

**Files:**

- Create: `packages/application/src/hat-authority-port.ts`
- Create: `packages/application/test/hat-authority-port.test.ts`
- Modify: `packages/application/src/index.ts`

- [ ] **Step 1: Write failing tests**

Cover these cases:

- active backend implementer + `toolType: "write_code"` allows.
- active TPM + `toolType: "write_code"` denies with `hat_tool_denied`.
- inactive assignment denies with `hat_authority_revoked` or `hat_authority_expired`.
- actor/assignment/scope mismatch denies with `hat_scope_denied`.
- unknown hat assignment denies with `hat_authority_missing`.

Run:

```bash
npm test -- --test-name-pattern="real hat authority port"
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the port**

Implement `createHatAuthorityPort(input)`:

- Inputs: `hatAssignmentAuthorityReader`, `hatDefinitions`, `createId`, optional `policyVersion`.
- Look up the durable assignment by `request.hatAssignmentId`.
- Require assigned agent, org, project, and optional team scope to match the command request.
- Find the assigned persistent hat by `authority.hatId`.
- Map command/tool to `ActionClass`; `toolType` wins over command type.
- Use `preflightHatAction()` for bundle enforcement.
- Return `HatAuthorityDecisionStatus.Active`, `Missing`, `ScopeDenied`, `ToolDenied`, `Expired`, or `Revoked`.

- [ ] **Step 3: Export it**

Export the new factory and command/tool mapping helpers from `packages/application/src/index.ts`.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- --test-name-pattern="real hat authority port|command authorization policy"
```

Expected: PASS.

### Task 3: Require Content-Addressed Evidence For Gate Approval

**Files:**

- Create: `packages/application/src/evidence.ts`
- Create: `packages/application/test/evidence.test.ts`
- Modify: `packages/application/src/handlers/record-quality-gate-evaluation.ts`
- Modify: `packages/application/test/command-pipeline.test.ts`
- Modify: `packages/application/src/change-control-kernel.ts`
- Modify: `packages/application/test/change-control-kernel.test.ts`
- Modify: `packages/application/src/index.ts`

- [ ] **Step 1: Write failing evidence utility tests**

Test `createContentAddressedEvidenceRef("test-run", payload)` returns `evidence:test-run:sha256:<64 hex>` and `isContentAddressedEvidenceRef()` rejects plain ids like `"qa-report-001"`.

Run:

```bash
npm test -- --test-name-pattern="content-addressed evidence"
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement evidence utility**

Canonicalize JSON values with sorted object keys before hashing. Keep the public API small:

- `createContentAddressedEvidenceRef(kind, payload): string`
- `isContentAddressedEvidenceRef(value): boolean`
- `allEvidenceRefsContentAddressed(values): boolean`

- [ ] **Step 3: Gate quality evaluation commands**

Reject approved or waived `RecordQualityGateEvaluationCommand`s unless every `evaluatedArtifactIds` entry and every `businessRuleResults[*].evidenceArtifactIds` entry is content-addressed. Request-changes/rejected outcomes may cite non-addressed draft context, but approval cannot.

- [ ] **Step 4: Gate change-control stage satisfaction**

Extend `StageGateEvaluation` with `evidenceRefs`. The review kernel should only treat a gate as satisfiable when the gate condition is true and at least one content-addressed evidence ref supports the satisfaction. Derive content-addressed evidence for artifact-presence gates from the carried artifacts; require explicit evidence from deps for tests, quorum, no-blocking-findings, and external approval.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- --test-name-pattern="content-addressed evidence|quality gate|change-control"
```

Expected: PASS.

### Task 4: Replace The Worker Composition Stub

**Files:**

- Modify: `apps/workers/src/organization-executor-composition.ts`
- Create or modify: `deploy/run-real-authority-evidence.ts`

- [ ] **Step 1: Write failing composition/proof tests where practical**

Add a unit test or proof path showing a TPM assignment cannot authorize `write_code`, while a delivery/implementation hat can authorize it.

- [ ] **Step 2: Wire real authorization**

Replace `createPermissiveCommandAuthorizationPort()` with:

```ts
createCommandAuthorizationPort({
  hatAuthorityPort: createHatAuthorityPort({
    hatAssignmentAuthorityReader: stateAdapters.hatAssignmentAuthorityReader,
    hatDefinitions: buildHatDefinitions(),
    createId: input.createId,
  }),
})
```

If the reaction-plan actor resolver synthesizes an actor for a required hat, make that actor resolve to a durable assignment row in the proof setup rather than silently granting authority in code.

- [ ] **Step 3: Add the KIND proof**

`deploy/run-real-authority-evidence.ts` should:

- apply migrations to live Cockroach;
- seed active hat assignment rows with `hat_id`;
- run the real authorization port through the command pipeline;
- prove TPM + `write_code` is denied and observed;
- prove backend implementer + `write_code` is allowed;
- prove quality-gate approval rejects plain evidence but accepts content-addressed evidence;
- print `PROOF: PASS`.

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm test
docker build -t agentic-org-worker:e2-real-authority-evidence -f Dockerfile .
kind load docker-image agentic-org-worker:e2-real-authority-evidence --name agentic-org
kubectl set image deployment/worker worker=agentic-org-worker:e2-real-authority-evidence -n agentic-org
kubectl rollout status deployment/worker -n agentic-org --timeout=120s
kubectl logs <fresh-worker-pod> -n agentic-org --tail=260
kubectl -n agentic-org port-forward svc/cockroach 26260:26257
COCKROACH_DATABASE_URL=postgresql://root@localhost:26260/defaultdb?sslmode=disable node --experimental-strip-types deploy/run-real-authority-evidence.ts
```

Expected: typecheck/test pass, worker boots cleanly, proof prints `PROOF: PASS`.

### Task 5: Review, Document, Commit

**Files:**

- Modify: `docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md`
- Modify: `docs/ORCHESTRATION_MOAT_ROADMAP.md`

- [ ] **Step 1: Dispatch subagent review**

Ask a review subagent to inspect the E2 diff for authority bypasses, forged-evidence paths, migration drift, and proof weakness.

- [ ] **Step 2: Apply high-confidence findings with tests**

Every accepted finding gets a regression test before the fix.

- [ ] **Step 3: Update docs**

Append an E2 section to `NORTH_STAR_ALIGNMENT_CHECKPOINT.md` with the final test counts, image hash, pod, and proof org/report. Mark E2 shipped in the roadmap.

- [ ] **Step 4: Commit**

Commit with:

```bash
git commit -m "feat(agentic-org): enforce real authority and evidence" \
  -m "Co-Authored-By: Codex <noreply@openai.com>"
```
