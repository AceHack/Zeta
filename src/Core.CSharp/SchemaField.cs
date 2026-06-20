namespace Zeta.Core.CSharp;

/// <summary>One field in a <see cref="TypeSchema"/>: a name and its C#-rendered type.</summary>
/// <param name="Name">The property name (e.g. <c>BirthYear</c>).</param>
/// <param name="CsType">The C#-rendered type (e.g. <c>string</c>, <c>int?</c>, <c>long</c>).</param>
public sealed record SchemaField(string Name, string CsType);
