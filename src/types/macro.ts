/**
 * MacroSignal
 * -----------
 * The core data shape for a single AI-generated trading signal.
 * This is what Gemini returns for each open Bayse market, and what
 * every card/chart component expects as its `signal` prop.
 */
export interface MacroSignal {
  /** Short punchy headline summarizing the market opportunity (max ~8 words) */
  headline: string;

  /**
   * The actual prediction market question from Bayse.
   * e.g. "Will the CBN cut rates by 50bps in May 2026?"
   * This is used as the card title AND as the marketId when placing trades.
   */
  market_question: string;

  /**
   * Gemini's assessed probability that the YES outcome resolves true.
   * Range: 0.0 (certain NO) → 1.0 (certain YES)
   * This drives the "AI Prediction" percentage on the card.
   */
  probability: number;

  /**
   * Gemini's full analytical reasoning for the probability assessment.
   * Usually 2-3 paragraphs covering macro context, historical patterns,
   * and specific risk factors. Shown in the SignalCard expanded view.
   */
  logic: string;

  /**
   * Overall market direction from Gemini's perspective.
   * - BULLISH     → Gemini sees upside, probability favors YES
   * - BEARISH     → Gemini sees downside, probability favors NO
   * - RISK_ALERT  → High uncertainty or volatility flagged
   * - NEUTRAL     → No strong directional conviction
   * Drives the sentiment badge icon and color on the card.
   */
  sentiment: "BULLISH" | "BEARISH" | "RISK_ALERT" | "NEUTRAL";

  /**
   * How trustworthy the underlying data source is for this signal.
   * Range: 0.0 (unreliable/unverified) → 1.0 (IMF/CBN/official source)
   * Gemini infers this from market liquidity, volume, and order count.
   * Also controls how "noisy" the market line looks on the divergence chart —
   * low reliability = more volatile market line to reflect uncertainty.
   */
  source_reliability: number;

  /**
   * Estimated accuracy of similar signals historically.
   * Range: 0.0 (rarely correct) → 1.0 (almost always correct)
   * Gemini estimates this based on market type (e.g. crypto short-term
   * markets have lower historical accuracy than high-liquidity sports markets).
   * Shown as a progress bar on the card.
   */
  /** Estimated accuracy of similar signals historically... */
  historical_accuracy: number;

  /** Bayse event UUID associated with this signal */
  eventId: string;

  /** Bayse market UUID associated with this signal */
  marketId: string;

  // ── Optional fields (not always present) ──────────────────────────────────

  /** Optional unique identifier for the signal */
  id?: string;

  /** Data source label (e.g. "NBS", "CBN", "IMF") */
  source?: string;

  /** Relative importance weight vs other signals in the same batch */
  weight?: number;

  /** Market category (e.g. "politics", "crypto", "sports", "macro") */
  category?: string;

  /** Historical probability trend — array of past values for sparkline charts */
  trend?: number[];
  
  direction?: "BUY_YES" | "BUY_NO" | "WAIT";
}
