# The hardware probe met real hardware — and `SPUSBDataType` is a vacuity trap under a sandbox

**Date:** 2026-08-20 · **Register: METERED** for everything below — every line is a command run
against the YubiHSM 2 physically attached to the maintainer's Mac Studio, with its verbatim
output. **No credential was read, printed or handled, and no authenticated session was opened.**

**What this closes:** `081M0B230NW087G0R000J30VQB` — *"frost-hardware-probe could not see a
YubiHSM 2 at all, and paired any module with any device"*. That bug was **fixed in the same PR
that filed it**, and the workitem states plainly: *"No hardware was touched: the device was never
plugged in, and every test below is a described host."* So the fix was **implemented and
unmetered**. It has now met the device.

## 1. The device is present — and the tool the probe's siblings reach for cannot see it

```
$ system_profiler SPUSBDataType          # 0 bytes, exit 0
$ system_profiler SPHardwareDataType     # 514 bytes, exit 0  ← control: the tool works
```

**`SPUSBDataType` returns EMPTY WITH EXIT 0 under this agent's sandbox, while a sibling datatype
on the same binary returns normally.** That is the vacuity class in its purest hardware form: a
check that *could not run* is indistinguishable, at the call site, from a check that ran and
found nothing. An "absent" reading here is a **gap wearing a finding's clothes** — which is
precisely the sentence the closed workitem used about its own bug, now recurring one layer up in
the environment rather than in the code.

`ioreg` is unaffected and is what the fixed probe actually uses:

```
$ ioreg -p IOUSB -l -w 0
  "USB Product Name" = "YubiHSM"            "idVendor" = 4176   "idProduct" = 48
  "USB Serial Number" = "0039160506"
  "USB Product Name" = "YubiKey FIDO+CCID"  "idVendor" = 4176   "idProduct" = 1030   (×2)
```

Yubico is `0x1050` (4176); YubiHSM 2 is `0x0030` (48). The device sits behind two VIA Labs hubs
on an Anker Thunderbolt dock — worth recording, because a probe that only walks the root hub
would miss it.

> **Standing consequence:** on macOS, `system_profiler` is not a dependable enumerator inside an
> agent context. Any future detection route that reaches for it inherits this failure mode
> **silently**. `ioreg` is the honest path.

## 2. The probe, run against the real device — verbatim

```
$ bun tools/setup/persona-keys/frost-hardware-probe.ts          # exit 0
[Hardware Security Probe] Result:
  TPM 2.0:            UNAVAILABLE
                      (THE CHECK DID NOT RUN) platform "darwin" has no Linux TPM interface —
                      /dev/tpmrm0, /sys/class/tpm and tpm2-tools were NOT consulted.
                      This is "not asked", not "no TPM".
  YubiKey / token:    Detected (S/N: 37516430)
  Smart-card reader:  Attached
  PKCS#11 module:     Not found
  YubiHSM 2:          ATTACHED (bulk USB — invisible to the reader/ykman probes above)
                      (the check ran) a YubiHSM was named in the ioreg USB enumeration
  yubihsm_pkcs11:     /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib (a DRIVER — not evidence of a device)
  PKCS#11 pair:       /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib drives YubiHSM 2
  Secure Enclave:     Present (no seal tier can use it — see header)
  Device present:     YES
  Honourable tiers:   hardware-pkcs11
```

**Both halves of the closed bug are confirmed fixed against hardware, not against a description:**

1. **The HSM is no longer invisible.** `YubiHSM 2: ATTACHED`, reached via the bulk-USB/ioreg
   route the old CCID and `ykman` paths structurally could not see.
2. **The module is matched to the device, not merely co-present.** `PKCS#11 module: Not found`
   (no `ykcs11`/OpenSC) sits directly above `PKCS#11 pair: …yubihsm_pkcs11.dylib drives
   YubiHSM 2`. Under the old `someModule && someDevice` logic those two lines could not coexist.
   **The forcing case the workitem described is exactly the state of this desk**, and the probe
   now reports it correctly.

And the line worth keeping for its own sake:

> `TPM 2.0: UNAVAILABLE (THE CHECK DID NOT RUN) … This is "not asked", not "no TPM".`

The discipline is carried **in the device layer's output string**, where a reader who never opens
the source still cannot mistake a gap for a finding.

## 3. Connector reachability — measured, and it is the real perimeter

```
$ curl -s http://127.0.0.1:12345/connector/status
status=OK   serial=*   version=3.0.7   pid=14449   address=localhost   port=12345
```

A connector **is already listening**, and **`serial=*`** — it is *not pinned to a device*. This is
the live confirmation of `081M0DJQ7BP087G0R002JDZF90` (*"yubihsm-connector reachability is the
real HSM perimeter"*): the 16-domain bitmask is enforced by the hardware **against a session**,
but the path *to* the hardware is an unpinned localhost TCP daemon. **Domain separation is not
reachability control, and only one of the two is currently constrained.**

Cheap narrowing available now, named rather than performed (it changes a running service):
pin the connector to `serial=39160506`.

## 4. Unauthenticated device facts — refreshed, not quoted

`hsm-domain-map.ts` records mechanisms from an earlier probe. Re-measured rather than trusted:

```
$ yubihsm-shell -a get-device-info            # exit 0, no session, no credential
Version number:   2.4.1
Serial number:    39160506
Log used:         2/62
Supported algorithms: rsa-pkcs1-sha{1,256,384,512}, rsa-pss-sha{1,256,384,512},
                      rsa{2048,3072,4096}, ecp{256,384,521}, eck256,
                      ecbp{256,384,512}, hmac-sha{1,256,384,512}, …
```

Firmware and serial **agree with the recorded values** — the file's stated facts survive
re-measurement. **`eck256` is secp256k1**, so the wallet/x402 path has a real on-device curve.
`ecbp*` (Brainpool) and the full RSA range are present and were **not** in the file's shortened
list; the file's list was explicitly the observed subset, so this widens rather than contradicts it.

**Still absent: any FROST-capable mechanism.** The threshold-signature design therefore remains
software FROST over HSM-sealed shares — on-device FROST is not available on this firmware.

## 5. What is now metered, and what is still not

| claim | before | now |
|---|---|---|
| probe can see a YubiHSM 2 | implemented, untested | **metered** — `ATTACHED`, real device |
| module is matched to device | implemented, untested | **metered** — the forcing case is this desk |
| TPM "did not run" ≠ "no TPM" | implemented | **metered** on darwin; **Linux path still unrun** |
| connector is the perimeter | argued | **metered** — live daemon, `serial=*` |
| device mechanisms | recorded | **re-measured**, agrees, and is wider |
| **domain separation enforces per-AI isolation** | — | **NOT metered, and must not be read as such** |

That last row is the one to guard. `hsm-domain-map.ts` states it at the claim: the **decision** is
enforced and tested; the **separation** is not — nothing stops a caller that already holds an
authenticated session from using any key that session's domains reach, and the gate is one a
caller can simply decline to call. Nothing in this note moves that row, and **a probe reporting
`Honourable tiers: hardware-pkcs11` is not evidence for it.**

Also unrun: `081M00VN9P1087G0R000FYTTVS` — the Linux TPM 2.0 probe needs an x86 node, and this is
Apple silicon. `tpm2_getcap` is absent here; the darwin path correctly declines to guess.

## 6. Pointers

- `tools/setup/persona-keys/frost-hardware-probe.ts` — the probe (unmodified by this note)
- `tools/setup/persona-keys/tpm2-linux-probe.ts` — the still-unrun Linux half
- `src/Core.TypeScript/federated-identity/hsm-domain-map.ts` — the 16-domain map, and the
  enforced/not-enforced split this note deliberately does not weaken
- workitems `081M0B230NW…` (closed bug, now metered) · `081M0DJQ7BP…` (connector perimeter,
  now measured) · `081M00VN9P1…` (Linux TPM probe, still unrun)
- `docs/research/2026-08-18-yubihsm-yubikey-readiness-the-probe-could-not-see-the-hsm-and-the-ceremony-runbook.md`
  — the readiness note this is the hardware follow-through for
