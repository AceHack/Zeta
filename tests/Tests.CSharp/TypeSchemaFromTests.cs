using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Tests for <see cref="TypeSchema.From"/> - infer a schema from one
/// <see cref="DynamicValue.Object"/> sample. Refusals are the contract: mixed
/// or uninferrable shapes must not collapse to <c>object</c>.
/// </summary>
public class TypeSchemaFromTests
{
    private static DynamicValue.Object Obj(params (string Key, DynamicValue Value)[] kvs) =>
        new(kvs.Select(kv => new KeyValuePair<string, DynamicValue>(kv.Key, kv.Value)).ToImmutableArray());

    private static DynamicValue.Array Arr(params DynamicValue[] xs) =>
        new(ImmutableArray.Create(xs));

    private static TypeSchema MustFrom(DynamicValue sample, string ns = "Zeta.Generated", string typeName = "Person")
    {
        Result<TypeSchema, TypeSchemaFromError> result = TypeSchema.From(sample, ns, typeName);
        return Assert.IsType<Result<TypeSchema, TypeSchemaFromError>.Ok>(result).Value;
    }

    private static TypeSchemaFromError MustErr(DynamicValue sample, string ns = "Zeta.Generated", string typeName = "Person")
    {
        Result<TypeSchema, TypeSchemaFromError> result = TypeSchema.From(sample, ns, typeName);
        return Assert.IsType<Result<TypeSchema, TypeSchemaFromError>.Err>(result).Error;
    }

    [Fact]
    public void InfersLongAndStringFromIntAndStringFields()
    {
        DynamicValue sample = Obj(
            ("BirthYear", new DynamicValue.Int(1977L)),
            ("Name", new DynamicValue.String("x")));

        TypeSchema schema = MustFrom(sample);

        Assert.Equal("Zeta.Generated", schema.Namespace);
        Assert.Equal("Person", schema.TypeName);
        Assert.Equal(2, schema.Fields.Count);
        Assert.Equal(new SchemaField("BirthYear", "long"), schema.Fields[0]);
        Assert.Equal(new SchemaField("Name", "string"), schema.Fields[1]);
    }

    [Fact]
    public void TopLevelStringRefuses()
    {
        Assert.Equal(TypeSchemaFromError.NotAnObject, MustErr(new DynamicValue.String("x")));
    }

    [Fact]
    public void NullOnlyFieldRefuses()
    {
        DynamicValue sample = Obj(("DeathYear", new DynamicValue.Null()));
        Assert.Equal(TypeSchemaFromError.NullField, MustErr(sample));
    }

    [Fact]
    public void FieldOrderIsObjectInsertionOrder()
    {
        DynamicValue nameFirst = Obj(
            ("Name", new DynamicValue.String("x")),
            ("BirthYear", new DynamicValue.Int(1977L)));
        DynamicValue yearFirst = Obj(
            ("BirthYear", new DynamicValue.Int(1977L)),
            ("Name", new DynamicValue.String("x")));

        TypeSchema nameFirstSchema = MustFrom(nameFirst);
        TypeSchema yearFirstSchema = MustFrom(yearFirst);

        Assert.Equal("Name", nameFirstSchema.Fields[0].Name);
        Assert.Equal("BirthYear", nameFirstSchema.Fields[1].Name);
        Assert.Equal("BirthYear", yearFirstSchema.Fields[0].Name);
        Assert.Equal("Name", yearFirstSchema.Fields[1].Name);
        Assert.False(
            string.Equals(
                SchemaJson.ToJson(nameFirstSchema),
                SchemaJson.ToJson(yearFirstSchema),
                StringComparison.Ordinal));
    }

    [Fact]
    public void FromIsDeterministic()
    {
        DynamicValue sample = Obj(
            ("BirthYear", new DynamicValue.Int(1977L)),
            ("Name", new DynamicValue.String("x")),
            ("Alive", new DynamicValue.Bool(true)),
            ("Score", new DynamicValue.Float(1.5)),
            ("Blob", new DynamicValue.Bytes(ImmutableArray.Create<byte>(1, 2))),
            ("Years", Arr(new DynamicValue.Int(1977L), new DynamicValue.Int(1978L))));

        TypeSchema a = MustFrom(sample);
        TypeSchema b = MustFrom(sample);
        Assert.Equal(SchemaJson.ToJson(a), SchemaJson.ToJson(b));
    }

    [Fact]
    public void MapsRemainingPrimitivesAndUniformIntArray()
    {
        DynamicValue sample = Obj(
            ("Alive", new DynamicValue.Bool(true)),
            ("Score", new DynamicValue.Float(1.5)),
            ("Blob", new DynamicValue.Bytes(ImmutableArray.Create<byte>(1, 2))),
            ("Years", Arr(new DynamicValue.Int(1977L), new DynamicValue.Int(1978L))));

        TypeSchema schema = MustFrom(sample);
        Assert.Equal(new SchemaField("Alive", "bool"), schema.Fields[0]);
        Assert.Equal(new SchemaField("Score", "double"), schema.Fields[1]);
        Assert.Equal(new SchemaField("Blob", "byte[]"), schema.Fields[2]);
        Assert.Equal(new SchemaField("Years", "long[]"), schema.Fields[3]);
    }

    [Fact]
    public void MixedArrayRefuses()
    {
        DynamicValue sample = Obj(
            ("Xs", Arr(new DynamicValue.Int(1L), new DynamicValue.String("x"))));
        Assert.Equal(TypeSchemaFromError.MixedArray, MustErr(sample));
    }

    [Fact]
    public void EmptyArrayRefuses()
    {
        DynamicValue sample = Obj(("Xs", Arr()));
        Assert.Equal(TypeSchemaFromError.EmptyArray, MustErr(sample));
    }

    [Fact]
    public void ArrayOfObjectsRefusesRatherThanCollapsingToObject()
    {
        DynamicValue sample = Obj(
            ("People", Arr(Obj(("Name", new DynamicValue.String("x"))))));
        Assert.Equal(TypeSchemaFromError.MixedArray, MustErr(sample));
    }

    [Fact]
    public void NestedObjectRecursesToParentFieldTypeName()
    {
        DynamicValue sample = Obj(
            ("Address", Obj(("City", new DynamicValue.String("x")))));
        TypeSchema schema = MustFrom(sample, "Zeta.Generated", "Person");
        Assert.Equal(new SchemaField("Address", "Person_Address"), schema.Fields[0]);
    }

    [Fact]
    public void NestedNullFieldRefuses()
    {
        DynamicValue sample = Obj(
            ("Address", Obj(("City", new DynamicValue.Null()))));
        Assert.Equal(TypeSchemaFromError.NullField, MustErr(sample));
    }

    [Fact]
    public void EmptyTypeNameRefuses()
    {
        DynamicValue sample = Obj(("Name", new DynamicValue.String("x")));
        Assert.Equal(TypeSchemaFromError.EmptyTypeName, MustErr(sample, "Zeta.Generated", string.Empty));
    }

    [Fact]
    public void EmptyFieldNameRefuses()
    {
        DynamicValue sample = Obj((string.Empty, new DynamicValue.String("x")));
        Assert.Equal(TypeSchemaFromError.EmptyFieldName, MustErr(sample));
    }

    [Fact]
    public void DuplicateFieldNameRefuses()
    {
        DynamicValue sample = Obj(
            ("Name", new DynamicValue.String("a")),
            ("Name", new DynamicValue.String("b")));
        Assert.Equal(TypeSchemaFromError.DuplicateFieldName, MustErr(sample));
    }

    [Fact]
    public void NullSampleThrows()
    {
        Assert.Throws<ArgumentNullException>(() => TypeSchema.From(null!, "Zeta.Generated", "Person"));
    }
}
