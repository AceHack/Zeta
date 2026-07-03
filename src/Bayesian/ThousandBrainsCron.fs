namespace Zeta.Bayesian

open System
open System.Threading.Tasks
open Zeta.Core
open Zeta.Core.Abstractions


/// <summary>
/// Wires the Thousand Brains lattice to the distributed cron runtime.
/// Each column is a tick source. On tick, the column observes reality,
/// updates its belief, and returns the Information Value (IV) gained.
/// This IV feeds back into the adaptive tick mechanism (four-corner closure).
/// </summary>
type ThousandBrainsCron(runtime: IDistributedCronRuntime) =

    /// Registers a column as a distributed tick source.
    member this.RegisterColumn(columnId: string, baseInterval: TimeSpan) =
        let config = 
            CronConfig(
                Interval = baseInterval,
                AutoStart = true,
                AdaptiveTick = true // Zero IV causes exponential backoff
            )
        runtime.RegisterTickSource(columnId, config)

    /// Binds the column's observation cycle to the tick.
    /// The observation function represents reading from the continuous environment.
    member this.BindColumn(column: ThousandBrains.Column, observationFn: unit -> Gaussian) =
        let mutable currentColumn = column
        
        let callback = Func<DateTime, Task<double>>(fun _time ->
            // 1. Observe reality
            let observation = observationFn ()
            
            // 2. Update belief and compute IV
            let updatedColumn = ThousandBrains.observe currentColumn observation
            
            // 3. The IV gained in this tick
            let ivGained = InformationValue.compute currentColumn.Belief updatedColumn.Belief
            
            // In a real system, we'd persist the updated column state here
            currentColumn <- updatedColumn
            
            // 4. Return IV (as double) to drive the adaptive tick rate
            Task.FromResult(float ivGained)
        )
        runtime.OnTick(column.Id, callback)
