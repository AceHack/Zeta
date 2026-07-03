namespace Zeta.Core.Abstractions;

/// <summary>
/// The state of a distributed actor/cron job.
/// </summary>
public enum CronState
{
    Idle,
    Ticking,
    Suspended
}
