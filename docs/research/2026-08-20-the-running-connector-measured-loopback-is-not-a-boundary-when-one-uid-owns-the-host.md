# The running yubihsm-connector, measured: loopback is not a boundary when one uid owns the host

**Aminata / threat-model-critic — advisory, not binding.** Measurements taken 2026-08-20T23:45–23:53Z
on macOS 26.5.2, Apple Silicon. **The device was not touched:** no `yubihsm-shell`, no `ykman`, no
restart, no reconfigure, no credential handled.

## 0. One paragraph

The connector **is** bound to `127.0.0.1` only — the narrow bind the 2026-08-18 note recommended and
assumed macOS made impossible. It is still not a boundary, for a reason unrelated to the bind
address: it was started by hand as `acehack`, is **not** under launchd or `brew services`, and
**nothing respawns it.** Any process running as `acehack` can `kill 14449` and bind 12345 itself.
**There is no race to win, because the legitimate listener does not come back.** The attacker then
*is* the connector — the responder on the parse path of every client. Loopback binding did not create
a boundary; it renamed the boundary to "the login account", and the login account is where every
agent, every editor, two LAN-listening media daemons and two third-party AI computer-use apps already
live.

## 1. Measured configuration

```
$ lsof -nP -iTCP:12345
yubihsm-c 14449 acehack 7u IPv4 ... TCP 127.0.0.1:12345 (LISTEN)
$ ps -o pid,user,command -p 14449
14449 acehack  yubihsm-connector -d
```

| fact | evidence |
|---|---|
| Loopback only, IPv4 only | `lsof`, `netstat` |
| **No config file exists** — every setting is a compiled default | `ls` on `/etc/`, `~/`, `/usr/local/etc/`, `/opt/homebrew/etc/` → all absent |
| **Not supervised** | `launchctl list \| grep -i yubi` → empty; `brew services list` → no yubihsm row (it *does* list `tor` and `ollama`, so the command works) |
| Exactly two routes | `/connector/api`, `/connector/status` |
| Binary `root:wheel 0755`, hardened runtime, **no entitlements** | `codesign -dv` → `flags=0x10000(runtime)`; entitlements empty |

## 2. Reachability

| # | actor | verdict | evidence |
|---|---|---|---|
| R1 | Any process as `acehack` | **REACHABLE** — the finding | two unauthenticated routes on loopback; same-uid is sufficient and decisive |
| R2 | Another local user account | **NOT REACHABLE — there are none** | `dscl . list /Users` → exactly `acehack`. **Empty by provisioning accident, not by control** |
| R3 | A system daemon uid | **REACHABLE (documented, unmeasured)** | no per-uid loopback filter; a TCP listener *cannot* check peer creds |
| R4 | A compromised bun/node process | **REACHABLE — 6 running now** | 5 `bun`, 1 `node`, plus two third-party AI computer-use apps, all `acehack` |
| R5 | A LAN host, directly | **NOT REACHABLE** | no non-loopback listener on 12345 |
| R6 | A LAN host, via same-uid pivot | **REACHABLE in two hops** | `qbittorrent` (user `acehack`) on four LAN/VM addresses; Plex on `*:32400`. RCE in either lands at R1 with **no escalation** |
| R7 | Inbound `ssh -L` | **NOT REACHABLE — sshd is off** | no port-22 listener |
| R8 | Outbound tunnel | **REACHABLE — Tor makes it three lines** | `tor` running as `acehack` with `ControlPort 9051`, cookie readable by owner. **No HiddenService needed** — `ADD_ONION` maps an ephemeral onion to `127.0.0.1:12345` |
| R9 | Screen Sharing / VNC | **REACHABLE if an attacker can authenticate** | `*.5900` LISTEN **on all interfaces**. Could not attribute the process without sudo. **Operator should confirm this is intentional** |
| R10 | Docker via `host.docker.internal` | **UNKNOWN — could not measure** | Docker VM is down. **Do not resolve from the web:** results mostly describe Docker *on Linux*, where the bridge gateway cannot reach a loopback-bound host service; Docker **Desktop** for Mac proxies through host-side userspace networking, a materially different path |
| R12 | A web page the operator opens | **UNKNOWN for execution; REACHABLE for fingerprinting** | no CORS header is emitted, so a page cannot read the body — but success-vs-error timing reveals a connector is present. **Execution turns entirely on whether `POST /connector/api` *requires* `Content-Type: application/octet-stream`** |
| R13 | Replacing the binary | **NOT REACHABLE without root** | `root:wheel 0755` |
| R14 | `DYLD_INSERT_LIBRARIES` | **NOT REACHABLE** | hardened runtime, **no entitlements** ⇒ dyld ignores insertion. **Measured correction to the 2026-08-18 doc §5-T2-A**, which listed dyld injection unqualified |

> **Every REACHABLE row reduces to one predicate: can you execute code as `acehack`?**

## 3. Why the bind address is the wrong control

### 3.1 The endpoint is takeable, and there is no race

Four steps, **no vulnerability**: `kill 14449` (same uid, permitted) → bind `127.0.0.1:12345`
(uncontested; nothing respawns the real one) → serve `/connector/status` truthfully so nothing
notices → on `/connector/api`, **be the responder to every client's `libyubihsm`.**

Step 4 is the position the 2026-08-18 doc already priced High-as-a-class, citing CVE-2020-24387,
CVE-2020-24388 and YSA-2021-01 — all *response*-parser bugs, **at least one executing before the MAC
is checked.** SCP03 protects key material, not the parser that runs before SCP03 has concluded
anything. The installed SDK is patched against those three; **the position is architectural.**

That doc treated occupying the endpoint as requiring *"a bind race, a container-bridge spoof, or
compromise of the connector process."* **Measured, it requires `kill`.**

The cheapest fix is not a firewall — it is **supervision**. launchd with `KeepAlive` converts a
silent takeover into a visible service flap. It does not stop an attacker who also unloads the job;
**it removes the free, quiet version.**

### 3.2 A loopback-only service is one control-port command from the internet

Same-uid access to Tor's cookie-authenticated control port publishes the connector as a hidden
service: **no port opened, no firewall rule changed, no config file written, no inbound connectivity
required.**

Worth naming precisely because of what the repo already believes:
`itron-hub-patent-boundary-p2p-is-the-upgrade.md` records **outbound-initiated connection** as the
portable, genuinely good half of the Itron patent. **That property is symmetric. It is exactly as
good for the attacker, and here it is pre-installed and running.**

Strength of the claim, honestly: this does **not** give a remote attacker the ability to sign. It
gives them **the pre-auth surface and the DoS surface, from anywhere.**

## 4. What reaching the port actually buys

Credit where due: sessions are mutually authenticated and encrypted **end-to-end between application
and device**, and Yubico states plainly that *"the Connector is not a trusted component."* A
port-holder cannot read commands, forge them, or mint a session without an auth key.

What they get anyway: pre-auth `get-device-info`; **session-slot exhaustion** (16 device-wide, slots
allocated before authentication completes); **total denial of the root of trust**; the response-parser
position; traffic analysis of every tenant's operation rate.

> Note the asymmetry that matters for x402: **none of these steal a key, and all of them stop a
> payment.** For an agent that must sign unattended, **availability *is* the security property** — and
> availability is precisely what the port-holder owns completely.

## 5. `serial=*` — verdict, including the case against pinning

**Not theatre, but a correctness control mis-shelved as a security control — and against the one
physical attack that matters it provides exactly zero.**

`serial` is documented as *device selection in case of multiple devices*. It is a **selector, not an
authenticator.**

**For pinning.** Under the "one device per trust domain" roadmap an unpinned connector opens an
*arbitrary* device — and then `hsm-domain-map.ts` is addressing the wrong hardware and every decision
it makes is nonsense. There, pinning stops being hygiene and becomes **correctness.**

**Against pinning, and it is stronger than it looks.**

1. **The check is on the wrong side of the trust boundary.** Yubico says the connector is untrusted.
   Pinning is a check performed *by the untrusted component* over a value *supplied by the device*.
2. **A serial is a claim, not a proof.** A purpose-built hostile USB device asserts whatever it likes.
3. **Zero defence against the highest-value physical attack.** The rim-press factory reset (~10s, no
   credential, wipes everything) leaves the **serial unchanged** — it is a hardware property. So
   *pull → reset → reinsert* produces a device a pinned connector **accepts without hesitation**, now
   holding the factory-default auth key (object ID 1, all capabilities, all domains).

**Verdict: pin it as a correctness control, and stop calling it a perimeter control.** Listing it
beside "bind the port" on a mitigation list creates exactly the impression the vacuity discipline
exists to prevent.

**What actually detects substitution and reset**, and belongs where pinning is tempting to put it:
(1) treat `Authenticate Session` failure as a **device-may-have-been-replaced** alarm — that check is
on the *right* side of the boundary, the client performs it and the device cannot fake it; (2)
`Log used` going backwards is a **wipe signature readable pre-auth**; (3) **attestation** — the serial
is inside every attestation certificate, and a signed attestation is a *proof* where the status line
is a *claim*.

**Smaller correction on the pre-auth oracle.** The serial-as-unrotatable-identifier argument stands.
The *firmware-version-as-victim-selector* argument is weaker here: EUCLEAK / CVE-2024-45678 affects
firmware **before 2.4.0**, and this device reports **2.4.1**. The pre-auth disclosure currently tells
an attacker *"this one is patched"* — value to them is presently negative. **Say the true thing rather
than the scarier one.**

## 6. Unattended signing — the distinction that collapses

> Sessions expire after **30 seconds of inactivity**. An agent signing every few minutes has no live
> session between payments. Unattended signing therefore **necessarily** means a **credential resident
> on the host.** **There is no configuration in which the host holds only a session handle.**

| config | blast radius on host compromise |
|---|---|
| **A.** password in file/env | unbounded signing across every capability and domain that key reaches |
| **B.** Keychain, ACL'd to one binary | same as A once the attacker executes *inside* the ACL'd binary — which is what "compromised agent" means. **ACLs bind to a code-signed binary, not to the intent of the code inside it** |
| **C.** per-agent auth key, distinct domains, minimal capabilities | **the only config where blast radius < "everything the HSM can do"** |
| **D.** live session, credential zeroed | **illusory — not a distinct configuration.** The 30s timeout means either the credential is retained (→ A/B) or the signer stops working |
| **E.** physical presence per signature | nothing without the human — **and it deletes the product** |

**The honest statement:** every configuration satisfying "unattended" places a credential on a host
whose compromise is assumed. The design question is **not** *how do we stop host compromise from
producing signatures* — it cannot be stopped — but **how small, how attributable, and how
expensive-to-repeat is each stolen signature.** That points at three levers: domain scope, capability
scope, and **rate/velocity limits that live off the host.** The device offers no rate limiting; the
connector offers none; **the repo has none.** That is a **design gap, not a configuration knob.**

## 7. Real mitigations vs theatre

**REAL** — per-agent auth keys with distinct domains (hardware-enforced against the session, not a
callable gate) · minimal capabilities (no `put-authentication-key`, `export-wrapped`, `set-option`,
`reset-device`, `delete-object` — an auth key with `put-authentication-key` plus a delegated set
reaching past its partition **can mint itself a credential into a peer's domain**) · a
delegated-capability lint over the roster (**computable with no device, no credential — the cheapest
real control**) · launchd `KeepAlive` · draining `get-logs` faster than 62 operations · **off-host
velocity limits (not currently built — the only control that bounds §6)** · physical presence
(*listed because honesty requires naming the control that works before refusing it*).

**THEATRE, or mis-shelved**

| item | why |
|---|---|
| **Binding to loopback** | *Mis-shelved, not useless.* It genuinely excludes R5. It does not exclude R1/R4/R6/R8 — **the reachable ones.** Listing it as *the* perimeter control is the vacuity failure: **the check cannot fail against the attacker who exists** |
| **Firewalling port 12345** | **Theatre for the current threat.** macOS's Application Firewall does not filter loopback, and the attacker is on loopback. **It stops nobody not already stopped** |
| **Pinning the serial** | correctness, not security (§5) |
| **Session lifetime limits** | **theatre, and the device already does it tighter** — 30s, hardware-enforced, no knob |
| **"Key material never leaves the device"** | true, and **not a mitigation for this threat.** In a mitigation column it implies bounded loss and delivers none. It belongs as an *exclusion*, never as a control |
| **The on-device audit log as accountability** | §8 — tamper-*evident*, not *retained* |

## 8. The 62-entry ring

**Checked, not assumed.** Yubico documents the Log Store as holding *"up to 62 different entries"*
and, when full, *"it is used as a circular buffer"*. **Default behaviour: it wraps silently. It does
not refuse.**

> **62 entries is not an audit log. It is a 62-deep undo of the evidence.**

- An adversary hides one signature by performing **62 boring operations.** No vulnerability, no extra
  credential. **The hash chain stays perfectly valid across the wrap** — integrity preserved while the
  evidence is destroyed, which is the worst combination for a reviewer, **because the chain verifies
  and invites confidence.**
- It is destroyed **without an adversary** too. An agent signing once per second clears the window in
  about a minute. **For an x402 payment agent, ordinary operation is the eviction mechanism.**
- The log carries a monotonic **tick**, not a wall-clock timestamp. Correlating tick to time is a
  host-side step, **and the host is the thing assumed compromised.** Under
  `local-time-never-enters-the-shared-fold.md` that correlation is a crossing that must be declared
  and metered; today nobody declares it, so **a compromised host silently supplies the timeline of its
  own audit.**

**The trade is strict.** Off = evidence destructible; `force-audit` on = **the device halts for
everyone when full**, a DoS knob any insider or any agent with `set-option` can pull — and it halts
the payment agent by design. Two consequences: (1) converting silent evidence-loss into loud
availability failure is normally right for a root of trust — *except* where the device is on the
critical path of unattended payments, which is our case; **make the choice per-device** (signing
device: off + aggressive drain; ceremony device: on). (2) **`force-audit = 0x02` is irreversible until
factory reset** — a non-reversible action and a **gated class** requiring fresh human authorization.
That belongs in the runbook where the command appears, not in a footnote.

**What could not be determined without touching the device** (all three falsifiers belong on the
throwaway device, never this one): does an unauthenticated `Create Session` actually consume a slot
(*"self-heals in 30s" and "needs a device reset" are different severities and we are currently
guessing which we have*) · does the log wrap at exactly 62 **with the chain still verifying** · does
`force-audit 0x01` recover cleanly after a drain.

## 9. Findings in priority order

1. **The connector is unsupervised and the endpoint is takeable with `kill`.** Highest severity,
   cheapest fix, and **it inverts the prior doc's assumption that occupying the endpoint requires
   winning a race.**
2. **Loopback binding is not the boundary it reads as** — one user account, 8+ same-uid processes
   including two third-party AI computer-use agents, two LAN-listening daemons under the same uid.
3. **The 30s timeout means unattended signing *requires* a resident credential.** The "long-lived
   session" configuration **does not exist.**
4. **There is no velocity limit anywhere** — device, connector, or repo. **The only lever that bounds
   loss, and it is unbuilt.**
5. **Tor's control port is a pre-installed, same-uid, outbound-initiated remote-exposure path.**
6. **`serial=*` is a correctness defect, not a security one.**
7. **The 62-entry ring cannot witness agent spending.**
8. **Two measured corrections to the 2026-08-18 doc** — §4's "cannot listen only on localhost" is not
   in force (it *is* loopback-bound, and the Docker VM is down), and §5-T2-A's dyld variant does not
   apply. **Both make the picture *less* alarming; recording them is how the alarming parts stay
   credible.**
9. **No Zeta code path uses the connector yet.** `rg` for `YUBIHSM_CONNECTOR`, `connector/api`,
   `127.0.0.1:12345` returns nothing. Blast radius **today** is ad-hoc human use — **so every control
   above can land before anything depends on the current shape. That window closes the first time an
   agent signs.**

## 10. Next checks, cheapest first

| check | cost | resolves |
|---|---|---|
| Read Content-Type/Origin handling in upstream `api.go` | ~5 min, offline | R12 — can a web page execute HSM commands blind |
| `docker run --rm alpine nc -z host.docker.internal 12345` with Docker up | ~2 min, no device contact | R10 |
| Delegated-capability lint over the auth-key roster | hours, no device | the highest-value finding class |
| launchd job with `KeepAlive` | ~30 min | finding 1 |
| Session-exhaustion falsifier **on the throwaway device** | ~1 hour | §8 severity |

**Not recommended:** anything touching the attached device. **Nothing above required it**, and the two
questions that would have are better answered on hardware nobody depends on.

## Anchors — checked

Yubico *Connector* (*"not a trusted component"*), *Core Concepts* (62-entry circular Log Store;
default auth key object ID 1 with all capabilities/domains), *Set Command Audit Option* (`0x01`
refuses until export; `0x02` locks until factory reset), *Session* (16 concurrent, 30s inactivity
expiry) · YSA-2024-03 / CVE-2024-45678 (EUCLEAK — firmware **before 2.4.0**; this device is 2.4.1,
**outside** the affected range) · Shostack, *Threat Modeling* (STRIDE) · Anderson, *Security
Engineering* 3rd ed. — *"the check on the wrong side of the trust boundary"*, applied to serial
pinning in §5 · Hirschman (1970) via `itron-hub-patent-boundary-p2p-is-the-upgrade.md` — §3.2 notes
the outbound-initiated property is **symmetric** between defender and attacker.

---

### Verification note (Otto, landing this)

Two load-bearing measurements were independently re-run before landing. **Supervision status
confirmed:** `launchctl list | grep -i yubi` empty and `brew services list` shows no yubihsm row, so
finding 1 stands — the endpoint is takeable with `kill`, no race. **The loopback bind confirmed:**
`lsof -nP -iTCP:12345` shows `127.0.0.1:12345 (LISTEN)` owned by `yubihsm-c 14449 acehack`. **R9
confirmed as a live exposure:** `*.5900` appears among the non-loopback listeners, alongside `*.88`,
`*.7000`, `*.32400`, `*.5000` and four `…:16705` LAN/VM binds. Process attribution for 5900 still
requires sudo and was not attempted; **the operator should confirm Screen Sharing is intentional.**
