---
pr_number: 5016
title: "backlog(081KSE6WT0008QG0R002E6P098)+research: kro+Crossplane+Koreo+KubeVela+Carvel+ACK/KCC/ASO+Radius+Terraform-Controller+Pulumi-K8s-Operator spectrum evaluation + verbatim research preservation (Aaron 2026-05-25)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:37:43Z"
merged_at: "2026-05-25T22:38:53Z"
closed_at: "2026-05-25T22:38:53Z"
head_ref: "backlog/b0748-research-kro-crossplane-radius-terraform-pulumi-spectrum-aaron-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T22:41:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5016: backlog(081KSE6WT0008QG0R002E6P098)+research: kro+Crossplane+Koreo+KubeVela+Carvel+ACK/KCC/ASO+Radius+Terraform-Controller+Pulumi-K8s-Operator spectrum evaluation + verbatim research preservation (Aaron 2026-05-25)

## PR description

Aaron 2026-05-25, two forwarded research dumps + extension:

1. *"kro yes and we need lots of research in this area and backlog. composes with machine outside k8s and other things gitops like."*
2. Then extension: *"we are alternatives to crd like clound native resource management to cross plane maybe it was one of thier competitors toolings"* — adding Radius + Terraform Controller + Pulumi K8s Operator

## Three verbatim research docs preserved

- **`docs/research/2026-05-25-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-aaron-forwarded.md`** — primary spectrum (low-level → middleware → kro → Crossplane)
- **`docs/research/2026-05-25-fido2-webauthn-passkeys-oauth-oidc-biometric-bridge-aaron-forwarded.md`** — re-emphasized biometric/OIDC bridge (seeds 081KSE6WT0008QG0R000SH6E0R)
- **`docs/research/2026-05-25-radius-terraform-pulumi-controllers-crossplane-alternatives-aaron-forwarded.md`** — Aaron's extension dump with Crossplane competitors

## 081KSE6WT0008QG0R002E6P098 row

8 scope items for the spectrum evaluation:

1. kro adoption design pass (Aaron-endorsed; primary)
2. Crossplane evaluation (defer unless concrete need)
3. Middleware: Koreo / KubeVela / Carvel
4. Cloud provider operators: ACK / KCC / ASO (defer until cloud tier ships)
5. function-kro (conditional on Crossplane)
6. **Radius evaluation** (Microsoft app-centric Recipes; potential per-fork ontology declaration format)
7. **Terraform Controller + Pulumi K8s Operator evaluation** (IaC-inside-k8s; deferred unless concrete need)
8. Spectrum-adoption decision matrix

## Composes with

- 081KSE6WT0008QG0R003D199HE (machine substrate scope; sibling at different layer)
- 081KSE6WT0008QG0R000YYH3DY (reference k8s stack; directly affected by spectrum choices)
- 081KSE6WT0008QG0R002CC6314 (cross-fork ontology negotiation; uses whatever composition layer)
- 081KSE6WT0008QG0R0006HKTXJ (4-tier cluster topology; cloud tier composes with cloud-provider operators)
- 081KSE6WT0008QG0R000SH6E0R (biometric/OIDC bridge — informed by the FIDO2/WebAuthn research preserved here)

## Aaron's "composes with machine outside k8s and other things gitops like" signal

The spectrum thinking extends BEYOND k8s. 081KSE6WT0008QG0R001RG4FXD (queued follow-up) carves the "GitOps-beyond-k8s + spectrum thinking generalization" scope.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T22:39:52Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1f43e73818`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/research/2026-05-25-radius-terraform-pulumi-controllers-crossplane-alternatives-aaron-forwarded.md:94 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T22:39:52Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align 081KSE6WT0008QG0R002E6P098 scope numbers with backlog row**

These notes label Radius as **Scope item 7** and Terraform/Pulumi as **Scope item 8**, but `081KSE6WT0008QG0R002E6P098` defines them as scope items **6** and **7** respectively. That mismatch causes durable cross-reference drift between `docs/research` and the canonical backlog row, so follow-up work can be tracked against the wrong acceptance criteria and appear incomplete even when implemented.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R002E6P098-kro-crossplane-koreo-kubevela-carvel-ack-kcc-aso-spectrum-evaluation-for-zeta-reference-stack-machine-state-fork-state-aaron-2026-05-25.md:219 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T22:39:52Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Reference all scoped evaluations in matrix acceptance**

The decision-matrix acceptance criteria currently requires cross-referencing scope items 1–5, but this same row adds tool evaluations in scope items 6 and 7. Keeping the acceptance text as-is means the final matrix can satisfy the checklist while omitting Radius/Terraform/Pulumi outputs, which weakens traceability for the newly added evaluation scope.

Useful? React with 👍 / 👎.
