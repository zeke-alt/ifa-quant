/**
 * Market Analysis API Route
 * 
 * This route orchestrates the core "intelligence" of the application.
 * It fetches live market data from Bayse, processes it for reliability,
 * and passes it to Vertex AI (Gemini) to generate actionable trading signals.
 */

import { bayseRead } from "@/lib/bayse-server";
import { GoogleGenAI } from "@google/genai";

// Initialize Vertex AI with Project & Location from env
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

// Logic: In-memory cache to prevent redundant AI calls and save on token usage
// Cache lasts for 30 minutes unless 'force=true' is passed in the URL.
let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  // Check if we can serve from cache
  if (!force && cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log("CACHE_HIT: Serving existing intelligence signals");
    return Response.json(cache.data);
  }

  try {
    console.log("ANALYSIS_START: Fetching live markets from Bayse...");
    
    // Step 1: Fetch raw event data from Bayse
    const data = await bayseRead(
      "/v1/pm/events?status=open&limit=10&size=10&currency=USD",
    );
    const events = data.events ?? [];

    if (events.length === 0) {
      return Response.json({ error: "No open markets found" }, { status: 404 });
    }

    // Step 2: Flatten nested Event/Market structure for AI analysis
    // Logic: Bayse returns Events containing multiple Markets. We flatten this 
    // to a single list of tradable outcomes for the AI to process.
    const flattenedMarkets = events.flatMap((e: any) =>
      e.markets.map((m: any) => ({
        eventId: e.id,
        marketId: m.id,
        eventTitle: e.title,
        question: m.title,
        yesProbability: m.outcome1Price,
        noProbability: m.outcome2Price,
        totalOrders: m.totalOrders,
        liquidity: e.liquidity,
        category: e.category,
      })),
    );

    // Step 3: Compute Source Reliability Scores
    // Logic: We calculate a reliability score [0-1] based on market liquidity 
    // and total order volume. We use log-based normalization (log1p) to 
    // handle wide variances in market activity.
    const maxLiquidity = Math.max(
      ...flattenedMarkets.map((m: any) => m.liquidity ?? 0),
    );
    const maxOrders = Math.max(
      ...flattenedMarkets.map((m: any) => m.totalOrders ?? 0),
    );

    const marketsWithReliability = flattenedMarkets.map((m: any) => {
      // Normalize liquidity and volume using log scales
      const liquidityScore =
        maxLiquidity > 0
          ? Math.log1p(m.liquidity) / Math.log1p(maxLiquidity)
          : 0;
      const volumeScore =
        maxOrders > 0 ? Math.log1p(m.totalOrders) / Math.log1p(maxOrders) : 0;
      
      // Combine scores: Liquidity (60%) + Volume (40%)
      const source_reliability = parseFloat(
        (liquidityScore * 0.6 + volumeScore * 0.4).toFixed(2),
      );
      return { ...m, source_reliability };
    });

    // Step 4: Construct the AI Prompt
    // Logic: This detailed prompt instructs Gemini to act as a Macro Analyst,
    // provides the processed data, and enforces strict JSON output formatting.
    const prompt = `You are a macroeconomic analyst specializing in African markets, particularly Nigeria.

Analyze these live prediction market events from Bayse Markets and generate trading signals.

LIVE MARKET DATA:
${JSON.stringify(marketsWithReliability, null, 2)}

CRITICAL ID RULES:
- "eventId" in the data is the parent event ID — copy it EXACTLY as-is
- "marketId" in the data is the specific market/outcome ID — copy it EXACTLY as-is
- These two values are ALWAYS different strings — never set them to the same value
- Do NOT generate, modify, or infer IDs — only copy from the data above

Return a JSON object with this exact structure:
{
  "global_confidence": <number between 0 and 1, weighted average confidence across all signals>,
  "active_signals": <number of signals generated>,
  "data_points": <total orders across all markets>,
  "signals": [
    {
      "eventId": <copy eventId exactly from the data, never same as marketId>,
      "marketId": <copy marketId exactly from the data, never same as eventId>,
      "category": <copy the category field exactly from the market data>,
      "headline": <short punchy headline, max 8 words>,
      "market_question": <the actual market question from the data>,
      "probability": <your assessed YES probability between 0 and 1>,
      "source_reliability": <use the pre-computed source_reliability from the data, do not override it>,
      "historical_accuracy": <estimated historical accuracy 0-1 for this market type>,
      "sentiment": <"BULLISH" | "BEARISH" | "RISK_ALERT" | "NEUTRAL">,
      "direction": <"BUY_YES" | "BUY_NO" | "WAIT"> — your recommended trade direction based on probability and sentiment,
      "logic": <2-3 paragraph reasoning for your probability assessment and sentiment>
      "trend": <an array of the last 5 YES probabilities for this market to show historical trends, if not available use an empty array []>
    }
  ]
}

Generate one signal per market. Be analytical, specific to Nigerian/African macroeconomic context, and honest about uncertainty.`;

    // Step 5: Invoke Vertex AI
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite-preview-02-05",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const responseText = result.text;
    if (!responseText) throw new Error("Vertex AI returned no text");

    const signals = JSON.parse(responseText);

    // Step 6: Post-Processing Validation
    // Logic: Ensure the AI didn't hallucinate or swap IDs, which is critical 
    // for correct chart rendering and trade execution.
    signals.signals = signals.signals.filter((s: any) => {
      if (s.eventId === s.marketId) {
        console.warn(
          `INVALID_IDS: eventId === marketId for "${s.headline}", dropping signal`,
        );
        return false;
      }
      return true;
    });

    // Update Cache
    cache = { data: signals, timestamp: Date.now() };
    console.log("VERTEX_SUCCESS: Generated fresh macro intelligence.");

    return Response.json(signals);
  } catch (err) {
    // Logic: Fallback to stale cache if AI call fails, ensuring uptime.
    if (cache) {
      console.warn("VERTEX_FAILED: Serving stale cache as fallback.");
      return Response.json(cache.data);
    }
    console.error("ANALYZE_ERROR:", err);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
