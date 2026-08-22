/**
 * semiotics-engine.ts
 * Maps irreducible geometric shapes from the Visual Cortex onto foundational human language concepts.
 * Bridges the biological rendering with cultural semiotics (English, Chinese Radicals, Runes).
 */

export interface LinguisticToken {
  english: string;
  pictogram: string; // E.g., Chinese radical, rune, or hieroglyph
  meaning: string;
}

export class SemioticsEngine {
  // A mapping dictionary for irreducible shapes vs active concepts
  // Format: [ShapeName][Concept] -> LinguisticToken
  private dictionary: Record<string, Record<string, LinguisticToken>> = {
    "Horizontal Bar": {
      "Time": { english: "Horizon", pictogram: "一", meaning: "Duration / Flow" },
      "Logic": { english: "Equivalence", pictogram: "二", meaning: "Balance / Equals" },
      "Structure": { english: "Foundation", pictogram: "土", meaning: "Earth / Ground" },
      "Language": { english: "Dash", pictogram: "—", meaning: "Pause / Connection" },
      "Love": { english: "Bridge", pictogram: "冖", meaning: "Cover / Connect" },
      "Chaos": { english: "Severance", pictogram: "丿", meaning: "Slash / Cut" },
      "Order": { english: "Level", pictogram: "平", meaning: "Flat / Calm" },
      "Humanity": { english: "Path", pictogram: "辶", meaning: "Walk / Journey" },
      "Nature": { english: "River", pictogram: "川", meaning: "Stream" },
      "Technology": { english: "Wire", pictogram: "丨", meaning: "Line / Transfer" }
    },
    "Vertical Pillar": {
      "Time": { english: "Moment", pictogram: "丨", meaning: "Now / Vertical Line" },
      "Logic": { english: "Truth", pictogram: "直", meaning: "Straight / Absolute" },
      "Structure": { english: "Pillar", pictogram: "柱", meaning: "Support" },
      "Language": { english: "I", pictogram: "我", meaning: "Self / Ego" },
      "Love": { english: "Stand", pictogram: "立", meaning: "Unyielding / Stand Together" },
      "Chaos": { english: "Fall", pictogram: "降", meaning: "Descend / Drop" },
      "Order": { english: "Law", pictogram: "律", meaning: "Rule / Principle" },
      "Humanity": { english: "Person", pictogram: "人", meaning: "Human (standing)" },
      "Nature": { english: "Tree", pictogram: "木", meaning: "Wood / Tree" },
      "Technology": { english: "Tower", pictogram: "塔", meaning: "Structure / Signal" }
    },
    "Diagonal Staircase": {
      "Time": { english: "Future", pictogram: "↗", meaning: "Ascend / Progress" },
      "Logic": { english: "Variance", pictogram: "爻", meaning: "Change / Intersect" },
      "Structure": { english: "Slope", pictogram: "厂", meaning: "Cliff / Incline" },
      "Language": { english: "Slang", pictogram: "言", meaning: "Speech (altered)" },
      "Love": { english: "Growth", pictogram: "生", meaning: "Life / Sprout" },
      "Chaos": { english: "Entropy", pictogram: "乀", meaning: "Stretch / Disorder" },
      "Order": { english: "Steps", pictogram: "阶", meaning: "Stairs / Stages" },
      "Humanity": { english: "Struggle", pictogram: "力", meaning: "Power / Effort" },
      "Nature": { english: "Mountain", pictogram: "山", meaning: "Peak" },
      "Technology": { english: "Graph", pictogram: "📈", meaning: "Data / Upward Trend" }
    },
    "Unknown Shape": {
      "Time": { english: "Eternity", pictogram: "∞", meaning: "Unbounded" },
      "Logic": { english: "Paradox", pictogram: "?", meaning: "Unknown" },
      "Structure": { english: "Void", pictogram: "空", meaning: "Empty / Space" },
      "Language": { english: "Silence", pictogram: "无", meaning: "Nothing / Silent" },
      "Love": { english: "Mystery", pictogram: "玄", meaning: "Deep / Profound" },
      "Chaos": { english: "Noise", pictogram: "黽", meaning: "Swarm / Chaos" },
      "Order": { english: "Pattern", pictogram: "文", meaning: "Text / Pattern" },
      "Humanity": { english: "Soul", pictogram: "心", meaning: "Heart / Mind" },
      "Nature": { english: "Wind", pictogram: "风", meaning: "Formless" },
      "Technology": { english: "Static", pictogram: "⚡", meaning: "Energy / Noise" }
    }
  };

  /**
   * Translates a geometric shape and semantic concept into a linguistic token.
   * If an exact match isn't found, falls back gracefully.
   */
  public translate(shapeName: string, concept: string): LinguisticToken {
    const shapeDict = this.dictionary[shapeName] || this.dictionary["Unknown Shape"];
    const token = shapeDict[concept] || shapeDict["Time"];
    return token;
  }
}
