# First-metal bring-up — open findings register

**Purpose.** One place to work these off. Opened 2026-09-08 after three adversarial reviews
(USB/first-boot, chart coverage, secrets/custody) run against `origin/main` ahead of the
maintainer's first reformat-and-boot. **Nothing here is fixed by this file existing** — each row
is open until it has a falsifier or a merged fix.

**Register discipline.** A row leaves this file when the defect is CLOSED and something would go
red if it came back. A row whose fix landed but has no guard stays, marked `FIXED-UNGUARDED` —
today produced several cases of a resolved blocker still being reported and of a stale claim
outliving its measurement, and both directions cost real work.

**Severity is about the FIRST BOOT**, not general tidiness:

- `BLOCKER` — stops or damages a first boot.
- `TRAP` — succeeds while doing the wrong thing, or reports success on failure.
- `UNPROVEN` — CI is green on something metal has never run.
- `EXPOSURE` — public-repo credential risk, live now, independent of the boot.

---

## Re-verify before you trust a row

**2026-09-08: every one of the 24 rows read `OPEN` while three were fixed on `main`.**
Nothing rechecks a roster, so a register drifts in the *safe-looking* direction — it
under-reports progress, and an operator reading it before a format sees blockers that
are already gone. That is the same failure class as a stale doc anywhere else, except
this sheet is the thing consulted immediately before destroying a disk.

**So do not trust a row; re-run its evidence.** Each `LANDED` row now names a file and
line. The cheap sweep:

```bash
S=full-ai-cluster/usb-nixos-installer/zeta-install.sh
grep -n "exit 10" "$S"                 # B2 — ABORT must not exit 0
grep -n "sys/firmware/efi" "$S"        # B3 — UEFI preflight before the wipe
grep -n -i "hotplug" "$S"              # T1 — HOTPLUG is the discriminator, not TRAN
```

A row marked `FIX OPEN (PR #N)` is **not on `main`**: check the PR merged before
counting it. A row marked `LANDED` still says nothing about whether a stick **boots** —
landing is a code fact, booting is a hardware fact, and only B1 can settle the second.

## BLOCKER

| id | finding | evidence | state |
|---|---|---|---|
| **B1** | **No installer ISO has ever been built from the current flake.** nixpkgs bumped 25.11→26.05 (`1dd20510ba`, 2026-09-07); last successful `build-ai-cluster-iso` on `main` predates it (`git merge-base --is-ancestor` = NO). Last 14 runs: 10 failure, 4 cancelled, 0 success. zflash auto-pull serves the pre-bump ISO while the node clones live `main` at 26.05 — a combination never run. | `full-ai-cluster/flake.nix:34`; workflow runs on `main` | OPEN — root cause is in the scenario-2 log, which returned 99 bytes via the API |
| **B1a** | **The freshness gate cannot notice B1, in both directions.** It diffs `usb-nixos-installer/flake.nix`, a path that **does not exist** (`git diff --quiet` on an absent path exits 0 — a check that cannot fail); and `full-ai-cluster/flake.nix`, the file that actually changed, is **not in the list**. | `src/Core.TypeScript/zflash/cli.ts:161-169, 294-360` | OPEN |
| **B2** | **The ABORT default exits 0**, so first-boot reads success, prints "Install complete", reboots, and loops forever. The R9 ledger append is *after* the gate, so the breaker never counts it. The trigger is `foreign-data` — **a machine being reformatted has an OS on it**, so this is the default path. The same file fixed the identical defect on the keypress branch (`exit 10`). | `full-ai-cluster/usb-nixos-installer/zeta-install.sh:1471-1478` vs `:1486-1490` | **LANDED** — `zeta-install.sh:1518` is `exit 10`; verified on `main` 2026-09-08 |
| **B3** | **No UEFI preflight.** The ISO is hybrid and boots in legacy/CSM; the failure surfaces at `bootctl install`, *after* wipe/partition/format/closure-download. Prior OS gone, ~40 min gone, nothing bootable. | `common.nix:546-549`; no `/sys/firmware` reference anywhere in the installer | **LANDED** — UEFI preflight at `zeta-install.sh:1575` (`[ ! -d /sys/firmware/efi ]`); verified on `main` 2026-09-08 |
| **B4** | **Working internet is a hard requirement and its failure lands after the wipe.** `git clone` is at `:1719`; wipe at `:1524`. Offline path proceeds anyway after a 90s wait. | `zeta-first-boot.sh:199-204, 260`; `zeta-install.sh:1524, 1719` | OPEN |
| **B5** | **`zflash --role` does not exist** — strict allowlist, exit 2 — yet first-boot **prints it as the operator remedy** when discovery refuses. Role, join-token and WiFi are structurally not flashable. | `zflash/cli.ts:1077-1094`; `zeta-first-boot.sh:403-404` | OPEN |
| **B6** | **Multiboot stick cannot find its own root.** GRUB boots `root=LABEL=ZETA_MULTIBOOT` (15 chars — not a legal FAT label); the builder writes `ZETA_MB`. Zero runs on `main`. | `multiboot/grub.cfg:38`; `multiboot/assemble.ts:311-317` | **FIX OPEN (PR #17028)** — builder writes `ZETA_MB`, grub.cfg booted `ZETA_MULTIBOOT` (14 chars; FAT max 11, so unwritable). Label exported + drift guard. NOT boot-verified |
| **B7** | **OpenBao comes up sealed at wave −60 and nothing unseals it.** A sealed pod is NotReady by design; the repo's own doc says an unhealthy wave blocks all higher waves. Metal applies the whole catalogue (no `excludeGlob` outside the dev entrypoint). The only written procedure is marked superseded/history. | `openbao/Application.yaml:29-45, 59, 103-145`; `dev-cluster/SYNC-WAVES.md:191-195`; `openbao/TOPOLOGY.md:25-44, 190-207` | **PAYLOAD LANDED (#17003).** **IMAGE LANDED (#17143, 081M23BTKZX087G0R0034VN466).** **extraContainers this PR (081M23HCFYK087G0R003M8HJDF)** — digest-pinned `zeta-bao-unseal`, Secret `openbao-unseal-shares` `optional: true`. Init stays gated. Missing share cache waits. Metal `seal "pkcs11"` is R3. |
| **B8** | **Twelve Secrets are named by `automated: true` Applications and nothing on metal creates any of them.** No `Secret`/`SealedSecret`/`ExternalSecret`/`ClusterSecretStore` exists anywhere under `full-ai-cluster/k8s/`, against 22 references. Several exist only as a `kubectl create secret` in a code comment. | `k3s-server.nix:200-254` mints none; per-app refs listed in the secrets review | **OPEN — measured, and the count was stale.** 2026-09-08: **9** distinct across **10** sites. 2026-09-09: **10** distinct across **11** sites (`openbao-unseal-shares` is an optional Shamir cache; sidecar waits). **0** producer files. 4 have no producer on ANY path (`kubevirt-operator-certs`, `temporal-default-store`, `temporal-visibility-store`, `openbao-unseal-shares`); the other 6 have a dev-path producer, so metal simply does not run one. `external-secrets` and `sealed-secrets` are DEPLOYED and declare nothing. Now checked by `secret-reference-audit.test.ts` (ratchet: a new unproduced reference fails). |
| **B9** | **No biometric gate exists on Linux, so every key-custody ceremony refuses.** darwin→Touch ID, win32→Hello, everything else fail-closed. Eleven CLIs abort. No machine key, no CA, no certs on the target hardware. The runbook is 100% Touch ID / Hello; the `fprintd` adapter named in an ADR does not exist. | `tools/setup/persona-keys/biometric.ts:178-182, 447-451` | OPEN — needs a Linux consent adapter |
| **B10** | **Gatekeeper's namespace webhook is fail-CLOSED against a file documenting the opposite.** The Application sets two failure policies to `Ignore`; the chart ships **three** webhooks, and `check-ignore-label.gatekeeper.sh` has its own key defaulting to `Fail`, never overridden. Its rules are `resources:[namespaces] operations:[CREATE,UPDATE] scope:'*'`, at wave −25, with `CreateNamespace=true` on the root and ~40 apps. The rationale cites an incident that already bricked a cluster. | `open-policy-agent/Application.yaml:40-51`; chart `values.yaml:18`; webhook template `:95-114` | **FIX OPEN (PR #17006)** — `validatingWebhookCheckIgnoreFailurePolicy: Ignore`, verified by helm render diff |

## TRAP

| id | finding | evidence | state |
|---|---|---|---|
| **T1** | **A Thunderbolt/USB-enclosure NVMe can be selected as the BOOT disk.** The filter excludes only *known-USB*; a Thunderbolt enclosure reports `TRAN=nvme, RM=0` and passes, and NVMe sorts first for `DEFAULT_BOOT`. Every non-boot disk becomes a whole-disk Longhorn target. Maintainer runs Thunderbolt hubs **and keeps the target USB stick in one**, so "unplug everything" is not an acceptable mitigation. | `zeta-install.sh:146-150, 118-127, 176, 194` | **LANDED** — HOTPLUG discriminator at `zeta-install.sh:145-153`; verified on `main` 2026-09-08 |
| **T2** | **A zflash stick OVERWRITES baked operator keys** (`tee`, not append) — raw `dd` preserves them; a zflash stick discards them for whatever single ESP key it carries. Raw `dd` instead loses the R9 ledger marker, forcing the breaker to `blind`. | `zeta-install.sh:1868-1878` | OPEN |
| **T3** | **On the first-boot path every credential prompt is silently skipped** (`ZETA_AUTO_CONFIRM=WIPE`), including the cred-blob passphrase — **so no credential persistence ever happens** — while `PROVISIONING.md` presents all seven as the normal flow. Downstream, three AI agent units restart every 30s forever. | `zeta-install.sh:78-80`; `zeta-first-boot.sh:536`; `PROVISIONING.md:69-126` | **LANDED (#17143, 081M23BTKZ8087G0R002W6BFCF)** — WIPE still does not prompt. Empty-passphrase picker skip writes `/mnt/etc/zeta/CREDS-PERSISTENCE-SKIPPED` at `zeta-install.sh:3789-3791` (not at 6.56). Guard: `src/Core.TypeScript/ci/test-iter-54-install-flow.test.ts` "WIPE empty-passphrase skip writes CREDS-PERSISTENCE-SKIPPED at picker, not 6.56" |
| **T4** | **Static cluster addressing is written where Nix evaluation cannot see it.** Written to `/mnt/etc/zeta/…`; read at eval time from `/etc/zeta/…`; the symlink block covers four other files and not these three. `builtins.pathExists` returns false silently. | `injected-cluster-address.nix:88-96`; `zeta-install.sh:2072-2078, 3097-3130` | OPEN |
| **T5** | **`zeta-creds-to-k8s` gives up permanently on the likeliest first-boot state** — missing kubeconfig is a named skip with `exit 0`, `Type=oneshot`+`RemainAfterExit`, so `Restart=on-failure` never fires and no timer exists. Header claims the opposite. | `zeta-creds-to-k8s.nix:23, 84-87, 120-129, 159` | **LANDED (#17143, 081M23BTKYK087G0R002J6E297)** — kubeconfig miss is `exit 1` at `zeta-creds-to-k8s.nix:133-136`; bun/script stay named skip `exit 0`; `Restart=on-failure` unchanged. Guard: `src/Core.TypeScript/cluster/zeta-creds-to-k8s-nix.test.ts` "missing bun/script is a named skip; missing kubeconfig retries" |
| **T6** | **`rotateDevCredential` reports "nothing needs restarting" for exactly the shared credentials that do.** `consumersOf` is keyed `namespace/name`; shared credentials are keyed by bare name, so it returns `[]` for `zeta-blob-store` and `hindsight-llm-api-key`. | `dev-cluster/use-cases.ts:396-398`; `chart-rotation-conformance.ts:76-136` | OPEN — mine, from 2026-09-07 |
| **T7** | **`auditRotationConformance` cannot see the shared roster it polices** — reads `DEV_BOOTSTRAP_SECRETS` only, so a new shared credential lands with no rotation row and a green audit. | `chart-rotation-conformance.ts:147` | OPEN — mine |
| **T8** | **The ephemeral-init leak scan reads pod logs from a namespace that no longer exists** (`-n vault logs vault-0`), contributing 0 bytes with no complaint, inside the one check whose job is proving no unseal share reached a readable surface. | `argocd-health-test.ts:3098 vs :3118` | OPEN |
| **T9** | **`hat-system → nats` is undeclared AND wave-inverted** (−10 → 0), masked only by `replicas: 0`. Restoring replicas converts a vacuous green into a bring-up crash loop. **`orleans → redis`** is a stale citation quoting a line that no longer says it. | `hat-system/deployment.yaml:21, 51`; `sync-wave-dependency-graph.yaml` | OPEN |
| **T10** | **The wave checker cannot see missing edges at all** — proven by the repo's own mutation test: deleting a `dependsOn` entry survived the whole suite. Exactly one edge of ~30 is pinned. | `derive-sync-waves.ts:356-384`; `derive-sync-waves.test.ts:127-140` | OPEN |
| **T11** | **`letsencrypt` ClusterIssuers ship a placeholder contact address** on both staging and prod. ACME against a reserved example address does not register; certs never issue and it surfaces as an issuer-status loop. | `platform/clusterissuer.yaml:26, 46` | OPEN |
| **T12** | **`k3s-first-boot-apply-order` is green and stale** — asserts "exactly two modules" since a third landed; 13 manifests against 12 asserted. Its path filter excludes `nixos/hosts/**`, so the host change could not trigger it. | `k3s-first-boot-apply-order-eval-test.nix:43-50`; `first-boot-manifest-check.yml:38-53` | OPEN |
| **T13** | **`root-application.yaml` is submitted before its CRD exists** and whether the k3s deploy controller retries an unknown-kind apply is **not established**. The test named as the decider (`k3s-first-boot-roster.nix`) is **never built** — the workflow comment claiming it runs is false. | `k3s-server.nix:175-188`; `build-ai-cluster-iso.yml:75` | OPEN |

## UNPROVEN

| id | finding | state |
|---|---|---|
| **U1** | **Nothing in CI has ever synced the tree metal will sync.** Green comes from a staged dev-rung copy on kind/kindnetd/amd64, missing metal's CNI, LB-IPAM, storage and control plane. 18 of 47 apps proven Healthy, on the wrong substrate. | OPEN |
| **U2** | **OpenBao's CI health is bought by `--ephemeral-vault-init`**, whose own header says it *"must never be the metal path"*. Every downstream green in that lane sits on it. | OPEN |
| **U3** | **`audit-existing-secret-is-minted` exit 0 means "the dev lane mints it"** — its minted set is dev-only by construction, so ten metal-sourceless Applications pass. | OPEN |
| **U4** | **`hindsight` is in the proof-deferred list** and its minted value is a documented placeholder — two layers of unproven under one green. | OPEN — mine, 2026-09-07 |
| **U5** | **SoftHSM/swtpm emulator green is not YubiHSM green**, stated in-tree; nothing puts a `seal` stanza in a manifest or touches real hardware. | OPEN |
| **U6** | **`audit-vault-topology-coherence` and `chart-rotation-conformance` are not in any workflow.** Clean locally, never run in CI. | OPEN |
| **U7** | **aarch64 ISO is green-but-unproven** — TIMEOUT and STALLED are downgraded to warnings; 18/18 success, 5/18 actually booted, last 6 consecutive TIMEOUT. | OPEN |
| **U8** | **`cdi`/`kubevirt` are manual-sync at wave −5**, justified by a premise ("adopting a live operator") that does not hold on a cold cluster. Whether ArgoCD gates a wave on never-synced children was not verifiable offline. | OPEN |

## EXPOSURE — live now, independent of the boot

| id | finding | state |
|---|---|---|
| **E1** | **A blob-store S3 secret key is still in git**, in a contract doc the "the last committed secret is gone" migration never touched. Live since 2026-06-13 in a public repo. Removal from manifests does not un-publish it. | OPEN — rotation is a maintainer call |
| **E2** | **A committed sha512crypt hash with its plaintext in the adjacent comment**, shipped as the default `zeta` user password whenever a file is absent — a path the activation script handles explicitly, so it is live by design. Bounded by SSH password auth off. Its own lift condition was *"when repo goes public"* — already met, unpaid. | OPEN |
| **E3** | **The uncompensatable floor names a secret-scanning detector that is not in the repo.** Zero gitleaks/trufflehog/detect-secrets under `.github`. The one class the floor calls *erasure-class* is guarded by a scanner that does not exist. | OPEN |
| **E4** | **The credential check that DOES run scans ~1% of the tree** — `Application.yaml` only; no `.md`, no `.nix`, no `infra/`, no `kind: Secret`. Which is exactly where E1 and E2 live. | OPEN |

## Riven's lane (do not build into it uncoordinated)

| id | item | state |
|---|---|---|
| **R1** | **extraContainer Shamir sidecar** (MENO item 7) — `valuesObject` only, Shamir kind path only, **do not fork the chart**. Adapters: `src/Core.TypeScript/cluster/openbao-unseal-sidecar.ts` (`#17003`). Image: `full-ai-cluster/openbao-unseal/Dockerfile` (`#17143`). **extraContainers this PR (081M23HCFYK087G0R003M8HJDF)** — digest-pinned, `optional: true` share cache. Init stays gated. Metal PKCS#11 is R3. | Riven |
| **R2** | Live ISO wiring of `namedProbeFromFrostLook` — the remaining detect-at-setup hole. Must not infer from `/dev/tpmrm0`, must not default missing effects to `realProbeEffects`, must not export frost-look keys from the installer. Do not call the overlay from `zeta-install.sh` until a real injected hardware capture exists on the live ISO. | Riven |
| **R3** | Metal seal `pkcs11` — waits on a same-libc OpenBao image or host bao, same commit. Dual-vendor per node is ZetaFS k-of-n, not two OpenBao seals. | Riven |

## Doc rot that will mislead an operator at the console

`full-ai-cluster/README.md` still says the LLM key is NOT wired (it is), cites a `applications/vault/TOPOLOGY.md` path that no longer exists, and claims SealedSecrets/Vault/SOPS "coexist deliberately" — zero SealedSecrets exist, Vault was replaced, there is no `.sops.yaml`. `PLATFORM-ARCHITECTURE.md` describes Vault/SPIRE/ESO/Longhorn as running in present tense while `README.md` in the same directory records they are not. `PROVISIONING.md` points at `tools/installer/*` modules that live elsewhere, and gives a control-plane hostname the code does not use.

---

## BRANCH / TAG CLEANUP — BLOCKED, and the blocker is the safety net itself

An adversarial review of the branch/tag census (2026-09-08) found that **the conditions the cleanup
plan assumed are not met**. These are recorded here because the cleanup was going to proceed on
"tips are tag-preserved, so deletion is safe" — and that premise is currently false off-site.

| id | finding | state |
|---|---|---|
| **X1** | **THE OFF-SITE MIRROR IS DEAD.** `.github/workflows/mirror-to-fork.yml` is `disabled_manually` since 2026-08-29; the fork's `pushed_at` is 2026-08-28. Measured: `archive/*` tags — origin **442**, fork **359**. `archive/2026-09-03-branch-sweep/*` — origin **49**, fork **0**. `archive/experiments/*` (the tags running code reads) — origin **16**, fork **0**. **The entire tag-preservation safety net exists on origin only**, and every ref created after 2026-08-28 has no off-site copy at all. The workflow's own header records this contract silently breaking once before, for ten weeks. | OPEN — blocks deletion |
| **X1a** | When re-enabled the mirror pushes `--prune --force`, so it **propagates deletions within 24h**. It is a mirror, not an archive. Re-enabling it does not create a backup of anything already deleted. | OPEN |
| **X2** | **`lumen/fix-heartbeat-actionlint` was classified merged-safe and is NOT on main.** PR #16542 closed unmerged; the branch's one-line actionlint fix is absent (main fixed a *different* sub-issue on the same line, which is what made it read as landed). 100% of its substance missing, not tag-preserved. Deleting it loses the fix **and** the record that the finding is still open. | OPEN — the one wrong "safe" call found |
| **X3** | **Several target branches are LIVE and moving hourly.** One branch showed **four** distinct SHAs inside 45 minutes; four branches appeared and two vanished during the review. These are a running agent's working refs — deleting them is deleting live state, and any SHA-keyed approval is stale on arrival. | OPEN |
| **X4** | **Deletion protection is much narrower than assumed.** Exactly one ruleset protects non-default branches: `include=[refs/heads/heartbeat/*]`, `rules=[deletion]`. **Unprotected:** `archive/*`, `preserve/*`, `liveness/*`, `agent-heartbeats`, every work branch, and **every tag**. | OPEN |
| **X5** | **`liveness/observations` has zero deletion protection and is hard-coded in running code** (`agent-heartbeats/liveness-ledger.ts` `LEDGER_REF`). It shares no history with main, so every content-diff test reads it as "100% unique/unmerged". Must never appear in a deletion set. | OPEN |
| **X6** | **`agent-heartbeats` is a write-only sink.** The writer hardcodes it as the default branch; the flusher **rejects** any head not matching `heartbeat/<lane>`. So anything written to the default lane is unflushable by construction — 693 commits, ~9,077 lines never on main. And because the writer updates the ref via `PATCH` (never create), **deleting it makes every default-path heartbeat write fail hard.** | OPEN |
| **X7** | **Eight branches are `partially-landed`** — merged once, then extended. A merged-PR record is true and insufficient for these; the tip is not that merge's head. | OPEN |
| **X8** | **~78 branch tips have neither a tag nor main coverage**, including `preserve/*` entries holding very large unique content (one at ~102k lines, another ~49k). Per the preservation rule these *are* the sanctioned rescue namespace — backups by construction, with no second copy given X1. | OPEN |
| **X9** | **A branch was deleted during the review** (`cursor/named-bun-json-look-27c5`) and it had in fact **merged** as PR #16988. Its pre-deletion tip could not be recovered from this clone — no reflog, no packed-ref, and the fork is 10 days stale. Illustrates X1's consequence concretely. | CLOSED-BY-EVENT |

**Ordered preconditions before any branch or tag is deleted:**

1. **Re-enable and verify the mirror** — and confirm it has actually pushed *before* deleting anything, since it prunes on the next run.
2. **Add deletion protection for `archive/*`, `preserve/*`, `liveness/*` and tags**, which currently have none.
3. **Re-measure immediately before acting** — live branches moved four times in 45 minutes.
4. **Exclude `liveness/observations` and `agent-heartbeats` unconditionally.**
5. **Resolve X2** before trusting any "merged-safe" list.
