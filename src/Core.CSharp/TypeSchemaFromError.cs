namespace Zeta.Core.CSharp;

/// <summary>
/// Why <see cref="TypeSchema.From"/> refused to infer a schema from a
/// <see cref="DynamicValue"/> sample. Surfaced as data via
/// <see cref="Result{T, TError}"/> - never thrown, never guessed into a CsType.
/// </summary>
public enum TypeSchemaFromError
{
    /// <summary>The sample is not a top-level <see cref="DynamicValue.Object"/>.</summary>
    NotAnObject,

    /// <summary>The emitted type name is the empty string.</summary>
    EmptyTypeName,

    /// <summary>An object key is the empty string - not a field name.</summary>
    EmptyFieldName,

    /// <summary>
    /// A field's only sample is <see cref="DynamicValue.Null"/> (or an array of only
    /// Null) - no CsType can be inferred from absence.
    /// </summary>
    NullField,

    /// <summary>
    /// An array is empty, so its element type cannot be inferred from one sample.
    /// </summary>
    EmptyArray,

    /// <summary>
    /// An array is not a uniform primitive (mixed shapes, Null mixed with a typed
    /// element, or Object/uninferrable elements). Does not collapse to <c>object</c>.
    /// </summary>
    MixedArray,

    /// <summary>The same field name appears more than once in the object (ordinal).</summary>
    DuplicateFieldName,
}
