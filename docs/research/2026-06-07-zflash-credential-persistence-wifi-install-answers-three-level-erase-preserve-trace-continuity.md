# zflash credential persistence — WiFi + install-answers, 3-level erase/preserve, trace continuity

**Aaron, 2026-06-07** (a diagnostic + design stream on `zflash` credential saving, #7006–#7011).

## The diagnosed bug (root cause)

> "the password saving didn't work last time in either direction (outwards/down to hardware, or
> outwards/backwards to USB) … or it's not password — I don't think it's credentials saving — it should
> **also save my WiFi credentials too** … and also **save the answers to my install questions** from
> previous installs unless there are new questions or I choose to reanswer/reformat."

**Root cause for WiFi:** the credential manifest (`tools/installer/zeta-creds-manifest.ts`) + handlers
(`tools/installer/zeta-cred-handlers.ts`) only declared `gh-cli`, `claude`, `gemini`, `codex`,
`ssh-host-keys`, `ssh-operator-pubkey`. **There was no `wifi` entry at all** — so WiFi creds could never
save "in either direction": nothing captured them. Per the subsystem's own discipline (Aaron 2026-05-27:
*"declare each credential we need… adding a new credential type = manifest edit, NOT a code change"*),
the fix is a manifest + handler entry, not new flow code.

### Fixed (this PR, 081KSKBP80008QG0R003AX2A69; TS, 92/92 installer tests green)

- **`wifi`** — manifest entry `paths: ["/etc/NetworkManager/system-connections"]`, `personaScoped:false`,
  `required:false`. `WIFI_HANDLER` accepts JSON `{ssid, psk}` or `.nmconnection`/`wpa_supplicant` text;
  **requires an SSID reference**; **never echoes the PSK** in error messages (P0 redaction discipline).
- **`install-answers`** — manifest entry `paths: ["/etc/zeta/install-answers.json"]`, optional;
  `INSTALL_ANSWERS_HANDLER` (JSON object). Saved answers are **reused** so previously-answered questions
  aren't re-asked — *unless* a new question appears or the operator reanswers / chooses a fresh reformat.

## Install mode — three levels (corrected, #7004/#7009/#7010)

Aaron corrected the model twice; the final shape (F# `KeyStore.InstallMode`, 13/13 Core tests green):

| mode | meaning |
|---|---|
| **`Live`** *(default)* | non-destructive boot; host untouched (erase-by-default is too aggressive) |
| **`ErasePreserveConfig`** | erase OS/data but **preserve config/secrets first** — to **hardware first, USB fallback** if no enclave (`preserveTargets`) — before erasing; secrets survive |
| **`EraseWipeConfig`** | also erase the preserved config/secrets — fully **fresh** (the only path that destroys the keyring) |

### The erase-preserve round-trip (`erasePreserveFlow`, #7010)

```
preserve → use-before-format → format → repersist
```

Preserve config/secrets BEFORE format; **use** them during install so there's **no re-login / re-auth /
re-config**; **re-persist** them to USB/hardware AFTER format. A **saga** (each phase fenced/idempotent;
DurableSaga + discipline #6) so a crash mid-flow replays without losing or double-applying secrets.

## Governing principles (#7011) — over the whole flow

> "just always try to do the right thing at every timestep to preserve continuity — the span/trace id
> from the USB event trigger — and don't recompute secrets/config that's already been computed."

1. **Trace continuity.** The span/trace id is rooted at the **USB event trigger** and propagates through
   every timestep of the flow (one distributed trace across preserve→use→format→repersist). Continuity
   of identity/trace is the invariant; every event on the stream carries the trigger's trace id.
2. **Don't recompute.** Secrets/config already computed are **reused, not recomputed** — idempotency
   (#6) + content-addressing (CAS): compute-once, address-by-content, reuse on replay. This is exactly
   why the erase-preserve flow *preserves and reuses* rather than re-deriving (no re-login/reauth).

Both are already load-bearing disciplines (idempotency #6, DST §7, content-addressing); this names them
as the explicit governing rule for the zflash install flow.

## Boot sequence: heartbeat to git → k8s → ArgoCD → charts (#7012/#7013)

> "when USB boots it should start heartbeating to git … after booting k8s and argocd and the charts."

The booted USB node's startup sequence, each step an event on the one stream (#6997/#7000):

```
OsInstalled → first-heartbeat-to-git → k8s up → ArgoCD up → charts reconciled
```

1. **Heartbeat to git** — the node joins the fleet via the heartbeat-via-commit pattern (`CLAUDE.md`:
   heartbeat = a commit to `origin/main`, the externalized idle counter + AgencySignature trailer). git
   is the **db control plane** (#6994), so boot → emit heartbeat commits = register liveness on the same
   shared event stream every other node folds.
2. **k8s → ArgoCD → charts** — bring up Kubernetes, then ArgoCD, then the charts. This is **GitOps**:
   ArgoCD's reconcile loop pulls desired state from **git** — the same control plane (#6994, "reconcile =
   fold git → desired state"). The charts are declarative state in git; ArgoCD is the reconciler. (Cf.
   #6994: CRDT + single-repo DUs *can* replace operators, but the concrete boot stack here is real
   k8s+ArgoCD reconciling from git.)
- **Continuity (#7011):** every step carries the trace id rooted at the USB trigger; one trace across
  boot → heartbeat → k8s → ArgoCD → charts.
- **Offline/airgapped:** heartbeats + chart state land in **local git**, **ferried** later (USB-ferry
  vision below) — same stream, deferred transport.

## Future / deferred (Aaron #7008/#7011) — captured, not built

- **Always a reformat, retention is the axis** — the 3-level mode above is the realization.
- **USB ferries for airgapped update (offline self-contained):** eventually the USB is **fully
  self-contained — no internet needed to start a cluster**, and an **airgapped PC is updated purely via
  USB ferries** (sneakernet transport of substrate DU events; ties the "ferries preserve memory" theme +
  `FerryThrottler`). The install/update stream is the same DBSP Z-set stream (#6997/#7000), carried by
  USB instead of network.
- **Incremental updates / self-healing on the USB** — explicitly **not now** (deferred); the current
  model is reformat-with-retention, not in-place incremental.

## Honest scope (peel)

- **Built + tested:** the `wifi` + `install-answers` manifest/handler entries (the diagnosed WiFi gap),
  the 3-level `InstallMode`, `preserveTargets` (hardware-first/USB-fallback), `erasePreserveFlow` phase
  order. TS 92/92, F# Core 13/13, 0-warning.
- **NOT built:** the actual capture/restore *wiring* of WiFi/install-answers through the live install
  (the manifest declares them; the persist/restore code iterates the manifest — verify it picks the new
  entries up end-to-end in the QEMU harness before claiming the round-trip works). Trace-id propagation
  and the saga fencing are *named/encoded as order*, not yet threaded through the live zflash flow.
  Airgapped-ferry + offline-self-contained + incremental-healing are future. The original "didn't save in
  either direction" runtime failure for non-WiFi creds still needs the failing run's logs to confirm
  whether the WiFi gap was the whole story or there's a second write-path bug.

## Anchors (Beacon)

- NetworkManager `.nmconnection` / `wpa_supplicant` (WiFi cred formats); GNOME Keyring / macOS Keychain.
- Distributed tracing — W3C Trace Context, OpenTelemetry span/trace ids (the continuity principle).
- Idempotency / content-addressing — discipline #6, CAS/Merkle/BLAKE3 (don't-recompute).
- Sagas — Garcia-Molina & Salem 1987 (`DurableSaga`; the fenced preserve→format→repersist flow).
- Sneakernet / air-gapped update transport (USB ferries).
- Internal: 081KSKBP80008QG0R003AX2A69 (zflash cred substrate), 081KSNY2Z0008QG0R0008PN7RQ (QEMU 5-scenario matrix incl. reformat-with-retention
  / reformat-from-scratch), #6996/#6998 (db + key noun-classes, one stream), #7000 (OS/USB/login events).
