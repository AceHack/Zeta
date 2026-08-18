# HSM container isolation — a shared connector is not a boundary, and what "prove-ish" can honestly mean

**Aaron 2026-08-18:** *"each tick source is a separate service with its own access level, most bound to
containers with restricted YubiHSM access per container … so we can prove-ish they can access each
other's keys without some exploit, which we also score and pay for disclosure."*

Design-and-analysis only. **No session was opened, no auth key was created, no key material was read,
and the physical device was not probed or written to.** Every device fact below comes from the shipped
SDK header at `/usr/local/include/yubihsm.h` (libyubihsm 2.7.3), the installed connector's own usage
output (v3.0.7), or Yubico's published documentation and security advisories — each cited inline.

This extends `2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md`,
which set the L1/L2/L3 ladder and asked (its §8 Q1) whether L1 is worth landing on its own or whether
shipping it manufactures a false sense of isolation. §9 below answers that question.

---

## 0. The short answer, stated before the evidence

> **Container A cannot USE container B's keys. Container A CAN deny container B its keys, and can
> attack container B's client process.** Confidentiality between tick sources is real and
> device-enforced. Availability and client-process integrity are not isolated at all, and cannot be
> made so by any arrangement of containers, because the single path to the device is an
> unauthenticated shared multiplexer that Yubico explicitly declines to call trusted.

"Prove-ish" can therefore honestly mean **a machine-checked proof about the declared policy, plus a
device read-back that the policy is what is installed, plus a paired negative test** — and an explicit
list of what none of that covers. It is a *coverage statement*, not a confidence number. Anything
stronger would be a claim the mechanism cannot carry.

---

## 1. What the device actually enforces — the hard numbers

Verified from the installed header, not from a blog post. These constants are the shape of every
argument below.

| constant | value | source | why it matters |
|---|---|---|---|
| `YH_MAX_SESSIONS` | **16** | `yubihsm.h:103` | total concurrent sessions **device-wide**, shared by every tick source |
| `YH_MAX_DOMAINS` | **16** | `yubihsm.h:122` | the isolation partitions; 16 is the ceiling on tick sources with disjoint domains |
| `YH_MAX_ITEMS_COUNT` | **256** | `yubihsm.h:101` | total objects device-wide |
| `YH_MAX_LOG_ENTRIES` | **64** (docs say 62 usable) | `yubihsm.h:117`; [Core Concepts] | the audit log is a **ring buffer** — see §6 |
| session inactivity timeout | **30 seconds** | [Core Concepts] | forces either session churn or session pinning; both are costly at 16 slots |
| transport | **GlobalPlatform SCP03** | [Core Concepts] | end-to-end encrypted+authenticated *client ↔ device* |

**The access-control rule**, quoted from Yubico's [Access Control] page:

> "a session can only access objects that share at least one domain with the Authentication Key used
> to open it"

and, on capabilities:

> "Both must agree for an operation to succeed. If a session has permission to sign, but the target
> key does not have signing enabled, the operation is rejected, and vice versa."

and, on creation:

> "a session cannot create an object that has more permissions than the Authentication Key itself is
> delegated to grant."

So the enforcement is: **domain intersection AND capability agreement, evaluated per session, on the
device.** It is sound and it is the only enforcement in the system. Note the two distinct refusals the
header names — `YHR_DEVICE_INSUFFICIENT_PERMISSIONS = -20` and `YHR_DEVICE_OBJECT_NOT_FOUND = -22`
(`yubihsm.h:214,218`). **Cross-domain access returns the second, not the first**, because an object
outside your domains is invisible rather than forbidden. §7 shows why that detail decides whether the
isolation test is a check or a decoration.

Two further named device states matter because they are exactly the attacks in §5:
`YHR_DEVICE_SESSIONS_FULL = -16` and `YHR_DEVICE_LOG_FULL = -21`.

---

## 2. How a container gets HSM access at all

The YubiHSM 2 is a bulk-USB device (`YH_VID 0x1050` / `YH_PID 0x0030`, `yubihsm.h:95-97`). Clients do
not speak USB; they speak HTTP to `yubihsm-connector`, which is a USB↔HTTP bridge. The installed
connector's own usage text gives its defaults:

```
-l, --listen string   listen address (default "localhost:12345")
    --enable-host-header-allowlist    Enable Host header allowlisting
```

Three things follow immediately, and all three are load-bearing:

**(a) The connector performs no caller authentication whatsoever.** Yubico states the design intent
plainly on the [Connector] page: *"The Connector is not a trusted component."* Authentication is
end-to-end between the application and the device over SCP03, so the connector never needs to know who
is calling — and consequently **never does**. Any process that can reach the listen address can submit
bytes to the device.

**(b) One connector per device, not one per container.** The connector claims the USB device
exclusively and acts, in its own documentation's phrasing, as a *"USB multiplexer"* allowing
synchronized concurrent access. N containers therefore share **one** connector process. There is no
supported topology in which each container drives the device directly over USB while another container
does too.

**(c) Host-header allowlisting is opt-in, not default.** The allowlist *contents* default to
localhost, but enforcement requires the explicit `--enable-host-header-allowlist` flag. This is a
DNS-rebinding surface wherever a browser-bearing context can reach the port. It is not the main event
for containers and is ranked accordingly in §5.

---

## 3. The topology table — and the real isolation boundary for each

| # | topology | how a container reaches the device | **what the isolation boundary actually is** | available on this machine? |
|---|---|---|---|---|
| T1 | **Shared connector on host, containers POST to it** | HTTP to the host's connector across the container network | **Nothing at the connector.** The boundary is *entirely* the device's domain+capability model. The container boundary contributes exactly one thing: it keeps A's credential unreadable by B **at rest and in process memory**. | **Yes** — and on macOS it is the only one |
| T2 | **Connector per container, USB passthrough** | container claims the USB device directly | Kernel device-cgroup / namespace — a real boundary, but **only one container can hold it**, so it isolates by *excluding* the others. Not multi-tenancy; it is a single-tenant device. | **No** on macOS (§4) |
| T3 | **USB/IP: connector per container over a network USB bus** | raw USB bus exported over TCP | **Worse than nothing.** The USB bus itself becomes a network service with no authentication, and every container gets raw device access. This *removes* the multiplexer's serialization without adding any check. | No usable macOS USB/IP server |
| T4 | **Broker in front of the connector** | container → broker (mTLS or UDS peer-creds) → connector → USB | **The only topology where the boundary is something we control and can meter.** The broker cannot read SCP03 traffic, but it *can* authenticate callers and count sessions (§8). Cost: a new trusted component we wrote, and another process to compromise. | Buildable |
| T5 | **One device per trust domain** | each tick source owns its own YubiHSM | The **device** is the boundary. No shared connector, no shared session pool, no shared log, no shared admin key. | Buildable, costs hardware |

**Reading the table.** T1 is where we are and where macOS confines us. Its boundary is real for
confidentiality and absent for everything else. T5 is the only arrangement that isolates in the sense
the word normally implies — and the n−k wipe budget already accepted for the threshold roster means
multiple devices were already on the shopping list, so T5 is less of a leap than it looks.

---

## 4. The macOS reality — two of the five topologies do not exist here

The device is attached to an Apple Silicon Mac. Containers on macOS run inside a Linux VM, and USB
passthrough requires hypervisor-level support that Docker Desktop does not provide; the supported path
is USB/IP (Docker Desktop 4.35.0+), and **macOS has no complete USB/IP server**. T2 and T3 are
therefore unavailable, not merely inadvisable.

This has a second-order consequence that is easy to miss and is a genuine finding:

> **On macOS, the connector cannot listen only on `localhost` and still serve containers.** The
> containers are inside a VM with a different network namespace, so the connector must bind an
> interface reachable from that VM. That is precisely the non-default configuration Yubico names as
> the precondition for YSA-2021-02 / CVE-2021-28484, and it is also the configuration in which any
> host process — not merely a container — can reach the port.

So the "default configuration is not remotely triggerable" reassurance in Yubico's advisories does not
apply to the topology this design requires. That is not a bug in their guidance; it is a mismatch
between their assumed deployment and ours, and it must be stated rather than inherited.

---

## 5. Attack classes, ranked by required access level

The brief is right that the access level is the whole story, so the tiers lead.

### Tier 1 — reachable from inside an unprivileged container

**T1-A · Connector response-path attack on a peer's client library. [High as a class]**
This is the only in-container path that reaches key material, and it routes *around* the device's
authorization model by never asking the device anything. If A can occupy the connector endpoint — bind
race, container-bridge spoof, or compromise of the connector process — then A is the responder to B's
`libyubihsm`, and B parses attacker-controlled bytes.

The CVE history says that position is productive:

- **CVE-2020-24387** (YSA-2020-06) — `libyubihsm` accepted session IDs 16–255 into a **16-element
  array**, giving out-of-bounds writes and reads. The handshake carrying that ID occurs *"in cleartext
  and without message authentication."* Fixed in SDK 2020.10 / yubihsm-shell 2.0.3.
- **CVE-2020-24388** (YSA-2020-06) — integer underflow in a `memcpy()` length, causing a large
  over-read — and, critically, this *"happens before the message authentication code (MAC) on the
  response packet is checked."*
- **YSA-2021-01** — improper length validation of authenticated messages; a maliciously-crafted
  YubiHSM 2 device can crash the client.

**The pattern is the finding.** Almost every SDK-side advisory in this product's history is a
client-side parser bug on the *response* path — the hostile-responder-attacks-caller direction — and at
least one executes before MAC verification. **SCP03 protects the key material; it does not protect the
client library.** "The connector is not a trusted component" is true about confidentiality and
misleading about memory safety: an untrusted component sitting on the response path of a parser with
this history is a boundary in name only.

*Status on the installed stack:* patched. libyubihsm 2.7.3 ≫ 2.0.3. The specific CVEs are **Dismiss**;
the *position* is High, because the position is architectural and permanent under T1.

**T1-B · Session-slot exhaustion. [High — and the most likely to actually occur]**
Sixteen sessions device-wide, 30-second inactivity timeout, `YHR_DEVICE_SESSIONS_FULL = -16`. Any
container holding a valid auth key — which every tick source has *by construction* — can open sessions
until the device refuses, denying every other tick source. No exploit, no vulnerability, no
misconfiguration: this is the device working as designed, used adversarially. It is also reachable **by
accident**, from an ordinary session-leak bug in one tick source, which is why it is ranked here rather
than dismissed as a mere DoS.

**T1-C · Connector denial of service. [Medium-High as a class]**
CVE-2021-28484 (YSA-2021-02) wedged the connector in an infinite loop on a request body of 0–2 bytes,
*"preventing any further operations from being performed until the connector is restarted."* Fixed in
3.0.1; installed version is 3.0.7, so this instance is **Dismiss**. The class persists: the connector
is a single-process, unauthenticated, shared serialization point, and anything that stops it stops
every tick source simultaneously.

**T1-D · Audit-log eviction. [Medium — it takes the evidence, not the keys]**
See §6. Any container performing ~62 logged operations rotates the entire evidence window out of the
device. With `force-audit` enabled it instead halts the device for everyone
(`YHR_DEVICE_LOG_FULL = -21`). This attacks "prove-ish" directly rather than attacking the keys.

**T1-E · Provisioning error — a shared domain or an over-broad capability. [High probability, High impact]**
Not an exploit; a configuration bug. And it is the single most likely *actual* isolation failure in
this design, because the device's enforcement is sound and the roster is hand-authored. Fully
preventable by a lint (§7, D1) and fully invisible to every check people usually write.

**T1-F · Delegated-capability escalation. [Critical if present — check this first]**
An authentication key carries both capabilities and **delegated capabilities**, the latter being *"the
maximum set of capabilities that can be granted to objects created or imported through that key"*
([Core Concepts]). An auth key holding `put-authentication-key` (`0x02`) with a delegated set and
domain mask reaching beyond its own partition **can mint itself a credential into a peer's domain** —
entirely within the device's rules, no exploit required. The same shape applies to `export-wrapped`
(`0x0c`) paired with objects marked `exportable-under-wrap` (`0x10`): the wrap key must share a domain
with what it exports, so a wrap key provisioned across domains for backup convenience is a
cross-tick-source export channel wearing a backup hat.

This is a **pure property of the roster**, computable without a device and without touching a key. It is
the highest-value finding class and the cheapest to witness — a coincidence §10 turns into the
incentive design.

### Tier 2 — requires host access

**T2-A · Replace or instrument the connector.** `DYLD_INSERT_LIBRARIES` on the connector process, or a
swapped binary, puts the attacker in the T1-A position without needing to win a race. Supply chain on
the connector is the same class.

**T2-B · Replace the PKCS#11 module.** `yubihsm_pkcs11` is a shared library the client trusts
absolutely. **CVE-2023-39908 / YSA-2023-01** (uninitialized memory read, CVSS 4.4) lived exactly here.
A module on disk is a driver, and the repo already learned that lesson in a different register — the
hardware probe was corrected because *a driver on disk is not an attached device*
(`081M00HVPGS087G0R0001T4BF8`). The security form of the same sentence: **a driver on disk is a
component the host can swap.**

**T2-C · Read a container's credential from host memory or its config.**

**T2-D · A host-reachable credential holding `set-option` (`0x11`) or `reset-device` (`0x1c`).** The
first can disable audit; the second wipes.

### Tier 3 — requires physical access

**T3-A · Rim-press reset.** ~10s during insert, no credential, wipes everything. Already established
and already priced: **n − k is the wipe budget.**

**T3-B · EUCLEAK — CVE-2024-45678 / YSA-2024-03.** Non-constant-time modular inversion in the Extended
Euclidean Algorithm inside Infineon's cryptographic library permits **ECDSA secret-key extraction**
from YubiHSM 2 firmware **prior to 2.4.0**. Two facts make this different from every other item here:

1. **The prerequisites are physical possession *and* a credential** — the advisory states the attacker
   *"would also require an authentication key that has the appropriate capabilities to perform signing
   actions with the affected elliptic curve key."* That is a strictly *narrower* precondition than the
   reset, which needs no credential at all.
2. **It cannot be patched.** Yubico's stated position is *"We believe that not allowing firmware
   updates is the best practice to maximize the security of your keys."* A device below 2.4.0 is
   permanently affected and the only remediation is replacement.

This qualifies the accepted consequence. "Capabilities can stop export, never erase" is right for the
reset path. For a pre-2.4.0 device, **physical access plus any signing credential can also extract**,
for ECDSA. The firmware version of the attached device is therefore a permanent, load-bearing property
that should be read once and recorded (§7, D4).

**T3-C · Device substitution.** Swap in a hostile device and the client's parser is attacked from the
device side — YSA-2021-01's threat model precisely.

### Explicitly dismissed — co-resident side channels

Calibration requires saying this plainly rather than padding the list: **no credible cross-container
side channel on this device leaks key material.** The genuinely shared resource is the device, and it is
serialized behind one USB endpoint, so what A can learn by timing its own requests is **B's operation
rate** — traffic analysis, not key bits. That is a real metadata leak and worth one sentence in a threat
model; it is not an isolation bypass. Cross-container CPU/cache side channels are a host property,
unchanged by the presence of an HSM. **Dismiss.**

---

## 6. The 62-entry ring — audit completeness and availability are strictly traded

The header declares `YH_MAX_LOG_ENTRIES 64`; Yubico's documentation states the store *"can only store
up to 62 different entries"* and that when full *"it is used as a circular buffer."* The `force-audit`
option (`YH_OPTION_FORCE_AUDIT`, `yubihsm.h:539`) inverts this: with it set, *"if the log buffer is
full, no new operations can be performed unless logs are audited"* (`yubihsm.h:2162`), surfacing as
`YHR_DEVICE_LOG_FULL = -21`.

There are exactly two configurations and both cost something:

| `force-audit` | what a full log does | what it costs |
|---|---|---|
| **off** (default) | oldest entries are overwritten | **the evidence is destructible** — by an adversary, and by ordinary traffic. A tick source signing once per second erases the window in about a minute. |
| **on** | the device refuses all operations | **every tick source halts at once**, dependent on a log drainer that is itself a session-consuming, log-entry-consuming client. |

> **On this device, audit completeness and availability are strictly traded, 62 entries at a time.
> There is no third option.**

The consequence for the disclosure programme is direct and is why §10 refuses a particular witness
class: **the on-device audit log cannot be the witness for a disclosure**, because an adversary who can
perform 62 operations can evict it, and a busy tick source evicts it without any adversary at all.

---

## 7. Discriminating checks vs. checks that only look like checks

The failure mode for isolation claims is specific: *a check that would pass whether or not the
isolation holds.* Five that will be written, and why each is vacuous:

**V1 — "A session opened with A's auth key can sign with A's key."**
Tests function, not isolation. Passes identically when every tick source shares one domain.

**V2 — "Container A cannot read `/run/secrets/b-auth-key`."**
Tests the filesystem. The boundary is on the device. This passes while A and B share a domain — it
cannot discriminate a device-level authorization property, only a credential-at-rest property.

**V3 — "The connector is reachable only on localhost."**
Under T1 on macOS this is false by necessity (§4). Where it is true it still discriminates nothing:
**reachability is not authorization**, and the connector authorizes nothing. It also passes in the exact
case under test, since both containers are legitimate callers.

**V4 — "`yubihsm-shell` reports N distinct authentication keys."**
A count is not an identification. N distinct auth keys with *overlapping domains* is the failure mode,
and it produces the identical count. (`.claude/rules/numerology-vs-number-theory.md` — the invariant,
not the cardinality.)

**V5 — the insidious one: "attempt cross-access, assert an error was returned."**
This passes when the object does not exist, when the connector is down, when the session failed to
open, and when the label was mistyped. **Four ways to pass with zero isolation.** It is made worse by the
`-22` vs `-20` distinction in §1: cross-domain access returns `YHR_DEVICE_OBJECT_NOT_FOUND`, which is
indistinguishable from a misconfigured test.

> **The methodological point that matters most in this document:** a negative test with no positive
> control **in the same run** is the vacuity class. The cross-access refusal only means something when
> the *same run* shows the legitimate holder succeeding against the *same object*.

Checks that genuinely discriminate:

**D1 — Roster lint: domain-disjointness and capability minimality.** A pure computation over the
declared provisioning artifact. Fails when anyone adds a shared domain or a capability outside the
minimal set. Mutation-testable: flip one domain bit in the roster and the lint must go red — if it does
not, the lint is itself vacuous (`src/Core.TypeScript/hygiene/mutation-runner.ts` is the existing
apparatus for exactly this).

**D2 — The paired access matrix.** For every (credential *i*, object *j*): assert `i ≠ j` is refused
**and** `i = i` succeeds, in one run. N² cells with the diagonal as the built-in positive control. This
is vacuity-proof by construction and it is the only test in the set that is a genuine falsifier of
isolation.

**D3 — Delegated-capability closure.** For each auth key, compute the transitive closure of what it
could *create*, and report reachability from credential *i* into domain *j*. Catches T1-F. Requires no
device, no session, no key material — it is arithmetic over text.

**D4 — Firmware version read-back, once.** `≥ 2.4.0` or the device is permanently EUCLEAK-affected
(§5 T3-B). Not upgradable, so this is a one-time check with a permanent answer that belongs in the
roster as a recorded fact.

**D5 — Session budget.** Sum of steady-state sessions across all tick sources `< 16`, with named
headroom. Fails when a 17th tick source is added, which is the moment the design silently breaks.

**D6 — Log policy declared explicitly.** `force-audit` on or off, chosen deliberately and recorded with
its cost from §6. An undeclared choice here is the vacuity class applied to evidence.

Note what the D-list is made of: **D1, D3, D5 and D6 need no hardware at all**, D4 is a single read, and
only D2 needs a device. The overwhelming majority of what can be honestly checked is checkable in CI on
a machine with no HSM attached.

---

## 8. Noninterference — the connector is an undeclared ambient channel

Discipline #7 / manifesto §13: entropy and influence cross only through **declared, metered** channels.
Under T1 every tick source's access to the device flows through a door that nobody declared and nobody
meters. That is the noninterference violation stated structurally, and it is what T4 exists to fix.

A broker can do two things the connector cannot, and it is worth being precise about the mechanism
because the obvious objection ("the broker can't read SCP03") is correct and does not matter:

1. **Authenticate the caller.** Over a Unix domain socket, the kernel supplies peer credentials — the
   one place in this entire stack where a *kernel-enforced* caller identity is available. On macOS the
   VM boundary rules out a UDS, so it must be mTLS over the VM network, which is a weaker but real
   identity.
2. **Enforce a per-caller session budget.** The broker cannot decrypt SCP03 — and does not need to.
   Session establishment is a distinct command and **the session ID travels in the clear**; that is
   exactly why CVE-2020-24387 was reachable. So a broker can count session-open and session-close per
   authenticated caller without inspecting a single byte of protected payload.

That second capability is the only mitigation available for **T1-B (session exhaustion)**, which nothing
else in the design addresses. Its honest cost: a new trusted component we wrote, one more process on
the response path — i.e. one more occupant of the T1-A position — and latency on every operation.

---

## 9. Answering the prior note's open question — is L1 worth landing alone?

`2026-08-14-code-bound-key-access…` §8 Q1 asked whether per-agent HSM auth-key isolation is worth
shipping on its own, or whether it manufactures a false sense of isolation. Both halves of the answer
are now supported.

**Containers materially strengthen L1, and the prior note could not have known this.** That note graded
L1 thin because *"same user, same filesystem, a debugger, a log, a core dump"* — four vectors, all of
which are credential-confidentiality vectors. Containers with distinct UIDs, no shared mounts, and no
`CAP_SYS_PTRACE` **remove all four**. So containerization genuinely upgrades L1 from "thin" to
"meaningful against a non-root in-container adversary." That is a real correction to the prior grading.

**And it manufactures a false sense of isolation if shipped bare**, for a reason the note anticipated in
shape but not in detail: the tidy per-agent-auth-key diagram displays the confidentiality property and
conceals the availability property (T1-B), the client-path property (T1-A), and the evidence property
(§6). All three are absent, and none of them is visible in the diagram.

**Verdict: land it, conditionally.** L1 under containers is worth shipping **if and only if** it ships
with D2 (the paired matrix), D1/D3 (the roster lints), and the written coverage statement from §0.
Those are what convert "each agent has its own auth key" from a diagram into a claim. Without them it is
the false sense of isolation, and the falseness is specific and nameable rather than vague.

**One weight-free finding that should not wait.** Provisioning requires *some* auth key holding
`put-authentication-key` and the `delete-*` capabilities, and that key is a single point of total
compromise across every tick source — a **standing, device-wide authority**, which is a weight
(manifesto §3) and a central point of control (§1). It has a clean resolution: **provision once, then
delete the admin authentication key.** The device is then left with no credential capable of creating or
deleting objects; re-provisioning becomes a reset, and a reset is a wipe. That trade is already priced —
the roster's wipe budget is n − k — so deleting the admin key converts a permanent capture risk into a
consumption of an allowance the design already accepted. This is the one recommendation here that
removes a risk instead of measuring it.

---

## 10. Scoring and paying for disclosure — through `measure`, not a parallel scheme

`src/Core.TypeScript/ledger/measure.ts` already refuses `malformed-key`, `unknown-work-item`,
`untitled`, `unmeasured`, `unreasoned`, and `unwitnessed`, prices **ordinally** (a ΔU sign, never an
invented number), and is idempotent by work-item key. Nothing new is needed. What *is* needed is a
class-specific answer to **what a witness looks like for an isolation bypass**, because "the test that
fails without the fix" is not obvious for a hardware boundary.

**Three admissible witness forms, in descending strength:**

- **W1 — a matrix cell flip.** The D2 paired access matrix gains a cell that is red before the fix and
  green after, **with the diagonal positive control passing in the same run**. Most provisioning-class
  bypasses produce a W1 witness, because they are roster properties and the roster is text.
- **W2 — a roster lint going red on the pre-fix artifact.** The D3 delegated-capability closure reports
  reachability from credential *i* into domain *j* that was previously unmodelled. **Pure computation —
  no device, no session, no key material** — therefore CI-runnable by anyone, including a discloser with
  no hardware.
- **W3 — a device-free reproduction against a simulated responder.** For client-path findings (T1-A),
  the witness is a fake connector: an HTTP endpoint returning the crafted response, plus the assertion
  that the client misbehaves before the fix. No real device, no key material, no session.

**Three class-specific refusals, each a falsifier the generic verb would not catch:**

- **Witnessed only by the on-device audit log → refused.** §6: it is a 62-entry ring, evictable by the
  adversary and by ordinary traffic. **A witness the attacker can delete is not a witness.**
- **A negative assertion with no positive control in the same run → refused.** The V5 vacuity. This is
  the single most likely bad submission and the easiest to check mechanically.
- **A physical-access finding that restates the reset → measured `unchanged`, not `reduced`.** The
  physical path is already priced at n − k wipes; restating it banks no new ΔU. (A physical finding
  that *changes* the accepted model — as EUCLEAK does, by adding extraction to erasure — is `reduced`
  and should be filed.)

**The score is two ordinals crossed, and no invented numbers.** The repo's register is ordinal
deliberately, because no metering discipline here could produce a cardinal price
(`toy-is-free-metered-must-be-earned.md`). So the score is **required-access tier**
(in-container > host > physical — the brief's own ranking, and the correct one) crossed with **witness
strength** (W1 > W2 > W3). Both axes are justified; neither is a number someone made up.

**Payment needs no new currency.** Under
`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`, budget is credited when others attest
you added value. A bypass disclosure with a W1 or W2 witness adds value to **every tick source at once**
— the shared-seed clause, leveraged rather than local. The existing earning path already covers it, and
inventing a bounty table would be exactly the purchasable-standing failure that rule warns against.

**The incentive property worth designing for on purpose.** Notice the coincidence in §5: **the
highest-value finding class (T1-F, delegated-capability escalation) is also the cheapest to witness (W2,
pure arithmetic over the roster).** That should be made deliberate rather than left as luck. If the only
way to demonstrate a bypass were to *use* a peer's key, the programme would pay people to touch key
material — the exact behaviour it exists to prevent. **Accepting W2 as a full-strength witness means a
discloser never has to run the exploit to get paid.** Make the safe path the profitable one.

---

## 11. Pointers

- `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md` — the L1/L2/L3 ladder; §9 above answers its §8 Q1
- `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md` — the destruction-not-leakage frame the n − k wipe budget comes from
- `tools/setup/persona-keys/frost-share-adapter.ts` — the L1 tier and its stated ceiling *(other agents own this path; referenced, not modified)*
- `src/Core.TypeScript/ledger/measure.ts` — the verb §10 routes disclosure through; its refusals are the falsifiers
- `.claude/rules/every-bug-has-economic-value.md` · `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the economics, unchanged
- `.claude/rules/numerology-vs-number-theory.md` — why V4 is vacuous
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the score stays ordinal
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference — §8's undeclared channel
- `/usr/local/include/yubihsm.h` (libyubihsm 2.7.3) — every constant in §1

**External sources.** [Core Concepts] and [Access Control]:
`https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-intro-core-concepts.html` ·
`https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-intro-access-control.html` ·
[Connector] `https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-tools-connector.html` ·
YSA-2020-06 (CVE-2020-24387, CVE-2020-24388) `https://www.yubico.com/support/security-advisories/ysa-2020-06/` ·
YSA-2021-01 `https://www.yubico.com/support/security-advisories/ysa-2021-01/` ·
YSA-2021-02 (CVE-2021-28484) `https://www.yubico.com/support/security-advisories/ysa-2021-02/` ·
YSA-2021-04 `https://www.yubico.com/support/security-advisories/ysa-2021-04/` ·
YSA-2023-01 (CVE-2023-39908) `https://www.yubico.com/support/security-advisories/ysa-2023-01/` ·
YSA-2024-03 (CVE-2024-45678, EUCLEAK) `https://www.yubico.com/support/security-advisories/ysa-2024-03/` ·
Docker Desktop USB/IP `https://docs.docker.com/desktop/features/usbip/`

**Anchors (Beacon).** Saltzer & Schroeder, *The Protection of Information in Computer Systems* (Proc.
IEEE 63(9), 1975) — least privilege and complete mediation; the connector is the complete-mediation
failure, since it mediates every request and checks none. Wulf et al., **HYDRA** (CACM 1974) — a
capability names both an object and the rights over it, which is exactly the shape of a YubiHSM
delegated-capability set, and the escalation in T1-F is the classical capability-amplification problem.
Goguen & Meseguer (1982) — noninterference, §8.
