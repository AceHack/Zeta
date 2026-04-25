# Supply-chain attack surface — safe patterns

**Purpose:** keep every third-party-code ingress point in this
repo — GitHub Actions, NuGet packages, toolchain installers,
MSBuild `.targets`, OS-package manifests — secure-by-default
against tag-rewrite, dep-poisoning, and installer-hijack attacks.
This doc is the **pre-add / pre-bump checklist** and the
authoritative reference when an agent or contributor is about to
introduce or upgrade a dependency.

**Primary sources:**

- OWASP Software Component Verification Standard (SCVS) —
  <https://owasp.org/www-project-software-component-verification-standard/>
- NIST SP 800-218 *Secure Software Development Framework (SSDF)*
  PW.4 (Reuse existing, well-secured software) —
  <https://csrc.nist.gov/Projects/ssdf>
- SLSA supply-chain levels spec — <https://slsa.dev/>
- GitHub's dependency-review docs —
  <https://docs.github.com/en/code-security/supply-chain-security>
- Canonical incidents (both mutable-tag class):
  - **CVE-2025-30066** — tj-actions/changed-files tag-rewrite
    cascade (March 2025), malicious commit landed on 23,000+
    repos via a single mutable `@v1` tag.
  - **Trivy TeamPCP attack** — 2026-03-19, Aqua Security's
      Trivy scanner ecosystem compromised by force-push of 76 of
      77 version tags on `aquasecurity/trivy-action` + 7 of 7 on
      `aquasecurity/setup-trivy`, plus a malicious binary
      `v0.69.4` published via a compromised `aqua-bot` service
      account. Even SHA-pinned consumers were hit if they bumped
      during the window. This attack targets a *security
      scanner itself* — it is the canonical case study for the
      "content-review-is-load-bearing" policy above: a SHA-256
      of a compromised release binary is still a valid SHA-256.
      Referenced in Semgrep rule `gha-action-mutable-tag`,
      Incident Playbook A, and the scanner-landscape research
      doc (`docs/research/vuln-and-dep-scanner-landscape-2026-
      04-22.md`) — which defers Trivy adoption pending
      rebuild-trust signals.

Re-read against current revisions of these sources every 5-10
rounds (FACTORY-HYGIENE row 41, same cadence as GHA safe-patterns).

## Threat model in one sentence

Any third-party code that executes in this repo's build, test, or
runtime (including CI toolchain installers) can execute arbitrary
commands with the permissions of that step — so every external
pin is a trust decision that survives until it is re-audited.
Mutable pins (tags, version ranges, moving URLs) turn a one-time
trust decision into a standing capability for the upstream
maintainer to compromise us later.

## The one rule you cannot break

> **Every third-party pin references an immutable identifier.
> Tags, floating versions, and URLs-without-digests are not
> pins — they are standing promises.**

For actions this is a 40-char commit SHA. For NuGet it is a fully
pinned version (no ranges) with a future `packages.lock.json`
commitment. For toolchain installers it is a SHA-256 of the
downloaded artefact. For OS packages it is the pinned version in
the manifest plus repository signature verification.

### Content review is the load-bearing step — the pin caches it

The immutable identifier is *how* we lock a decision, but the
decision itself is **content review at first pin**. A SHA-256 that
points at malicious code is still malicious; a hand-verified
script run `curl | bash`-style after a careful read is safe.

In this factory, Aaron's standing policy (2026-04-22) is: *"never
run a script you download without checking it for vulnerability,
trojans and things of that nature even like gist and stuff, it's
fine to download and run bash and things like that just validate
them first."* So the actual author-time protocol is:

1. **Download to disk**, do not execute.
2. **Read the script in full** — check for sudo / privilege
   escalation, data exfiltration (`curl -X POST`, `nc`, `scp` to
   non-project hosts), shell-metacharacter injection, opaque
   base64 blobs, cryptominers, calls to suspicious domains,
   trojans masquerading as legitimate installers.
3. **Execute if clean**; record the validation decision in the
   commit message or manifest comment.
4. **SHA-256-pin the validated content** — the pin is then a
   cache of your review. Any bump invalidates the cache and
   forces a re-read.

The delivery mechanism (`curl | bash` vs `curl -o path && bash
path`) is not the risk. The risk is unvalidated content.

## Third-party-code ingress points

Zeta has four classes of supply-chain surface. Each has a
different current enforcement level — **which is itself the
dominant residual risk** when an ingress is bumped.

| Class | Immutable-pin enforced? | Author-time tooling | Reactive playbook |
|---|---|---|---|
| GitHub Actions (`.github/workflows/**`) | **Yes** — Semgrep `gha-action-mutable-tag` + convention of trailing `# vX.Y.Z` comment | Required by rule; lint hard-fails on mutable tags | INCIDENT-PLAYBOOK Playbook A (third-party action compromise) |
| NuGet packages (`Directory.Packages.props`) | **Partial** — central version management + exact versions. `packages.lock.json` not yet adopted (SDL #7 deliverable). | `tools/audit-packages.sh` + `package-auditor` skill (manual) | INCIDENT-PLAYBOOK Playbook C (NuGet dep poisoning) |
| Toolchain installers (`tools/setup/manifests/{brew,apt,dotnet-tools,uv-tools,verifiers}`) | **Partial** — versions declared per manifest; not all artefacts carry SHA-256. | `tools/setup/install.sh` is the single consumer; `ensure-*` scripts are opportunistic | INCIDENT-PLAYBOOK Playbook B (toolchain installer hijack mid-setup) |
| MSBuild `.targets` auto-imported via NuGet | **No** — SDL #7 open deliverable; any package may ship executable MSBuild logic that runs during `dotnet build`. | Manual review; no allowlist yet | Playbook C covers the exploit path |

If you bump or add something in a class marked Partial / No, the
pre-add checklist is **load-bearing** — the lint won't save you.

## Pre-add / pre-bump checklist — universal

Before committing any third-party addition or bump, walk this
list. Every item is reviewer-visible.

- [ ] **Justify the dependency at all.** For a new add: does
      something already in `Directory.Packages.props` / the toolchain
      / the standard library cover this? Dependency deletion beats
      dependency audit.
- [ ] **Read the release notes since the current pin.** Not a
      skim — specifically look for: breaking changes, new
      maintainers, repository transfers, deprecation warnings,
      scope expansions, new transitive dependencies.
- [ ] **Confirm project health.** Recent commits, responsive
      issue tracker, not a single-maintainer abandonware account.
      For high-risk bumps, check the package registry for
      maintainer account changes.
- [ ] **Pin by immutable identifier.** SHA for actions; exact
      version for NuGet; SHA-256 digest (where available) for
      toolchain installers; pinned version + repo signature for
      OS packages. Trailing human-readable comment (`# v1.2.3`)
      so diffs are readable.
- [ ] **Re-run the whole build gate.** `dotnet build -c Release`
      plus `dotnet test Zeta.sln -c Release` plus the full CI
      matrix on a PR — do not trust a one-OS bump.
- [ ] **Document the bump rationale** in the commit message.
      "Why this version, now?" Future you (or a future incident
      responder) needs this.
- [ ] **Check upstream attestations / SLSA level** if available.
      SLSA-3+ packages carry build-provenance metadata GitHub can
      verify automatically.

## Pre-add / pre-bump checklist — per class

### GitHub Actions

- [ ] `uses:` points at a 40-char commit SHA, never a tag.
- [ ] Trailing `# vX.Y.Z` comment for humans.
- [ ] Action is from a **known maintainer** — GitHub-owned
      (`actions/*`), a major-org account, or a single-author action
      we've audited source for. Avoid newly-created third-party
      actions unless the blast radius is trivial.
- [ ] Semgrep `gha-action-mutable-tag` + `actionlint` both pass.
- [ ] Also apply the injection checklist in
      `docs/security/GITHUB-ACTIONS-SAFE-PATTERNS.md`.

### NuGet packages

- [ ] Added / bumped only in `Directory.Packages.props` (central
      version management). No inline `<PackageReference Version=...>`
      in `.fsproj` / `.csproj`.
- [ ] Version is exact, not a range (`1.2.3`, never `[1.0,2.0)`).
- [ ] `tools/audit-packages.sh` was run locally before commit.
- [ ] `package-auditor` skill workflow was followed for MAJOR
      bumps — read CHANGELOG for Breaking / Removed bullets, grep
      our source for any usage of removed surface, **test before
      deferring**.
- [ ] If the package ships MSBuild `.targets`, manually read the
      targets file(s) before committing — they run at build time.
- [ ] When `packages.lock.json` adoption lands (SDL #7), the lock
      file gets updated and committed alongside the bump.

### Toolchain installers (`tools/setup/`)

- [ ] Addition or bump lands in the relevant manifest under
      `tools/setup/manifests/`, not ad-hoc in a script.
- [ ] Where the upstream publishes SHA-256 digests, include the
      digest in the manifest; the install script verifies.
- [ ] The three-way-parity invariant still holds (GOVERNANCE.md
      §24) — dev laptop, CI, devcontainer all bootstrap from the
      same manifest.
- [ ] For new installer scripts, prefer Homebrew / apt / mise /
      elan over hand-rolled `curl | bash`; when `curl | bash` is
      unavoidable, pin the raw URL by SHA-256.

### OS-package manifests (brew / apt)

- [ ] Package listed in `tools/setup/manifests/{brew,apt}` with
      pinned version.
- [ ] For apt: repository GPG key is captured under
      `tools/setup/apt-keys/` and verified during install, not
      fetched from a keyserver at install-time.

## Factory tooling that enforces this

Three layers; none individually sufficient — the pre-add
checklist is the primary defence.

1. **Semgrep** — `.semgrep.yml` rule `gha-action-mutable-tag`
   hard-fails any non-SHA action pin. Runs on every PR. One rule
   today; expansion candidates tracked in SDL #7.
2. **`package-auditor` skill + `tools/audit-packages.sh`** — the
   manual NuGet-side audit. Paired with an agent; not yet
   CI-gated (SDL #7 open deliverable to make the audit a gate).
3. **Incident playbooks** (`docs/security/INCIDENT-PLAYBOOK.md`) —
   reactive. Playbook A (action compromise), B (toolchain
   installer hijack), C (NuGet dep poisoning), D (maintainer
   account compromise). Triggered when prevention fails.

When adding a third-party surface that none of the above covers,
either extend the tooling in the same commit or flag a SECURITY-
BACKLOG row naming the residual risk explicitly.

## Do / don't — minimal pair

### Unsafe

```xml
<!-- Directory.Packages.props — tag-range opens a standing ingress -->
<PackageVersion Include="SomePkg" Version="[1.0,2.0)" />
```

```yaml
# .github/workflows/foo.yml — one mutable tag is a trust delegation
- uses: tj-actions/changed-files@v45
```

### Safe

```xml
<!-- exact version; diff-legible; auditable -->
<PackageVersion Include="SomePkg" Version="1.7.2" />
```

```yaml
# Full SHA is the trust anchor; trailing comment keeps diffs readable.
- uses: tj-actions/changed-files@0fe0c5a3b5ed3a1df2c6e8bab4a1a52f8e4c07d9 # v45.0.7
```

## Upstream signals to watch

The supply-chain threat surface evolves fast. During the cadenced
re-read (FACTORY-HYGIENE row 41), check:

- **GitHub Security Advisories** for packages we depend on
  (`dependabot` alerts on the repo; Security → Dependabot).
- **SLSA progress tracker** — new attestation publishers; new
  verification requirements.
- **CVE feeds** filtered for NuGet ecosystem + GitHub Actions
  ecosystem.
- **Incident write-ups** for the canonical attack classes (the
  `tj-actions/changed-files` post-mortem is the reference; newer
  incidents get added here).

## Why this doc exists in-repo

- **Author-time reference.** Agents and contributors about to add
  a dependency should not have to rediscover OWASP SCVS or NIST
  SSDF — the relevant subset lives here, cross-referenced to our
  actual tooling.
- **Factory-specific cross-refs.** Points at our Semgrep rule,
  our `audit-packages.sh`, our manifests, our playbooks. Generic
  external guidance can't do that.
- **Cadenced audit target.** FACTORY-HYGIENE row 41 re-reads
  upstream guidance on cadence so drift is caught.
- **Reviewer citation surface.** A PR review can reject with
  "violates §Pre-add checklist item N" rather than handwaving.

## Scope

Factory-wide. Applies to every third-party ingress in this repo
and — via factory reuse — to adopter projects. Inherits
automatically via the factory CI discipline and the ships-to-
project row in `docs/FACTORY-HYGIENE.md`.
