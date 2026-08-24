---
id: 081M0QDZRR7087G0R003A3VBN4
type: task
state: backlog
priority: P2
slug: platform-lane-stays-quarantined-two-ours-ui-only-flip-two-pr
title: "platform lane stays quarantined: two ours (UI-only flip), two private-sourced (must NOT publish), one nonexistent upstream"
created: 2026-08-23T13:46:59.719Z
depends_on: []
composes_with: []
---

# platform lane stays quarantined: two ours (UI-only flip), two private-sourced (must NOT publish), one nonexistent upstream

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/. -->

## The measurement (2026-08-23, `main` at `324da722d`)

```
$ bun src/Core.TypeScript/cluster/lane-partition.ts --rung dev
CANNOT BE PRICED (never packed): 3
  platform: unmeasurable image ghcr.io/flowdent/cloudservice:latest;
            unmeasurable image ghcr.io/flowdent/fd-webclient:latest;
            unmeasurable image ghcr.io/ich777/steamcmd:armareforger;
            unmeasurable image ghcr.io/lucent-financial-group/zeta-platform-controller:latest;
            unmeasurable image ghcr.io/lucent-financial-group/zeta-portal:latest
covered by a lane: 41/47  |  quarantined: 3 oversize + 3 unpriced
```

`platform`'s five blockers are **three different problems**, and only one of them is a
visibility flip. Naming them as one list is what made this look like a single fix.

## 1. Ours — `zeta-portal`, `zeta-platform-controller`. Authorized; the flip is UI-only.

Aaron, verbatim: *"make zeta-portal and zeta-platform-controller public"*. Both are
`orgs/Lucent-Financial-Group` container packages linked to `Lucent-Financial-Group/Zeta`,
**which is already public** — so publishing exposes nothing the repo does not.

**No API can set package visibility.** Measured three independent ways rather than inherited:

```
GET    /orgs/Lucent-Financial-Group/packages/container/zeta-portal              -> 200
PATCH  /orgs/Lucent-Financial-Group/packages/container/zeta-portal              -> 404
POST   /orgs/Lucent-Financial-Group/packages/container/zeta-portal              -> 404
PUT    /orgs/Lucent-Financial-Group/packages/container/zeta-portal              -> 404
PATCH  /orgs/Lucent-Financial-Group/packages/container/zeta-portal/visibility   -> 404
POST   /orgs/Lucent-Financial-Group/packages/container/zeta-portal/visibility   -> 404
PUT    /orgs/Lucent-Financial-Group/packages/container/zeta-portal/visibility   -> 404
```

`GET` returns 200 on the *same* path every write method 404s on, so the 404 is "no such
route", not "no such package". Corroborated by: (a) the REST reference for Packages
enumerates 27 endpoints, all `GET`/`DELETE`/`restore`, none touching visibility; (b) GraphQL
schema introspection exposes exactly one package mutation, `deletePackageVersion`. Token
carries `admin:org` + `write:packages`, so this is not a scope shortfall.

**The human path** (per package):
`https://github.com/orgs/Lucent-Financial-Group/packages/container/package/zeta-portal/settings`
→ **Danger Zone** → **Change visibility** → **Public** → type the package name →
**"I understand the consequences, change package visibility"**. Same for
`.../package/zeta-platform-controller/settings`.

**This is irreversible.** GitHub: *"Once you make a package public, you cannot make it
private again."* That puts it in the gated non-reversible class — it is authorized here
because Aaron named both packages explicitly, not because an agent judged it safe.

## 2. Flowdent — `cloudservice`, `fd-webclient`. Do NOT publish. This is a manifest defect.

Aaron drew the line on **source-repo privacy, not image visibility**: *"if the flowdent
stuff is in zeta it's fine to make it public ... we don't need to deploy any private
flowdent repos stuff in the public Zeta, only stuff that's in the public Zeta for flowdent,
none of the private repo stuff."*

Measured provenance — the packages' own `repository` links:

| image | source repo | repo state |
|---|---|---|
| `ghcr.io/flowdent/cloudservice` | `Flowdent/fd-core` | `private=true`, `visibility=private` |
| `ghcr.io/flowdent/fd-webclient` | `Flowdent/fd-webclient` | `private=true`, `visibility=internal` |

The `Flowdent` org has **`public_repos: 0`, `owned_private_repos: 9`** — there is no public
Flowdent source for anything.

So this falls on the "do not publish" side by Aaron's own rule, and the defect is upstream:
**the public Zeta tree references build outputs of private repositories.**
`full-ai-cluster/k8s/applications/platform/blueprints-flowdent.yaml:19,50` names both images,
and `Application.yaml:29` includes `blueprints-flowdent` in the platform Application's glob.
A public repo whose deployment depends on artifacts nobody outside can pull is the
`clone-at-tag-stays-sufficient` failure in a different costume.

**Options — for Aaron and Max to choose, not for an agent to pick.** Nothing is removed from
the chart here; changing what a deployment references changes what a deployment does.

- **(a) Drop the reference** from the public tree.
- **(b) Split the chart** so the Flowdent Blueprints live where their source lives.
- **(c) Open the source.** Only this one makes publishing the images consistent with the rule
  — the rule keys on the repo, so the repo is what would have to change.
- **(d) Keep as-is and accept** `platform` stays unmeasurable, recorded as a known exception.

Note (b)/(d) are cheaper than they look: these are **Blueprints**, i.e. templates. PR #13457
/ #13524 already established that a Blueprint instantiates nothing until a `Deployable` names
it, and none does.

## 3. `ich777/steamcmd:armareforger` — does not exist upstream.

The publisher ships no Arma Reforger image. A prior agent refused to substitute a sibling tag
because the four game tags share only their first two layers; that refusal stands and is
correct — an unevidenced substitution would be a measurement of a different artifact.

## Consequence to state plainly

**Publishing both of our packages does not unquarantine `platform`.** It takes the blocker
list from 5 to 3, and `platform` stays in CANNOT BE PRICED until #2 and #3 are answered.

## Confirmed unaffected: `hat-system` and `orleans`

`orgs/Lucent-Financial-Group` publishes **exactly two** container packages — the two above.

```
hat-system-operator  -> 404    zeta-orleans-silo  -> 404
```

Neither was ever built, so **no visibility change can reach them**. Tracked separately at
081M0QB1ZBW087G0R002664EN7 (hat-system) and 081M0QB1Q6Z087G0R00091JH3Q (orleans).

## Falsifier

Baseline, anonymous (no token), both images today:

```
GET https://ghcr.io/v2/lucent-financial-group/{zeta-portal,zeta-platform-controller}/manifests/latest  -> 403
```

After the UI flip this must become `200` **without a token** — visibility reported as `public`
is not the same as anonymously pullable, and the partitioner has no token. Then
`lane-partition.ts --rung dev` must show `platform` with **3** unmeasurable images, not 5.
