---
pr_number: 4715
title: "deps: Bump YamlDotNet from 17.1.0 to 18.0.0"
author: "dependabot"
state: "MERGED"
created_at: "2026-05-23T07:22:19Z"
merged_at: "2026-05-23T13:28:27Z"
closed_at: "2026-05-23T13:28:27Z"
head_ref: "dependabot/nuget/YamlDotNet-18.0.0"
base_ref: "main"
archived_at: "2026-05-23T15:57:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4715: deps: Bump YamlDotNet from 17.1.0 to 18.0.0

## PR description

Updated [YamlDotNet](https://github.com/aaubry/YamlDotNet) from 17.1.0 to 18.0.0.

<details>
<summary>Release notes</summary>

_Sourced from [YamlDotNet's releases](https://github.com/aaubry/YamlDotNet/releases)._

## 18.0.0

## What's Changed

* Add a parse method wrapper and caching to fix AoT compilation by @EdwardCooke in https://github.com/aaubry/YamlDotNet/pull/1103
    **BREAKING CHANGE** This is a breaking change in the `TypeInspectorSkeleton` class and the `ITypeInspector` interface by adding 2 methods . Quick fix to resolve those breaking changes in your own custom TypeInspector is to return false on the HasParseMethod method and return null or throw an exception on the Parse method.


**Full Changelog**: https://github.com/aaubry/YamlDotNet/compare/v17.1.0...v18.0.0

Commits viewable in [compare view](https://github.com/aaubry/YamlDotNet/compare/v17.1.0...v18.0.0).
</details>

[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=YamlDotNet&package-manager=nuget&previous-version=17.1.0&new-version=18.0.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:

- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)


</details>

## Reviews

### APPROVED — @AceHack (2026-05-23T09:29:51Z)

This is a clean dependency update. It should be safe to merge.

### APPROVED — @AceHack (2026-05-23T10:26:19Z)

Reviewed and approved. The breaking change is noted and the remediation is clear.

## General comments

### @dependabot (2026-05-23T07:22:20Z)

### Labels

The following labels could not be found: `dependencies`. Please create it before Dependabot can add it to a pull request.


Please fix the above issues or remove invalid values from `dependabot.yml`.

### @chatgpt-codex-connector (2026-05-23T07:22:23Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @AceHack (2026-05-23T09:30:01Z)

@dependabot merge
