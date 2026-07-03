using System;

namespace Zeta.Core.Abstractions;

/// <summary>
/// Represents the abstract configuration of a tick source.
/// </summary>
public struct CronConfig
{
    public TimeSpan Interval { get; set; }
    public bool AutoStart { get; set; }
}
