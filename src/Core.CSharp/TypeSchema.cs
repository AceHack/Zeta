using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// A zeta <b>type schema</b> — the language-neutral IR a code generator consumes to emit a typed
/// surface. One schema feeds the C# codegen (<see cref="SchemaCodegen"/>), the TypeScript
/// <c>codegen-from-ir</c>, and a future Rust codegen: one IR, a typed surface per language oracle
/// ("all langs, the same feature"). The generative C# leg consumes this without any F# dependency.
/// </summary>
/// <param name="Namespace">Target namespace for the emitted type.</param>
/// <param name="TypeName">Name of the emitted record type.</param>
/// <param name="Fields">Ordered fields, rendered as positional record parameters in order.</param>
public sealed record TypeSchema(string Namespace, string TypeName, IReadOnlyList<SchemaField> Fields);
