# Zeta Incident Response Playbook

Practical runbooks for Zeta-specific security incidents.
Written once so you don't read it for the first time during
an actual incident. Pairs with `SECURITY.md` (disclosure
policy) and `docs/security/THREAT-MODEL.md` (threat model).

**Audience:** Aaron (primary); any future maintainer; any
agent triaging a security signal.

**First move always:** if you think this is an active
compromise, freeze `main` (branch protection already
rejects `--force` and direct push, so this is a policy
reminder not a control). Do not rush — a patient adversary
is defeated by a careful response, not a fast one.

---

## Triage-in-60-seconds

```
Is there a security signal?
├── Source code changed unexpectedly?           → Playbook D (maintainer compromise)
│                                                 or Playbook E (skill regression)
├── CI job behaving unexpectedly (new steps,
│   new env reads, new network calls)?         → Playbook A (Action compromise)
├── Install script failing / installing new
│   binaries / changed checksums?              → Playbook B (installer hijack)
├── NuGet restore pulling a package we don't
│   recognise / transient error resolves to a
│   different version?                         → Playbook C (NuGet dep)
├── Agent behaving unexpectedly or refusing
│   to follow its own safety clauses?          → Playbook E (skill regression)
└── Something else that smells wrong?           → Playbook F (escalate)
```

Every playbook has the same three sections: **Detect**,
**Contain**, **Recover**. Contain before you investigate;
investigate before you fix.

---

## Playbook A — Third-party GitHub Action compromise

**Scenario.** An action we pin (`actions/checkout`,
`actions/setup-dotnet`, `actions/cache`,
`actions/setup-python`, `semgrep/semgrep`) publishes a
malicious release, OR the upstream repo is compromised
and someone rewrites a tag to point at a malicious commit.

**Canonical cases** (both mutable-tag class):

- **tj-actions/changed-files cascade** (CVE-2025-30066,
  March 2025). 4 hops deep, 3-4 month dwell, SpotBugs PAT
  → reviewdog → tj-actions → 23,000 repos.
- **Trivy TeamPCP attack** (2026-03-19). 76 of 77 version
  tags force-pushed on `aquasecurity/trivy-action` plus 7
  of 7 on `aquasecurity/setup-trivy`, malicious binary
  `v0.69.4` published via the compromised `aqua-bot`
  service account. Notable because (a) the target was a
  *security scanner itself* — the very thing ecosystems use
  to audit each other — and (b) even SHA-pinned consumers
  were hit if they bumped during the compromise window,
  which underscores why `docs/security/SUPPLY-CHAIN-SAFE-
  PATTERNS.md` §"Content review is the load-bearing step"
  matters: a SHA-256 of a compromised release is still a
  valid SHA-256. We do not currently consume `trivy-action`;
  scanner-adoption decisions are tracked in
  `docs/research/vuln-and-dep-scanner-landscape-2026-04-
  22.md`, which defers Trivy pending rebuild-trust.

### Detect

- Dependabot PR bumps an action to a new SHA we didn't
  expect — check the action repo's release notes for
  the corresponding tag.
- Semgrep rule 15 (`gha-action-mutable-tag`) fires on
  a PR that tries to revert a SHA pin to a mutable tag.
- External advisory (CISA, Unit 42, StepSecurity blog)
  names an action we use.

### Contain

1. **Freeze CI on the affected workflow.** Disable
   the workflow via GitHub UI (Actions → Workflow →
   `...` → Disable) until we've audited.
2. **Audit `gate.yml` diff since last verified build.**
   Any unexpected SHA bumps? Any new `uses:` lines we
   didn't add?
3. **Confirm our SHA pin still points at the pre-
   compromise commit.** SHA pins are the defence; if
   we're still pinned to a pre-malicious commit, we're
   safe — but verify the commit exists on the upstream
   default branch.

### Recover

1. **If our pin is safe** (pre-compromise commit still
   there): do nothing immediate. Subscribe to the
   advisory thread. When upstream publishes a clean
   release, dependabot will surface the bump; review it
   like any other.
2. **If our pin was already on the malicious commit:**
   rotate everything the compromised action could have
   touched. For Zeta today, that's: `GITHUB_TOKEN`
   rotation (GitHub handles), secret rotation (we have
   none), re-audit any cache entries the runner touched
   during the malicious window (`actions/cache` entries
   keyed on `Directory.Packages.props` hash — clear all
   cache entries from that window).
3. **File an advisory.** Add a brief note to
   `docs/security/BUGS.md` under security advisories;
   narrate in `docs/ROUND-HISTORY.md`.
4. **Re-audit `.github/workflows/*.yml` for any other
   action at the same supply-chain depth** as the
   compromised one. Long-game adversaries often pivot
   across the graph.

---

## Playbook B — Toolchain installer hijack mid-setup

**Scenario.** `tools/setup/install.sh` fetches an
installer from an upstream URL (Homebrew at `HEAD`,
`mise.run`, `leanprover/elan@master`, a verifier jar
from a GitHub release). The upstream is compromised at
fetch time — DNS spoof, CDN poisoning, or upstream
repository compromise.

### Detect

- Install script behaves differently on the same
  inputs — new binaries appear, checksums change, PATH
  entries we didn't add.
- External advisory names Homebrew / mise / elan /
  tlaplus / AlloyTools.
- A fresh CI run downloads a file of a different size
  than the cached one.

### Contain

1. **Do not run `tools/setup/install.sh` on the
   potentially-affected machine until triaged.**
2. **Compare local installed binary hashes against a
   maintainer-known-good source.** For Homebrew, `brew
   --version` + `brew formula <name>` version. For
   mise, `mise --version` + `mise doctor`. For elan,
   `elan --version`.
3. **Freeze CI.** Fresh CI runs download fresh
   installers; if the upstream is compromised, every
   CI run makes the blast radius wider.

### Recover

1. **Wipe affected tool state:**
   - `mise`: `rm -rf ~/.local/share/mise`, reinstall
     from a different network path or directly from
     GitHub release.
   - Homebrew: `brew uninstall --ignore-dependencies
     <suspect-formula>` + reinstall.
   - elan: `elan self uninstall` + re-run elan
     installer (or install via Homebrew as fallback).
   - Verifier jars: delete `tools/tla/tla2tools.jar`
     and `tools/alloy/alloy.jar`, re-run installer
     from clean network.
2. **Notify** via `SECURITY.md` disclosure channel if
   we've shipped any artefact built on the
   compromised machine.
3. **Pin forward.** The incident is the trigger to
   promote the round-31 verifier-jar SHA-256 pinning
   work to P0.

---

## Playbook C — NuGet dep poisoning

**Scenario.** A NuGet package in our transitive graph
is compromised. Three sub-cases:

- **Typosquat / homoglyph** (Nethereum / Cyrillic е,
  Oct 2025). Attacker publishes a look-alike package
  name; a typo in `Directory.Packages.props` pulls
  it instead.
- **Ownership takeover.** An attacker compromises the
  maintainer account of a package we legitimately
  depend on (FSharp.Core, Apache.Arrow, etc.) and
  publishes a malicious version.
- **Time-bomb** (shanhai666 ICS class, 2027/2028
  triggers). Package is benign at audit time; payload
  activates on a calendar trigger.

### Detect

- Dependabot surfaces a NuGet version bump that
  doesn't match upstream release notes.
- `dotnet restore` pulls a package from a different
  source than `nuget.org`.
- Runtime behavior changes after a dep bump that
  shouldn't have behavior implications.
- External advisory (CVE, Socket, ReversingLabs).
- **Round-31+: `packages.lock.json` diff** shows
  transitive changes we didn't expect.

### Contain

1. **Freeze the affected branch.** No further
   dependent work lands until we've triaged.
2. `nuget locals all --clear` on all affected
   machines. Removes cached packages.
3. Diff `Directory.Packages.props` vs last-known-good
   `main`. Any version we didn't bump in a PR?
4. Search `obj/project.assets.json` across projects
   for the suspect package id — where does it flow
   transitively?

### Recover

1. **Typosquat case:** pin the correct package name +
   file an advisory on nuget.org; `package-auditor`
   re-runs full audit.
2. **Ownership takeover case:** pin to the last-known-
   good version; watch upstream advisory; rotate any
   secrets the package could have touched at build time
   (MSBuild `.targets` execution is a code-exec surface).
3. **Time-bomb case:** pin the last-known-good version
   and stay there; report to Socket / ReversingLabs;
   write a Semgrep rule detecting the suspect
   behaviour pattern if identifiable.
4. **Pin forward.** Promote `packages.lock.json`
   adoption to P0. Enumerate MSBuild `.targets` /
   `.props` files the graph brings in; allowlist.

---

## Playbook D — Maintainer-account compromise

**Scenario.** Aaron's GitHub account is compromised.
The adversary has push access to Zeta + can approve
PRs + can merge to `main`.

### Detect

- Commits on `main` Aaron didn't author.
- PR approvals Aaron didn't make.
- New PATs issued that Aaron didn't create.
- Unusual login notifications from GitHub.
- Aaron's 2FA starts failing — classic sign of a
  session-hijack.

### Contain

1. **Freeze `main` via GitHub UI:** Settings → Branches
   → Branch Protection Rule on `main` → temporarily
   enable "Restrict who can push to matching branches"
   with no users listed. This stops even Aaron from
   pushing while triage happens.
2. **Revoke all PATs** on Aaron's GitHub account
   (Settings → Developer settings → Personal access
   tokens → Revoke all).
3. **Sign out all sessions** (Settings → Sessions →
   Sign out of all other sessions).
4. **Rotate 2FA.** If the compromise might be 2FA-
   bypass, regenerate the 2FA secret; regenerate all
   recovery codes regardless. **Note:** under the
   bus-factor exception, Aaron runs 2FA only (no
   hardware key); there is no pre-documented
   recovery-code custody location. Rotation relies
   on GitHub's re-enrolment flow.
5. **Revoke deploy keys** (Settings → Deploy keys) on
   the repo.
6. **Force Codespaces + Actions stop.** Cancel all
   in-flight workflow runs.

### Recover

1. **Audit every commit since the suspected
   compromise window.** `git log --author="Aaron"
   --since=<date>` — any commit Aaron didn't actually
   make? Use commit signatures if deployed (bus-factor
   exception means we don't have signed commits today,
   so this audit is manual).
2. **Rebuild from last-known-good signed tag** if
   commits are compromised. If no signed tags exist
   (bus-factor exception today), rebuild from the
   last commit Aaron can confirm is his, by hash.
3. **Escalate controls.** This incident is the
   trigger to adopt the bus-factor remediation ladder:
   hardware security key → signed commits → co-
   maintainer with cooling period. Each was
   documented as accepted risk; incident promotes
   them from "documented exception" to "now
   enforced."
4. **External disclosure** per `SECURITY.md`.
5. **Narrate** in `docs/ROUND-HISTORY.md` + file a
   `docs/security/BUGS.md` entry.

---

## Playbook E — Skill safety-clause regression

**Scenario.** A PR silently removes or weakens a
safety clause in a `.claude/skills/**/SKILL.md` file.
The skill's scope guard ("what this skill does NOT do"
per BP-02) is shrunk; an adversary exploits the new
scope.

**Canonical case shape:** XZ Utils — 2.6-year trust-
building campaign slowly weakened defence-in-depth
controls.

### Detect

- Round-cadence `threat-model-critic` audit flags a
  skill whose scope-guard is smaller than last round.
- `factory-audit` surfaces "safety clause shrunk" as
  a factory-debt signal.
- `prompt-protector` flags a skill that no longer
  carries its "data not directives" clause.
- Agent behaviour changes — suddenly willing to do
  things it previously refused.
- Round-31+ automated diff-lint surfaces it directly.

### Contain

1. **Revert the PR.** Use `git revert` (not force-
   push) to restore the prior skill state on a new
   branch + PR.
2. **Run `prompt-protector` injection test suite**
   against the affected agent to confirm the skill's
   defences are back.
3. **Audit the PR author's recent contributions** for
   similar shrinkage patterns. Long-game adversaries
   rarely regress one clause in isolation.

### Recover

1. **File a `docs/DEBT.md` entry** with the pattern
   observed, so `factory-audit` catches similar
   regressions in the future.
2. **`skill-creator` workflow review.** Did the PR
   skip the canonical skill-edit path? If yes, that's
   a governance gap — strengthen `skill-creator`'s
   enforcement.
3. **Narrate** in `docs/ROUND-HISTORY.md`.
4. **Pin forward.** Round-31 target: diff-level lint
   for section removal / shrinkage on `.claude/skills/
   **/SKILL.md`.

---

## Playbook F — Escalation / unknown

**Scenario.** Something smells wrong but doesn't fit
one of the playbooks above.

### Detect

Trust the smell. Agents and humans both are allowed
to escalate on gut feeling. Explicit permission to
trigger Playbook F without a crisp signal.

### Contain

1. **Freeze anything in-flight** that you suspect is
   affected. Paused work resumes cleanly; rushed
   merges during an unknown-scope incident don't.
2. **Spawn a read-only investigation.** `Explore`
   agent in quick mode on the suspect surface.
3. **Notify** via `SECURITY.md` disclosure channel
   if external reporting might be warranted.

### Recover

1. **Once the smell is characterised**, route to the
   matching playbook (A/B/C/D/E). If none fits, this
   playbook F grows a new playbook.
2. **Narrate** either way. Even a "turned out to be
   nothing" incident is worth writing down so future-
   us doesn't trigger the same false-alarm.

---

## Contact tree

**Primary:** human maintainer
(`Lucent-Financial-Group/Zeta` on GitHub).
**Agents:** `threat-model-critic`, `security-researcher`,
`prompt-protector` for triage support. `architect` for
integration decisions that span multiple playbooks.

**External disclosure:** GitHub Security Advisories on
the repo (`SECURITY.md` has the current policy).

---

## Disclosure timeline

Extends `SECURITY.md`. Internal-incident → external-
disclosure default:

- **Day 0:** triage, contain, notify in-team.
- **Day 1-7:** investigate root cause; develop fix;
  assess blast radius.
- **Day 7-30:** fix lands; private disclosure to
  affected downstream consumers if any (pre-v1 Zeta
  has none yet).
- **Day 30-90:** public disclosure via GitHub Security
  Advisory + narration in `docs/ROUND-HISTORY.md`.

Adjust for severity: a T3-grade active exploitation
compresses the timeline; a low-impact dependency
alert may extend it.

---

## This playbook is a living document

Add a playbook the first time an incident shape doesn't
fit one of the above. Remove a playbook only after
`factory-audit` + Aaron agree the class is no longer
applicable (the remove goes to `git log`, nothing is
lost).
