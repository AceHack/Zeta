# B9: the Linux consent adapter is a REMOTE CHANNEL, not a local factor

**Register:** the mechanism findings are **verified in code and cited by file**. The
recommendation is a **design judgement and Aaron's to overrule** — recorded here so the
obvious fix is not applied by reflex.

---

## 1. B9 is accurate, and the abort is structural

`tools/setup/persona-keys/biometric.ts`:

```ts
/** The biometric platforms we know how to gate on. `unsupported` ⇒ fail-closed. */
export type BiometricPlatform = "macos-touchid" | "windows-hello" | "unsupported";
```

On Linux the gate returns `{ ok: false, platform: "unsupported" }` and reports it honestly
rather than pretending. Everything that gates on it therefore refuses — which is why the
register says eleven CLIs abort with no machine key, no CA and no certs on the target
hardware. **Nothing here is a bug.** The gate is doing what a fail-closed gate does.

## 2. The obvious fix would defeat the thing it unblocks

The register's own wording — *"needs a Linux consent adapter"* — invites the reading
"make Linux return `ok: true`". Two candidate mechanisms present themselves, and **both
fail, for reasons already written down in this repo**:

**TPM attestation.** A TPM attests **a machine**, not **a human**.
`federated-identity/ceremony-gate.ts` draws the line precisely:

> **CEREMONY** ⟺ the operation ESTABLISHES or WIDENS trust, or is irreversible.
> *Cryptography cannot decide these: there is no prior fact to chain to, so the only
> remaining source of authority is a human.*

A TPM-satisfied ceremony gate is a gate that has been **satisfied by the very machine
asking**. The same file names that move: *"Unattended operation that quietly swallowed
that gate would be a privilege escalation dressed as a convenience — the shadow may
INHERIT standing authority, never EXTEND it into a gated class."*

**`pam_fprintd` (fingerprint).** This one *is* a human factor and the parsing work already
exists — `src/Core.TypeScript/pam/auth-chain.ts` was generalised specifically so the same
attribution question could be asked of `pam_fprintd.so`. But it requires **a human at the
box**, which is the thing Aaron's hardware constraint rules out:

> *"we want the hardware to be completed contorlled by the AI and the code after bootup
> and not need human intervention except though our declared UI and interfaces from humans
> remotely."*

## 3. His constraint already contains the answer

The exception clause is the design: **"except through our declared UI and interfaces from
humans remotely."** So the Linux adapter is not a local authentication factor at all —
it is a **transport for a remote human's approval**.

That keeps both properties simultaneously, which neither candidate above does:

| requirement | remote channel | TPM auto-approve | fingerprint |
|---|---|---|---|
| a **human** authorises the gated class | ✅ | ❌ machine authorises itself | ✅ |
| **no human at the box** | ✅ | ✅ | ❌ |
| the gate is not widened | ✅ | ❌ | ✅ |

**The TPM still has a job, and it is a different one.** It attests *which machine is
asking* so the remote approver is not authorising a bare prompt. Machine attestation and
human authorisation are two factors answering two questions; the error is substituting the
first for the second.

## 4. Before building an adapter, note what the gate is NOT

`ceremony-gate.ts` carries its own vacuity disclosure, and it changes the work:

> *`ceremonyRequirementFor` is a CLASSIFIER, not an ENFORCER. It returns a label. Nothing
> in this repo prevents a caller from ignoring the label and proceeding. The one place the
> gate is structurally enforced is `yubiHsmSignerRequiringCeremony`, which cannot produce
> a signature at all — and it cannot because the credential to open a session is absent,
> not because this classifier stopped it.*

So an adapter that merely returns `ok: true` on Linux would **not** be adding a gate to
anything; it would be removing the one refusal that currently holds. The enforcement lives
in the *biometric* call being fail-closed and in the HSM credential being absent — not in
the classifier.

## 5. What would actually need building

Stated as scope, not as a plan I have authority to adopt:

1. **A remote approval transport** — the node emits a signed request naming the operation
   (from `ceremony-gate`'s closed set) and its own attested identity; a human approves
   from a declared interface; the node verifies the approval. The **closed command set**
   property applies: a peer may NAME an operation and never DEFINE one.
2. **TPM machine attestation** alongside it, so the approver sees which box is asking.
   `full-ai-cluster/nixos/modules/tpm2-seal-model.nix` and `tpm2-seal-prereqs.nix` exist;
   whether they are sufficient is **unverified** here.
3. **A fourth `BiometricPlatform` arm** — the current union is closed at three, and a
   remote-approval result is not "biometric" in any of the existing senses. Reusing
   `macos-touchid` would be a false attribution of exactly the kind `auth-chain.ts` was
   written to prevent.

## 6. The recommendation, and its limit

**Do not add a Linux arm that returns `ok: true` from a machine-local factor.** It would
turn eleven honest refusals into eleven silent approvals, and the register would read as
fixed while the property it protected was gone.

**This is a design decision, not a defect.** The gate's own register says the embedded
policy *"is a design judgement, not a measurement, and it is Aaron's to overrule."* The
same applies to this document.

## Pointers

- `tools/setup/persona-keys/biometric.ts` — the three-platform union and the fail-closed arm
- `src/Core.TypeScript/federated-identity/ceremony-gate.ts` — the ceremony/unattended principle and the vacuity disclosure
- `src/Core.TypeScript/pam/auth-chain.ts` — Linux PAM attribution, already generalised for `pam_fprintd.so`
- `full-ai-cluster/nixos/modules/tpm2-seal-model.nix` · `tpm2-seal-prereqs.nix`
- [`no-directives.md`](../../.claude/rules/no-directives.md) — inherit authority, never extend it into a gated class
- [`gated-action-find-the-third-path.md`](../../.claude/rules/gated-action-find-the-third-path.md) — a binary between a gated action and a bad action is usually a false dilemma
