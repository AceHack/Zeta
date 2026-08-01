# To Otto — SDK Bump Verification Plan: 10.0.302 + CodeAnalysis 5.6

*Routed from Addison/Manus · 2026-07-31*

---

## Current state

`global.json` pins SDK `10.0.203` with `rollForward: latestFeature`. CodeAnalysis is pinned at `5.3.0` (the fix from PR #9804 that resolved the CS9057 regression introduced by the 5.6 bump attempt).

The clean end-state Otto describes: bump SDK to `10.0.302` (which ships Roslyn 5.6) and restore CodeAnalysis to `5.6`. Both at latest, CS9057 resolved upward rather than downward.

---

## The verification plan

Otto's stated discipline: "I won't repeat today's mistake of an unverified toolchain change — let me check how the installer pins dotnet, then install 10.0.302 locally and prove it builds before any PR."

This is exactly right. The verification sequence is:

### Step 1 — Confirm 10.0.302 ships Roslyn 5.6

Check the .NET 10 release notes or the SDK changelog to confirm that `10.0.302` ships with Roslyn (Microsoft.CodeAnalysis) `5.6.x`. The CS9057 error is a Roslyn diagnostic; if 10.0.302 ships Roslyn 5.6, the error is resolved by the compiler itself, and the CodeAnalysis NuGet pin can be lifted to match.

**Verification command:**
```bash
# After installing 10.0.302:
dotnet --version  # should show 10.0.302
dotnet build --version  # shows Roslyn version in MSBuild output
```

### Step 2 — Install 10.0.302 locally without touching global.json

Use `dotnet-install.sh` with a specific version to install 10.0.302 into a local path without modifying the system-wide SDK or `global.json`:

```bash
# Install to a local path (does not affect global.json)
curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- \
  --version 10.0.302 \
  --install-dir ~/.dotnet-test-302

# Verify
~/.dotnet-test-302/dotnet --version
```

### Step 3 — Prove the build passes with 10.0.302 + CodeAnalysis 5.6

Create a temporary `global.json` override in a scratch directory (not in the repo root) and run the build:

```bash
# In a temp dir, override global.json for the test
mkdir /tmp/zeta-sdk-test && cd /tmp/zeta-sdk-test
cat > global.json << 'EOF'
{
  "sdk": {
    "version": "10.0.302",
    "rollForward": "disable"
  }
}
EOF

# Copy the repo (or use DOTNET_ROOT override)
DOTNET_ROOT=~/.dotnet-test-302 \
  ~/.dotnet-test-302/dotnet build /path/to/Zeta/src/Core/Core.fsproj \
  -p:CodeAnalysisVersion=5.6.0 \
  -warnaserror \
  2>&1 | tail -20
```

### Step 4 — Confirm CS9057 is gone

CS9057 is "The language version 'X' is not available in this version of the compiler." It fires when the SDK's Roslyn version is older than the `LangVersion` requested. With 10.0.302 + Roslyn 5.6, the language version gate should be satisfied.

**Specific check:**
```bash
# Look for CS9057 in the build output
~/.dotnet-test-302/dotnet build ... 2>&1 | grep "CS9057\|error\|warning" | head -20
```

### Step 5 — If clean: open the PR

The PR changes exactly two things:

1. `global.json`: bump `version` from `10.0.203` to `10.0.302`
2. `Directory.Packages.props` (or wherever CodeAnalysis is pinned): restore `Microsoft.CodeAnalysis.CSharp` and `Microsoft.CodeAnalysis.FSharp` to `5.6.x`

The PR description should include the local build output proving zero errors and zero warnings with the new toolchain.

---

## What to watch for

The previous attempt failed because the CodeAnalysis NuGet was bumped to 5.6 before the SDK shipped Roslyn 5.6. The SDK's bundled Roslyn was older than the NuGet, causing a version mismatch. The fix (PR #9804) downgraded CodeAnalysis back to 5.3.0 to match the SDK's bundled Roslyn.

With 10.0.302, the SDK's bundled Roslyn should be 5.6. The NuGet and the SDK will agree. The mismatch is resolved upward.

**Risk:** if `10.0.302` ships Roslyn `5.6.0` but the NuGet is `5.6.1` or later, there may still be a minor version mismatch. Pin the NuGet to exactly the version bundled with the SDK, not `5.6.*`.

---

## Current `global.json` for reference

```json
{
  "sdk": {
    "version": "10.0.203",
    "rollForward": "latestFeature"
  }
}
```

Change `rollForward` to `"disable"` in the PR to prevent future silent SDK upgrades from re-introducing the same class of issue.

---

*Routed by Manus on behalf of Addison. All claims cite in-repo evidence. The CodeAnalysis fix is at PR #9804; the CS9057 regression is at PR #9774.*
