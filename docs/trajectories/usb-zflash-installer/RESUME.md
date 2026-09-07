# Trajectory - USB / zflash Installer

Status: active — shipped + iterating; first surfaced as a trajectory 2026-05-29 from substrate inventory (the flashing mechanism works on `origin/main`; this surface was missing, so the workstream lived head-only)
Last refreshed: 2026-09-07
Type: workstream (current-focus) — a trajectory the operator is _actively powering_. Many trajectories can be tracked; only a few are workstreams at once (finite-focus / WIP-bounded — a workstream is a trajectory under sustained thrust, and thrust budget is finite, so most trajectories coast). (Genus = "trajectory"; "workstream" is the species: a trajectory under sustained thrust toward a deliverable, vs. emergent-posture trajectories like `anti-infection`. See [`factory-trajectory-surface`](../factory-trajectory-surface/RESUME.md) for the genus/species taxonomy.) One of the operator's three current cluster workstreams (encryption / usb-zflash / ts-workflow-engine).
Eventual encoding (design-stage — the human maintainer 2026-05-23 genetic-ID substrate + Clifford/HKT): this trajectory's state is trackable as a 128-bit genetic-ID seed (discrete, reversible via parser-combinator ↔ generator-function) → Clifford-space path (continuous, eventual). Mirrors the three-lane I8-lattice / I9-manifold split.
Current blocker: hardware — metal S6 first-login + WiFi radio / Touch ID / TPM
(human-gated). Software restore is **proven**: `main` workflow_dispatch
[33126215487](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33126215487)
on SHA `034544150` serial `zeta-creds-restore: wrote 1 creds` after picker
`--bake-cred x1` ([#15912](https://github.com/Lucent-Financial-Group/Zeta/pull/15912)).
Sibling dispatch QEMU steps already use
`if: always() && github.event_name == 'workflow_dispatch'` — they do **not**
skip when restore is red. Do not re-litigate that P1 or re-dispatch restore
as if `--defer-all` were still the live hang.
2026-08-18: `zflash` ISO acquisition is now architecture-aware (`--iso-arch`,
default x86_64). Before this a run carrying both the x86_64 and aarch64 ISOs
was resolved by `readdirSync` order — a coin flip whose only symptom was "no
bootable device" after a full flash-and-walk-to-the-box cycle, and whose
untagged cache name made a wrong pick win every later auto-discovery. Closes
known-unknown #2 of the first-metal preflight; that runbook no longer asks the
operator to hand-download and hand-rename an ISO.
**2026-08-31 — THE LANE ITSELF WAS RED FOR 38 HOURS, and "restore is proven"
did not notice.** `build-ai-cluster-iso` failed on every `main` push from
`f4c1f5dca` (2026-08-30T02:48) to `7c1857530` (2026-08-31T17:12) — scenario 2,
first-boot provisioning. Cause: **`mise --version` SEGFAULTED on NixOS first
boot** (mise 2026.8.14, from "run mise 2026.8.14 everywhere" #16186). Under
`set -e` the failed command substitution killed `install.sh` with **rc=139**,
three attempts, and the node came up partially provisioned — `bun: command not
found` downstream, so nothing needing a runtime could run.

Reverted to the last-known-good **2026.6.12** across all five declarations in
[#16200](https://github.com/Lucent-Financial-Group/Zeta/pull/16200). Two
hypotheses were refuted by measurement first, not argument: both release tarballs
have **identical** `PT_INTERP`, `DT_NEEDED` and max `GLIBC_2.18`, so it is
neither a missing library nor a glibc floor. The runtime cause is unidentified
and 2026.8.14 works fine on macOS — **re-attempting the bump is welcome**, and
now it will produce a diagnosis in one run.

WHY IT TOOK 38 HOURS, which is the reusable part: the probe read
`mise --version 2>/dev/null`. A SIGSEGV prints nothing to stdout, the redirect
ate stderr, and the serial log recorded **not one character** of explanation —
"apt packages up to date", then the retry. The harness's own `081KZETP6AT` diag
block prints _"install.sh error lines"_, and a signal death produces none, so it
emitted an empty block between its two markers. #16200 makes `rc >= 128` report
the signal by name; a version probe that cannot say _"the binary crashed"_
reports a crash as an empty version string.

**Read the old claims with that in mind.** "Software restore is proven" was true
of the restore step and simultaneously the lane could not boot a node. A green
claim about one step is not a claim about the lane.

**Session handoff (2026-08-28):** restore is closed on software. Do not
re-open [#14852](https://github.com/Lucent-Financial-Group/Zeta/pull/14852)
`--defer-all` as the live hang — that hang was pre-`--defer-all` on
[run 32724820159](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32724820159).
After `--defer-all` + bake-cred (#15912), restore wrote 1 cred on
[run 33126215487](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33126215487).
The 2026-08-24 handoff
([`docs/handoffs/2026-08-24-riven-usb-zflash-qemu-restore-next.md`](../../handoffs/2026-08-24-riven-usb-zflash-qemu-restore-next.md))
is historical. **So is this sentence's own "next slice", as of 2026-08-31:**
in-guest wrong-passphrase (phase 2b) AND the hexagonal passphrase port both
LANDED on 2026-08-29 in `133a95b5de` (#15983). `WRONG_QEMU_PASSPHRASE`,
`PHASE2B_SERIAL_SEPARATOR`, `assertUefiKeyfileRestoreWrongPassphraseContract`
and `installer/passphrase-source.ts` (`planPassphraseSource` pure,
`PassphraseSourceEffects` injected) are all on `main` with unit falsifiers.

**PHASE 2B HAS RUN.** Do not re-dispatch restore as if the harness were unproven.
`main` workflow_dispatch
[33462406161](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33462406161)
(2026-09-01, SHA `ed765bbed`, #15983 is an ancestor) restore step succeeded.
Serial (job `build-iso` step `UEFI keyfile restore decrypt`):

- `zeta-creds-restore: wrote 1 creds (target-root: /)` (happy-path phase 2)
- `phase 2b — rebooting installed disk with WRONG fw_cfg passphrase`
- `UEFI keyfile restore wrong-passphrase contract ok (decrypt refused; no write; still fw_cfg / not metal)`

The 2026-08-31 "never run" sentence was true of the August 26/27 dispatches and
false once 33462406161 finished. Same failure as "restore is proven" vs a red
lane: a green claim about one step is not a claim about the next step, and a
stale "never" is not a claim about the last dispatch.

Do **not** re-dispatch restore to re-prove this. The remaining restore gap is
metal `tty1` (hardware). Next software on this trajectory is the remaining
k3s/k3d class on `081M1DFQ2MZ087G0R000CMNHQX`: spire-agent hostNetwork
restarts. The Gateway API CRD gap is **measured closed** on live-k3d smoke
[33739778288](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33739778288)
(cert-manager Healthy, 0 restarts). Not another ISO restore, and not another
kind `--cni cilium` dispatch.

Next concrete action: **minimize metal** — S6 physical first-login +
WiFi radio / Touch ID / TPM (human-gated). Software deepen landed:
per-federation threat-model stub + optional QEMU UEFI menu-boot smoke
(`qemu-uefi-menu-smoke.ts`) + UEFI keyfile ESP persist planner
(`uefi-keyfile-esp.ts`) + USB iSerial sysfs probe (`usb-iserial-probe.ts`;
not default `usbUuid` binding). Persist picker now forwards
`--usb-iserial` / `--uefi-keyfile` the same way persist/restore already
did. QEMU USB boot argv now carries `serial=ZETA-QEMU-001` (guest
sysfs; host probe stays injectable). Guest installer 6.95d prints the
sysfs probe report to the serial log and writes `--serial-file` on
success. Default persist remains FAT UUID. `ZETA_BIND_USB_ISERIAL=1`
forwards `--usb-iserial` to the picker only when the probe succeeded.
Persist writes `zeta-creds.factor` next to the blob; restore reads it
and `/etc/zeta/usb-iserial` with no UUID fallback. `ZETA_BIND_UEFI_KEYFILE=1`
writes `/mnt/boot/EFI/ZETA/keyfile` and restores from `/boot/EFI/ZETA/keyfile`
(fail closed; no UUID fallback; not copied to `/etc`). The two opt-ins
are mutually exclusive. Opt-in
`QEMU_USB_ISERIAL_PHASE1=1` asserts probe markers **and**
persist-default UUID; ISO/cdrom does not. Opt-in
`QEMU_UEFI_KEYFILE_PHASE1=1` (dedicated; not implied by wifi/iSerial)
bakes `/zeta-bind-uefi-keyfile` and asserts the **install-time** keyfile
write. It does **not** prove picker bind. Opt-in
`QEMU_UEFI_KEYFILE_PICKER=1` (dedicated; not implied by PHASE1) also
bakes `/zeta-qemu-creds-passphrase` so 6.95-picker binds the blob to the
keyfile (restore-decrypt precondition; not phase-2 decrypt). Opt-in
`QEMU_UEFI_KEYFILE_RESTORE=1` (dedicated; not implied by PICKER) injects
the QEMU test passphrase via `-fw_cfg file=` on disk boot and asserts
restore decrypt against the keyfile. The secret is not copied onto the
installed ESP. Default
wifi/iSerial phase-1 must not bake that marker or the passphrase file.
Not on `gate (required)`.
See `docs/security/USB-IDENTITY-THREAT-MODEL.md` <!-- STALE-REF: ../../security/USB-IDENTITY-THREAT-MODEL.md -->:
traveler → cluster → federation → ISociety/CTM, self-similar.
Cluster/federation glossary promoted (`docs/SEED-VOCABULARY.md` +
`docs/GLOSSARY.md` §Society identity). Credential binding model tests
landed (`credential-binding-model.ts`). Multiboot scaffold + hermetic
planner + FAT assemble + EFI embed path landed
(`src/Core.TypeScript/installer/multiboot/` — `--plan` / `--assemble`
/`--grub-efi`). Real GRUB EFI binary comes from nix/`grub-mkimage` (not
vendored). QEMU UEFI menu-boot smoke is optional CI
(`qemu-uefi-menu-smoke.ts`).
**Physical boot** only when ready
for residual hardware (S6 feel, radio associate, Touch ID / TPM). Paper/mock
S6 flow accepted 2026-07-08 (GitHub → local → done; skip-gh continue
later via local/SSH). Longer-term (not blocking S6): desktop app UI
over NixOS, then microkernel UI; `gh` is temporary foothold — successor
is Zeta IdP and ZetaDB/DagFs as git backend/client. See
[S6-UX-PLACEHOLDER.md](./S6-UX-PLACEHOLDER.md). Slice 5 CODEOWNERS when
teams confirmed; system mise pinned via Nix overlay (same release as
`tools/setup/linux.sh`).

## 2026-09-01 — THE ROAD TO K8S ON REAL HARDWARE, measured end to end

The maintainer's stated goal: _"I would really like to get k8s running on real
hardware soon."_ This section is the honest distance to that, split into what is
PROVEN, what is UNPROVEN, and what is a DECISION rather than work.

### PROVEN — the boot/install/join path is genuinely covered

Run [33462406161](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33462406161),
all steps green, zero skipped:

* **Signed installers, both architectures.** x86_64 1606 MB + aarch64 1582 MB,
  cosign keyless. The chain was verified four independent ways rather than
  asserted: rendered bytes -> `.sha256` manifest -> the cosign bundle's own
  `messageDigest` -> a Fulcio cert naming
  `build-ai-cluster-iso.yml@refs/heads/main` and `runs/33462406161/attempts/1`.
  Digest `d93c40fc96815036523b95d680a707d08acfa41a532e9aaf8c969a5562beee93`.
* **UEFI keyfile, all three phases**: install-time write, picker bind, restore
  decrypt. Plus wifi ESP acceptance and the x86_64 boot-discriminator self-test.
* **Format scenarios 1-4**: initial format, boot + install substrate, reformat
  with retention, path-fork migrate-vs-fresh.
* **SECOND MACHINE JOINING — the question that actually matters for a cluster:**
  * `k3s agent JOINS the server` (scenario 5 markers on serial)
  * `a second CONTROL PLANE joins (one cluster CA, not two)` — the failure that
    actually bites on HA, tested by name
  * `dirty disk FAILS CLOSED (k3s must not start)`
  * `cluster comes ALL the way up (node Ready + CoreDNS)`
  * `a longhorn PVC actually BINDS and data survives`

So: flashing, installing, encrypting, and forming a two-node cluster are proven in
QEMU. That is the majority of first-metal risk and it is retired.

### UNPROVEN — the charts, and the substrate they were proven on

| | |
|---|---|
| Application dirs | **48** (47 priced) |
| Get a health verdict at all | **24** |
| Of those, actually `Healthy` | **18** |
| **Proven Synced+Healthy** | **18 of 47 ~ 38%** |

Not healthy even on kind: `cdi`, `forgejo`, `gmod`, `kubevirt` = **Missing**;
`hindsight`, `weaviate` = **Progressing**.

Never asserted anywhere — the nine standing `excludeGlob` deferrals: `cilium`,
`cilium-lb-ipam`, `longhorn`, `ollama`, `vllm`, `gitlab`, `temporal`,
`agent-memory`, `platform`.

**THE SUBSTRATE GAP, which is the single biggest metal risk.** Metal runs
**k3s + Cilium**. The 18 healthy charts are proven on **kind + kindnetd**.
Kind `--cni cilium` included (dispatch 33701456828) now reports the four
Healthy too — Cilium is not the cause. The lane that tests metal's actual
configuration at chart depth is `live-k3d`, and it was reverted to `smoke`
scope on 2026-09-01 after four Applications would not reach Healthy there
(`081M1DFQ2MZ087G0R000CMNHQX`). Distinguishing table:

- kindnetd: Healthy
- kind+Cilium: Healthy
- k3d (k3s+Cilium): Degraded / Progressing

The k3d included dump (run 33429761222) was a cascade from **missing Gateway
API CRDs** (cert-manager CrashLoop → trust-manager / openziti FailedMount),
plus a **second** class (spire-agent hostNetwork DNS i/o timeout).
**MEASURED live-k3d smoke [33739778288](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33739778288)
job `100600115401` (SHA `d83e0b643`): succeeded.** Vendored CRDs present;
cert-manager Synced/Healthy, 0 restarts; cert-manager issued
`trust-manager-1`. spire-agent still 0/1 with 2 restarts. The dump's
`-l app=spire-agent` printed no logs: chart 0.24.2 selector is
`app.kubernetes.io/name=spire-agent`, and hostNetwork/dnsPolicy are
hardcoded. Dump now targets `daemonset/spire-agent`. Do not re-lift
`--scope included`. Do not invent a Cilium values tweak. Do not re-dispatch
the Cilium included probe. live-k3d smoke [33754516236](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33754516236)
job `100646643214`: `configmap/spire-bundle` is DATA 0. Crash is
missing `bundle.crt` because the server is Pending on local-path, not
the included-class DNS timeout.

**Expect chart-level surprises on metal.** Boot and join are proven; what runs on
top of them is proven on a different substrate.

### LANES ARE CAPACITY PLANNING, NOT CHART TESTING

`k8s-lane-partition.yml` is green and has run 89 times, and "covered by a lane:
44/47" reads like coverage. It is not: the lane job renders image lists and pulls
images to measure on-disk cost. It contains **zero** cluster bring-up and **zero**
health assertions (counted). It solves runner capacity; nothing about chart health.

### DECISIONS OPEN, each with evidence and none taken

* **gitlab** — `081M1ET79Y9087G0R000N29HWF`. CPU was never its blocker; **76 GiB of
  PVCs** was (gitaly 50, minio 10, postgres 8, redis 8) against a ~70 GiB runner.
  Measured achievable: 1350m / 4191Mi / 5 GiB. Must go through the ladder
  (`resourceClaims` + storage claims + `--apply`), NOT flat `valuesObject` values —
  a flat edit hits every rung and would ship 2 GiB of git storage to `large`.
* **minio -> seaweedfs** — MinIO's chart upstream is **archived**: newest 5.4.0
  created 2025-01-02, appVersion `RELEASE.2024-12-18T13-15-44Z`, verified live
  against `charts.min.io`. SeaweedFS published 4.45.0 on 2026-09-01 and we run
  4.33.0. Both already reconcile and provision the same five buckets; MinIO is
  merely the consumer DEFAULT. The gap: seaweedfs's gate proves DEPLOY, not that
  Loki/Mimir work against its S3 gateway.
* **orleans** — the k8s manifests are correct (StatefulSet, `podManagementPolicy:
  Parallel`, POD_NAME/POD_NAMESPACE/POD_IP downward API, RBAC on
  pods/endpoints/statefulsets, ports 11111/30000, requests AND limits). But **no
  `Microsoft.Orleans.*` package is referenced anywhere** — `OrleansCronAdapter.fs`
  says of itself that it is "a lightweight in-memory adapter ... in a real
  deployment, this would be backed by Orleans IGrain timers". The image
  `zeta-orleans-silo:latest` is a placeholder and the partitioner cannot price it.
* **PR-archive flush lane** — `081M1EKTVH7087G0R002XC3GCW`, deadlocked on
  `action_required`; every fix relaxes a security gate or spends a credential
  decision.

### ORLEANS CLUSTERING — RESEARCHED 2026-09-01, and the risk is NOT where it looked

The maintainer's hypothesis was that CockroachDB might diverge from PostgreSQL on
_locking granularity_ — table-level vs partition-level. **The locking half of that
is settled and favourable; the blocker is somewhere else entirely.**

**Orleans' PostgreSQL clustering SQL takes NO LOCKS.** Read from
`dotnet/orleans@main src/AdoNet/Orleans.Clustering.AdoNet/PostgreSQL-Clustering.sql`:
no `LOCK TABLE`, no `pg_advisory_lock`, no `SELECT FOR UPDATE`, no explicit
serializable transaction. Membership is pure optimistic concurrency — a
single-row compare-and-swap on a version row:

```sql
UPDATE OrleansMembershipVersionTable
SET Version = Version + 1
WHERE DeploymentId = @DeploymentId AND Version = @VersionArg;
```

Single-row CAS with client-side retry on mismatch is precisely the pattern
CockroachDB is built for. On locking, Cockroach is a good fit.

**THE ACTUAL BLOCKER IS PL/pgSQL FEATURE COVERAGE.** Those functions read the
affected-row count with `GET DIAGNOSTICS RowCountVar = ROW_COUNT`, and
CockroachDB's PL/pgSQL documentation lists `GET DIAGNOSTICS` as **not supported**,
alongside `PERFORM`, `EXECUTE`, `CASE`, the `FOUND` variable, and — relevant to
Orleans' rollback path — _"PL/pgSQL exception blocks cannot catch transaction retry
errors."_ So Orleans' AdoNet clustering will not install on CockroachDB as shipped.

Not fatal, but not free: Orleans keeps its SQL as DATA in the `OrleansQuery`
table, so a CockroachDB dialect can be authored (restructure to `RETURNING` or
plain conditional statements instead of `GET DIAGNOSTICS`). That is a maintained
fork of upstream's SQL, and it is a standing cost, not a one-off.

**RECOMMENDATION: Redis for Orleans membership.** Redis clustering providers are
**stable as of Orleans 10.0** and documented at `orleans.dev/integrations/redis`
(first-class, not the OrleansContrib community package). We already run `redis/`
in-tree. One production caveat from the docs: _persistence must be explicitly
enabled_ — a volatile Redis can lose membership and take the cluster down with it.

**ON "CAN REDIS SCALE OUT" — the question mostly dissolves.** Orleans membership
is a handful of keys and one row per silo; it needs AVAILABILITY, not sharding.
Redis Cluster does shard by key hash and Sentinel gives HA, so either covers it,
but neither is load-bearing for membership size. The thing that scales out in
Orleans is the SILOS, and that is independent of the membership store. Where scale
genuinely matters is grain PERSISTENCE — and if that lands on AdoNet it inherits
the same PL/pgSQL question, so a Redis or blob-backed grain store keeps both
halves off that path.

Sources: [PostgreSQL-Clustering.sql](https://github.com/dotnet/orleans/blob/main/src/AdoNet/Orleans.Clustering.AdoNet/PostgreSQL-Clustering.sql) ·
[CockroachDB PL/pgSQL](https://docs.cockroachlabs.com/docs/stable/plpgsql) ·
[Orleans cluster management](https://learn.microsoft.com/en-us/dotnet/orleans/implementation/cluster-management) ·
[Orleans Redis integration](https://orleans.dev/integrations/redis/)

### CHART CURRENCY NOW GATES THE USB TEST (Aaron, 2026-09-01)

> _"lets put them in our current path for tasks to complete before we test the usb i
> really want all our charts to be on latest version before i test the usb again."_

So the ordering is fixed: **charts first, USB second.** The audit that produced the work
list is `081M1F2F4WQ087G0R000ZWZXTB`; `bitnamilegacy` is `081M1F1K5N5087G0R0019JKRV0`.

#### The reframe that makes this achievable, and it is the SAME argument as ArgoCD's

The audit is full of staged-upgrade requirements that look prohibitive: cockroachdb
permits **one major at a time** across six; cilium needs **five sequential hops**; nats
changes its **stream state file format**; temporal wants worker deletion plus a schema
migration; dapr's 1.14 -> 1.15 hop carries a documented **actor-reminder data-loss
warning**.

**Every one of those is an UPGRADE requirement, and a USB install is not an upgrade.**
A machine flashed from this ISO comes up with no cluster and no data, so there is no path
to walk between versions — the question is only _which version gets installed_. That is
exactly why the ArgoCD bump (#16276) was safe despite being 200 versions behind, and the
argument generalises to the whole set.

**What does NOT get waived by a fresh install**, because it is not about version distance:

| still required | why a fresh install does not help |
|---|---|
| repoURL relocations — `tempo`, `cert-manager`, and possibly `loki`, `headscale` | the current repo is frozen or a legacy mirror; installing _from_ it installs the frozen thing |
| `redis` off `bitnamilegacy` | the image is archived at every chart version; 28.0.12 defaults to an UNPINNED `bitnami/redis:latest`, which is worse |
| `hindsight`'s bundled `ankane/pgvector:latest` | archived since 2023-10-11, and a subchart image is invisible to the chart version |
| **our `valuesObject` keys still being READ** | this is the one that actually bites: a key that silently stops being read renders fine and configures nothing |
| `mimir`'s `minio.enabled: false` override | the chart still defaults it TRUE; a values reset re-adds a bundled archived minio |
| `seaweedfs` >= 4.40 | closes an unpatched HIGH CVE in the pin we ship today — see below |

#### FIRST IN THE QUEUE: seaweedfs, and the irony is the point

`seaweedfs 4.33.0` carries **CVE-2026-77611 / GHSA-9x53-cjpr-m682, CVSS 7.1 HIGH**,
published 2026-08-21: a scoped S3 principal can write outside its permitted key prefix via
`PutObjectAcl` on a nested key. Fixed in **4.40+**; we are pinned below it.

**We removed minio for unpatched HIGH advisories and moved to a version of its replacement
that has one.** Nobody chose that — the CVE published after the replacement was designed —
but it is the exact failure this audit exists to catch, landing on the audit's own
recommendation.

Exposure today is **low and checkable**: the bug needs a _scoped_ identity to escape, and
our config defines exactly one principal, `admin`, with full access — there is no
restricted identity for it to victimise. That is a reason it is not an emergency, not a
reason to leave it. The fix rides along with a bump already recommended as `UPGRADE-SAFE`.

Note when bumping: seaweedfs also changed its S3 identity loader to fail **closed** rather
than open when zero identities load, so smoke-test the `createBuckets`/auth config after.

#### The per-chart procedure, already executed once

ArgoCD is the worked example (#16276). For each chart:

1. Point `repoURL` at the **live** source, where the audit found it moved.
2. Bump to newest published; `audit-chart-target-revisions --refresh` refuses a pin
   upstream never published, so it checks the number rather than trusting it.
3. `helm template` at **both** versions with our exact `valuesObject`, and verify **key by
   key** that every value still takes effect — not merely that it renders.
4. Diff the rendered resource sets and record additions/removals.
5. Let the k8s lanes prove reconciliation. A chart that renders is not a cluster that syncs.

#### Honest statement of the goal

"All charts on latest" is achievable for a fresh install in a way it is not for a live
cluster — but it will not be _uniformly_ true on the day it lands: `loki` needs a
maintainer call on the OSS/GEL fork, and `headscale`'s best chart source is an open
question. Those two get named, not silently skipped.

### THE ONE THING BLOCKING THE USB RIGHT NOW — now the SECOND thing

Nothing technical. The ISO is staged and verified, `/dev/disk6` (124 GB, no
filesystem) is plugged in, and `zflash` refuses because the target was
**discovered, not stated** — by design. It needs a human to name the device:

```
bun src/Core.TypeScript/zflash/flash-usb.ts <iso> \
  --expect-device=/dev/disk6 --expect-size=123979431936 --expect-model="USB 3.2.1 FD"
```

It will still require a typed confirmation phrase carrying a runtime-random nonce,
and read-back verifies after writing.

## Why This Exists

The "usb/zflash" workstream is the **flashing mechanism** for getting NixOS
onto cluster hardware: the USB NixOS installer + the `zflash` tool (Touch ID +
random nonce + SSH-key auto-inject + control-plane/worker role-picker). It is
the sibling of `cluster-encryption-credential-substrate` (which owns _what_
secrets get injected); this trajectory owns _how the bits get onto the metal
and boot into a joinable node_.

**Deeper purpose — self-healing hardware (the human maintainer 2026-05-29):**
the USB is not only first-install; it is the _self-healing repair_ mechanism for
the local accelerator cluster. A human's only job is to plug in the USB — any
failed node in the K8s / GPU-accelerator cluster re-images, re-joins, and
re-credentials itself. This gives Zeta **local + free-cloud both**: the
self-healing local accelerator cluster (owned metal, GPU compute, sovereignty)
composing with the free GitHub-Actions cloud swarm (081KSNY2Z0008QG0R003X1QWYG, zero-marginal-cost
because open-source). The workflow engine
(`ts-workflow-engine-du-state-machine` trajectory) is portable across both
substrates; usb/zflash keeps the local one alive with minimal human-in-the-loop
(physical-only — plug in the USB, everything else automated).

**2026-09-05 — repair stick must keep HSM-talk (Aaron, via Riven).**
CLI creds on the stick are shipped. After OpenBao replaced Vault,
a repaired box still has to talk to the YubiHSM / smartcard HSM.
That is a companion inventory, not a second secret store:
PKCS#11 module path, connector config, authkey _reference_,
domain map, OpenBao seal env pointer. Forbidden as originals:
PIN plaintext, Shamir shares, `OP_SESSION`, a brand type in the
ZetaFS volume. Classifier:
`src/Core.TypeScript/cluster/seal-emulator-rung.ts`. Sibling:
`cluster-encryption-credential-substrate`. `--bake-cred` now
accepts the five companion kinds
(`081M1TX6CV6087G0R002GZEXMP`); PIN stays an env-name
reference. SoftHSM2 in CI does **not** replace this metal
companion set. NixOS `zeta.hostSeal.boxRole = "prod-metal"`
is how a repaired box declares automatic rotation (HSM or
TPM PKCS#11); FIDO / biometric stay developer-only. The
role is declared on the host, not inferred from a k8s
label, and presence is still a probe.

**2026-09-06 — setup-time detect, then companion (Aaron, via
Riven).** First-boot / setup probes HSM and TPM and
integrates PKCS#11 _only_ if the device is accessible.
Metal HSM vendors are YubiHSM 2 and CardContact
SmartCard-HSM (not a YubiKey). TPM is an auto-unseal path
(OAEP). Lucent 1Password remains
a peer unseal path for boxes that do not have that silicon,
or that choose it. Classifier:
`src/Core.TypeScript/cluster/unseal-path.ts`. The repair
stick still carries HSM-talk companions; it is not the
detector. SoftHSM / swtpm 2×2 is a CI install matrix
(`081M1TS32Y3087G0R0026Y21F5`,
`.github/workflows/seal-emulator-install.yml`), not a
USB path. Off-cluster `bao operator init` against that
SoftHSM (`081M1TV43F6087G0R0008QFTKM`) is a CI witness,
not a substitute for the metal companion set.
The hostPath overlay **planner**
(`081M1TZH2PW087G0R0036F3S18`,
`pkcs11-hostpath-overlay.ts`) consumes the companion
path string. Setup glue
(`081M1V32K68087G0R000SW5PJB`,
`planSetupPkcs11Overlay`) joins those contents with
the attached-device oracle; the restore filename is
not the `.so`. The path picker now feeds that overlay
(`081M1V5ER44087G0R0000WPCC4`,
`planSetupOverlayFromIntegrate`).
Bake-cred refuses the restore filename as the
module-path value (`081M1V6WCHN087G0R0022FN5DV`)
and refuses SoftHSM / swtpm paths on that stick
(`081M1V880WV087G0R002E07KGH`).
Setup overlay reads that restored file via an injected
capture (`081M1V9KQFX087G0R0038J326D`).
Load-site / ELF capture classifies musl vs glibc and
names option D host `bao` (`081M1VB58YS087G0R001G1RSXW`);
host HCL is not a chart seal.
Installer parses `PT_INTERP` from ELF bytes
(`081M1VDMK7R087G0R0038GVG66`); no `readelf`.
First-boot names the bao site and path
(`081M1VGV2N6087G0R001ZHWZDS`); `/dev/tpmrm0`
does not pick `on-host`.
Argv names both flags
(`081M1VJGMMP087G0R002JRZ458`); a bare tpmrm0
argv is not `on-host`.
Conf/argv carrier
(`081M1VM7S47087G0R001VQ1QK5`) emits both
`ZETA_BAO_LOAD_SITE` and `ZETA_BAO_PATH`, or
neither; does not expand `ZetaFirstbootRole`;
does not edit `zeta-first-boot.sh`.
Conf consume
(`081M1VNS22M087G0R000P9A1XH`) parses those
assignments back into a named ask; a bare
tpmrm0 path is still not an ask; still does
not edit `zeta-first-boot.sh`.
Role conf plus named bao
(`081M1VQ6CHS087G0R0036YJAQ5`) joins those
lines onto the role conf, or leaves it
byte-identical; still does not expand
`ZetaFirstbootRole`; still does not edit
`zeta-first-boot.sh`.
ESP write
(`081M1VRW8ZY087G0R000XDM4BG`) puts those
lines on `/zeta-firstboot.conf` via
`firstboot-bao-elf.ts`, not installer `fs`;
still does not edit `zeta-first-boot.sh`.
CLI flags
(`081M1VTE7TZ087G0R002XSHAYZ`) parse
`--bao-load-site` and `--bao-path` in
`file-backed.ts`; one without the other
refuses; does not fill `NIXOS_HOST_BAO`;
still does not edit `zeta-first-boot.sh`.
QEMU harness
(`081M1VW190B087G0R003D4GWJF`) forwards
those same flags from `prepare-boot-image.ts`;
still does not edit `zeta-first-boot.sh`.
First-boot env consume
(`081M1VXAQEJ087G0R00325DJRS`) reads sourced
`ZETA_BAO_*` in `firstboot-bao-env.ts`.
Bash pickup
(`081M1VZRST2087G0R001QEJDWG`) exports both
names from `zeta-first-boot.sh` and
sed-parses them in `zeta-install.sh`; both
or neither; does not fill `NIXOS_HOST_BAO`;
does not invoke bun.
Post-6.95a bun consume
(`081M1W1NCDT087G0R002H3VG6Y`) invokes
`firstboot-bao-env.ts` after mise/bun exist;
a null ask is not a seal; still does not
invoke bun from `zeta-first-boot.sh`.
Env join
(`081M1W3BPCN087G0R001R97E45`) plans the
overlay from sourced `ZETA_BAO_*`; injected
read; tpmrm0 is still not an ask; still
does not invent an integrate decision.
Installer-iso epoch
(`081M1W4XQH4087G0R000F69WYQ`) names the
epoch; ISO current-system bao is not
option D; `/mnt` existing does not pick
the epoch.
ISO bun names epoch
(`081M1W6J9MH087G0R003VNMDDR`) exports
`ZETA_BAO_ELF_EPOCH='installer-iso'` as a
literal after 6.95a; `/mnt` is unknown,
not `installer-iso`.
Env join reads named epoch
(`081M1W8D6MF087G0R003405R3N`) from
`ZETA_BAO_ELF_EPOCH`; a named ask without
a named epoch refuses; still does not
invent an integrate decision.
ISO bun filters current-system bao
(`081M1W9VW7P087G0R0026A9J6Z`) so bun JSON
ask is null at `installer-iso` plus
`NIXOS_HOST_BAO`.
Named unseal request
(`081M1WBA6RX087G0R002450S9J`) from
`ZETA_UNSEAL_REQUEST`; `/dev/tpmrm0` is
not `pkcs11-tpm`; still does not invent
an integrate decision.
Env request joins injected capture
(`081M1WCEGYJ087G0R0039T2T39`); missing
is unmeasured, not `auto`.
Overlay env join reads unseal request
(`081M1WE7Z5S087G0R001WT3K6G`) from
`ZETA_UNSEAL_REQUEST`; capture stays
injected.
ISO bun consume reports named unseal
request (`081M1WG1RJB087G0R001ADMJNK`);
missing is unmeasured, not `auto`; does
not export a default request.
Argv/conf overlay joins read unseal
request (`081M1WHKEEQ087G0R0002B3SPG`)
from `ZETA_UNSEAL_REQUEST`; capture stays
injected; does not add the request to
ESP conf.
Named probe snapshot becomes host
capture (`081M1WK36Y1087G0R003WT976Y`);
`/dev/tpmrm0` is not `present`.
Overlay joins take named probe
(`081M1WMR8KD087G0R003HZYY14`);
null is unmeasured, not present;
`/dev/tpmrm0` is not a capture.
Env integrate takes named probe
(`081M1WP0C7B087G0R000VK9E0V`);
overlay passes the probe through.
ISO bun consume reports unmeasured
probe (`081M1WQNTZ0087G0R002Q8T8RT`);
null is unmeasured, not present.
Frost result becomes named probe
(`081M1WS6HV4087G0R001K1YWMN`);
`/dev/tpmrm0` is not `present`; a
YubiKey is not CardContact; still
does not run the live probe from
`zeta-install.sh`.
Overlay env join takes frost result
(`081M1WTR4BW087G0R0001NVXWQ`);
null frost result is unmeasured, not
present; ISO bun `probe` stays null.
glibc-host-into-musl-image is not a
module; Application.yaml stays Shamir.

## Grounding (on `origin/main`)

Shipped artifacts:

- `src/Core.TypeScript/zflash/cli.ts` <!-- STALE-REF: ../../../src/Core.TypeScript/zflash/cli.ts --> — the flashing tool (Touch ID + nonce + SSH auto-inject)
- `full-ai-cluster/usb-nixos-installer/` <!-- STALE-REF: ../../../full-ai-cluster/usb-nixos-installer/ --> — the installer ISO substrate + first-boot role-picker
- `.claude/skills/flash-cluster-iso/SKILL.md` <!-- STALE-REF: ../../../.claude/skills/flash-cluster-iso/SKILL.md --> — operator + agent-driven (expect) flashing skill

Grounding backlog:

- `081KSGS9H0008QG0R001EZKNCB` <!-- STALE-REF: ../../backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-impleme.md --> — zflash agent-mode native implementation (**closed** — `--agent` in `cli.ts`)
- Workitem `081KV1PY2H308QG0R00347547K` — `zeta flash` MCP router (**done** #8104)
- `081KSGS9H0008QG0R0011BC7T2` <!-- STALE-REF: ../../backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-r.md --> — CI cascade-6: slices 1–3 landed (#8126, #8129, #8139); scenarios 1 + 2 hard gate (scenario 2 green run 27602908527 after #8478 initrd virtio)
- `081KSGS9H0008QG0R00120EEHM` <!-- STALE-REF: ../../backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md --> — installer config bugs (hostname-not-unique, gh-auth, banner)
- `081KSGS9H0008QG0R003V23XNZ` <!-- STALE-REF: ../../backlog/P1/081KSGS9H0008QG0R003V23XNZ-iter5-wifi-credentials-injection-via-usb-esp-for-zero-typing-cluster-bringup-without-ethernet-load-bearing-for-homelab-persona-aaron-2026-05-26.md --> — iter-5 WiFi-credentials injection via USB ESP (zero-typing bringup without ethernet)
- `081KSGS9H0008QG0R002T3BJ2R` <!-- STALE-REF: ../../backlog/P1/081KSGS9H0008QG0R002T3BJ2R-iter4-ssh-key-and-hashedpassword-substrate-for-cluster-bringup-2026-05-26.md --> — iter-4 SSH-key + hashedPassword substrate (shared seam with encryption)

## Composes with

- `cluster-encryption-credential-substrate` trajectory — shares the 081KSGS9H0008QG0R002T3BJ2R / 081KSKBP80008QG0R003AX2A69 creds-on-USB seam
- 081KSGS9H0008QG0R003X5Y2A5 (installer WiFi reproducibility / nixos.org timeouts / cachix mirror) + 081KSGS9H0008QG0R001Q2DH2H (installer nmtui WiFi rescan) — physical-hardware-tested WiFi hardening (verify on-disk; cite once row paths confirmed)

## Current Rule

The happy path is zero-typing: flash with zflash, boot, pick role, join. Every
manual step at the physical machine is debt — drive it toward the 081KSGS9H0008QG0R0011BC7T2 CI
full-install path so a human never has to babysit a USB stick for a routine
bringup.

## Current Next Action

**Software (closed, do not re-litigate):** non-interactive 6.95-picker
(`--defer-all` #14852) and restore non-zero write (#15912, dispatch
33126215487). Sibling dispatch steps already `if: always()`.
**Next software:** ~~in-guest wrong-passphrase phase 2b + passphrase~~ **BOTH LANDED 2026-08-29 (`133a95b5de`) AND BOTH RAN on dispatch [33462406161](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33462406161) (2026-09-01) — do not rebuild, do not re-dispatch restore.** ~~kind `--cni cilium` so the included proof creates its own cluster~~ **THAT CELL CLOSED 2026-09-03** (kindnetd Healthy / kind+Cilium Healthy / k3d Degraded; weaviate asserted on kind+Cilium; #16419 squash `18367ea19`). ~~k3d applying vendored Gateway API CRDs~~ **MEASURED live-k3d smoke [33739778288](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33739778288) job `100600115401`: CRDs present, cert-manager Healthy 0 restarts, trust-manager cert issued.** ~~k3d metal `control-plane` hosts + SAN + nodes Ready~~ **#16508 squash `183322698`**. ~~hostAliases to ClusterIP~~ **MEASURED live-k3d [33781233753](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33781233753) job `100736414774`: server Running, `bundle.crt` present, busybox hostNetwork `TCP kube-dns 10.43.0.10:53 FAIL`.** ~~TCP pod IP distinguisher~~ **MEASURED live-k3d [33800779819](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33800779819) job `100800757935`: hostNetwork ClusterIP FAIL + overlay pod IP OPEN; pod-network both OPEN; Cilium backends active; klipper `svclb-cilium-ingress` Running.** ~~metal `--disable=servicelb` on k3d~~ **MEASURED live-k3d [33804533591](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33804533591) job `100812620217`: `app=svclb` empty, hostNetwork ClusterIP still FAIL, agent DNS i/o timeout with `bundle.crt` present.** ~~cgroupns / non-verbose Socket LB status~~ **MEASURED live-k3d [33809535624](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33809535624) job `100828865623`: `CgroupnsMode=private`, `KubeProxyReplacement` True, Host BPF, Cluster health endpoints 0/1, ClusterIP still FAIL.** ~~`cilium-dbg config get` socket-LB knobs~~ **MEASURED live-k3d [33814040666](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33814040666) job `100842821668`: those names return Configuration does not exist; `enable-host-legacy-routing=false`.** ~~ConfigMap `cilium-config` socket-LB keys~~ **MEASURED live-k3d [33817974673](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33817974673) job `100854900709`: `bpf-lb-sock=false` `bpf-lb-sock-hostns-only=true` `bpf-lb-external-clusterip=false`; verbose Socket LB Enabled / Hostns-only; hostNetwork ClusterIP still FAIL.** ~~host-ns ClusterIP `ip route get`~~ **MEASURED live-k3d [33836543665](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/33836543665) job `100910668481` (merge of #16533):** `10.43.0.10 via 172.18.0.1 dev eth0` — Docker bridge, not `cilium_host`. k3d-in-docker class. Do not invent helm. Do not re-lift included. Metal confirmation is `ip route get 10.43.0.10` after USB boot. ~~metal first-boot Cilium HelmChart still 1.16.5 EOL~~ **FIRST-BOOT PIN MATCHES APPLICATION 1.20.1 (2026-09-04)** — no live cluster, skip-minor hop allowed on fresh install; Cilium still forbids skip-minor in-place. Redis already Valkey (#16292). Hindsight already `pgvector/pgvector:pg17-trixie`. hat-system wait Job rewritten onto `registry.k8s.io/kubectl:v1.32.3` (shell-free; not a tag swap). Remaining `081M1F1K5N5` outside deferred gitlab: none. seaweedfs 4.45 CVE already merged (#16279). **Next software:** named `zflash` of the already-plugged stick. S6 first-login + WiFi + Touch ID/TPM stay human-gated. Do not re-dispatch restore. `--serve-tree` packed 411676B then client-side apply died on the 262144 last-applied annotation (live-k3d + live-kind-included 33821540802); delivery is now server-side apply. **MEASURED 33822942615:** ArgoCD then failed to checkout the GitHub SHA from the in-cluster dumb-HTTP repo (served commit is a new hash; 40-hex `targetRevision` is an object fetch). Catalog asks for `main`. **MEASURED 33824995558:** `main` closed that; new hole is `failed to list refs: unexpected EOF` because busybox httpd 200s `?service=git-upload-pack`. Not missing helm/ACE chart deps (zero children means no helm pulls). Smart-HTTP shim (advertisement + NAK + pack) because Argo CD LsRemote is go-git (dumb HTTP = unexpected EOF; 404 = repo not found). Fail-fast the ComparisonError. A GitHub SHA passthrough would return the committed metal tree — refuse that the same way GHCR is not a docker pull-through. Dumb HTTP against GitHub Pages already exists (`gitpull.html`); putting that reader in this pod is later, and must not serve the un-overlaid SHA. `--disable=servicelb` stays (metal klipper off, Cilium owns L4). The kind-included hang on this PR is mimir Synced/Degraded (Otto `081M1FG1RCW`) + agent-memory Progressing; health wait now fail-fasts on Degraded so it does not burn 2400s. Do **not** land hostAliases to ClusterIP. Do **not** re-lift k3d `--scope included`. Do **not** dispatch another Cilium included probe. Do **not** invent Cilium helm values. Otto takes mimir (`081M1FG1RCW`). CI on k3d is a USB/metal first-boot rehearsal, not a second product: `--serve-tree dev` is now wired on k3d live as well as kind included (runner CPU/memory only; PVC sizes and datapath stay the shipped metal surface). Three existing ladders, no fourth: resource rungs, storage profiles, runner disk envelope. Superseded text kept below for lineage:
**Superseded:** in-guest wrong-passphrase phase 2b + passphrase
hexagonal port (`passphrase-source.ts`) so a human can run the metal
tty1 runbook without the software door being untested. Dispatch restore
on idle `main` after that lands. **Post-login:**
[FIRST-SESSION.md](./FIRST-SESSION.md) slices 1–4 landed; S6 paper/mock
accepted (physical boot still human-gated). Slice 5 CODEOWNERS when teams
are confirmed.

- ESP hostname + credential injection now has QEMU-testable planning/serial-marker assertions; WiFi radio association remains physical-gated, but a future ESP WiFi blob can reuse the same write-plan + serial-marker pattern.

## Society validation (not PR-centric)

Per `docs/BUILD-GATES.md` <!-- STALE-REF: ../../BUILD-GATES.md -->: local `preflight` before push; peer replay; CI is signal. Tiers S0–S6 in FIRST-SESSION.md. Full QEMU cascade = society cadence, not per-edit tax.
