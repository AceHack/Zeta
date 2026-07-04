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

    /// Binds a YinYangCell's observation cycle to the tick.
    /// The yin (Adinkra codeword) is the T0 identity anchor — invariant across ticks.
    /// The yang (ThousandBrains.Column) evolves on every tick.
    /// A ComputeReceipt is emitted per tick via the onReceipt callback.
    member this.BindYinYangCell(
            cell: Zeta.Bayesian.YinYangCell.Cell,
            observationFn: unit -> Gaussian,
            onReceipt: Zeta.Core.ComputeReceipt.Receipt -> unit) =
        let mutable currentCell = cell
        let callback = Func<DateTime, Task<double>>(fun _time ->
            // 1. Observe reality
            let observation = observationFn ()
            // 2. Update the yang (column belief); yin (codeword) is invariant
            let updatedCell = Zeta.Bayesian.YinYangCell.observe observation currentCell
            // 3. Compute IV (KL divergence from prior to posterior)
            let ivGained = InformationValue.compute currentCell.Column.Belief updatedCell.Column.Belief
            // 4. Compute posterior entropy: H(G) = 0.5 * ln(2πe/τ) for Gaussian with precision τ
            let posteriorEntropy =
                let tau = updatedCell.Column.Belief.Precision
                if tau <= 0.0 then 0.0
                else 0.5 * log (2.0 * System.Math.PI * System.Math.E / tau)
            // 5. Emit a ComputeReceipt for this tick.
            // DeltaJ = 1.0 abstract joule per tick (real measurement comes from IScheduler).
            let receipt = Zeta.Core.ComputeReceipt.fromIV (float ivGained) 1.0 posteriorEntropy
            onReceipt receipt
            // 6. Persist the updated cell state
            currentCell <- updatedCell
            // 7. Return IV to drive the adaptive tick rate
            Task.FromResult(float ivGained)
        )
        runtime.OnTick(cell.Column.Id, callback)

    /// Registers a YinYangCell as a distributed tick source.
    member this.RegisterYinYangCell(cell: Zeta.Bayesian.YinYangCell.Cell, baseInterval: System.TimeSpan) =
        this.RegisterColumn(cell.Column.Id, baseInterval)
