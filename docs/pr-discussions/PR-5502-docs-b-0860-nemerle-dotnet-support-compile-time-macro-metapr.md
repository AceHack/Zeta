---
pr_number: 5502
title: "docs(081KSKBP80008QG0R000J2YFK2): Nemerle dotnet support \u2014 compile-time macro metaprogramming complementing F# type providers (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T16:23:51Z"
merged_at: "2026-05-27T16:25:12Z"
closed_at: "2026-05-27T16:25:12Z"
head_ref: "backlog/b-0860-nemerle-dotnet-macro-metaprogramming-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T17:49:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5502: docs(081KSKBP80008QG0R000J2YFK2): Nemerle dotnet support — compile-time macro metaprogramming complementing F# type providers (Aaron 2026-05-27)

## PR description

## Summary

Files 081KSKBP80008QG0R000J2YFK2 substrate-engineering target row for extending dotnet
metaprogramming capability beyond F# type providers + Roslyn Source
Generators via Nemerle's compile-time macro-based syntax extension.

Operator conversation thread:

> *\"i guess you can do that with templates if you are deiciplined\"*
>
> *\"this is why we shold support nmerle for dotnet\"*

The substrate-engineering insight: C++ templates put discipline on
user; Nemerle macros put discipline INTO the language. Aligns with
framework's general \"encoding rules without mechanizing them
produces a memory of failures, not prevention\" pattern.

## Row content highlights

- Capability gap analysis (F# vs C# vs Nemerle on 6 metaprogramming
  surfaces)
- Relationship-type-inference substrate-engineering target (from same
  2026-05-27 conversation thread; PR #5497 razor-anchor-friend-pact
  substrate composes)
- 5 sub-row decomposition for future implementation
- Mika 2026-05-18 substrate anchor verbatim preserved (Nemerle in
  operator's substrate-engineering-language-spectrum)
- JetBrains MPS substrate connection (upstream-prior-art)
- Substrate verification per verify-existing-substrate-before-
  authoring rule

Priority: P3 (substrate-engineering target; not urgent).

## Test plan

- [x] Markdownlint clean (no MD004 leading-+ continuations)
- [x] No prior 081KSKBP80008QG0R000J2YFK2 row on main + no in-flight (ID-allocation
      discipline applied)
- [x] Substrate-verification pass per rule before authoring
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T16:23:57Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
