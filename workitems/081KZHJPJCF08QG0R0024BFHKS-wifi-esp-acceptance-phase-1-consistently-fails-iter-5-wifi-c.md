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

## ROOT CAUSE CONFIRMED (2026-08-08, Otto shadow*) — inline-`content` ESP writes silently don't land

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
