---
id: 081M24MADR2087G0R001FCD8K6
type: task
state: backlog
priority: P1
slug: no-mise-managed-tool-has-a-committed-digest-trust-rests-on-g
title: "No mise-managed tool has a committed digest: trust rests on GitHub's attestation service being up, and mise.lock is the fix"
created: 2026-09-10T02:52:00.000Z
depends_on: []
composes_with: [081M24HZCYN087G0R002MT55TV]
---

# No mise-managed tool has a committed digest: trust rests on GitHub's attestation service being up, and `mise.lock` is the fix

Split out of **081M24HZCYN087G0R002MT55TV** (the rustup `curl | sh` retirement). Same
defect class — _a third party's availability sits on the critical path of `install.sh`_ —
but a different mechanism and a fleet-wide blast radius, so it is filed rather than
folded into a pin PR.

## The measurement, 2026-09-10

`live kind ArgoCD health (ubuntu-24.04-arm)`, run **34427150482**, step 5:

```
mise github:yannh/kubeconform@0.7.0 [1/3] download kubeconform-linux-arm64.tar.gz
mise github:yannh/kubeconform@0.7.0 [2/3] checksum kubeconform-linux-arm64.tar.gz
mise github:yannh/kubeconform@0.7.0 [2/3] verify GitHub artifact attestations
mise ERROR Failed to install github:yannh/kubeconform@0.7.0:
  GitHub artifact attestations verification error: API error:
  GitHub API returned 503 Service Unavailable:
  {"message":"trust-metadata-api service unavailable", ... "status":"503"}
```

Also observed on `build-and-test (windows-11-arm)` (gate, on `main`) at the same time;
both x86 siblings passed. `install.sh` retried 5 times over 01:57:33 → 02:00:36 and the
outage outlasted the budget. **More retry is not the answer and no more was added.**

### Four facts the log settles

1. **The checksum step ALREADY PASSED** before the attestation call. Integrity was
   established; the install still failed on an availability check layered on top of it.
2. **It is not one tool.** In that same run `golangci-lint`, `uv` and `actionlint` each
   printed `verify GitHub artifact attestations` and happened to succeed. Measured
   settings: `github_attestations = true` **and** `aqua.github_attestations = true`
   (`python.github_attestations` is already `false`, disabled in `mise.sh` for this exact
   class of problem in a previous incident). The exposure follows the **setting**, not the
   backend, and every `aqua:`-resolved tool is in it — `k3d`, `kind`, `kubectl`, `helm`,
   `shellcheck`, `actionlint`, `golangci-lint`, `uv`, `1password-cli`.
3. **The roster GROWS WITHOUT A DIFF HERE.** A tool joins the exposed set the day its
   upstream starts publishing attestations. Nothing in this repo changes, and nothing in
   this repo can notice.
4. **THE BIG ONE: no mise-managed tool has a committed digest.** There is no `mise.lock`
   in the tree and `locked = false`. So the `[2/3] checksum` above is verified against a
   checksum **fetched from upstream at install time**, not against a pin in git. We do not
   today own the digest of a single one of the ~20 tools `install.sh` provisions.

## Why the obvious fix was evaluated and REJECTED

Moving `kubeconform` from mise onto `tools/setup/manifests/from-url` (the mandatory-`sha256`
mechanism, as used for Ollama in #17200 and for rustup in 081M24HZCYN087G0R002MT55TV) does
not fit. Four reasons, in order of decisiveness:

1. **`from-url` structurally cannot host it.** A row is `<dest> <url> sha256=` — one URL for
   all hosts, no platform axis, no extraction, no PATH placement. kubeconform ships **eight**
   platform archives (`.tar.gz` on Unix, `.zip` on Windows), each containing a binary. A row
   would land a tarball at a path, not a `kubeconform` on `PATH`.
2. **The pin mechanism that CAN do it is POSIX-only, and the gate failure is on Windows.**
   `install-pinned-artifact.ts` now has the platform axis and archive extraction, but its rim
   uses `resolveElevatorPathOrThrow("sudo")`, splits `PATH` on `:`, and hardcodes
   `tar --zstd`. The failing **gate** lane is `windows-11-arm`. A Unix-only migration leaves
   the blocking failure in place and fragments the tool graph — which is the answer the ask
   invited if it were true, and it is true.
3. **It would be the THIRD pin of this one tool's version.** `.mise.full.toml` says `0.7.0`
   and `gate.yml:1055` independently does
   `go install github.com/yannh/kubeconform/cmd/kubeconform@v0.7.0`. A third mechanism makes
   the drift surface worse, not better.
4. **It fixes one exposure out of at least four**, per fact 2 above.

## What the fix actually is: `mise.lock`

mise ships the exact artifact being asked for, natively. Verified 2026-09-10 by running it
(the output below is real, and the file was then deleted rather than committed):

```
$ MISE_ENV=full mise lock "github:yannh/kubeconform"
→ Targeting 7 platform(s): linux-arm64, linux-arm64-musl, linux-x64, linux-x64-musl,
                           macos-arm64, macos-x64, windows-x64
✓ Lockfile written to mise.full.lock
```

```toml
[tools."github:yannh/kubeconform"."platforms.linux-arm64"]
checksum = "sha256:cc907ccf9e3c34523f0f32b69745265e0a6908ca85b92f41931d4537860eb83c"
url = "https://github.com/yannh/kubeconform/releases/download/v0.7.0/kubeconform-linux-arm64.tar.gz"
```

Committed text, one `sha256` per platform, diffable in a `git` diff — the same shape as a
`from-url` row and the same property
(`.claude/rules/no-binary-in-proof-lineage.md`: the evidence is text). `windows-arm64` is
**not** in the default platform set but IS supported explicitly
(`mise lock <tool> --platform windows-arm64` produced an entry), which matters because
`windows-11-arm` is the lane that failed.

**And this is what makes turning the attestation off legitimate rather than a bypass.**
Today the attestation is one of only two trust sources and neither is ours, so disabling it
would genuinely reduce what is checked. With a committed lockfile the digest is **ours**,
verified **locally**, before anything executes — strictly the property the rustup pin buys —
and the remote call is no longer load-bearing for trust. Relocating a check is not removing
one. **Do not disable it before the lockfile lands; that ordering is the whole argument.**

## What must be MEASURED before this is shipped (not assumed)

- Does `locked = true` change _resolution_ as well as verification, and does a platform
  absent from the lockfile **fail closed** or silently fall through? A lockfile that is
  quietly bypassed on an unlisted platform is the vacuity class.
- Do all eight platforms we actually run get an entry — `windows-arm64` explicitly, plus
  the musl variants the cluster nodes may use?
- Three-way parity (GOVERNANCE §24): `install.sh`, `install.ps1` and the devcontainer image
  must all honour it, and `install.ps1` defaults Windows to `ZETA_HOST_TIER = 'full'`
  (line 415), so Windows installs the whole k8s set on every runner.
- Does the lockfile survive a `mise` version bump, and what is the refresh path
  (`mise lock` re-run + review) — the same question `from-url-rolling-receipts` answers for
  the other mechanism.

## Adjacent findings, recorded not acted on

- **`install.ps1:415` defaults every Windows host to tier `full`**, so `windows-11-arm`
  installs `k3d`/`kind`/`kubectl`/`helm`/`kubeconform` — the whole k8s set — although
  nothing on Windows uses them. That is why an attestation outage on a _Kubernetes_ tool
  took down a _build-and-test_ lane. Narrowing it is a behavioural change to tier selection
  and belongs on its own row.
- **kubeconform is pinned twice at `0.7.0`** (`.mise.full.toml`, `gate.yml:1055`) by two
  unrelated mechanisms, with nothing checking that the two agree.
- The **cascade** was fixed under 081M24HZCYN087G0R002MT55TV: six `if: always()` teardown
  steps in `k8s-argocd-health-test.yml` ran `bun …-down.ts` with no toolchain installed and
  reported `bun: command not found` / exit 127 as a _second, later_ red. They now name the
  real earlier failure and exit 0 only when there is provably nothing to tear down.
