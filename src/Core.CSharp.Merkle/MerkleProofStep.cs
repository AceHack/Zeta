namespace Zeta.Core.CSharp;

/// <summary>
/// One step of a Merkle inclusion (audit) proof: the sibling digest at a level
/// plus which side it occupies. <see cref="SiblingOnRight"/> = true ⇒ the sibling
/// is the RIGHT child (the current node is the LEFT child, so
/// <c>parent = Combine(self, sibling)</c>); false ⇒ <c>parent = Combine(sibling, self)</c>.
/// Mirrors the F# <c>MerkleProofStep</c> record (<c>src/Core/Merkle.fs</c>) byte-for-byte,
/// so the same <c>(leaf, steps, root)</c> verifies identically across the F#/Rust/TS/C# oracles.
/// </summary>
public readonly record struct MerkleProofStep(MerkleHash Sibling, bool SiblingOnRight);
