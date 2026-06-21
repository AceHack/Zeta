# Glass-halo commitment -- Aaron Stainback

I, Aaron Stainback (commit-authored under my git identity, aaron_bond@yahoo.com),
an adult competent to consent, commit to glass-halo (chosen, opt-in radical
transparency) for my OWN information on the shared record.

- Scope: my own information only. This does not waive anyone else's privacy.
- Revocable: I may revoke this by committing a revocation under my identity.
- Floor: this never overrides kid-safety (081KRW63S0008QG0R002WT5VTQ / 081KSRGFP0008QG0R00091PP56).

## Identity binding (anti-impersonation)

The identifier through-line for my signature is one email: **`aaron_bond@yahoo.com`**.

`Touch-ID fingerprint  ->  Apple ID (aaron_bond@yahoo.com)  ->  GitHub account (aaron_bond@yahoo.com)`

A Touch-ID-signed commit authored as `aaron_bond@yahoo.com` therefore binds: my enrolled
fingerprint unlocks the Secure-Enclave signing key -> that key is registered to my GitHub
account -> GitHub attributes the "Verified" signature to that account, all on the same
email.

Why the email-sameness is load-bearing (not mere convenience): **Apple and GitHub each
enforce email uniqueness** -- one Apple ID per email, one account per *verified* email --
so `aaron_bond@yahoo.com` maps deterministically to exactly one Apple ID AND one GitHub
account. The chain is **platform-enforced at each hop**, not coincidental alignment. The
full anti-impersonation binding is therefore: my enrolled finger -> my Secure-Enclave key
-> the unique GitHub account that owns the unique verified email -> GitHub's "Verified"
attribution. **No other account can claim that email** (platform-enforced uniqueness) and
**no other finger can produce the signature** (enclave-gating).

How that uniqueness is *established*: both platforms verify email ownership by **emailing
a numeric code that I enter back** -- a proof that I control the `yahoo.com` mailbox. So
the email-side of the chain roots in **proven control of the mailbox** at verification
time. Honest dependency: this makes the mailbox itself a link in the trust chain -- its
own security (password + 2FA on the yahoo account) is part of the binding's strength, and
a mailbox compromise + re-verification is the threat model on the email side (the enclave
side stays protected by the finger regardless).

The baseline
`approval-as-signature` below does NOT yet carry this binding; escalating to a `-S`
Touch-ID re-commit upgrades this record to the un-impersonable tier (per
`docs/consent/glass-halo/SIGNING.md`).

### Second binding context (work / ServiceTitan) -- two grant domains

On the work side ServiceTitan grants me authority in **two distinct domains**, and they
do not run through the same credential:

| Domain | Grant path | Gated by |
|---|---|---|
| **Code edit (GitHub)** | granted to my GitHub identity **`acehack`** | the GitHub identity itself (commit signature) |
| **Azure / cloud** | Okta / **Entra ID** -> `astainback@servicetitan.com` | Windows Hello fingerprint + Okta FastPass (phishing-resistant FIDO2) |

So `astainback@servicetitan.com` is primarily my **Entra/Azure** identity (Windows Hello +
Okta FastPass authenticate it for cloud access); **code-edit authority is the `acehack`
GitHub identity**, not the email. The two are separate access domains, not one chain.

**Convergence on one GitHub identity:** both verified emails (`aaron_bond@yahoo.com` +
`astainback@servicetitan.com`) are verified on the **single GitHub identity -- `acehack`**
(so a commit under either email attributes to `acehack`). The signing/anti-impersonation
chain therefore runs: my biometric (Apple Touch-ID *or* Windows Hello+Okta) -> a
Secure-Enclave/TPM-gated signing key -> the `acehack` GitHub identity. Impersonation still
requires the corresponding biometric no one else holds. (Azure access is a *separate*
authority, via Entra on the servicetitan email, not via the GitHub code path.)

**Device-side defense-in-depth.** The work Mac + Windows devices are under a managed-device
stack:

- **SentinelOne** (EDR / endpoint agent) -- confirmed on the operator's Windows machine,
  likely the Mac too (*"i think my mac had that too"* -- Mac coverage the one residual
  tentative). It is SentinelOne (EDR), not Microsoft Sentinel (SIEM).
- **Okta** -- the auth factor (Okta FastPass, phishing-resistant FIDO2).
- **Microsoft Intune** -- the MDM/UEM (formerly Microsoft Endpoint Manager). Confirmed.

A managed/monitored device adds device-compliance + compromise-detection on the device
side, which *hardens* the device holding the signing key but is **not part of the core
signature-binding** (that is biometric + key + email-uniqueness). Stack names confirmed
(SentinelOne EDR + Okta + Intune); only Mac SentinelOne coverage remains "i think" --
flagged per `premise-flagged-unverified-stays-unverified-downstream` until confirmed.

## Consent event record (all three parts)

Per the operator's own definition (2026-05-30): the **signature is the informed
approval, not the keystroke** -- *"my signature is the approval/signature not the
actual running of the command."* The agent records the approval; the approval is the
signature. The full event:

1. **What was shown.** The commitment text above + the glass-halo convention
   (`docs/consent/glass-halo/README.md`) + the Touch-ID/Secure-Enclave signing
   mechanism (`docs/consent/glass-halo/SIGNING.md`) + the exact commit/PR command.
2. **The operator's response (verbatim English).**
   - *"after the fingerprint stuff lands on main i'm happy to sign my glass halo"*
   - *"lets sign"*
   - *"I read the document and I agree ... my signature is the approval/signature not
     the actual running of the command ... the record show what you showed me and how
     i responded in english and my signature all 3"*
3. **Signature.** The informed approval above is the signature. Recorded by the agent
   (Otto) at the operator's explicit authorization to run the command, and authored
   under the operator's git identity. Tier: **approval-as-signature** (the README's
   "for now" baseline). Optional escalation available at any time: re-commit `-S`
   Touch-ID-signed under the operator's own identity, or attach a DocuSign-executed
   record.

Recorded 2026-05-30. Agent (Otto) is committer/recorder; the operator is the
consenting principal and git-author. This is glass-halo: the full mechanism of the
consent is itself on the public record.
