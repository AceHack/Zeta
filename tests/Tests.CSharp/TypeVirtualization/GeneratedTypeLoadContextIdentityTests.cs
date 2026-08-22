using System;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using Xunit;
using Zeta.Core.CSharp.Blake3;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.TypeVirtualization;

/// <summary>
/// <b>The falsifier for "types are virtualized actors" (2026-08-15).</b> The thesis is that a type is
/// content-addressed by a ZetaId, materialized on demand, resident only while referenced, collectable
/// when not — and activatable more than once for parallelism (Orleans' <c>[StatelessWorker]</c>).
/// <para>
/// These tests separate the two halves of "identity" that the thesis conflates, and they are written so
/// that they FAIL if the separation is not real:
/// </para>
/// <list type="bullet">
///   <item><b>Logical identity holds.</b> Two byte-identical copies of one generated assembly
///   content-address to the SAME <c>ZetaId</c> (category <c>ContentAddress</c>). Change the code, change
///   the id — the built-in versioning Aaron describes.</item>
///   <item><b>Runtime identity does NOT hold.</b> Those same two activations are two distinct CLR
///   <see cref="Type"/> objects with identical <see cref="Type.AssemblyQualifiedName"/>, mutually
///   non-assignable. This is the cost of multi-activation on .NET and it is not removable by
///   content-addressing.</item>
///   <item><b>Collection is real but coarse.</b> A collectible <see cref="AssemblyLoadContext"/> does
///   unload — the granularity is the whole context, never one type.</item>
/// </list>
/// <para>
/// The subject is <c>Zeta.Core.ZSetW_IntegerRing</c>, which exists ONLY because
/// <c>Zeta.Generators.ZSetWRingGenerator</c> (a Roslyn <c>IIncrementalGenerator</c>) ran during this
/// project's compile — i.e. it is a genuinely generated type, not a hand-written one.
/// </para>
/// <para>
/// Anchors: Bernstein/Bykov et al., "Orleans: Distributed Virtual Actors for Programmability and
/// Scalability" (MSR-TR-2014-41); .NET <c>AssemblyLoadContext</c> collectibility and per-context type
/// identity. Doc: <c>docs/research/2026-08-15-the-type-system-as-a-virtualized-runtime-*.md</c>.
/// </para>
/// </summary>
public sealed class GeneratedTypeLoadContextIdentityTests
{
    /// <summary>A type emitted by the Roslyn generator into THIS assembly at compile time.</summary>
    private const string GeneratedTypeName = "Zeta.Core.ZSetW_IntegerRing";

    /// <summary>ZetaId's generic payload is 119 bits, so a 256-bit BLAKE3 digest is truncated to fit.</summary>
    private const int ContentAddressPayloadBits = 119;

    [Fact]
    public void OneGeneratedTypeActivatedTwiceIsTwoDistinctClrTypes()
    {
        string original = typeof(GeneratedTypeLoadContextIdentityTests).Assembly.Location;
        string copy = CopyToTemp(original);

        var alc = new AssemblyLoadContext("zeta-type-activation-identity", isCollectible: true);
        try
        {
            Type? resident = typeof(GeneratedTypeLoadContextIdentityTests).Assembly.GetType(GeneratedTypeName);
            Type? secondActivation = alc.LoadFromAssemblyPath(copy).GetType(GeneratedTypeName);

            Assert.NotNull(resident);
            Assert.NotNull(secondActivation);

            // The two activations are indistinguishable by NAME — the string identity is identical.
            Assert.Equal(resident!.AssemblyQualifiedName, secondActivation!.AssemblyQualifiedName, StringComparer.Ordinal);

            // …and yet they are different types to the CLR. This is the claim under test: `typeof(X) == typeof(X)`
            // is FALSE across load contexts, so a second activation of "the same type" is not the same type.
            Assert.NotSame(resident, secondActivation);
            Assert.False(resident.Equals(secondActivation));

            // Neither can stand in for the other: a value of one is not assignable to the other.
            Assert.False(resident.IsAssignableFrom(secondActivation));
            Assert.False(secondActivation.IsAssignableFrom(resident));
        }
        finally
        {
            alc.Unload();
            TryDelete(copy);
        }
    }

    [Fact]
    public void BothActivationsContentAddressToTheSameZetaId()
    {
        string original = typeof(GeneratedTypeLoadContextIdentityTests).Assembly.Location;
        string copy = CopyToTemp(original);

        var alc = new AssemblyLoadContext("zeta-type-activation-content-address", isCollectible: true);
        try
        {
            Assembly first = typeof(GeneratedTypeLoadContextIdentityTests).Assembly;
            Assembly second = alc.LoadFromAssemblyPath(copy);

            // Different files on disk, byte-identical content.
            Assert.NotEqual(first.Location, second.Location, StringComparer.Ordinal);

            UInt128 firstId = ContentAddressOfFile(first.Location);
            UInt128 secondId = ContentAddressOfFile(second.Location);

            // Logical identity: content-addressing says "the same type", by construction.
            Assert.Equal(firstId, secondId);

            var payload = ZetaIdCodec.UnpackPayload(firstId);
            var contentAddress = Assert.IsType<ZetaIdPayload.ContentAddress>(payload);
            Assert.Equal(IdVersion.V1, contentAddress.Version);

            // Runtime identity: the CLR disagrees about the very same pair. Both statements are true at
            // once — which is exactly why "ZetaId settles type identity" is only half a claim.
            Assert.NotSame(first.GetType(GeneratedTypeName), second.GetType(GeneratedTypeName));

            // And the versioning half: perturb one byte of the content and the id must change.
            byte[] bytes = File.ReadAllBytes(first.Location);
            bytes[0] ^= 0xFF;
            Assert.NotEqual(firstId, ContentAddressOfBytes(bytes));
        }
        finally
        {
            alc.Unload();
            TryDelete(copy);
        }
    }

    [Fact]
    public void CollectibleLoadContextUnloadsWhenNothingReferencesIt()
    {
        string copy = CopyToTemp(typeof(GeneratedTypeLoadContextIdentityTests).Assembly.Location);
        try
        {
            (WeakReference context, WeakReference assembly) = ActivateThenDeactivate(copy);

            // Unload is cooperative: it completes on a later GC once no managed reference survives.
            for (var i = 0; i < 32 && (context.IsAlive || assembly.IsAlive); i++)
            {
                GC.Collect();
                GC.WaitForPendingFinalizers();
            }

            Assert.False(
                context.IsAlive,
                "a collectible AssemblyLoadContext holding a generated type did not unload; the 'types are collectable' half of the thesis would be false");
            Assert.False(assembly.IsAlive);
        }
        finally
        {
            TryDelete(copy);
        }
    }

    /// <summary>
    /// Load an assembly into a collectible context, touch the generated type, then unload and return
    /// only weak references. <see cref="MethodImplOptions.NoInlining"/> matters: it guarantees the
    /// strong locals leave scope before the caller's GC, which is what makes the unload observable.
    /// </summary>
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static (WeakReference Context, WeakReference Assembly) ActivateThenDeactivate(string assemblyPath)
    {
        var alc = new AssemblyLoadContext("zeta-type-activation-unload", isCollectible: true);
        Assert.True(alc.IsCollectible);

        Assembly asm = alc.LoadFromAssemblyPath(assemblyPath);
        Assert.NotNull(asm.GetType(GeneratedTypeName));

        var refs = (new WeakReference(alc), new WeakReference(asm));
        alc.Unload();
        return refs;
    }

    /// <summary>BLAKE3-256 of the file, truncated to the 119-bit ZetaId ContentAddress payload.</summary>
    private static UInt128 ContentAddressOfFile(string path) => ContentAddressOfBytes(File.ReadAllBytes(path));

    private static UInt128 ContentAddressOfBytes(byte[] bytes)
    {
        byte[] digest = ContentHash256.OfBytes(bytes).Raw;

        UInt128 payload = UInt128.Zero;
        for (var i = 0; i < 16; i++)
        {
            payload |= (UInt128)digest[i] << (8 * i);
        }

        payload &= (UInt128.One << ContentAddressPayloadBits) - UInt128.One;
        // PackGeneric (not PackPayload) because the ContentAddress path needs no ISimulationEnvironment:
        // a content address carries no timestamp and no randomness — it is a pure function of the bytes.
        // PackGeneric still enforces the same 119-bit bound, so nothing is being reached past here.
        return ZetaIdCodec.PackGeneric(IdVersion.V1, Category.ContentAddress, payload);
    }

    private static string CopyToTemp(string path)
    {
        string target = Path.Combine(
            Path.GetTempPath(),
            string.Create(CultureInfo.InvariantCulture, $"zeta-type-activation-{Guid.NewGuid():N}.dll"));
        File.Copy(path, target, overwrite: true);
        return target;
    }

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (IOException)
        {
            // The file may still be mapped until the context finishes unloading; a stale temp file is
            // harmless and must never fail the test.
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
