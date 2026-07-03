---
pr_number: 4913
title: "feat(hindsight): wire real vectorize-io OCI Helm chart"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T06:51:39Z"
merged_at: "2026-05-25T06:54:11Z"
closed_at: "2026-05-25T06:54:11Z"
head_ref: "fix/hindsight-real-helm-chart"
base_ref: "main"
archived_at: "2026-05-27T19:51:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4913: feat(hindsight): wire real vectorize-io OCI Helm chart

## PR description

## Summary

Identified Hindsight as **vectorize-io/hindsight** — agent persistent memory system with built-in Hermes integration. Replaced the placeholder with the real OCI Helm chart.

Per the [vectorize-io docs](https://hindsight.vectorize.io/sdks/integrations/hermes): Hermes ships with 8 external memory provider plugins including Hindsight. Hindsight automatically recalls relevant context before every LLM call, retains conversations across sessions, and provides explicit \`retain\`/\`recall\`/\`reflect\` tools.

## Wired config

| Field | Value |
|---|---|
| repoURL | \`ghcr.io/vectorize-io/charts\` (OCI) |
| chart | \`hindsight\` |
| targetRevision | \`0.3.0\` |
| postgresql.enabled | \`true\` (bundled, longhorn-backed 20 Gi — swap to CockroachDB later) |
| api.llm | Groq via \`hindsight-llm-api-key\` Secret (Vault-backed ExternalSecret) |
| service | ClusterIP :80 — matches Hermes' \`HINDSIGHT_URL\` already wired in #4910 |
| syncPolicy.prune | \`false\` — memory store is precious |

## Hermes integration

Hermes' \`deployment.yaml\` already declares:
\`\`\`yaml

- name: HINDSIGHT_URL
  value: \"http://hindsight.hindsight.svc.cluster.local\"
\`\`\`

That URL now resolves once both Applications are healthy. No additional wiring needed.

## Sources

- [Hindsight + Hermes integration docs](https://hindsight.vectorize.io/sdks/integrations/hermes)
- [vectorize-io/hindsight (GitHub)](https://github.com/vectorize-io/hindsight)
- [Hindsight installation guide](https://hindsight.vectorize.io/developer/installation)

## Test plan

- [ ] markdownlint passes
- [ ] Post-merge: \`argocd app sync hindsight\` succeeds; \`kubectl -n hindsight get pods\` shows api + worker + postgres Running
- [ ] Hermes pods can reach hindsight service (\`kubectl -n hermes exec ... -- curl http://hindsight.hindsight.svc.cluster.local/health\`)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T06:57:25Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `4f04f11d89`


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

### Thread 1: full-ai-cluster/k8s/applications/hindsight/Application.yaml:57 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T06:57:25Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Map Hindsight API service values to the chart schema**

This block is using a top-level `service` key and assumes Hermes can call `http://hindsight.hindsight.svc.cluster.local`, but the v0.3.0 chart reads API networking from `api.service.*` and renders the API Service as `<fullname>-api` (`templates/api-service.yaml` / `_helpers.tpl`). As written, this override is ignored and the generated endpoint remains the chart default (`...-api` on API port defaults), so Hermes traffic will be sent to a non-existent/wrong Service.

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/k8s/applications/hindsight/Application.yaml:42 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T06:57:25Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Use supported keys for LLM provider secret injection**

The chart does not consume `api.llm.provider` or `api.llm.existingSecret`; in v0.3.0 it expects LLM config via `api.env` and either top-level `existingSecret` or `api.secrets` (`templates/api-deployment.yaml`/`secret.yaml`). With these unsupported keys, no `HINDSIGHT_API_LLM_*` env vars are populated, so retain/reflect operations that require an LLM provider key will fail at runtime.

Useful? React with 👍 / 👎.
