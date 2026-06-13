[<Xunit.Collection("FeatureFlags")>]
module Zeta.Tests.Infra.FeatureFlagsTests

open System
open Xunit
open Zeta.Core

[<CollectionDefinition("FeatureFlags", DisableParallelization = true)>]
type FeatureFlagStateCollection() = class end

[<Fact>]
let ``all flags default to off`` () =
    FeatureFlags.resetAll ()
    Assert.False(FeatureFlags.isEnabled Flag.WitnessDurable)
    Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive)
    Assert.False(FeatureFlags.isEnabled Flag.SignedSemiNaive)
    Assert.False(FeatureFlags.isEnabled Flag.CqfCountingFilter)

[<Fact>]
let ``programmatic set enables flag`` () =
    FeatureFlags.resetAll ()
    FeatureFlags.set Flag.WitnessDurable true
    Assert.True(FeatureFlags.isEnabled Flag.WitnessDurable)
    Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive)
    FeatureFlags.resetAll ()

[<Fact>]
let ``programmatic set to false disables flag`` () =
    FeatureFlags.resetAll ()
    FeatureFlags.set Flag.WitnessDurable true
    Assert.True(FeatureFlags.isEnabled Flag.WitnessDurable)
    FeatureFlags.set Flag.WitnessDurable false
    Assert.False(FeatureFlags.isEnabled Flag.WitnessDurable)
    FeatureFlags.resetAll ()

[<Fact>]
let ``reset removes override, restoring default`` () =
    FeatureFlags.resetAll ()
    FeatureFlags.set Flag.CountingSemiNaive true
    Assert.True(FeatureFlags.isEnabled Flag.CountingSemiNaive)
    FeatureFlags.reset Flag.CountingSemiNaive
    Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive)
    FeatureFlags.resetAll ()

[<Fact>]
let ``resetAll clears all overrides`` () =
    FeatureFlags.resetAll ()
    FeatureFlags.set Flag.WitnessDurable true
    FeatureFlags.set Flag.CountingSemiNaive true
    FeatureFlags.set Flag.SignedSemiNaive true
    FeatureFlags.resetAll ()
    Assert.False(FeatureFlags.isEnabled Flag.WitnessDurable)
    Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive)
    Assert.False(FeatureFlags.isEnabled Flag.SignedSemiNaive)

[<Fact>]
let ``env var DBSP_FLAG_WITNESSDURABLE enables flag`` () =
    FeatureFlags.resetAll ()
    Environment.SetEnvironmentVariable("DBSP_FLAG_WITNESSDURABLE", "1")
    try
        Assert.True(FeatureFlags.isEnabled Flag.WitnessDurable)
    finally
        Environment.SetEnvironmentVariable("DBSP_FLAG_WITNESSDURABLE", null)
        FeatureFlags.resetAll ()

[<Fact>]
let ``env var accepts true, on, yes (case-insensitive)`` () =
    FeatureFlags.resetAll ()
    for value in ["true"; "TRUE"; "True"; "on"; "ON"; "yes"; "YES"; "1"] do
        Environment.SetEnvironmentVariable("DBSP_FLAG_COUNTINGSEMINAIVE", value)
        Assert.True(FeatureFlags.isEnabled Flag.CountingSemiNaive, $"Expected true for '{value}'")
    Environment.SetEnvironmentVariable("DBSP_FLAG_COUNTINGSEMINAIVE", null)
    FeatureFlags.resetAll ()

[<Fact>]
let ``env var rejects 0, false, no, empty, random`` () =
    FeatureFlags.resetAll ()
    for value in ["0"; "false"; "no"; "off"; ""; "banana"] do
        Environment.SetEnvironmentVariable("DBSP_FLAG_COUNTINGSEMINAIVE", value)
        Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive, $"Expected false for '{value}'")
    Environment.SetEnvironmentVariable("DBSP_FLAG_COUNTINGSEMINAIVE", null)
    FeatureFlags.resetAll ()

[<Fact>]
let ``programmatic override takes precedence over env var`` () =
    FeatureFlags.resetAll ()
    Environment.SetEnvironmentVariable("DBSP_FLAG_WITNESSDURABLE", "1")
    FeatureFlags.set Flag.WitnessDurable false
    try
        Assert.False(FeatureFlags.isEnabled Flag.WitnessDurable)
    finally
        Environment.SetEnvironmentVariable("DBSP_FLAG_WITNESSDURABLE", null)
        FeatureFlags.resetAll ()

[<Fact>]
let ``meta-flag RESEARCHPREVIEW enables ResearchPreview-stage flags`` () =
    FeatureFlags.resetAll ()
    Environment.SetEnvironmentVariable("DBSP_FLAG_RESEARCHPREVIEW", "1")
    try
        Assert.True(FeatureFlags.isEnabled Flag.WitnessDurable)
        Assert.True(FeatureFlags.isEnabled Flag.SignedSemiNaive)
        Assert.False(FeatureFlags.isEnabled Flag.CountingSemiNaive)
        Assert.False(FeatureFlags.isEnabled Flag.CqfCountingFilter)
    finally
        Environment.SetEnvironmentVariable("DBSP_FLAG_RESEARCHPREVIEW", null)
        FeatureFlags.resetAll ()

[<Fact>]
let ``stage classifications are correct`` () =
    Assert.Equal(FlagStage.ResearchPreview, FeatureFlags.stage Flag.WitnessDurable)
    Assert.Equal(FlagStage.ResearchPreview, FeatureFlags.stage Flag.SignedSemiNaive)
    Assert.Equal(FlagStage.Experimental, FeatureFlags.stage Flag.CountingSemiNaive)
    Assert.Equal(FlagStage.Experimental, FeatureFlags.stage Flag.CqfCountingFilter)
