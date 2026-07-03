using System;
namespace Zeta.Core.Abstractions;
/// <summary>
/// Represents the abstract configuration of a tick source.
/// </summary>
public struct CronConfig
{
    public TimeSpan Interval { get; set; }
    public bool AutoStart { get; set; }
    /// <summary>
    /// If true, the interval adapts based on Information Value (IV) gain.
    /// Zero IV (e.g., Sybil clones) causes exponential backoff.
    /// </summary>
    public bool AdaptiveTick { get; set; }
}
