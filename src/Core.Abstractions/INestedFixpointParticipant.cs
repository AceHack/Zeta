namespace Zeta.Core;

/// <summary>
/// Optional capability: participates in a nested fixed-point scope.
/// </summary>
public interface INestedFixpointParticipant
{
    bool Fixedpoint(int scope);
}
