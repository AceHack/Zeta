# Claim - backlog-0891-zflash-qemu-retention-vera-20260531

- **Session ID:** codex/20260531T163608Z-vera-b0891
- **Harness:** codex
- **Claimed at:** 2026-05-31T16:36:08Z
- **ETA:** 2026-05-31T20:36:08Z
- **Scope:** B-0891 scenario 3 QEMU reformat-with-retention proof for zflash self-healing.
- **Durable target:** docs/backlog/P1/B-0891-zflash-done-acceptance-criteria-qemu-test-harness-5-scenarios-initial-format-cluster-up-reformat-with-retention-reformat-from-scratch-cluster-joining-aaron-2026-05-28.md; tools/zflash/test-harness/**; tools/installer/zeta-creds-*.ts; focused QEMU/credential-retention tests.
- **Platform mirror:** local broadcast `/Users/acehack/.local/share/zeta-broadcasts/vera.md`

## Notes

- ask: operator assigned Vera the USB/ISO QEMU lane on 2026-05-31; Otto keeps `tools/crypto/**` and `tools/observe/**`.
- receipt: no active remote claim for B-0891 or zflash/QEMU was visible before claiming.
- receipt: open PR path check showed #6217 in `tools/crypto/**`, #6218 in `tools/observe/**`, and #6216 in `agentic-organization/**`; this claim avoids those path sets.
- progress: claim branch pushed at `ec78b17670c9c49d245d4aa85dc6692fb653f082`; follow-up progress commit records a parseable AgencySignature trailer block.
- progress: `tools/installer/zeta-creds-restore.ts` now skips `already-present` restored credentials instead of rewriting them.
- proof: `bun test tools/installer/zeta-creds-persist-restore.test.ts` passes with an ESP-retention regression covering root wipe -> restore -> repeat restore with zero writes.
- limitation: `bun run typecheck` could not start because `tsc` is not installed in this isolated worktree.
- progress: `tools/zflash/test-harness/run.ts` now fails closed on scaffolded runtime attempts, so `reformat-with-retention` cannot pass by returning scaffolded status.
- proof: `bun test tools/zflash/test-harness/` passes, including `run.test.ts` coverage that `--dry-run` remains non-runtime planning while `--scenario reformat-with-retention` exits nonzero until implementation lands.
- progress: `tools/zflash/test-harness/qemu-state.ts` now defines the scenario-3 qcow2 `qemu-img snapshot -c/-a/-l` and QEMU restart command plan plus required retention serial markers.
- proof: `bun test tools/zflash/test-harness/` passes with `qemu-state.test.ts` coverage for KVM and TCG restart plans, snapshot commands, serial markers, and Result-shaped invalid-input feedback.
- operator-clarification: USB/ISO tests cover zflash, boot, retention/no-retention semantics, and one agent start path; Kubernetes and ArgoCD health belong in separate cluster integration tests.
- operator-clarification: retention reformat keeps the same cluster/node identity; no-retention reformat creates a new cluster/node identity.
- operator-clarification: Touch ID/biometric retention is physical operator testing; QEMU should assert preserved auth-state markers. Zeta is baked into the image, and target hardware assumptions include both x86_64 and ARM64/aarch64.
- progress: carved Kubernetes and ArgoCD health into dedicated backlog row B-0951 for kind/k3d integration testing, keeping B-0891 scoped to USB/ISO zflash acceptance and a narrow agent-start smoke path.
- progress: `run.ts --scenario reformat-with-retention <iso>` now emits the QEMU qcow2 snapshot/restart plan from `qemu-state.ts` and still exits failed until command execution plus serial-marker assertions are wired.
- progress: `qemu-state.ts` now includes a Result-shaped retention serial-marker assertion helper for `zeta-creds-restore:` and `already-present`, with missing-marker feedback tests.
- progress: declared B-0891 QEMU substrate through install.sh manifests (`qemu`/`qemu-system-x86`/`qemu-utils`) and B-0951 cluster tools through `.mise.toml` (`k3d`, `kind`, `kubectl`, `helm`), replacing ad hoc dev-cluster brew instructions with `tools/setup/install.sh`.
- progress: `qemu-state.ts` now exposes `executeQcow2SnapshotRetentionPlan`, a Result-shaped execution contract that runs the planned snapshot/list/restore/restart command sequence through an injected runner and asserts retention serial markers afterward.
- progress: `qemu-state.ts` now exposes a timeout-bound `spawnSync` process executor adapter, with injectable command and serial readers so tests prove command wiring without launching QEMU.
- progress: `run.ts` now connects scenario 3 to the real timeout-bound QEMU process executor behind explicit `ZFLASH_QEMU_RETENTION_EXECUTE=1` opt-in; the default CLI path still fails closed, while the opt-in path can pass only after serial-marker assertions prove retention.
- proof: `bun test tools/zflash/test-harness/` passes with injected-executor dispatcher coverage for both proven-retention success and missing-marker failure; `bun --bun tsc --noEmit -p tsconfig.json` and `git diff --check` pass.
- progress: scenario 3 now plans qcow2 disk bootstrap (`qemu-img create`) plus an initial ISO boot before baseline snapshot/restore/restart, so `ZFLASH_QEMU_RETENTION_EXECUTE=1` no longer assumes a pre-existing qcow2 disk.
- proof: focused harness coverage now asserts the create-disk and initial-install steps in both the planner and dispatcher execution sequence.
- progress: scenario 3 now carries lifecycle-aware QEMU serial stop conditions: initial ISO boot stops on `[iter-5.1]`, retained restart stops on `zeta-creds-restore:` + `already-present`, and shared hard-fail markers stop the run early.
- proof: `bun test tools/zflash/test-harness/` passes with 61 tests covering lifecycle stop markers, managed QEMU command stop behavior, and failure-marker feedback; `bun --bun tsc --noEmit -p tsconfig.json` and `git diff --check` pass.
- next: run the real `ZFLASH_QEMU_RETENTION_EXECUTE=1` scenario against an ISO/artifact when available, then promote scenario 3 out of scaffolded only after real QEMU serial markers prove retention end to end.
- empirical: running `ZFLASH_QEMU_RETENTION_EXECUTE=1` against CI ISO artifact `nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso` booted to the NixOS installer login prompt but did not emit `[iter-5.1]`, so the harness boundary needed to follow the observed serial surface.
- progress: initial ISO boot now stops at the observed installer-ready boundary (`zeta-installer login:` plus `nixos@zeta-installer:~`), while the retained restart still requires `zeta-creds-restore:` + `already-present`; a retained restart that reaches the plain installer prompt first fails fast as non-retention evidence.
- proof: `bun test tools/zflash/test-harness/`, `bun --bun tsc --noEmit -p tsconfig.json`, and `git diff --check` pass after the serial-boundary patch.
- empirical: rerunning `ZFLASH_QEMU_RETENTION_EXECUTE=1 ZFLASH_QEMU_RETENTION_TIMEOUT_MS=240000` against the CI ISO now creates the qcow2, reaches the initial installer-ready boundary, creates/lists/restores `post-initial-format`, then fails at `restart-from-iso-with-disk` with `terminal marker observed before required serial markers: nixos@zeta-installer:~; still waiting for zeta-creds-restore:, already-present`. This is the desired fail-fast non-retention verdict for a plain installer ISO.
- progress: zflash now accepts `--bake-cred`, `--bake-passphrase-file`, `--bake-passphrase-env`, and `--persona`, resolves the flashed ESP filesystem UUID from `diskutil info`, and writes the existing B-0852 encrypted blob as `/zeta-creds.enc` during the same ESP mount session as pubkey/hostname injection.
- proof: `bun test full-ai-cluster/tools/zflash-lib.test.ts tools/installer/zeta-creds-persist-restore.test.ts`, `bun test tools/zflash/test-harness/`, `bun --bun tsc --noEmit -p tsconfig.json`, `git diff --check`, and `bun full-ai-cluster/tools/zflash.ts --help | rg -- '--bake-cred|--bake-passphrase-env|--persona'` pass after the zflash bake-cred patch.
- next: rerun the real QEMU scenario against a zflash-baked artifact path; if QEMU still only reaches the installer prompt, the remaining gap is full-install/reboot orchestration rather than ESP credential-blob generation.
- progress: `zeta-install.sh` now carries a zflash-baked boot-USB ESP `/zeta-creds.enc` into the installed target ESP as `/mnt/boot/zeta-creds.enc` before unmounting the USB ESP, and Step 6.95 skips the interactive picker only when that retained blob was copied from the boot USB during the current install.
- proof: `bun test tools/ci/test-iter-54-install-flow.test.ts`, `bash -n full-ai-cluster/usb-nixos-installer/zeta-install.sh`, `bun test tools/zflash/test-harness/`, `bun --bun tsc --noEmit -p tsconfig.json`, and `git diff --check` pass after the retained-preseed installer patch.
- note: `shellcheck full-ai-cluster/usb-nixos-installer/zeta-install.sh` still reports the pre-existing SC2016 info finding on the SHA-512 hash regex; this patch did not change that line.
- next: rerun the real scenario against a zflash-baked image. If retention markers still do not appear, the remaining work is full-install/reboot orchestration rather than credential preseed transport.
