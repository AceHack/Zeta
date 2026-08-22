module internal Zeta.Bayesian.AssemblyInfo

open System.Runtime.CompilerServices

// InternalsVisibleTo is for the test assembly only, per GOVERNANCE.md §19's
// standing redirect: "the tests need it" is never a reason to make a member
// public. `BoundJustification` is an authoring discipline with no consumer
// outside this assembly, so it stays internal and the tests reach it here.
[<assembly: InternalsVisibleTo("Bayesian.Tests")>]
do ()
