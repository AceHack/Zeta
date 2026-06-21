---
id: 081KSGS9H0008QG0R00126RHQR
title: Add ISO release-attach to build-ai-cluster-iso.yml workflow when Zeta starts tagging releases
status: open
priority: P3
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with: []
---

# 081KSGS9H0008QG0R00126RHQR — Add ISO release-attach to build-ai-cluster-iso.yml workflow (when Zeta starts tagging releases) (Aaron 2026-05-26)

## Scope

Add a `release: types: [published]` trigger + attach-to-release job to `.github/workflows/build-ai-cluster-iso.yml` so that when Zeta starts tagging GitHub releases, the AI-cluster installer ISO gets automatically built at the release tag + attached to the release as a downloadable asset.

## Why this is a follow-up row (not done in USB cleanup PR 2)

USB cleanup PR 2 retired the legacy `build-installer-iso.yml` workflow which had a release-attach feature. The canonical `build-ai-cluster-iso.yml` does NOT have the same feature. PR 2's substrate-honest scope was deletion-of-legacy; adding release-attach to the canonical workflow is its own focused engineering work + can wait until Zeta starts tagging releases (currently zero releases per `gh release list` 2026-05-26).

## What the legacy workflow had (reference implementation)

From `.github/workflows/build-installer-iso.yml` (deleted in USB cleanup PR 2):

```yaml
on:
  release:
    types: [published]

jobs:
  build-iso:
    if: github.event_name != 'release'  # release uses attach-to-release-job below
    # ... existing build steps

  attach-to-release:
    if: github.event_name == 'release'
    permissions:
      contents: write  # elevated for release-asset upload
    # ... checkout at release tag, build ISO, upload as release asset
```

Pattern:

- Regular PR / push / workflow_dispatch builds the ISO + uploads as workflow artifact (current state)
- Release `published` event triggers a separate job that rebuilds the ISO AT the release tag commit + uploads as release asset (so the release has a downloadable installer)
- Skip the regular build-iso job on release events (avoid building twice)

## Acceptance

Core trigger + job structure:

- [ ] `release: types: [published]` trigger added to `build-ai-cluster-iso.yml`
- [ ] `attach-to-release` job added with `permissions: contents: write` (elevated only for that job)
- [ ] Job checks out at release tag SHA, builds canonical ISO, uploads as release asset
- [ ] Skip existing build-iso job on release events (no duplicate builds)

Security + reliability safeguards (must preserve from deleted legacy workflow):

- [ ] **Reject release tags starting with `-`** — prevents tag-name injection into `gh release upload` argument list (a tag like `-flag` could be interpreted as a flag rather than a positional):

  ```bash
  if [[ "${RELEASE_TAG}" == -* ]]; then
    echo "::error::Release tag starts with '-' which would be ambiguous as gh CLI argument; aborting"
    exit 1
  fi
  ```

- [ ] **Use `--` separator for `gh release upload`** — disambiguates tag-name + filename from flag arguments even when tag passes the leading-dash check:

  ```bash
  gh release upload -- "${RELEASE_TAG}" "${ISO_PATH}" "${SHA256_SIDECAR_PATH}"
  ```

- [ ] **Write SHA256 sidecar OUTSIDE the read-only Nix store** — the ISO at `result/iso/zeta-installer-*.iso` is a symlink into `/nix/store/...` which is read-only. The SHA256 sidecar (`<iso-name>.sha256`) must be written to a workflow-controlled writable directory (e.g., `$GITHUB_WORKSPACE` or `$RUNNER_TEMP`):

  ```bash
  ISO_RESOLVED=$(readlink -f result/iso/zeta-installer-*.iso)
  ISO_NAME=$(basename "${ISO_RESOLVED}")
  SHA256_DIR="${RUNNER_TEMP}/iso-release"
  mkdir -p "${SHA256_DIR}"
  cp "${ISO_RESOLVED}" "${SHA256_DIR}/${ISO_NAME}"
  ( cd "${SHA256_DIR}" && sha256sum "${ISO_NAME}" > "${ISO_NAME}.sha256" )
  ```

  Then upload from `${SHA256_DIR}` not from `result/iso/`.

Discipline + injection-safety (per existing `build-ai-cluster-iso.yml` patterns):

- [ ] Runner pinned to `ubuntu-24.04` (not `-latest`)
- [ ] Third-party actions SHA-pinned with trailing `# vX.Y.Z` comments
- [ ] Concurrency groups (cancel-in-progress only for PRs, NOT for releases)
- [ ] No `github.event.*` values interpolated into `run:` lines — pass via `env:` per the GitHub Actions script-injection guide
- [ ] `permissions: contents: read` at workflow level; elevate to `contents: write` only on the `attach-to-release` job

Test:

- [ ] Tag a small release (e.g., `v0.0.1-test`) + verify ISO + sidecar attached + then untag
- [ ] Negative-test: tag a `-malicious` name + verify it aborts cleanly

## Out of scope

- Decision to start tagging releases at all (separate governance question)
- Release-versioning scheme (semver vs date-based; separate row when releases start)
- Release notes generation (separate row)

## Composes with

- `.github/workflows/build-ai-cluster-iso.yml` (the workflow this extends)
- `full-ai-cluster/usb-nixos-installer/` (the canonical AI-cluster installer substrate)
- USB cleanup PR 2 (this row's origin)

## Origin

USB cleanup PR 2 (2026-05-26) retired `build-installer-iso.yml`; the release-attach feature it carried was UNUSED at deletion time (zero existing releases per `gh release list`) but the capability is worth preserving for when Zeta starts tagging releases. This row tracks the canonical-workflow re-implementation.
