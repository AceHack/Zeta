using System;
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
public sealed record TypeSchema(string Namespace, string TypeName, IReadOnlyList<SchemaField> Fields)
{
    /// <summary>
    /// Infer a <see cref="TypeSchema"/> from one <see cref="DynamicValue.Object"/> sample.
    /// Field order is the object's insertion order (order-sensitive). Primitive map:
    /// Bool to <c>bool</c>, Int to <c>long</c>, Float to <c>double</c>, String to <c>string</c>,
    /// Bytes to <c>byte[]</c>; a uniform primitive array maps to <c>T[]</c>. Nested objects
    /// recurse as a CsType token <c>{TypeName}_{FieldName}</c> (this slice returns only
    /// the root schema). Refuses rather than guesses: non-object top-level, empty type
    /// or field names, null-only fields, empty or mixed arrays, duplicate field names.
    /// Nullability is not inferred from a single sample.
    /// </summary>
    /// <param name="sample">The sample value; must be a <see cref="DynamicValue.Object"/>.</param>
    /// <param name="ns">Target namespace for the emitted type.</param>
    /// <param name="typeName">Emitted type name (must be non-empty).</param>
    /// <returns>
    /// <see cref="Result{T, TError}.Ok"/> carrying the inferred schema, or
    /// <see cref="Result{T, TError}.Err"/> with a <see cref="TypeSchemaFromError"/>.
    /// </returns>
    /// <exception cref="ArgumentNullException"><paramref name="sample"/>, <paramref name="ns"/>, or <paramref name="typeName"/> is null.</exception>
    public static Result<TypeSchema, TypeSchemaFromError> From(DynamicValue sample, string ns, string typeName)
    {
        ArgumentNullException.ThrowIfNull(sample);
        ArgumentNullException.ThrowIfNull(ns);
        ArgumentNullException.ThrowIfNull(typeName);

        if (typeName.Length == 0)
        {
            return new Result<TypeSchema, TypeSchemaFromError>.Err(TypeSchemaFromError.EmptyTypeName);
        }

        if (sample is not DynamicValue.Object obj)
        {
            return new Result<TypeSchema, TypeSchemaFromError>.Err(TypeSchemaFromError.NotAnObject);
        }

        return FromObject(obj, ns, typeName);
    }

    private static Result<TypeSchema, TypeSchemaFromError> FromObject(DynamicValue.Object obj, string ns, string typeName)
    {
        var fields = new List<SchemaField>(obj.Pairs.Length);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (KeyValuePair<string, DynamicValue> pair in obj.Pairs)
        {
            if (pair.Key.Length == 0)
            {
                return new Result<TypeSchema, TypeSchemaFromError>.Err(TypeSchemaFromError.EmptyFieldName);
            }

            if (!seen.Add(pair.Key))
            {
                return new Result<TypeSchema, TypeSchemaFromError>.Err(TypeSchemaFromError.DuplicateFieldName);
            }

            Result<string, TypeSchemaFromError> csType = InferCsType(pair.Value, ns, typeName, pair.Key);
            if (csType is Result<string, TypeSchemaFromError>.Err err)
            {
                return new Result<TypeSchema, TypeSchemaFromError>.Err(err.Error);
            }

            var ok = (Result<string, TypeSchemaFromError>.Ok)csType;
            fields.Add(new SchemaField(pair.Key, ok.Value));
        }

        return new Result<TypeSchema, TypeSchemaFromError>.Ok(new TypeSchema(ns, typeName, fields));
    }

    private static Result<string, TypeSchemaFromError> InferCsType(
        DynamicValue value,
        string ns,
        string parentTypeName,
        string fieldName)
    {
        switch (value)
        {
            case DynamicValue.Bool:
                return new Result<string, TypeSchemaFromError>.Ok("bool");
            case DynamicValue.Int:
                return new Result<string, TypeSchemaFromError>.Ok("long");
            case DynamicValue.Float:
                return new Result<string, TypeSchemaFromError>.Ok("double");
            case DynamicValue.String:
                return new Result<string, TypeSchemaFromError>.Ok("string");
            case DynamicValue.Bytes:
                return new Result<string, TypeSchemaFromError>.Ok("byte[]");
            case DynamicValue.Null:
                return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.NullField);
            case DynamicValue.Object nested:
                {
                    string nestedName = parentTypeName + "_" + fieldName;
                    Result<TypeSchema, TypeSchemaFromError> nestedResult = FromObject(nested, ns, nestedName);
                    if (nestedResult is Result<TypeSchema, TypeSchemaFromError>.Err err)
                    {
                        return new Result<string, TypeSchemaFromError>.Err(err.Error);
                    }

                    return new Result<string, TypeSchemaFromError>.Ok(nestedName);
                }
            case DynamicValue.Array arr:
                return InferArrayCsType(arr, ns, parentTypeName, fieldName);
            default:
                return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.NotAnObject);
        }
    }

    private static Result<string, TypeSchemaFromError> InferArrayCsType(
        DynamicValue.Array arr,
        string ns,
        string parentTypeName,
        string fieldName)
    {
        if (arr.Items.Length == 0)
        {
            return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.EmptyArray);
        }

        DynamicValue? firstTyped = null;
        var nullCount = 0;
        foreach (DynamicValue item in arr.Items)
        {
            if (item is DynamicValue.Null)
            {
                nullCount++;
                continue;
            }

            if (item is DynamicValue.Object)
            {
                return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.MixedArray);
            }

            firstTyped ??= item;
        }

        if (firstTyped is null)
        {
            return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.NullField);
        }

        if (nullCount > 0)
        {
            return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.MixedArray);
        }

        Result<string, TypeSchemaFromError> first = InferCsType(firstTyped, ns, parentTypeName, fieldName);
        if (first is Result<string, TypeSchemaFromError>.Err firstErr)
        {
            return firstErr;
        }

        string elementCsType = ((Result<string, TypeSchemaFromError>.Ok)first).Value;
        for (var i = 0; i < arr.Items.Length; i++)
        {
            Result<string, TypeSchemaFromError> next = InferCsType(arr.Items[i], ns, parentTypeName, fieldName);
            if (next is Result<string, TypeSchemaFromError>.Err nextErr)
            {
                return nextErr;
            }

            string nextCsType = ((Result<string, TypeSchemaFromError>.Ok)next).Value;
            if (!string.Equals(nextCsType, elementCsType, StringComparison.Ordinal))
            {
                return new Result<string, TypeSchemaFromError>.Err(TypeSchemaFromError.MixedArray);
            }
        }

        return new Result<string, TypeSchemaFromError>.Ok(elementCsType + "[]");
    }
}
