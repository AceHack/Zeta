module internal Zeta.Core.AssemblyInfo

open System.Runtime.CompilerServices

// InternalsVisibleTo is for test + benchmark assemblies and for
// Zeta.Core.CSharp — the C# shim that exposes declaration-site
// variance F# cannot syntactically produce, and is part of the
// same library family by design. Zeta.Bayesian is NOT in this
// list — it uses the public `IOperator<'T>` plugin interface,
// exactly the shape every external plugin library uses.
[<assembly: InternalsVisibleTo("Tests.FSharp")>]
[<assembly: InternalsVisibleTo("Tests.CSharp")>]
[<assembly: InternalsVisibleTo("Benchmarks")>]
[<assembly: InternalsVisibleTo("Bayesian.Tests")>]
[<assembly: InternalsVisibleTo("Core.CSharp.Tests")>]
[<assembly: InternalsVisibleTo("Zeta.Core.CSharp")>]
do ()
