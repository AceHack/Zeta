# Seed Manifest — Bootstrap Razor Test Repo

The minimal file set that seeds the test repo for the 23-hour
recreation experiment (081KQTPYE0008QG0R00392KABJ). A fresh-context agent starts
with ONLY these files and attempts to recreate the codebase.

## Design decisions

### 1. Bootstrap docs: EXCLUDED

The test repo does NOT include CLAUDE.md, AGENTS.md, or
GOVERNANCE.md. Rationale: including them gives the fresh agent
the answer key — factory conventions, reviewer roles, build
gates. Excluding them tests whether specs alone are sufficient
to derive those conventions. This is the stronger test.

If the fresh agent cannot derive build conventions from specs,
that's a finding (the specs are incomplete, not that the
bootstrap docs should be included).

### 2. Formal proofs: INCLUDED

TLA+ specs are included because they encode safety invariants
that can't be derived from code alone (they specify properties
the code SHOULD have, not properties it DOES have). Excluding
them would force the fresh agent to rediscover safety
properties from first principles — interesting but not the
hypothesis under test.

### 3. Directory structure: MIRRORED

The test repo mirrors Zeta's directory layout. Rationale: the
directory structure IS part of the spec (paths are referenced
in overlay files, profile templates, etc.).

## Included paths

```yaml
include:
  # OpenSpec behavioural specs (6 capabilities)
  - openspec/specs/**/spec.md
  - openspec/specs/**/overlays/**
  - openspec/README.md

  # TLA+ formal specs (19 specs)
  - tools/tla/specs/*.tla

  # Alloy specs (2 specs)
  - tools/alloy/specs/*.als

  # Z3 verification (the algebraic lemmas, not the tautologies)
  - tools/Z3Verify/Program.fs
  - tools/Z3Verify/Z3Verify.fsproj

  # Build infrastructure (the contract, not the implementation)
  - Directory.Build.props
  - Directory.Packages.props
  - Zeta.sln
  - .editorconfig

  # Project structure (empty dirs with READMEs)
  - src/Core/README.md          # if exists
  - tests/Tests.FSharp/README.md # if exists
```

## Excluded paths (with rationale)

```yaml
exclude:
  # Bootstrap docs — the answer key (Decision #1)
  - CLAUDE.md
  - AGENTS.md
  - GOVERNANCE.md
  - docs/ALIGNMENT.md

  # Source code — the thing being recreated
  - src/**/*.fs
  - src/**/*.cs
  - tests/**/*.fs

  # Memory — per 081KR2E4K0008QG0R000W3W6C1 categories 1/3/4 (KEEP/EXEMPT)
  - memory/**

  # Factory tooling — derivative of specs
  - tools/hygiene/**
  - tools/backlog/**
  - tools/github/**
  - tools/ops/**
  - tools/peer-call/**

  # CI workflows — derivative of repo-automation spec
  - .github/workflows/**

  # Skills/agents/commands — derivative of GOVERNANCE
  - .claude/**

  # Docs — derivative or exempt
  - docs/**  # except bootstrap-razor/ itself
```

## Metrics

Per 081KR2E4K0008QG0R001BRHAPK (spec audit):

| What's seeded | Count |
| ------------- | ----- |
| OpenSpec behavioural specs | 6 |
| TLA+ formal specs | 19 |
| Alloy specs | 2 |
| Z3 lemmas | 16 |
| Build config files | 4 |
| **Total seed files** | **~47** |

The recreation experiment measures: from these 47 files, how
much of the 81-module `src/Core/` can a fresh agent recreate
in 23 hours? The spec audit (081KR2E4K0008QG0R001BRHAPK) showed 37% coverage —
the experiment tests whether that 37% is sufficient to
bootstrap the other 63%.
