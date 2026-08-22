# KSP + PKI proxy: mostly already decided, Microsoft is not in the way — and `yhusb://` deletes the problem

**Mateo / security-researcher.** **Date:** 2026-08-20 · **Register key:** **measured** (artifact
exercised) · **checked** (primary source, named URL, fetched this date) · **cited** (secondary) ·
**unknown** (named, not omitted).

Answering Aaron: *"can we write our own version of Windows KSP: PKI Proxy for ourselves too to
connect into any HSM we support."*

## 0. The three sentences

1. **The ask is already 90% decided.** `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`
   is the abstraction; `federated-identity/ports.ts` is the shipped port. **A KSP is one more adapter
   on the Windows side of an existing port; a "PKI proxy" is one more adapter on the POSIX side.**
   Neither is a new architecture.
2. **The KSP is not blocked by Microsoft signing — that fear is stale (§A1).** It is blocked by
   **having no consumer**: no Windows node, no ADCS, no IIS. Windows appears in this repo only as a
   *dev-workstation* setup target.
3. **The highest-value finding deletes work rather than adding it:** `libyubihsm` speaks **`yhusb://`
   — direct USB, no connector daemon, no loopback listener at all.** Every finding in the connector
   threat model — takeable-with-`kill`, unauthenticated loopback, Tor re-export, the pre-auth surface
   — exists **only because the HTTP connector is running.** For our own callers on macOS/Linux it is
   optional. **Stop the connector and the boundary problem is not mitigated, it is absent.**

## A. Windows CNG KSP — feasibility

### A0. What it is, and the minimum

A **user-mode DLL** exporting `GetKeyStorageInterface`, returning an
`NCRYPT_KEY_STORAGE_FUNCTION_TABLE` (27 members). **The minimum for a signing-only provider is not a
guess — a shipped one enumerates it.** Google's open-source Cloud KMS CNG provider documents exactly
what it supports (**checked**, [kmscng user guide](https://github.com/GoogleCloudPlatform/kms-integrations/blob/master/kmscng/docs/user_guide.md)):
open provider, open key, **sign hash**, enum keys, enum algorithms, get property, free, export
**public keys only**. **Unsupported: key creation, deletion, encrypt/decrypt, derive, import, verify,
secret agreement.**

That is the shape: **open, enumerate, get public key, sign hash — everything else refuses.** Whether
an unimplemented slot may be `NULL` or must stub `NTE_NOT_SUPPORTED` is **unknown** (falsifier: the
CPDK `ksp` sample, ~1 hour on a Windows VM).

### A1. Signing verdict — **no Microsoft signature required. No appointed hub here.**

- **The CSP signing service is dead and Microsoft says so:** *"Microsoft will no longer sign CSPs, and
  the manual CSP signing service has been retired."* And decisively: **"Starting with Windows 8, it is
  no longer a requirement that CSPs must be signed."** (**checked** —
  [Authenticode Signing of Third-party CSPs](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode-signing-of-csps))
- **The PPL/LSASS gate does not reach a third-party KSP, because one is never loaded there:** *"Third
  party KSPs are not loaded in the key isolation service (LSA process). Only the Microsoft KSP is
  loaded in the key isolation service."* (**checked** —
  [Key Storage and Retrieval](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-and-retrieval)).
  The must-be-Microsoft-signed constraint people cite is a **protected-process** rule — real, and off
  our path.

**Honest limit, stated rather than rounded:** no primary Microsoft page states a signature requirement
for a CNG *KSP* — **and absence of a documented requirement is not a documented absence.** Secondary
sources assert one loosely and do not substantiate it when read. Circumstantial support is strong:
every shipped third-party KSP is vendor-signed with an ordinary code-signing certificate, and a
Microsoft Q&A thread shows a developer registering a custom CNG provider with **no signing mentioned
by anyone, including the MSFT responder**.

> **Falsifier, cheap:** build the CPDK sample KSP **unsigned**, register it, call
> `NCryptOpenStorageProvider`. One VM, under a day. Kernel-mode is the genuinely gated case — **and a
> KSP is user-mode, so it does not apply.**

**Verdict: not an appointed hub. Cost of the production path ≈ one ordinary code-signing certificate,
which we need anyway.**

### A2. Existing bridges — enough that writing one is mostly wasted

| route | status | covers |
|---|---|---|
| Windows' own **Microsoft Platform Crypto Provider** | ships in Windows | **TPM 2.0 — the base case is already solved by the OS** |
| **Smart-card minidriver + Microsoft Smart Card KSP** | the real generic bridge | Register a minidriver under `…\Calais\SmartCards\<name>` and **Microsoft's own KSP fronts your device** (**checked**, [Minidriver Registration](https://learn.microsoft.com/en-us/windows-hardware/drivers/smartcard/minidriver-registration)). **OpenSC ships `opensc-minidriver.dll`** ⇒ **the CardContact/Nitrokey HSM 2 already reaches CNG with zero code from us** |
| Yubico's YubiHSM 2 KSP | ships in the SDK | YubiHSM 2 on Windows — **but see A4** |
| **A generic PKCS#11→KSP shim** | **does not exist as a maintained neutral project** | near-misses are per-vendor or hobby-scale. **The one genuine gap** |

**So writing our own KSP would buy** only: one Windows seam across *all* device classes instead of
three vendor paths, escaping A4, and putting our own velocity limits in the Windows path. **All three
are real; none has a consumer today.**

### A4. A finding against the KSP we would otherwise adopt

From Yubico's own KSP page (**checked**):

- *"Design considerations for Key Storage Providers in Windows prevent the direct USB functionality of
  libyubihsm (Connector URL `yhusb://`), therefore it is not supported in this version of the YubiHSM
  KSP."* ⇒ **on Windows the connector is mandatory**, so the whole connector threat model *does* apply
  there, and **the `yhusb://` escape hatch is POSIX-only.**
- Registry `HKLM:\SOFTWARE\Yubico\YubiHSM` carries **`AuthKeysetPassword`** — the HSM authentication
  credential, **in plaintext in the registry**, minimum eight characters.

**That is the connector doc's config A ("password in file/env → unbounded signing across every
capability and domain that key reaches"), shipped as the vendor default.** Severity: Medium, **and
zero for us today** — we run no Windows CA. A *do-not-adopt-as-configured* note, not a bug in our tree.

### A5. The structural fact that makes the two faces one design

Read A4's first bullet again: **it is not a Yubico limitation, it is a property of CNG.** A KSP is
loaded into **every calling process** (certreq, IIS worker, signtool, a .NET app). A USB HSM is an
**exclusively claimed** device. **N processes cannot each claim it.**

> **Therefore any KSP over a USB device is necessarily a thin client of a single device-owning
> broker.** Yubico's broker is the connector.

Derived from the public CNG loading model, not from anyone's implementation — and it settles the
framing: **the KSP and the "PKI proxy" are not two products. The KSP is a ~400-line client of the
proxy, and the proxy is the thing that has to be right.**

## B. The proxy, answered against the connector findings point by point

### B0. First, the move that makes most of this unnecessary

Use **`yhusb://`** and run **no daemon** where a single process needs the device. Findings 1, 2, 5 and
reachability rows R1/R4/R6/R8 are **properties of a listening socket**; with no socket **they do not
exist.** The cost is honest: **exclusive device claim — exactly one process at a time.** Build the
proxy only when a second concurrent consumer actually exists.

### B1. Trust boundary — lead with the disqualifying fact

On the measured host, `dscl . list /Users` returned **exactly one account.**

> **Peer credentials on a single-account host authenticate nothing** — every caller, honest and
> hostile, presents the same uid. **The proxy's caller authentication is worth exactly as much as the
> OS account separation beneath it, and today that is zero. Per-agent OS accounts are the
> prerequisite, not an enhancement.**

Ship accounts first and the boundary can be retrofitted; ship the proxy first and you have built **a
control that cannot fail — the vacuity class, and worse than no proxy because it reads as
protection.**

With per-agent accounts: **peer uid → roster row → SPIFFE path → `hsm-domain-map` grant.** The uid is
supplied by the kernel, not the caller.

### B2. Unix socket, not TCP — and the decisive reason is *not* `SO_PEERCRED`

Peer credentials are real (`SO_PEERCRED` on Linux; `LOCAL_PEERCRED` on macOS/BSD gives **uid but no
pid**), **but the bigger win is earlier than the syscall:** a Unix socket is a **filesystem object**.
`0600`, owned by the proxy's uid, in a `0700` directory ⇒ **the kernel refuses `connect(2)` before a
single protocol byte is read.** TCP loopback has no such gate. **Prefer uid; use pid only for
logging** — pid is a TOCTOU hazard, and the repo already carries the PID-recycle blade.

**Windows caveat:** AF_UNIX on Windows has no documented peer-credential option; the equivalent is a
**named pipe** with a DACL. **The port must abstract "local channel with peer identity", never "unix
socket".**

**It is never a network service.** If a peer on another node needs a signature, it asks that node's
agent and *that node's* local proxy signs. **That constraint is what keeps this out of §1 and out of
the patent boundary.**

### B3. Supervision — the direct answer to "takeable with `kill`"

**Socket activation.** The listening socket is created and **held by PID 1**; killing the service does
not release the address, and connections queue in the kernel backlog (**checked**,
[systemd.socket(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html);
launchd's `Sockets` key is the macOS equivalent).

> **This inverts the measured failure: an attacker can no longer take the endpoint with `kill` — the
> address is owned by init.** They must unload the unit, which is privileged and loud.

### B4. What it REFUSES — a proxy with no refusals is a passthrough

Closed command set: a caller may **name** an operation and can never **define** one.

1. **Operation not in the set** — permanently absent: `export-wrapped`, `put-authentication-key`,
   `set-option`, `reset-device`, `delete-object`. **Not gated. Absent.**
2. **Peer uid not in the roster.**
3. **Key outside the caller's domain grant** — reuses `hsmDomainDecision`, **upgrading that file from
   classifier to enforcer.**
4. **Unattended sign on a presence-gated device** (Trezor/Ledger) — typed, §C.
5. **Algorithm the device does not have** — secp256k1 on Secure Enclave or TPM 2.0. Named, never a
   runtime surprise.
6. **Velocity/budget exceeded.** **Honest limit: a same-host limiter bounds a compromised *agent*, not
   a compromised *host*. It does not satisfy "off-host velocity limits" and must not be listed as if
   it does.**
7. **Device-identity alarm** — `Authenticate Session` failure and `Log used` going backwards fail
   closed. **The check on the *right* side of the boundary.**
8. **Refuses to be reachable off-node** — bind failure if the channel is not local. **A test, not a
   comment.**

### B5. Does it hold key material or a credential?

**Key material: never.** The port cannot express extraction — **structural, not policy.**

**A credential: yes, and pretending otherwise would be the illusory config D.** The 30 s inactivity
expiry means unattended signing *requires* a resident credential. So: **the proxy is the only process
that holds it; N credentialed processes become one.** Fetched from the OS keystore, `mlock`'d, never
in `argv`, never in an env var, never logged, **and never in the registry (§A4).** Blast radius is
bounded by per-agent keys + minimal capabilities + distinct domains, **not by hiding the credential.
Compromise of the proxy = full use of what that credential reaches. Say it out loud.**

**Residual risk accepted, not solved:** the proxy inherits the **response-parse position**. Moving the
parser into a smaller, unprivileged, network-less process **narrows** it; it does not remove it.

### B6. Scorecard

| finding | this design |
|---|---|
| unsupervised, takeable with `kill` | **Answered** — address owned by PID 1 |
| loopback is not a boundary | **Answered structurally** — no listener under `yhusb://`; else filesystem-mode + uid gate, **conditional on per-agent accounts** |
| 30 s ⇒ resident credential | **Not solved — bounded.** One holder instead of N |
| no velocity limit anywhere | **Partially** — off-host still unbuilt |
| Tor same-uid re-export | **Answered** — nothing to re-export |
| `serial=*` | correctness pin; detection moves to auth-failure + log-counter alarms |
| 62-entry ring can't witness spending | **Not solved.** The proxy's own log is *host-side* evidence and the host is the assumed adversary. **Do not present it as an audit trail** |

### B7. Clean-room and §1 check

Designed from public standards only — CNG docs, the minidriver spec, PKCS#11, the TCG registry,
Yubico's public docs. **No Itron code or spec was consulted.** A device-owning process is **not** a
mediating hub: it brokers no peer traffic, is node-local and unreachable from other nodes, is
one-per-device rather than one-per-fleet, and **exit is real** — a caller can bind TPM, Secure Enclave
or software adapters without it.

> **The moment anyone proposes that this proxy serve other nodes, it becomes an appointed hub and both
> §1 and the patent boundary bite. That sentence belongs in the file header.**

## C. The port shape — refusals typed, not surprising

Extends `ports.ts`. Idiom copied from `RootOfTrustClass`: **a closed union, so a new device family is
a type error until its profile is stated.** `CustodyDeviceClass` = software · tpm2 (**base case**) ·
apple-secure-enclave (**P-256 only**) · pkcs11-token · yubihsm2 · presence-gated-wallet.
`CustodyProfile` carries `attendance`, `algorithms` (**absence IS the refusal**), `exposureBoundary`,
`rootOfTrustClass` (reuse, do not fork), `channel`, and **`exclusiveClaim`** — which **forces §A5's
broker question into the type** rather than leaving it to be rediscovered.

Three things this makes structural: **a presence-gated device cannot serve an unattended sign**
(`planSign` is total; that pairing has exactly one arm and it is a refusal); **Secure Enclave cannot do
secp256k1** (a named arm carrying `available`, so the caller falls back rather than crashes); and the
five-way `RootEvidenceState` is **never collapsed**.

**Honest limit — do not read this as more than it is.** TypeScript cannot make the *device→intent*
mismatch a compile error in general, because the profile is resolved at runtime from a probe. What
**is** compile-enforced: every device class has a stated profile, every refusal arm is handled, and an
unattended call site cannot construct a `SignIntent` without a budget. **The rest is a total function
with tests — the repo's normal standard, not a guarantee.**

`Phase`, never `Date.now()`. Velocity windows are *local behaviour* and may use the local clock; **the
verdict may not.**

## D. Scope verdict

**Build, in this order:**

1. **Per-agent OS accounts + the delegated-capability lint.** No hardware, no device contact, no new
   process. **Without account separation every later boundary is vacuous (§B1). This is the whole
   prerequisite and it is not a proxy.**
2. **`CustodyProfile` + `planSign`**, wired to the existing probe. Hours; passes with no hardware;
   falsifier = a test that fails if the Trezor row is marked `unattended-capable`.
3. **Move every YubiHSM path to `yhusb://` and stop the connector.** A day. **Deletes an attack
   surface instead of adding a control**; costs exclusive device claim.
4. **Only if a second concurrent consumer genuinely exists:** the socket-activated node-local signer.

**Do NOT build:** a **Windows KSP** (no consumer — and if one appears: SmartCard-HSM → OpenSC
minidriver + Microsoft's own Smart Card KSP, **zero code**; TPM → Microsoft Platform Crypto Provider,
**ships with Windows**; YubiHSM → Yubico's KSP with §A4 fixed by policy). A **network PKI proxy**
(§B7). **Our own PKCS#11 provider** — PKCS#11 already *is* the cross-platform seam for everything
except Windows, and Windows is covered by minidriver + built-in KSPs.

> **So the honest answer is: yes, and most of it already exists.** The 5% that does not is (a) OS
> account separation, (b) the typed profile/refusal table, (c) turning off the connector. **The KSP is
> a real, tractable, unblocked build — Microsoft is not in the way — and it has nobody to serve yet.**

### Verification note (Otto, landing this)

Two claims re-checked before landing. **The Windows-8 signing sentence confirmed** on Microsoft's live
page. **`yhusb://` confirmed** from Yubico's own KSP page, which names it while explaining why Windows
cannot use it — *"prevent the direct USB functionality of libyubihsm (Connector URL `yhusb://`)"*.
**I did NOT exercise `yhusb://` on the attached device:** it claims the device exclusively (§A5) and
would take it from the maintainer's running connector. It stays **checked**, not **measured**, and the
falsifier is one command on a host where no connector is serving anything.
