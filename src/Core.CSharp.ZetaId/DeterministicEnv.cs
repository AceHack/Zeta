namespace Zeta.Core.CSharp.ZetaId;

public static class DeterministicEnv
{
    public static readonly ISimulationEnvironment Instance = new DeterministicEnvironment();

    private sealed class DeterministicEnvironment : ISimulationEnvironment
    {
        public long NextInt64() => 0;
    }
}
