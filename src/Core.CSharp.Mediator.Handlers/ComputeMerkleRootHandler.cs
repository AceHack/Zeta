using System.Text;
using Zeta.Core.CSharp;
using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>Handles <see cref="ComputeMerkleRootQuery"/> by delegating to the proven Merkle Core — a
/// thin CQRS shell; Core builds the tree and computes the root.</summary>
public sealed class ComputeMerkleRootHandler : IQueryHandler<ComputeMerkleRootQuery, MerkleHash>
{
    /// <summary>Encode the leaves and return the Merkle root (empty set → <see cref="MerkleHash.Zero"/>).</summary>
    public ValueTask<MerkleHash> Handle(ComputeMerkleRootQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        if (query.Leaves.Count == 0)
        {
            return new ValueTask<MerkleHash>(MerkleHash.Zero);
        }

        var leaves = new byte[query.Leaves.Count][];
        for (var i = 0; i < query.Leaves.Count; i++)
        {
            leaves[i] = Encoding.UTF8.GetBytes(query.Leaves[i]);
        }

        return new ValueTask<MerkleHash>(new MerkleTree(leaves).Root);
    }
}
