---
id: 081KZHJPJCF08QG0R0024BFHKS
type: bug
state: backlog
priority: P2
slug: wifi-esp-acceptance-phase-1-consistently-fails-iter-5-wifi-c
title: "wifi-ESP acceptance phase-1 consistently fails: iter-5-wifi credential-injection markers missing (dispatch-only build-iso redder)"
created: 2026-08-08T20:58:12.751Z
depends_on: []
composes_with: []
---

# wifi-ESP acceptance phase-1 consistently fails: iter-5-wifi credential-injection markers missing (dispatch-only build-iso redder)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZHJPJCF08QG0R0024BFHKS-*.md` glob. -->

## VALIDATION RESULT (2026-08-09, Otto shadow*) — NOT closed; blocked on bug A, correcting my own claim below

**Correcting the "COMPLETE FIX LANDED" claim I wrote earlier the same day: it was premature.**
Validation run **31323533516** (which carries every fix below, plus bug A's retry #10190) shows:

- The **read-side fix WORKS** — `[iter-5.2] found injected hostname` and `[iter-5-wifi] found
  zeta-wifi-credentials.json on boot USB ESP` both land. That part of the diagnosis held.
- **The contract still FAILS.** The last two markers (`wrote NetworkManager profile`,
  `association deferred`) never emit, because step 6.95c prints
  `[iter-5-wifi] invalid zeta-wifi-credentials.json; skipping profile write`.
- **That is NOT a creds bug — it is downstream of bug A** (`081KZETP6AT`). In that run
  `install.sh` failed all 3 retry attempts on a *deterministic* NixOS/mise dynamic-linker
  failure, so `bun` was never installed, so the `wifi-esp-to-nm.ts` converter could not RUN —
  and the code reported that as "invalid creds". **One root cause, not two.**

So this workitem is **blocked on 081KZETP6AT**, not independently completable: the wifi-ESP
acceptance contract cannot pass until the first-boot toolchain install succeeds. (Handed to
Dejan for the nix-ld vs nix-native-toolchain decision, 2026-08-09.)

**Diagnosability fix shipped from this finding:** the installer now distinguishes *converter
could not execute* (`converter unavailable (bun/runtime missing — install.sh incomplete)`) from
*creds JSON is malformed*, and prints the converter's stderr instead of deleting it unread —
the conflation cost a full diagnosis cycle.

**To close:** bug A fixed first, THEN a wifi-ESP dispatch with all three markers + contract ok,
then one clean hardware boot.

---

## (superseded — premature) COMPLETE FIX LANDED (2026-08-09, Otto shadow*) — pending CI + hardware validation

The full chain is fixed; awaiting a few green CI dispatches + Aaron's hardware test before closing.
Note the ROOT CAUSE section below (inline-`content` writes) was a WRONG intermediate hypothesis —
the #10180 verification DISPROVED it (the bake writes all files correctly). The real cause was
**read-side**: the installer unmounted the boot USB ESP before the iter-5 probes. Superseded by
this section; kept below for the diagnosis trail.

The fixes, in order:

1. **#10172** — persist the phase-1 serial on wifi-contract failure (it wasn't written, so the
   failure was a black box). Diagnosability unblocked.
2. **#10180** — post-bake ESP-write verification (`mdir` read-back, fail loud). It PASSED →
   proved the bake writes all files → redirected the diagnosis to the read side. Stays as a guardrail.
3. **#10184** — the real root cause: iter-4.2 mounts the ESP, finds the pubkey, unmounts it; the
   iter-5.2 (hostname) + iter-5-wifi probes then read an empty `$PROBE_MOUNT`. Fix: **re-mount**
   the ESP for the iter-5 probes. Files now found (`[iter-5.2] found injected hostname`,
   `[iter-5-wifi] found zeta-wifi-credentials.json`). Also fixed the test-iter-54 regression #10183
   introduced.
4. **#10185** — guarded the `ZETA_HOME: unbound variable` crash the re-mount exposed in the
   previously-dead wifi branch (degrades to fallback instead of a first-boot hard-fail).
5. **#10186 (the complete fix)** — the NM-profile write needs the repo + mise that only exist after
   the step-6.95a bootstrap, but the wifi step ran at 6.6. Split it: **6.6 stages** the creds to
   `/mnt/boot`; **new step 6.95c (iter-5.5.1)** — after the bootstrap — runs the helper and writes
   the NetworkManager profile, emitting `wrote NetworkManager profile` + `association deferred`. All
   three acceptance-contract markers now land in the phase-1 serial.

**Two permanent guardrails from this arc:** serial-persistence on wifi-contract failure (#10172),
and post-bake ESP-write verification (#10180).

**Validation status:** local checks pass (bash -n, test-iter-54 29/29, marker ordering). This is
first-boot code that is NOT testable locally, so the real proof is **CI `build-ai-cluster-iso`
dispatch (wifi-ESP scenario) + Aaron's hardware** (owner). A given run may still trip the SEPARATE
install.sh intermittent (081KZETP6AT, instrumentation armed) — that is bug A, not this.

**To close:** a few green wifi-ESP dispatches (all three markers + contract ok) + one clean
hardware boot. Then move to `done`.

---

## (superseded — diagnosis trail) ROOT CAUSE hypothesis (2026-08-08) — inline-`content` ESP writes silently don't land

Two-step breakthrough: (1) fixed the diagnosability blocker (#10172 — the wifi-contract-failure
path didn't persist the serial artifact, so the failure was a black box). (2) With the serial now
captured (run 31283198561, artifact `qemu-wifi-esp-serial-log`), the pattern is decisive.

The installer probes the boot USB ESP and finds SOME baked files but not others — split cleanly by
HOW the bake wrote them (`src/Core.TypeScript/zflash/lib.ts` `planFileBackedZflashImage`):

| ESP file | write mode (lib.ts) | serial result |
|---|---|---|
| `zeta-authorized-keys.pub` | `sourcePath` (l.356) | **FOUND** (serial l.136) ✓ |
| `zeta-hostname.txt` | inline `content` (l.367) | **"no zeta-hostname.txt on USB ESP"** (l.171) ✗ |
| `zeta-wifi-credentials.json` | inline `content` (l.384) | **"no … skipping wifi injection"** (l.181) ✗ |

So the bug is **NOT wifi-specific and NOT the installer**: **every inline-`content` ESP write
silently fails to land on the ESP, while `sourcePath` writes succeed.** Hostname injection
(iter-5.2) is broken the same way — this workitem's title undersells it; it's the whole
inline-content ESP-write path.

**Where:** the divergence between `content` and `sourcePath` writes is in the EXECUTION, not the
plan — `file-backed.ts` l.272 flags `needsInlineStaging` when any write has `content`, then
`planFileBackedZflashImageExecution` stages content to temp files and the executor mcopies them.
`sourcePath` writes mcopy directly. The staged-content mcopy is the suspect.

**Why the unit tests miss it:** `file-backed.test.ts` / `lib.test.ts` (69 pass) test the PLAN with a
MOCK executor — they never exercise the real `createNodeFileBackedZflashImageExecutor` mcopy of
inline-staged content. So the plan is correct; the real staged-content execution is where it breaks.
A test gap: no end-to-end assertion that a `content` ESP write actually appears in the mounted ESP.

**The bake does NOT hard-fail** — it reports success (install proceeds, other markers appear), so
this is a silent-drop, exactly the class #9937 was about, one layer down.

## Next steps (revised — now actionable)

1. Fix the inline-staged-content mcopy in the real executor (`planFileBackedZflashImageExecution` +
   `executeFileBackedZflashImageExecutionPlan`, `src/Core.TypeScript/zflash/file-backed.ts` +
   `lib.ts`). Needs a local bake repro (qemu-img + mcopy + an ISO) to pin the exact mcopy/staging
   line, OR careful read of the staging→mcopy path.
2. Add an end-to-end test that a `content` ESP write (hostname or wifi) actually lands in the mounted
   ESP (closes the mock-executor gap that hid this).
3. Owner: USB/zflash trajectory. This now also covers hostname injection, not just wifi.

Evidence: run 31283198561 serial `qemu-wifi-esp-serial.log` (l.136 pubkey found, l.171 hostname
absent, l.181 wifi absent). Diagnosability fix that made this visible: #10172.

## Summary (Otto shadow*, 2026-08-08)

The `081KSGS9H0008QG0R003V23XNZ wifi ESP acceptance` scenario in `build-ai-cluster-iso`
(**workflow_dispatch ONLY** — not run on push/PR) fails its phase-1 contract, apparently
CONSISTENTLY, independent of the separate install.sh intermittent (081KZETP6AT).

## Symptom

```
Exit code: 1
Reason: wifi ESP phase-1 contract failed — wifi ESP install markers missing:
  [iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP;
  [iter-5-wifi] wrote NetworkManager profile to installed system;
  [iter-5-wifi] association deferred (physical-gated; no radio claim)
```

The expected `[iter-5-wifi]` serial markers are never emitted — starting with the very first
one ("found zeta-wifi-credentials.json on boot USB ESP").

## Why it's a distinct bug from 081KZETP6AT

Evidence run **31276420713**: `install.sh` **SUCCEEDED**, scenario-1 and scenario-2 **passed**
(first-session + self-register markers present), yet the wifi-ESP phase-1 contract still failed
with the markers-missing reason. So it is NOT a downstream effect of the install.sh failure or a
provisioning timeout — it is the wifi-ESP-credentials-injection path itself.

Data points (dispatch runs): 31270499976 (install.sh failed + wifi-ESP failed) and 31276420713
(install.sh succeeded + wifi-ESP failed) → wifi-ESP fails in both = looks consistent, not
intermittent. Push/PR build-iso stays green because this scenario is dispatch-only.

## Diagnosis leads

The first missing marker is "found zeta-wifi-credentials.json on boot USB ESP", so the two
candidate root causes are:

1. The QEMU harness (`QEMU_WIFI_ESP_PHASE1=1` path in
   `src/Core.TypeScript/ci/qemu-full-install-test.ts` / `prepare-boot-image.ts`) is not baking
   `zeta-wifi-credentials.json` onto the boot-image ESP that the VM boots from; or
2. The installer (`zeta-install.sh` iter-5-wifi step) is not reading/detecting the creds JSON on
   the ESP, so it never emits the marker or writes the NetworkManager profile.

Next: inspect the phase-1 serial log artifact (uploaded as "081KSGS9H0008QG0R003V23XNZ wifi ESP
serial log" on run 31276420713) to see how far the wifi-ESP step gets, and diff the harness's
ESP-bake step against what the installer expects to find.

## Scope / priority

P2 — does NOT gate normal CI (dispatch-only), and physical WiFi association is already
metal-gated in the USB trajectory. But it means the wifi-ESP zero-typing bringup
(081KSGS9H0008QG0R003V23XNZ, "WiFi-credentials injection via USB ESP") is not actually passing
its own acceptance. Owner: USB/zflash trajectory (`docs/trajectories/usb-zflash-installer/`).

## Cross-refs

- Feature backlog: `081KSGS9H0008QG0R003V23XNZ` (iter-5 WiFi-credentials injection via USB ESP).
- Sibling / disentangled-from: `081KZETP6AT08QG0R003MG1VYN` (install.sh first-boot intermittent).
- Evidence run: 31276420713 (job `build-iso`, wifi-ESP scenario).
