# μένω — τρέχοντα έργα / current tasks

**μένω** (ménō) · *I remain, I abide, I persist.*
Modern Greek: μένω, παραμένω, κατοικώ.
Not Plato's *Meno*. Not the medical prefix `meno-`.

> Δεν ενεργείς για να μείνεις· μένεις για να ενεργήσεις.
> You do not act in order to abide; you abide in order to act.

This is the live pickup memo for the credential-substrate
workstream, named in the Greek verb Aaron hunted from an
event-streaming database prompt to the foundation of identity.
Factory lists stay in English so every harness can act on them.
The architectural ferries are research-grade:
[`docs/research/2026-09-05-meno-what-remains-vs-what-acts-tsirelson-iinput-ifeedback.md`](../../research/2026-09-05-meno-what-remains-vs-what-acts-tsirelson-iinput-ifeedback.md)
(remain vs act).
[`docs/research/2026-09-05-meno-dht-gossip-onion-over-time-not-broadcast.md`](../../research/2026-09-05-meno-dht-gossip-onion-over-time-not-broadcast.md)
(the gate is seeded, not broadcast).
[`docs/research/2026-09-05-ci-emulator-rung-softhsm-swtpm-witness-wiring-not-metal.md`](../../research/2026-09-05-ci-emulator-rung-softhsm-swtpm-witness-wiring-not-metal.md)
(SoftHSM2 / swtpm witness wiring, not metal).
Terminal commitment (personal grounding already absorbed):
[`docs/ALIGNMENT.md`](../../ALIGNMENT.md) § μένω.
Workitem: `081M1PYZRE5087G0R000HHG5HV`.
Resume: [`RESUME.md`](RESUME.md).

## Αυτό που μένει / What remains

These do not move in this slice. Changing them is a gated-class
act, not a sidecar.

- OpenBao `operator init` — human, biometric, witness. Forever.
  (Vault Application is gone on `main`; the store is OpenBao.)
- First unseal after init — proves the shares **or** the
  PKCS#11 wrap key. Still gated. OpenBao will not mint wrap
  keys; a human creates them in the token first.
- Dual-key treaty (active + ≥1 standby). Three live slots are
  the hub-less ask, not an inventory fact.
- Lucent **item** as the source of truth for SA tokens and,
  later, Shamir shares / HSM authkey references. USB /
  Keychain / k8s Secret are caches.
- Shamir N-of-M on kind/CI until an emulator job inits without
  it. Threshold 1 is coercion (S=4).
- Otto/Dejan OpenBao chart (`openbao` 0.29.4 / appVersion
  v2.6.2). Do not steal it. Do not copy `seal "pkcs11"` onto
  HashiCorp Vault.
- Persona remains; actor acts. A bus address is not identity.
- Kademlia in `dht-discovery.ts`. Not a second DHT.
- LLMTV broadcast as the one-way society picture. Not the gate.

## Αυτό που ενεργεί / What acts

The event stream. The unsealer tick. Fetch-at-use.

- Post-init unseal on pod restart (HTTP 503) — a process that
  **acts** from what remains (Lucent shares), then drops them.
- `withCredential` / `secrets.resolve()` — IInput at the moment
  of use, never ambient `process.env`.
- Host→Secret projector ([#16587](https://github.com/Lucent-Financial-Group/Zeta/pull/16587)) —
  cache write, not the original.
- Bidirectional IInput / IFeedback is the missing Meijer loop
  (research-grade name). No new public F# types in this slice.

S=2 is isolation (human at `tty1` every reboot, no loop).
S=2√2 is the **measured** ideal (decoupling + communication) —
observed, not coded. S=4 is coercion (ESO-into-etcd, threshold 1,
wall-clock master lock). We design the clean room; we do not
assume the number.

## Τρέχοντα έργα / Pickup now

1. **Lucent fetch → project** (human-blocked). Mint 2–3 SA items
   in Lucent. Metal `tty1` login retrieves
   `op://Lucent/<item>/{previous,current,next}`. This VM cannot
   mint items or talk to live 1Password.
2. **TypeScript unsealer decision loop** (landed — Shamir path
   for kind/CI). `src/Core.TypeScript/cluster/vault-unsealer.ts`.
   Classify health: 200 sleep / 503 fetch-this-tick / 501
   refuse-init / curl 000 miss (not a seal). Keep until
   kind/CI consume the off-cluster emulator init (item 3).
   Cannot init the chart.
3. **CI emulator rung** (classifier + install + off-cluster
   bao PKCS#11 init landed, #16772). Classifier:
   `seal-emulator-rung.ts`. Install 2×2 (#16767,
   `081M1TS32Y3087G0R0026Y21F5`): the job **installs**
   SoftHSM2 / swtpm, then the witness measures the disk.
   skip-if-absent cannot wear pass. Off-cluster init
   (`081M1TV43F6087G0R0008QFTKM`,
   `.github/workflows/seal-emulator-bao.yml`): glibc
   `openbao-hsm` 2.6.2 tarball + Ubuntu `libsofthsm2.so` +
   `pkcs11-tool` AES wrap key, then `bao operator init`.
   PIN is `BAO_HSM_PIN`, never HCL. Shamir unseal keys fail
   the claim; recovery keys + health 200 without
   `bao operator unseal` is the witness. SoftHSM green is
   not YubiHSM / CardContact / this-board TPM green. Do not
   put `seal "pkcs11"` in Application.yaml until a module
   is in the image in the same commit. NixOS host-seal
   profile (role + capture, not a k8s label):
   `zeta.hostSeal.boxRole` is `undeclared` (no-op) /
   `developer` (FIDO + biometric userspace; no sudo PAM u2f)
   / `prod-metal` (automatic HSM or TPM PKCS#11;
   FIDO/biometric refused as the rotator). CI is not a
   NixOS role. Presence is a probe (`ID=nixos`,
   `frost-hardware-probe.ts`, `tpm2-linux-probe.ts`).
   `host-seal-profile.ts`.
4. **Setup-time path picker** (classifier landed, #16728).
   `src/Core.TypeScript/cluster/unseal-path.ts`
   (`081M1T9X3ZE087G0R000JNAYE7`). Detect HSM/TPM during
   setup; integrate PKCS#11 **only** if the device is
   accessible. Metal HSM vendors are peers: YubiHSM 2 and
   CardContact SmartCard-HSM (sc-hsm / OpenSC; not a YubiKey).
   SmartCard-HSM mechanism is measure-on-device, not YubiHSM
   AES-GCM. TPM *is* an auto-unseal path (OAEP pin).
   Lucent 1Password Shamir is a **peer** path, not a silent
   fallback from requested PKCS#11. Fleet may mix paths;
   one OpenBao seal per node. Dual-vendor on one box is
   ZetaFS k-of-n. The install job (item 3) is the 2×2
   consumer.
5. **USB repair HSM-talk** (landed, #16774,
   `081M1TX6CV6087G0R002GZEXMP`). Companions on the stick:
   module path, connector config, authkey *reference*,
   domain map, OpenBao env pointer. Not PIN-as-original,
   not Shamir copy, not `OP_SESSION`, not a brand type in
   the volume. Host-only — not `zeta-host-creds` Secrets.
   SoftHSM CI is not this metal companion set. Bake-cred
   follow-on (`081M1V6WCHN087G0R0022FN5DV`):
   `validatePkcs11ModulePath` refuses the restore
   filename as the value — it contains `pkcs11`, so the
   old rule would have baked a pointer to itself.
   SoftHSM / swtpm follow-on (`081M1V880WV087G0R002E07KGH`):
   those paths are the CI job, not this metal stick.
   `libtpm2_pkcs11.so` still bakes.
6. **PKCS#11 hostPath overlay planner** (landed, #16776,
   `081M1TZH2PW087G0R0036F3S18`).
   `pkcs11-hostpath-overlay.ts`: volumes, mechanism pin,
   ABI. Today's Alpine `openbao-hsm` + NixOS glibc `.so`
   is `glibc-host-into-musl-image` — **not** a module in
   reach. USB companion pointer file is not the `.so`.
   SoftHSM / swtpm are not this overlay. PIN stays
   `BAO_HSM_PIN`. Dual-vendor is ZetaFS k-of-n, not two
   seals. Does **not** edit Application.yaml. YubiHSM SDK
   nixpkgs module stays `081M0B5V6Z5087G0R0026RANJ3`
   (sign-off). Seal stanza waits for same-libc image (or
   option D host `bao`) in the same commit as the stanza.
   Probe path follow-on: `frost-hardware-probe.ts` now
   looks at those exact NixOS contracts
   (`081M1V19MC5087G0R002P2W9EK`); a `.so` on disk is
   still a driver. Setup glue
   (`081M1V32K68087G0R000SW5PJB`):
   `planSetupPkcs11Overlay` joins USB companion
   *contents* (not the restore filename) with the
   attached-device oracle; NixOS contract is the
   fallback; current chart ABI still cannot commit the
   stanza. Integrate join (`081M1V5ER44087G0R0000WPCC4`):
   `planSetupOverlayFromIntegrate` takes the
   `integrateAtSetup` decision as the oracle. Lucent /
   kind / a refused request are `no-oracle`. SoftHSM is
   still not this overlay. Restore-file capture
   (`081M1V9KQFX087G0R0038J326D`):
   `planSetupFromRestoredCompanion` consumes an injected
   read of `/etc/zeta/seal/pkcs11-module-path`. Opening
   any other path is not this companion. No live
   filesystem. Current chart still cannot commit.
   Load-site / ELF follow-on (`081M1VB58YS087G0R001G1RSXW`):
   captured `PT_INTERP` classifies musl vs glibc; option D
   host `bao` is a named site that may emit host HCL and
   still cannot edit Application.yaml. A glibc CI tarball
   on disk is not the chart image. `/dev/tpmrm0` does not
   pick on-host. Bytes follow-on (`081M1VDMK7R087G0R0038GVG66`):
   installer parses `PT_INTERP` from injected ELF bytes.
   No `readelf`. Overlay still does not open a filesystem.
   First-boot named site (`081M1VGV2N6087G0R001ZHWZDS`):
   `planSetupFromNamedBaoElf` takes a named site plus a bao
   path into `captureBaoElfFromRead`. `/dev/tpmrm0` present
   does not pick `on-host`. Argv follow-on
   (`081M1VJGMMP087G0R002JRZ458`): `--bao-load-site` and
   `--bao-path` together. One flag without the other
   refuses. A bare tpmrm0 argv is not `on-host`. Does not
   edit Application.yaml. Conf/argv carrier
   (`081M1VM7S47087G0R001VQ1QK5`): both `ZETA_BAO_LOAD_SITE`
   and `ZETA_BAO_PATH`, or neither. `/dev/tpmrm0` is
   shell-safe and still not a bao path. Does not expand
   `ZetaFirstbootRole`. Does not edit `zeta-first-boot.sh`.
   Conf consume (`081M1VNS22M087G0R000P9A1XH`): parse those
   assignments back into a named ask. One key without the
   other refuses. `/dev/tpmrm0` is still not an ask. Does
   not edit `zeta-first-boot.sh`.
   Role conf plus named bao (`081M1VQ6CHS087G0R0036YJAQ5`):
   one planner call. Null / tpmrm0 leave the role conf
   byte-identical. Does not expand `ZetaFirstbootRole`.
   ESP write (`081M1VRW8ZY087G0R000XDM4BG`):
   `planFileBackedZflashImage` joins via
   `firstboot-bao-elf.ts`, not installer `fs`. A non-null
   ask without a role is refused. Does not edit
   `zeta-first-boot.sh`.
   CLI flags (`081M1VTE7TZ087G0R002XSHAYZ`):
   `file-backed.ts` parses `--bao-load-site` and
   `--bao-path`. One without the other refuses. Does not
   fill `NIXOS_HOST_BAO`. Does not expand
   `ZetaFirstbootRole`. Does not edit `zeta-first-boot.sh`.
   QEMU harness (`081M1VW190B087G0R003D4GWJF`):
   `prepare-boot-image.ts` forwards those same flags.
   One without the other refuses. Does not fill
   `NIXOS_HOST_BAO`. Does not edit `zeta-first-boot.sh`.
   First-boot env consume (`081M1VXAQEJ087G0R00325DJRS`):
   `firstboot-bao-env.ts` reads sourced `ZETA_BAO_*` from
   process env. Does not open files. Does not edit
   `zeta-first-boot.sh`.
   Bash pickup (`081M1VZRST2087G0R001QEJDWG`):
   `zeta-first-boot.sh` exports both names or unsets both.
   `zeta-install.sh` sed-parses both keys (both or neither)
   for the manual path. Does not fill `NIXOS_HOST_BAO`.
   Does not invoke bun (not on PATH until Step 6.95a).
   `/dev/tpmrm0` may be exported; bun consume is still
   not an ask. Does not expand `ZetaFirstbootRole`.
   Post-6.95a bun consume (`081M1W1NCDT087G0R002H3VG6Y`):
   `zeta-install.sh` invokes `firstboot-bao-env.ts` after
   mise/bun exist. Does not invoke bun from
   `zeta-first-boot.sh`. A null ask is not a seal.
   Env join (`081M1W3BPCN087G0R001R97E45`):
   `planSetupFromNamedBaoElfEnv` is the argv/conf sibling.
   Sourced process env into the overlay plan. Injected
   read — the installer ISO's current-system bao is not
   metal option D. tpmrm0 is still not an ask. Does not
   invent an integrate decision. Does not land the stanza.
   Installer-iso epoch (`081M1W4XQH4087G0R000F69WYQ`):
   `namedBaoElfAskAtEpoch`. `installer-iso` does not open
   `NIXOS_HOST_BAO`. `installed-host` may. `/mnt` existing
   does not pick the epoch. Does not fill a `/mnt/...`
   path. Does not invent an integrate decision.
   ISO bun names epoch (`081M1W6J9MH087G0R003VNMDDR`):
   `zeta-install.sh` exports `ZETA_BAO_ELF_EPOCH='installer-iso'`
   as a literal after 6.95a. Missing epoch is unmeasured, not
   `installed-host`. `/mnt` is unknown, not `installer-iso`.
   Does not invent an integrate decision.
   Env join reads named epoch (`081M1W8D6MF087G0R003405R3N`):
   `planSetupFromNamedBaoElfEnv` takes epoch from env, not as
   a TypeScript argument. A named ask without a named epoch
   refuses. Missing keys stay unmeasured. Does not invent an
   integrate decision.
   ISO bun filters current-system bao (`081M1W9VW7P087G0R0026A9J6Z`):
   `consumeFirstbootBaoElfEnvWithEpoch` applies
   `namedBaoElfAskAtEpoch` when epoch is named. Bun JSON ask is
   null for ISO current-system bao. Missing epoch still reports
   the sourced ask. Does not invent an integrate decision.
   Named unseal request (`081M1WBA6RX087G0R002450S9J`):
   `parsePathRequest` / `ZETA_UNSEAL_REQUEST`. Missing is
   unmeasured, not `auto`. `/dev/tpmrm0` is unknown, not
   `pkcs11-tpm`. Does not call `integrateAtSetup`. Does not
   invent an integrate decision.
   Env request joins injected capture (`081M1WCEGYJ087G0R0039T2T39`):
   `integrateAtSetupFromEnv`. Missing request is unmeasured, not
   `auto`. Capture stays injected. `/dev/tpmrm0` still refuses
   at parse. Does not invent an integrate decision.
   Overlay env join reads unseal request (`081M1WE7Z5S087G0R001WT3K6G`):
   `planSetupFromNamedBaoElfEnv` takes the request from env, not
   as a TypeScript `IntegrateDecision`. Capture stays injected.
   Missing request is unmeasured, not `auto`. Does not invent
   an integrate decision.
   ISO bun consume reports named unseal request (`081M1WG1RJB087G0R001ADMJNK`):
   bun JSON includes `requested`. Missing is unmeasured, not
   `auto`. `/dev/tpmrm0` still refuses. Does not export a
   default request. Does not invent an integrate decision.
   Argv/conf overlay joins read unseal request (`081M1WHKEEQ087G0R0002B3SPG`):
   `planSetupFromNamedBaoElfArgv` and `planSetupFromNamedBaoElfConf`
   take the request from env, not as a TypeScript
   `IntegrateDecision`. Capture stays injected. Missing is
   unmeasured, not `auto`. Does not add the request to ESP
   conf. Does not invent an integrate decision.
   Named probe snapshot becomes host capture (`081M1WK36Y1087G0R003WT976Y`):
   `hostCaptureFromNamedProbe`. `/dev/tpmrm0` is not `present`.
   A YubiKey is not CardContact. A driver on disk is not an
   attached YubiHSM. Null is unmeasured, not absent. Does not
   invent an integrate decision.
   Overlay joins take named probe (`081M1WMR8KD087G0R003HZYY14`):
   argv/conf/env joins take `NamedHardwareProbe | null`. Null
   is unmeasured, not present. `/dev/tpmrm0` on the probe is
   not a capture. Does not invent a capture. Does not invent
   an integrate decision.
   Env integrate takes named probe (`081M1WP0C7B087G0R000VK9E0V`):
   `integrateAtSetupFromEnv` takes `NamedHardwareProbe | null`.
   Null is unmeasured, not present. `/dev/tpmrm0` on the probe
   is not a capture. Overlay passes the probe through. Inner
   `integrateAtSetup` still takes a capture. Does not invent
   an integrate decision.
   ISO bun consume reports unmeasured probe (`081M1WQNTZ0087G0R002Q8T8RT`):
   bun JSON includes `probe: null`. Missing is unmeasured, not
   present. A named PathRequest is not a named probe.
   `/dev/tpmrm0` is not a probe. Does not invent a look. Does
   not invent an integrate decision.
   Frost result becomes named probe (`081M1WS6HV4087G0R001K1YWMN`):
   `namedProbeFromFrostResult`. `/dev/tpmrm0` is not `present`.
   A YubiKey / CCID reader is not CardContact. A driver on
   disk is not an attached YubiHSM. Null frost result is
   unmeasured, not absent. OS family is named, not inferred.
   Does not run the live probe. Does not import frost into
   cluster. Does not invent an integrate decision.
   Overlay env join takes frost result (`081M1WTR4BW087G0R0001NVXWQ`):
   `planSetupFromFrostEnv`. Maps via `namedProbeFromFrostResult`
   then `planSetupFromNamedBaoElfEnv`. `/dev/tpmrm0` is not
   `present`. A YubiKey is not CardContact. Null frost result
   is unmeasured, not present. Does not run the live probe.
   Does not change ISO bun `probe: null`. Does not invent
   an integrate decision.
7. extraContainer sidecar — later, **same commit as the
   sidecar**, and only for the Shamir kind path until the
   emulator job replaces it. `valuesObject` only. Do not fork
   the chart.
8. Lease sidecar / portal / Consent (SSH is break-glass).
9. Inventory lock test (presence counts, never private material).
10. ADR: dual as minimum, three live slots as default.
11. Missing persona trees (riven / vera / lior) after the 3-key
    default exists.
12. ESO for **app** secrets after the unsealer is real — never
    Shamir-share copy.
13. **seed vs broadcast** (classifier landed). Join-hash is
    **framework**, indexed at `docs/PRODUCT-LANES.md`, not in
    SEED (`081M1RZ70FF087G0R0035580EZ`,
    `081M1S0K0R0087G0R001T4R8JH`).

## Δεν κάνουμε / Do not

- Helm-fight Otto on OpenBao / chart currency.
- Persist `OP_SESSION` / `op signin`.
- Treat Keychain / USB as the original.
- Rekey OpenBao to threshold 1.
- Copy Shamir shares into a Kubernetes Secret via ESO.
- Call SoftHSM green "YubiHSM green", or swtpm green "this
  board's TPM green."
- Infer swtpm from `/dev/tpmrm0` on a CI runner.
- Rotate a prod box with FIDO or biometrics. Break-glass may
  exist; it is not the rotator.
- Enable `security.pam.u2f` (or sudo fingerprint) from
  `zeta.hostSeal` — that is a lockout, bind it on the host.
- Set `boxRole = "prod-metal"` from a Kubernetes label.
- Commit `seal "pkcs11"` without a module in the image.
- Appoint `yubi-hsm-mock` as the device.
- Call the Shamir sidecar HashiCorp auto-unseal.
- Two active OpenBao seals on one node.
- Silent PKCS#11 → Lucent downgrade when the requested
  device is missing.
- skip-if-absent wearing pass on an emulator matrix cell.
- Collapse CardContact SmartCard-HSM into YubiHSM, or treat
  a YubiKey as the card.
- Mint public `IInput` / `IFeedback` F# types.
- Absorb FF7 identity-blend as factory policy
  (`docs/DRIFT-TAXONOMY.md` Pattern 1).
- Implement Tor / onion routing, or a `.zeta` hidden-service
  directory.
- Replace `llmtv-broadcast.ts`. That is the society picture,
  not the join path.
- Invent a second DHT. Pin is `lastSeenMs` refresh plus the
  heartbeat filename magnet already on main (#16623).
- Name a public "Zeta Gate" product in SEED. Kernel name is
  **seed vs broadcast**.
- Compute founder-sacrifice / agent self-erasure of the human
  operator. Agreement has no self-erasure clause (#16624;
  HC-9 dual). Derived debate is not consent.
