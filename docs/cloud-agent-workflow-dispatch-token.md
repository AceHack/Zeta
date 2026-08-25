# Cloud Agent workflow-dispatch token

**Secret name:** `ZETA_WORKFLOW_DISPATCH_TOKEN` (added 2026-08-25).

## Why this exists

Cursor Cloud Agents authenticate `gh` as the `cursor` GitHub App
installation token (`ghs_…`), which is **read-only**. It cannot run
`workflow_dispatch`, so a cloud agent cannot kick off
`build-ai-cluster-iso.yml` (the USB/zflash QEMU restore runs) or any
other manually-dispatched workflow. An interactive `gh auth login
--device` does not help: each Cloud Agent run boots a fresh ephemeral
VM, so the login would not survive to the next run.

## The secret

`ZETA_WORKFLOW_DISPATCH_TOKEN` is a Cursor **Secret** that Cursor
injects as an environment variable into every Cloud Agent VM. The
value is a fine-grained PAT scoped to `Lucent-Financial-Group/Zeta`
with repository permission **Actions: Read and write** (Metadata: Read
is automatic). The value lives only in Cursor Secrets — never in git.

## How to use it (cloud agents)

The default `gh` token is read-only; override it per-command with the
secret. Dispatch only when the concurrency group is idle:

```bash
# 1. wait until this is empty (concurrency serializes on refs/heads/main)
gh run list --workflow=build-ai-cluster-iso.yml --status in_progress --limit 5

# 2. dispatch on post-fix main
GH_TOKEN="$ZETA_WORKFLOW_DISPATCH_TOKEN" gh workflow run build-ai-cluster-iso.yml --ref main
```

Belt-and-suspenders (bypasses `gh` entirely — useful if `gh` ever
resolves the read-only App token instead of `GH_TOKEN`):

```bash
curl -X POST \
  -H "Authorization: Bearer $ZETA_WORKFLOW_DISPATCH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/Lucent-Financial-Group/Zeta/actions/workflows/build-ai-cluster-iso.yml/dispatches \
  -d '{"ref":"main"}'
```

## Notes

- Dispatch is attributed to the PAT owner's identity.
- `push` events do **not** run the restore steps; only
  `workflow_dispatch` does (see `.github/workflows/build-ai-cluster-iso.yml`).
- Concurrency serializes on `refs/heads/main`; a second pending `main`
  run drops the first pending one, so never dispatch while another
  `main` ISO run is pending or in progress.
- Host-loop harnesses (e.g. Otto/Codex) already have their own `gh`
  write path and do not need this secret.
- If the secret is absent (`-z "$ZETA_WORKFLOW_DISPATCH_TOKEN"`), the
  agent cannot dispatch — ask the operator to add it in the Cursor
  Secrets panel, or route the dispatch to a harness that has write.
