namespace Zeta.Core.CSharp.Yaml;

/// <summary>How a scalar was written in the source.</summary>
public enum ScalarStyle
{
    /// <summary>Unquoted.</summary>
    Plain,
    /// <summary>'...' (only '' -&gt; ').</summary>
    SingleQuoted,
    /// <summary>"..." (supports \\ \" \n \t \r \0 \/).</summary>
    DoubleQuoted,
}
