---
id: 081M0DJQ7BP087G0R002JDZF90
type: task
state: backlog
priority: P1
slug: yubihsm-connector-reachability-is-the-real-hsm-perimeter-bin
title: "yubihsm-connector reachability is the real HSM perimeter: bind scope, drain the 62-entry log ring, measure pre-auth session exhaustion"
created: 2026-08-19T17:57:18.326Z
depends_on: []
composes_with: []
---

# yubihsm-connector reachability is the real HSM perimeter: bind scope, drain the 62-entry log ring, measure pre-auth session exhaustion

**Owner:** Nazar (`security-operations-engineer`) for the runtime controls; Aminata
for the model rows.
**Class:** Information disclosure (S1), Denial of service (sessions), Repudiation
(log ring). **Severity (SDL bug bar):** Medium for the leak, High for the DoS if
the connector turns out to be reachable from anything but the node's own agent.

## The gap in the model

The source note says `yubihsm-connector` "must be bound to the narrowest possible
scope". That is advice, not a control, and the model never answers the question the
threat model is supposed to answer: **who can reach the USB endpoint?** On a NixOS
node that is: any local process, any user in the connector's access group, any
container sharing the network namespace, and — the one nobody models — **any web
page the operator opens**, because the connector is a plain-HTTP listener on
localhost and localhost HTTP services are reachable from the browser (DNS rebinding
/ CSRF class).

Three consequences, each with its own falsifier.

### 1. Pre-authentication self-description is a targeting oracle (METERED)

`get-device-info` answers with **no session**: firmware version, serial,
`Log used: N/62`, algorithm list, part number.

- **Firmware version selects victims.** EUCLEAK (CVE-2024-45678) is a key-extraction
  flaw at fw ≤ 2.4.0, below a non-existent update boundary, so remediation is device
  replacement. An unauthenticated reader learns which node in the fleet is worth
  stealing.
- **The serial is an unrotatable global identifier**, and it is also inside every
  attestation certificate. It is a permanent linkability handle for every key the
  node ever issues (LINDDUN: identifiability + linkability), and it collides with
  this repo's own posture that names and standing are earned and rotatable while
  hardware identity is not. A privacy budget cannot frost a serial number.
- **`Log used: N/62` is a live activity counter** readable without a credential —
  a low-bandwidth covert/side channel on how busy the root of trust is.

**Control:** bind the connector to the narrowest scope the node can express and
*verify it in CI/NixOS module tests*, not in prose. Treat the serial as public and
never as a secret or an authenticator.

### 2. Pre-auth session allocation is a plausible DoS (unmetered — name the falsifier)

`Create Session` allocates device-side session state **before** the caller has
proven anything; the device supports a small fixed number of concurrent sessions.
Anything that can post bytes to the connector can therefore attempt to exhaust
them, and the node's root of trust stops answering for its legitimate agent. No
exploit, no credential, no key material — just arithmetic.

**Falsifier:** open sessions up to the device limit without completing
`Authenticate Session`, then assert (a) the next legitimate `Create Session` fails
and (b) how the state is reclaimed (timeout? connector restart? device reset?). The
reclamation path is the actual deliverable — if it is "device reset", the DoS is
worse than it looks.

### 3. The 62-entry audit log is a ring, and integrity is not retention (METERED)

The log is hash-chained (tamper-evident, genuinely good) and holds **62 entries**.
Entry 63 overwrites entry 1, and the chain stays perfectly valid while the evidence
is gone. **An adversary hides one action by performing 62 boring ones.** That is a
cheap anti-forensics primitive requiring no flaw at all, and the source note — which
correctly meters the chain — never asks what overflow costs.

Also: the log carries a monotonic `tick`, not a timestamp. Correlating tick to
wall-clock is a host-side trust step that today nobody has declared.

**Controls:** (a) the host drains `get-logs` and persists off-device **faster than
62 commands**, and a missed drain is an alert, not a shrug; (b) the tick is the
ordering key and any wall-clock correlation is recorded as a declared, metered
crossing at the membrane — never allowed to reorder or filter evidence entering a
shared fold; (c) investigate whether the device's force-audit mode (refuse commands
while the log is full) is the right posture — it converts a silent evidence-loss
into a loud availability failure, which is usually the trade you want for a root of
trust, and it is itself a DoS knob an insider can pull. **unmetered**: read from
public documentation, not measured on our device. Falsifier: enable it on the
throwaway device and assert the refusal and the recovery path.

## Done when

- The NixOS module expresses and tests the connector's reachability scope.
- A log-drain path exists with a "ring nearly wrapped" alarm, and the tick↔clock
  correlation is a declared crossing.
- The session-exhaustion and force-audit falsifiers are run and their results land
  in the threat model as metered rows.
