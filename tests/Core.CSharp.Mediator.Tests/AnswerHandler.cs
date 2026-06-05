using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles the <see cref="Answer"/> query via the Zeta port.</summary>
public sealed class AnswerHandler : IQueryHandler<Answer, int>
{
    /// <summary>Return the answer.</summary>
    public ValueTask<int> Handle(Answer query, CancellationToken cancellationToken) => new(42);
}
