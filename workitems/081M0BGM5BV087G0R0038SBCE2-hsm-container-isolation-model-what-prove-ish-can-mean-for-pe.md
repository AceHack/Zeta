---
id: 081M0BGM5BV087G0R0038SBCE2
type: task
state: backlog
priority: P2
slug: hsm-container-isolation-model-what-prove-ish-can-mean-for-pe
title: "HSM container isolation model: what prove-ish can mean for per-tick-source YubiHSM access"
created: 2026-08-18T22:42:11.963Z
depends_on: []
composes_with: []
---

# HSM container isolation model: what prove-ish can mean for per-tick-source YubiHSM access

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0BGM5BV087G0R0038SBCE2-*.md` glob. -->

## Why

Aaron 2026-08-18: each tick source is a separate service with its own access level, most bound to
containers with restricted YubiHSM access per container -- "so we can prove-ish they can access each
other's keys without some exploit, which we also score and pay for disclosure."

The first job was definitional: what can "prove-ish" honestly mean for a boundary whose only
enforcement point is a USB device reached through a shared, unauthenticated multiplexer.

## Outcome

`docs/research/2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md`

Design-and-analysis only -- no session opened, no auth key created, no key material read, no probe or
write to the physical device. Every device constant is cited to the shipped SDK header
(`/usr/local/include/yubihsm.h`, libyubihsm 2.7.3) or to Yubico's published docs and advisories.

Headline: container A cannot USE container B's keys (device-enforced, real); container A CAN deny
container B its keys, and can attack container B's client process. Confidentiality yes, availability
no, peer-process integrity no.

## Follow-on work this doc names but does not do

- **D1 / D3 roster lints** -- domain-disjointness, capability minimality, delegated-capability
  closure. Pure computation over a declared provisioning artifact; no device, no key material, so
  CI-runnable with no HSM attached. Highest value per unit of effort in the whole set.
- **D2 paired access matrix** -- the only genuine falsifier of isolation; needs a device and must
  carry its diagonal positive control in the same run.
- **D4** -- read the attached device's firmware version once and record it. Below 2.4.0 the device is
  permanently EUCLEAK-affected (CVE-2024-45678) and cannot be patched.
- **Delete the admin authentication key after provisioning** -- removes a standing device-wide
  authority (manifesto §1/§3) at a cost the roster's n-k wipe budget already priced.

## Not this work-item's lane

`tools/setup/` and `frost-hardware-probe.ts` are owned by the hardware-inventory pass; the k8s
cluster surfaces by another. This item is the isolation model and its attack surface only.
