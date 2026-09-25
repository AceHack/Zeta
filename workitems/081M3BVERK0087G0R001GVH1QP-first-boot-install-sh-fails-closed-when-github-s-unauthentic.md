---
id: 081M3BVERK0087G0R001GVH1QP
type: bug
state: backlog
priority: P2
slug: first-boot-install-sh-fails-closed-when-github-s-unauthentic
title: "First-boot install.sh fails closed when GitHub's UNAUTHENTICATED API rate limit blocks mise attestation verification"
created: 2026-09-25T08:38:34.848Z
depends_on: []
composes_with: []
---

# First-boot install.sh fails closed when GitHub's UNAUTHENTICATED API rate limit blocks mise attestation verification

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BVERK0087G0R001GVH1QP-*.md` glob. -->

## The measurement

Run **36110246885**, WP11-scoped dispatch. The step failed at **13m37s**, in
**phase 1** — the install — so the installed disk was never booted and WP11's
verdict unit never ran. The harness's own reason:

> `first-boot provisioning contract failed — tools/setup/install.sh failed on
> first boot after exhausting its retries (marker: "WARN: install.sh FAILED
> rc=")`

The serial carries the cause, **6 occurrences, and it is the ONLY tool that
failed** (`grep -oE "Failed to install [a-zA-Z0-9:@./-]+" | sort | uniq -c`
returns exactly one line):

```
Failed to install github:yannh/kubeconform@0.7.0:
  GitHub artifact attestations verification error for github:yannh/kubeconform@0.7.0:
  API error: GitHub API returned 403 Forbidden: {"message":"API rate limit exceeded...
  Location: src/toolset/toolset_install.rs:244
```

## Why this is a product bug and not a CI flake

**The attestation policy is correct and is not what is being questioned here.**
`.mise.toml` documents at length why artifact attestations are enforced —
including the `fastq@1.20.2` regression the policy genuinely caught. Verifying
supply-chain provenance before installing a binary is right.

**The failure is in the VERIFICATION PATH, not the policy.** Attestation
verification calls GitHub's API, and **unauthenticated** that limit is 60
requests/hour **per source IP**. A first boot has no `GITHUB_TOKEN`. So the
install fails **closed** — correctly, in the sense that it refuses to install
something it could not verify — and takes the whole provisioning contract with
it.

**An operator hits this exactly as CI did.** Plug the USB in behind a busy
office NAT, a CGNAT ISP, or a university network, and the shared public IP has
very likely already spent its 60. The node then comes up **PARTIALLY
provisioned** with no clear statement that a rate limit, rather than anything
about the machine, is why. That is squarely the "will it work when I plug the
USB in" question.

## Second site, same tool, same hour

`chart pins + helm template + kubeconform` went red on PR #17662 at 07:32 with
`external-secrets 2.10.0: kubeconform failed — Valid: 15, Invalid: 0,
Errors: 5`, and passed on a re-run with no code change. That is a **different
failure site** — kubeconform *running* and failing to fetch 5 schemas, rather
than kubeconform failing to *install* — so the two should not be conflated.
What they share is being network-dependent failures of the same tool within
the same hour, which is worth noting when triaging either.

## Directions, RANKED

### (4) PRE-STAGE THE VERIFIED BINARY IN THE ISO -- THIS IS THE FIX

It is already a pinned version. The ISO is already built in CI, **where a token
exists and the rate limit is not a factor.** Verification at BUILD time is
strictly better than verification at install time: it happens **once**, on a
machine we control, with the policy **fully enforced**, instead of once per
operator on a network we do not control.

It **removes the dependency** rather than making it more reliable, which is the
disposition to prefer whenever it is reachable.

### (2) NAME THE RATE LIMIT -- do this FIRST, regardless of (4)

Small, and it converts a mystery into a diagnosis even if (4) slips. Today the
operator gets:

    install.sh FAILED rc=1
    Location: src/toolset/toolset_install.rs:244

What they need is:

    GitHub API rate limit exceeded (60/hour per IP, unauthenticated).
    Resets at <time from the response>. Wait, or use a different network,
    or supply a token.

One tells them nothing. The other tells them what to do.

### (3) Back off on a 403 rate limit -- a PALLIATIVE, and say so

Worth having: the current three attempts are seconds apart and the response
carries the reset time. **But state its limit out loud** -- a rate-limit window
can be up to an hour, and **no in-install backoff can wait that out.** It
narrows the failure window; it does not close it.

### (1) Token where one exists -- CI ONLY

Lifts CI to 5000/hour and removes this class from the lane. **It does nothing
for a real operator**, who has no token, and it must not be allowed to look
like an operator fix -- fixing the lane while leaving the product broken is how
a check stops representing what it claims to.

**Do NOT respond by disabling attestation verification.** The policy caught a
real regression and the `.mise.toml` note records it. Written plainly for the
next person under time pressure reaching for the disable flag:

> **The answer is to verify EARLIER, not to verify LESS.**

## Origin

081M3BEGSQR087G0R003610CGB (WP31). Found while attempting to verify that WP11
verdict 7 now emits — the run could not answer that question because the
install never completed, which is itself the finding.

## Part of a larger surface

This is one row of 081M3BWJ96T087G0R0028WT3S3 -- the inventory of EVERY external
dependency a first boot has, classified by what an operator gets when it is
unavailable (named refusal / partial install / silent skip). Three rows of that
table were discovered in a single night by a single lane.
