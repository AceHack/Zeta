import { createStudentTState, updateStudentT, type StudentTState } from "../planning/student-t-bnn";
import { WSet, RealAlgebra } from "./wset";

export interface BnnPriors {
  explorationRate: number; // 0.0 - 1.0 (how uniform the distribution is)
  targetTrackingWeight: number; // 0.0 - 1.0 (how much to care about closing the distance)
}

/**
 * A Society of Student-t BNNs for predicting the optimal CHIP-8 key.
 * 
 * Uses the latest Bayesian Categorical Tensors (WSet) for multilayer EP inference.
 */
export class BnnSocietyPredictor {
  private priors: BnnPriors = {
    explorationRate: 0.1,
    targetTrackingWeight: 0.9,
  };

  private agents: Map<string, Record<number, StudentTState>> = new Map();
  public agentCount: number;

  constructor(agentCount: number = 3) {
    this.agentCount = agentCount;
    this.initializeSociety();
  }

  private initializeSociety() {
    for (let i = 0; i < this.agentCount; i++) {
      const agentBeliefs: Record<number, StudentTState> = {};
      for (let k = 0; k <= 0xF; k++) {
        const diversityVariance = 1.0 + (Math.random() * 0.5); 
        agentBeliefs[k] = createStudentTState(4.0, 0.0, diversityVariance, 0.1);
      }
      this.agents.set(`agent_${i}`, agentBeliefs);
    }
  }

  public setPriors(priors: Partial<BnnPriors>) {
    this.priors = { ...this.priors, ...priors };
  }

  public getPriors(): BnnPriors {
    return this.priors;
  }

  /**
   * Calculates the probability distribution for all 16 hex keys using WSet Comonoid consensus.
   */
  public predict(display: boolean[]): Record<number, number> {
    // 1. Calculate heuristic visual gradients
    let leftX = 0, leftY = 0, leftCount = 0;
    let rightX = 0, rightY = 0, rightCount = 0;

    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = x + y * 64;
        if (display[idx]) {
          if (x < 32) {
            leftX += x; leftY += y; leftCount++;
          } else {
            rightX += x; rightY += y; rightCount++;
          }
        }
      }
    }

    const observations: Record<number, number> = {};
    for (let i = 0; i <= 0xF; i++) observations[i] = 0.0;

    if (leftCount > 0 && rightCount > 0) {
      const pX = leftX / leftCount;
      const pY = leftY / leftCount;
      const tX = rightX / rightCount;
      const tY = rightY / rightCount;

      const dx = tX - pX;
      const dy = tY - pY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        if (ny < 0) observations[2] = (observations[2] ?? 0) + Math.abs(ny) * this.priors.targetTrackingWeight;
        if (ny > 0) observations[8] = (observations[8] ?? 0) + Math.abs(ny) * this.priors.targetTrackingWeight;
        if (nx < 0) observations[4] = (observations[4] ?? 0) + Math.abs(nx) * this.priors.targetTrackingWeight;
        if (nx > 0) observations[6] = (observations[6] ?? 0) + Math.abs(nx) * this.priors.targetTrackingWeight;
      }
    }

    // 2. Online EP Training (Training = Running the Sim)
    const agentWSets: WSet<number, number>[] = [];
    
    for (const beliefs of this.agents.values()) {
      const wsetEntries: { key: number, weight: number }[] = [];
      for (let k = 0; k <= 0xF; k++) {
        const obsValue = observations[k] ?? 0.0;
        const y = obsValue + ((Math.random() - 0.5) * 0.05); // Add subjective noise
        const result = updateStudentT(beliefs[k]!, y);
        beliefs[k] = result.state;
        
        // The weight is the raw unnormalized probability (posterior mean)
        const weight = Math.max(0, result.state.posterior.mu);
        wsetEntries.push({ key: k, weight });
      }
      agentWSets.push(new WSet(RealAlgebra, wsetEntries));
    }

    // 3. Comonoid Wiring for Consensus
    // We combine all agent WSets by mapping them into a unified WSet and consolidating.
    const allEntries: { key: number, weight: number }[] = [];
    for (const wset of agentWSets) {
      allEntries.push(...wset.entries);
    }
    
    // Create a unified WSet and use `consolidate` (which sums weights for same keys)
    const unifiedSet = new WSet(RealAlgebra, allEntries);
    const consensusSet = unifiedSet.consolidate();

    // 4. Normalize and apply exploration rate
    const consensusProbs: Record<number, number> = {};
    for (let i = 0; i <= 0xF; i++) consensusProbs[i] = 0.0;
    
    let sum = 0;
    for (const entry of consensusSet.entries) {
      const w = entry.weight / this.agentCount; // Average across agents
      consensusProbs[entry.key] = w + (this.priors.explorationRate / 16);
      sum += consensusProbs[entry.key]!;
    }

    if (sum > 0) {
      for (let i = 0; i <= 0xF; i++) consensusProbs[i] = consensusProbs[i]! / sum;
    }

    return consensusProbs;
  }
}
