# Get a working machine — readiness, measured: the YubiHSM is attached, R8 is one word, and the live cluster tree carries 13 known failures

> **Register: measured where an exit code is quoted, `unverified` where it says so.**
> Measured at `01bd090ed3` (worktree cut from `origin/main`, 2026-08-26T07:40Z), on the
> maintainer's darwin-arm64 host — the same host the YubiHSM is plugged into.
> Every exit code below was read directly (`echo $?` on its own line), never through a pipe.
> Aaron's ask: *"get a working machine soon."* This is what stands between here and that.

---

## 0. Bottom line

Three sentences, and the third is the one that reorders the plan:

1. **The k8s/helm track is not vacuous.** It was, and PR #10647 fixed it. Two independent
   mutation campaigns — one by me, one by a second agent that never saw my results —
   confirm the validators go red for the right reasons. The remaining problem is **scope
   and enforcement**, not honesty.
2. **The hardware track has more shipped code than its own docs claim, and less hardware
   contact than its test counts imply.** ~1,600 tests pass across it. **None of them touch
   the attached YubiHSM, a real USB stick, or real metal.**
3. **The missing SmartCard-HSM is not on the critical path.** The YubiHSM Aaron already has
   is attached, reachable, and offers secp256k1 today. What blocks a working machine is one
   unanswered word, one boot-time unit that has never succeeded, and 13 recorded Application
   failures on the tree the hardware actually runs.

**Nothing in the top five items of §6 waits on hardware that has not arrived.**

---

## 1. What was measured, with exit codes

The table is the evidence base. Everything downstream cites it.

| # | command | exit | result |
|---|---|---|---|
| M1 | `bun tools/setup/persona-keys/frost-hardware-probe.ts` | `0` | **YubiHSM 2 ATTACHED**; `yubihsm_pkcs11.dylib` present; honourable tier `hardware-pkcs11`; TPM check **DID NOT RUN** (darwin) |
| M2 | `bun infra/k8s/tests/ratchet-app-failures.ts` | `0` | **339 passed, 13 failed** — exactly at the recorded ceiling |
| M3 | ratchet, baseline mutated `13`→`14` | `1` | `IMPROVEMENT NOT RECORDED: 13 failures, ceiling is still 14 (-1)` |
| M4 | ratchet with deps absent | `2` | `MEASUREMENT NOT TRUSTED … an empty or unparseable run is NOT zero failures` |
| M5 | `bun infra/k8s/tests/validate-applications.ts --offline --apps-dir full-ai-cluster/k8s/applications` | `1` | 229 passed, 14 failed, each failure named |
| M6 | `bun src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts` | `0` | **blocking+derived = 16** (was **9** on 2026-08-17) |
| M7 | `bun src/Core.TypeScript/cluster/single-node-readiness.ts` | `0` | `no blockers` — but only because the collision is *acknowledged* in the ledger |
| M8 | `bun test src/Core.TypeScript/privilege/` | `0` | 40 pass / 0 fail |
| M9 | `bun test tools/setup/touchid-sudo-config.test.ts` | `0` | 35 pass / 0 fail |
| M10 | `bash tools/setup/hsm/dkek-ceremony-preflight.sh` | `1` | `REFUSE` × 3 named reasons — fail-closed verified on a live host |
| M11 | `bash -n full-ai-cluster/usb-nixos-installer/zeta-install.sh` | `0` | syntax clean; **192 `sudo` call sites**; `set -euo pipefail` at `:43` |
| M12 | process-substitution isolation demo (§4.3) | `0` | producer exits `7`, loop body runs **0** times, script still exits `0` |

**M3 and M4 together are the strongest single result in this audit.** A check with three
distinguishable states — *at ceiling* / *wrong count, direction named* / *could not measure,
refusing to report* — is the opposite of the vacuity class. M4 fired on both my run and the
second agent's, independently and both by accident. A validator that refuses to manufacture a
zero from a broken run is the property this repo keeps saying it wants; here it is, working.

---

## 2. Hardware ground truth (measured today, not cited)

```
YubiHSM 2      ATTACHED   firmware 2.4.1, serial 39160506
mechanisms     ecdsa-sha256, eck256 (secp256k1), ed25519   [unauthenticated get-device-info]
yubihsm-connect RUNNING   pid 11484
SmartCard-HSM  ABSENT     (ordered, not received)
TPM 2.0        NOT ASKED  darwin has no Linux TPM interface — "not asked", not "no TPM"
Secure Enclave PRESENT    and no seal tier can reach it (P-256 only, no AES wrap primitive)
```

Three consequences, and they settle the procurement question:

- **secp256k1 is already available** on the device in hand. The SmartCard-HSM's unconfirmed
  secp256k1 support is **not a blocker for anything**, because —
- **No FROST-capable mechanism exists on the YubiHSM, and none is orderable.** Every FROST
  module in the repo imports `@noble/curves/ed25519.js`; there is no k256 threshold code at
  all. The absence is *structural*: a FROST partial is an extractable affine function of the
  secret, so a general-purpose PKCS#11 mechanism that emitted one would be a key-extraction
  oracle. The ordered device will not change this.
- **Two device facts contradict the trajectory RESUME written yesterday**, both favourably
  and both unrecorded: the connector is now running (RESUME says it is not) and the YubiKey
  now reports a serial (RESUME says none). *Doc staleness in the favourable direction is the
  dangerous direction* — neither the RESUME nor the 2026-08-21 design ledger is currently a
  safe basis for a go/no-go.

### What one YubiHSM can and cannot do

| capability | one YubiHSM | needs a second device |
|---|---|---|
| L1 at-rest FROST share wrapping (`hardware-pkcs11`) | **yes, today** | — |
| single-key secp256k1 / Ed25519 signing | **yes, today** | — |
| 1-of-1 custody | **yes — roster checker says SOUND** | — |
| YubiHSM-backed NixOS SSH-CA | **yes** — blocked on authorization, not hardware | — |
| domain partitioning (16 domains) | **yes** | — |
| 2-of-3 with all shares on the one device | **refused, correctly** — roster emits 2 ERRORS: "device holds 3 positions… the actual cost of a seizure is 1" | yes |
| device backup / wrap-key export | no | **yes** |
| L2 use-without-extract (FROST partial on-chip) | **no — and no orderable token provides it** | neither |

The roster checker refusing multi-share-on-one-device is not an obstacle; it is the tool
being right. A 2-of-3 whose three shares share a seizure boundary is a 1-of-1 wearing a
costume.

---

## 3. Track A — hardware / USB / HSM

### 3.1 The single sharpest blocker: R8 is one word

`docs/design/2026-08-21-credential-binding-tpm-seal-or-usb-iserial-the-r8-decision-brief.md`
is a 386-line brief that **deliberately decides nothing** and ends on one question:

> **Should the credentials belong to the node, or to the stick?**
> `node` → bind `tpmSeal`. `stick` → bind `usbISerial`. `both` → §0.2, a larger piece of work.

It **recommends `node`/`tpmSeal`** and says plainly that a recommendation is not a decision.
Verified still unresolved five days on:

| claim | status | evidence |
|---|---|---|
| no decision doc exists | **confirmed** | only the 2026-05-29 biometric-sudo ADR under `docs/DECISIONS/` |
| default is still the factor the brief's own root-cause calls broken | **confirmed** | `zeta-install.sh:3392,3399,3424,3428,3431` — every failure path "staying `--usb-uuid`" |
| `tpmSeal` unreachable from any CLI | **confirmed** | `installer-binding-cli.ts:58` — `Exclude<CredentialBindingFactorKind, "tpmSeal">` |
| §0.2 XOR defect intact | **confirmed** | asking for **two** binding factors silently yields the **weakest one** |

And §0.1 stands, which is the one that should worry us most: **the shipped iSerial path is
not stick-bound** — it reads a recorded copy from `/etc/zeta/usb-iserial` on the installed
root — **while `credential-binding-model.test.ts:68` pins the opposite claim.** A passing
test aimed at the wrong layer. That is the vacuity class in its most expensive form: not a
missing check, but a green one asserting something false.

**One word from Aaron unblocks everything in the brief's §4, mechanically.**

### 3.2 Boot-time credential restore has never once succeeded

`full-ai-cluster/nixos/modules/zeta-creds-restore.nix`. Three fix layers landed in eight days
— `a6c8eaa011`, `b034ca026d`, and HEAD's `9acd60a075` ("failed chdir before ExecStart") — and
the latest is **explicitly unverified**; its work-item is `state: backlog` and the commit says
"To dispatch + verify next."

This is R11 — the problem Aaron actually reported *("this is the 3rd time i booted")*. It is
the difference between a machine that remembers itself and one that does not.

### 3.3 The two standing constraints, honestly graded

**"Nothing operator-run, only operator-approved via biometric" — satisfied on the ceremony
surface, absent on the HSM and node surfaces.**

Wired and tested (`requireBiometric` gating each sensitive step, agent executing): CA creation
and cert issue, FROST CA keygen, Shamir custody, onboarding, teardown, rotation, cluster
rotation, publish, setup-machine. The honest-register work here is genuinely good — it reports
`factor: "unattributed"` rather than claiming a fingerprint it cannot observe, because on a
stock macOS sudo stack a fingerprint, a smart-card PIN and a typed password are
indistinguishable through `sudo`'s exit status. `claimsBiometric()` is correspondingly false
there. **A caller whose argument needs the biometric specifically must gate on
`claimsBiometric()`, not on `ok`.**

Three gaps:
1. **No biometric gate on the HSM share path** — `frost-share-adapter.ts`,
   `frost-partial-signer.ts`, `frost-token-roster.ts` contain no `requireBiometric`.
2. **Windows Hello is an honest stub** — fail-closed, WinRT wiring point named.
3. **The node path is passphrase-gated, not biometric** — `zeta-creds-restore.nix:341` uses
   `systemd-ask-password` on tty1.

And a **live host defect**: `bun tools/setup/touchid-sudo.ts --verify` reports
**FRAGILE (RED)** — Touch ID works only because `pam_tid.so` was added directly to
`/etc/pam.d/sudo`, which macOS **replaces on OS update**, silently reverting to
password-only. `sudo_local` is absent. `pam_reattach` is declared and not installed, so Touch
ID cannot prompt inside tmux. **The durable fix is written, tested, idempotent, and has not
been applied on this machine.**

**"No ad-hoc sudo" — satisfied in TypeScript, entirely unenforced in shell.**

The TS side is excellent: one resolver (absolute path, root-owned, setuid, non-world-writable,
never `PATH`-resolved), fail-closed with reasons, 40/40 tests (M8), and a lint in the required
floor. But the lint **reports its own blind spot**:

```
scanned 1377 live non-test TS/JS files
UNGUARDED SURFACE (reported, never enforced): 209 `sudo` occurrences in 6 of 29 shell scripts.
Shell is out of this lint's reach AND out of eslint's — nothing here should be read as covering it.
```

**195 of those 209 are in `zeta-install.sh`** — the 3,771-line script that actually installs
the machine (M11 counts 192 in the current tree). Line 998 is
`ZETA_SUDO="${ZETA_SUDO-sudo}"`: env-overridable and `PATH`-resolved, precisely the class the
elevator work closed in TypeScript and left fully open in the thing that provisions nodes.

Mitigating, and it is the right pattern: **TS↔shell parity tests**
(`installer/{disk-preflight,force-reformat,tpm}-shell-parity.test.ts`) extract real blocks from
`zeta-install.sh` and run them under bash against the TS oracle. They cover the *decisions*,
not the 195 call sites.

### 3.4 Defects found (each is a priced opportunity, none implies bad intent)

1. **`frost-signer.ts` produces a signature that does not verify, and its only assertion is
   `expect(finalSig.length).toBe(64)`.** Reproduced against both candidate group-key
   derivations; both `false`. Three source-level causes: `:204` uses one participant's nonce
   as the group commitment; `:168` computes `c = H(message)`, binding neither `R` nor the
   group key; `:92-93` passes a scalar to `getPublicKey`, which hashes and clamps it.
   **This is the vacuity class exactly** — a length check over a broken signature. The correct
   engine is `frost-partial-signer.ts`; note it is *not* the file whose name reads like the
   signer. **Delete `frost-signer.ts` + test, or mark it `toy`.**
2. **The hardware probe reads the USB bus and never the connector.** Today's
   `Honourable tiers: hardware-pkcs11` (M1) is true only *because* the connector happens to be
   running — **the probe would print the identical line with it down.** A
   `curl 127.0.0.1:12345/connector/status` returns in milliseconds and needs no credential.
3. **`zflash/cli.ts` (1,746 L) and `setup.ts` have bare module-scope `main()`** — no
   `import.meta.main` guard, so they are untestable by import and have zero tests. This is the
   same defect `flash-usb.ts:1141-1150` documents having fixed for itself; the `--agent`
   backlog row is marked `closed` on the strength of this untested code.
4. **Stale references:** `full-ai-cluster/tools/README-flash-usb.md` documents a file that
   does not exist; `.claude/skills/flash-cluster-iso/SKILL.md` is cited and absent.

### 3.5 The largest unknown, stated plainly

**Nothing built after 2026-06-21 has ever run on metal.** Four June boots are on file. Eight
weeks of changes have landed since with QEMU as the only witness. No amount of code closes
this one.

---

## 4. Track B — k8s / helm

### 4.1 Can it go red? Yes — proven by mutation, twice, independently

PR #10647's vacuity was real and specific: a ~120-line hand-rolled YAML parser that **never
threw**, a chart check that was literally `index.yaml.includes("name: " + chart)`, and a cadence
that never ran on a PR — total run count before the fix: **one**. All three are fixed.

Two mutation campaigns, run without sight of each other:

```
audit-local-helm-charts.ts        9/9 as expected
  control rc=0 · bad-yaml rc=1 · bad-apiversion rc=1 · bad-semver rc=1 · name-mismatch rc=1
  dep-pin-drift rc=1 · duplicate-key rc=1 · missing-version rc=1
  no-charts rc=1  ("refusing to report success on an empty set")

validate-applications.ts          7/7 as expected
  --offline: control rc=0 · bad-yaml rc=1 · dup-key rc=1 · missing-syncPolicy rc=1 · empty-tree rc=1
  --render : control rc=0 · targetRevision 999.999.999 rc=1
             "no version '999.999.999' … (110 published versions; newest 21.0.4)"

ratchet-app-failures.ts           4 distinguishable states  [M2/M3/M4]
```

No `continue-on-error`, no `|| true` in a verdict step, no pipes in verdict steps across all
2,655 lines of the three big workflows; `set -euo pipefail` in every multi-command block.

**Verdict: `helm-validate.yml` = VERIFIED-CAN-GO-RED, by mutation.** The other three
(`k8s-argocd-health-test`, `k8s-lane-partition`, `build-ai-cluster-iso`) are
**VERIFIED-BY-CI-HISTORY** — a weaker grade, earned from real observed reds, not mutation.

### 4.2 The load-bearing finding: none of it is required

```
gh api repos/Lucent-Financial-Group/Zeta/rulesets/16134995
→ required_status_checks: [{"context":"gate (required)"}]
```

**`gate (required)` is the only required check on `main`.** `helm-validate`,
`k8s-argocd-health-test`, `k8s-lane-partition` and `build-ai-cluster-iso` go red honestly and
**block no merge.** What *is* required is `gate.yml`'s `lint (yaml/k8s)` job, which lost its
`continue-on-error` on 2026-08-14 and now runs yamllint + kubeconform (pinned
`-kubernetes-version 1.33.0`, added 2026-08-25) over all three manifest roots, plus the
cluster-tree consumer audit, the observability-chain audit, and both of their mutation suites.

So the honest sentence is: **the cheap structural floor blocks; the expensive semantic lanes
advise.** That is a defensible design — it is not the same as coverage.

### 4.3 A new defect, measured not read

`k8s-lane-partition.yml:288`:

```bash
done < <(bun src/Core.TypeScript/cluster/lane-partition.ts --lane "$LANE" --images)
```

Process substitution. `pipefail` does not cover it and the producer's exit status is never
checked. I confirmed the mechanism empirically rather than by reading (M12): under
`set -euo pipefail`, a producer exiting `7` leaves the loop body running **zero** times and the
script exiting **`0`**. So an empty or failed image list yields `FAILED=0`, a near-zero measured
delta, a pass against budget, and a green lane **having measured nothing**. This is undisclosed
— unlike the `build-ai-cluster-iso` aarch64 `TIMEOUT/STALLED → ::warning::` hole, which the
file discloses at `:872-877`. **File it.**

### 4.4 The structural blocker: two cluster trees that cannot coexist

`workitems/081M00QCHWA087G0R000GKKRXD` — `infra/k8s`+`infra/nixos` and
`full-ai-cluster/k8s`+`full-ai-cluster/nixos` are two independent declarations of one cluster.
Both declare `Application/argocd/zeta-root` with different source paths, both with
`prune: true` + `selfHeal: true`. Kubernetes has exactly one object at that identity, so
whichever applies last prunes the other tree's entire child graph.

`full-ai-cluster/` is settled as canonical **for k8s** (it is what `zeta-install.sh:1514`
installs; 46 Applications vs 7; it carries four empirically-earned k3s fixes `infra/` lacks;
and `infra/`'s longhorn/cockroachdb values *cannot come up on one node*). It is **not settled
for NixOS**, and that is a maintainer question with three options — (a) drop the root flake's
`nixosConfigurations`, (b) repoint them across a nixpkgs major, (c) keep the root flake as the
workstation surface. Option (a) breaks any machine already tracking `.#control-plane` from the
root flake, which is **off-repo state and not knowable from here.**

**And the coupling is getting worse, not better.** M6 measures **16** binding surfaces; the
2026-08-17 pass measured **9**. Deletion is provably safe at 0. The number has nearly doubled
in nine days, which means every week of delay makes the consolidation larger. The consumer
list was under-counted twice before (docs-only → 2 → 9 → 16), which is exactly why it is now
*derived by a tool* rather than grepped by hand.

Also: `src/Core.TypeScript/cluster/ports.ts:203` hardcodes
`applicationsPath: "full-ai-cluster/k8s/applications"`, so **`infra/k8s`'s 7 apps — the ones
`helm-validate`'s primary lane validates — never reach a live cluster in CI.** The lane
validates a tree nothing deploys; the tree that deploys is covered by a ratchet.

### 4.5 What the live tree still owes: 13 failures, enumerated

M2 reproduces the ceiling exactly. It has come down **29 → 23 → 18 → 13**, which is real
sustained progress. The remaining 13 are composed of ArgoCD-contract gaps (missing
`prune`/`selfHeal` on `cdi`, `kubevirt`, `ollama`, `vllm`; missing `CreateNamespace=true`),
a fictional pin (`oz` pinning ziti-controller `1.4.5` where the newest published is `3.2.1`),
chart repos returning HTTP 404 (`sealed-secrets`, `forgejo`), and charts that refuse to render
with the values we hand them. **Several of the contract gaps may be deliberate** under the
either/or gating convention in `root-application.yaml` — so they are not simply "to fix", they
are "to adjudicate".

### 4.6 Two honest limits, both already disclosed by the code

- **`helm template` + `kubeconform` check structure and schema, not semantics.** Reproduced:
  `statefulset.replicas: "not-a-number"` renders `replicas: 0`, and the validator reports
  `55 passed, 0 failed`, rc=0. A cluster would deploy zero pods. **Only a live cluster
  notices.**
- **Both charts this repo owns are metadata-only** — no `templates/`, no `values.yaml` — so
  `--helm` renders zero documents. The tool prints `Schema-validated manifests: 0` rather than
  a green tick, which is the correct behaviour.

### 4.7 Cancellation is the quiet denominator

| workflow | success | failure | cancelled | in-flight |
|---|---|---|---|---|
| `helm-validate` | 35 | 5 | 0 | 0 |
| `k8s-argocd-health-test` | 23 | 5 | **12 (30%)** | 0 |
| `k8s-lane-partition` | 28 | 10 | 2 | 0 |
| `build-ai-cluster-iso` | 18 | 2 | **13 (33%)** | 7 |

Two caveats that cut in opposite directions, and both matter:

- **`helm-validate`'s reds are mostly not content reds.** Of 9 failed runs checked via the
  jobs API, **7 failed at `Install toolchain via three-way-parity script`** — toolchain flake.
  Only **2** were real content failures. The lane's demonstrated content-failure rate in the
  wild is 2, not 5.
- **I nearly reported a false weak link and caught it.** My first aggregate over
  `build-ai-cluster-iso` showed "2 success, 3 cancelled, 7 null" and read as a broken lane.
  The nulls were **in-flight runs**, not failures. Corrected: 18 success / 2 failure /
  13 cancelled over 40. *A conclusion field that is empty because the run has not finished is
  not a conclusion* — and one-third cancellation still means a third of the evidence about
  `main` never arrives.

---

## 5. Capability ledger

| capability | state | evidence |
|---|---|---|
| Privilege elevator + closed-command-set system-tool | **EXISTS-TESTED**, in the required floor | M8; lint at `gate.yml:1849` |
| Touch ID approval gate, honest attribution register | **EXISTS-TESTED** | M9 |
| Installer decision logic (preflight, breaker, repair, binding model) | **EXISTS-TESTED** | 621 pass / 0 fail |
| TS↔shell parity harness | **EXISTS-TESTED** | runs real `zeta-install.sh` blocks under bash |
| zflash flasher safety rails | **EXISTS-TESTED** | 704 pass / 0 fail |
| Ed25519 FROST (keygen, DKG, ROAST, RFC 9591) | **EXISTS-TESTED** | 224 pass / 0 fail |
| DKEK ceremony preflight decision | **EXISTS-TESTED** + verified fail-closed on a live host | M10 |
| helm/k8s validators + ratchet | **EXISTS-TESTED**, mutation-proven | M2–M5 |
| Boot-time credential restore | **EXISTS-UNVERIFIED** — never succeeded once | work-item `state: backlog` |
| PKCS#11 HSM adapter (real `dlopen`, `C_Encrypt`) | **EXISTS-UNVERIFIED** — zero production callers | sole consumer uses `software-plaintext` |
| TPM seal/unseal | **EXISTS-UNVERIFIED** — no Linux TPM host has tried | — |
| zflash operator entrypoint | **EXISTS-UNTESTED** — no `import.meta.main` guard | §3.4(3) |
| `tpmSeal` binding via CLI | **ABSENT** — excluded by type | `installer-binding-cli.ts:58` |
| n-of-m HSM key management | **DESIGN-ONLY** — 9/9 acceptance criteria unchecked, `last_updated: 2026-05-31` | `docs/backlog/P2/081KRW63S…` |
| secp256k1 FROST | **ABSENT**, and not orderable | §2 |
| YubiHSM backup / wrap-key code | **ABSENT** — every hit is a document | — |
| YubiHSM SDK on cluster nodes | **ABSENT** — a flashed node has no route to an attached HSM | `081M0B5V6Z5…` |
| Metal boot since 2026-06-21 | **ABSENT** | §3.5 |

---

## 6. The plan, ordered by unblocks-most ÷ effort

### Human-gated — only Aaron can do these

| # | action | why it is first |
|---|---|---|
| **H1** | **Answer R8 with one word: `node` / `stick` / `both`.** | Unblocks the brief's entire §4 mechanically. On the brief's own analysis `node` (`tpmSeal`) wins: its unbuilt work is *decisions with known shapes*, iSerial's is *a product question with no good answer* ("must the stick be present at every boot?"). **This is the highest-leverage keystroke available.** |
| **H2** | **Confirm the surviving cluster tree** — and answer the NixOS sub-question (a)/(b)/(c). | M6 says the coupling nearly doubled in nine days. Every week of delay enlarges the migration. |
| **H3** | **Run the hardware lane once, with the device PIN.** `bun --config=bunfig.hardware-lane.toml test tools/setup/persona-keys/frost-share-adapter.hardware.test.ts` | Converts `hardware-pkcs11` from *probed-available* to *exercised*. **`--config` must precede `test`** or it is silently ignored and rc=1 means "never ran", indistinguishable from "no token". |
| **H4** | **Authorize the YubiHSM-backed SSH-CA ceremony** (`081M0DGENQM…`, P1). | Blocked on authorization + one metered probe, **not on hardware**. Highest-value thing the single device can do. |

> **Why no agent ran H3:** an authenticated PKCS#11 login with an unknown PIN risks an
> auth-key lockout counter. Aaron has **one** YubiHSM; a lockout is repeated-irreversible
> harm to the only device. Deliberately not attempted.

### Agent-doable now — no hardware, no approval

| # | action | effort |
|---|---|---|
| **A1** | **Get `zeta-creds-restore` green once.** Dispatch `build-ai-cluster-iso.yml`, confirm the `ExecStart entered` marker. HEAD's fix is unverified. | small — this is R11, the problem actually reported |
| **A2** | **Add connector-reachability to the hardware probe.** `curl 127.0.0.1:12345/connector/status`. | tiny — closes a live false-green (§3.4(2)) |
| **A3** | **Fix or delete `frost-signer.ts`.** It emits a non-verifying signature under a length-only assertion. | small — pure vacuity removal |
| **A4** | **File and fix `k8s-lane-partition.yml:288`.** Capture the producer's exit status instead of process substitution. | tiny — measured in §4.3 |
| **A5** | **Add `import.meta.main` guards to `zflash/cli.ts` and `setup.ts`**, then test them. | small — unblocks testing 1,746 untested lines |
| **A6** | **Drive M6 from 16 toward 0** — migrate stale-tree consumers one at a time. Each is independently landable and the audit proves progress. | medium, parallelisable — **start before H2 lands**, since every consumer removed is one less thing H2 must decide about |
| **A7** | **Adjudicate the 13 ratchet failures.** Split into *deliberate* (either/or gating), *dead upstream* (404 repos), and *genuinely broken* (fictional ziti pin). Lower the ceiling for each fix. | medium — this is the direct path to a clean live tree |
| **A8** | **Route `zeta-install.sh`'s 192 `sudo` sites through the tested elevator**, or extend the parity harness to cover them. Start with `ZETA_SUDO="${ZETA_SUDO-sudo}"` at `:998`. | large — but it is the single largest gap against Aaron's own stated constraint |
| **A9** | **Reconcile the storage over-provision.** Declared 967 GiB vs 763 GiB schedulable — over by 204 GiB. Syncing at current ceilings asks Longhorn for storage it will refuse to place. | medium — a bring-up failure waiting to happen |
| **A10** | **Refresh the stale docs**, both directions: the design ledger marks R4/R6/R7/R9 "NOT BUILT" (all four landed 2026-08-22/23); the sovereignty RESUME under-reports the connector and the YubiKey serial. | small — **do this early**; §2 notes neither doc is currently a safe go/no-go basis |

### One-shot, on this machine

| # | action |
|---|---|
| **L1** | `bun tools/setup/touchid-sudo.ts --apply` — makes the Touch ID gate survive OS updates (currently **FRAGILE/RED**), plus install `pam_reattach` so it prompts inside tmux. Idempotent. |

### Hardware-gated — genuinely waiting

| # | action | waiting on |
|---|---|---|
| **W1** | Device backup / wrap-key custody | a second HSM |
| **W2** | DKEK ceremony + weekly restore drill | the SmartCard-HSM (not arrived). Preflight is built and verified fail-closed (M10) |
| **W3** | Real n-of-m quorum across distinct seizure boundaries | ≥ 2 devices |
| **W4** | **Metal boot of anything built after 2026-06-21** | a provisioning window, not a part |

**W4 is the largest unknown in this document and the only item on the whole list that no
amount of code retires.**

---

## 7. What was NOT checked — stated, not glossed

- **No device was touched, no HSM session opened, no stick flashed, no machine booted, no PIN
  or secret read.** H3 was deliberately not attempted (see the note above).
- **`k8s-argocd-health-test`, `k8s-lane-partition` and `build-ai-cluster-iso` were not run**
  (no Docker/kind/nix locally). Their red-capability is code-reading plus observed CI
  failures — **VERIFIED-BY-CI-HISTORY, a weaker grade** than helm-validate's mutation proof.
- **The `full-ai-cluster/k8s` tree itself was not mutated** — only the baseline number was.
- **`validate-bootstrap.ts` was not independently mutated** (only its own 10-case suite run).
- **The remaining 40+ workflows were not audited**, nor whether `gate (required)`'s own floor
  is complete. Note commit `49a16f6acc` — *"1,162 of 1,219 tests block nothing"* — suggests
  that is the live question, and an agent was editing `gate-blocking-floor.ts` during this
  audit.
- **Whether any off-repo machine tracks `.#control-plane` from the root flake is unknowable
  from here**, and it is what makes H2's option (a) a maintainer call.
- The claim that no orderable HSM can compute a FROST partial is **the repo's spec reading
  plus a measured mechanism list**, not independently re-derived from PKCS#11 v3.1.
- `zflash/cli.ts` was read at header, arg-parsing and tail — **not all 1,746 lines**.

### Two process notes worth carrying forward

**A stale shared tree bit again.** `/Users/acehack/zeta-wt-actions` had another agent actively
writing in it during this audit — files appeared that I never touched, after my own
`git reset --hard`. That reset may have destroyed a concurrent writer's uncommitted work; if
so, the fault is mine and the mechanism is the known one
(`.claude/rules/shared-checkout-is-view-only.md` generalises past the Documents checkout).
All of this document's work moved to a private worktree the moment it was noticed, and only
this file is committed. **A clone with a writer in it is not a spare clone.**

**Two searches returned false negatives and were corrected**, both instances of patterns
already on file: `rg -il "a\|b"` treats `\|` as a literal pipe, and an unquoted `$PATHS` does
not word-split under zsh — the latter exiting rc=2, *a check that never ran printing as zero
hits*. Every finding here was re-run with explicit arguments.

---

## 8. Pointers

- `docs/design/2026-08-21-credential-binding-tpm-seal-or-usb-iserial-the-r8-decision-brief.md` — §6 is H1
- `workitems/081M00QCHWA087G0R000GKKRXD-consolidate-the-two-cluster-trees-*.md` — H2
- `infra/k8s/tests/FULL-AI-CLUSTER-FAILURE-BASELINE.md` — the 13, and why a ratchet beats both a plain step and `continue-on-error`
- `docs/history/pr-reviews/PR-10647-fix-k8s-helm-validate-could-not-go-red-*.md` — the vacuity that was fixed, and the four things it deliberately left
- `src/Core.TypeScript/privilege/elevator.ts` · `tools/setup/persona-keys/biometric.ts` — the two constraints, where they *are* honoured
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` — where they are not (A8)
- `tools/setup/hsm/dkek-ceremony-preflight.sh` — built, fail-closed, waiting on W2
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline this document is written under
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — every defect in §3.4 and §4.3 was written by someone making the system better, several by the tooling that later found them
