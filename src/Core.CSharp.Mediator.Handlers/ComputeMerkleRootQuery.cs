using Zeta.Core.CSharp;
using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>
/// Compute the Merkle root over a set of leaves — the integrity domain, as a CQRS query through the
/// mediator. A real operation (tamper-evident commitment), delegating to the proven Merkle Core.
/// </summary>
/// <param name="Leaves">The leaf payloads (UTF-8 encoded before hashing).</param>
public sealed record ComputeMerkleRootQuery(IReadOnlyList<string> Leaves) : IQuery<MerkleHash>;
