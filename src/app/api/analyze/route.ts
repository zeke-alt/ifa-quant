/**
 * Market Analysis API Route
 * 
 * This route orchestrates the core "intelligence" of the application.
 * It fetches live market data from Bayse, processes it for reliability,
 * and passes it to Vertex AI (Gemini) to generate actionable trading signals.
 */

import { bayseRead } from "@/lib/bayse-server";
import { GoogleGenAI } from "@google/genai";
console.log("ENV CHECK:", {
  hasGemini: !!process.env.GEMINI_API_KEY,
  hasBayseKey: !!process.env.BAYSE_API_KEY,
  hasBayseSecret: !!process.env.BAYSE_API_SECRET,
});
// Initialize Vertex AI with Project & Location from env
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

// Logic: In-memory cache to prevent redundant AI calls and save on token usage
// Cache is now currency-specific.
let cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 30;

// Logic: The "Stability Latch"
// We store a global history of signals to prevent AI jitter.
// If a new prediction is within 4% of the old one, we stick with the old one.
const STABILITY_THRESHOLD = 0.04;
let signalHistory: Record<string, any> = {};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";
  const eventId = searchParams.get("eventId");
  const currency = searchParams.get("currency") || "USD";

  // Check if we can serve from cache (only for global feed)
  if (!eventId && !force && cache[currency] && Date.now() - cache[currency].timestamp < CACHE_DURATION) {
    console.log(`CACHE_HIT: Serving existing ${currency} intelligence signals`);
    return Response.json(cache[currency].data);
  }

  try {
    let events = [];

    if (eventId) {
      console.log(`ANALYSIS_START: Fetching specific event ${eventId} from Bayse...`);
      const data = await bayseRead(`/v1/pm/events/${eventId}`);
      // Handle both { event: {...} } and {...} formats
      const event = data.event || (data.id ? data : null);
      events = event ? [event] : [];
    } else {
      console.log(`ANALYSIS_START: Fetching live markets (${currency}) from Bayse...`);
      const data = await bayseRead(
        `/v1/pm/events?status=open&limit=10&size=10&currency=${currency}`,
      );
      events = data.events ?? [];
    }

    if (events.length === 0) {
      return Response.json({ error: "No open markets found" }, { status: 404 });
    }

    // Step 2: Flatten markets for individual analysis
    // Logic: Every selection is a unique trade. We flatten them but keep the event context
    // so the AI can differentiate between multiple selections under the same event.
    const flattenedMarkets = events.flatMap((e: any) =>
      e.markets.map((m: any) => ({
        eventId: e.id,
        eventTitle: e.title,
        marketId: m.id,
        marketTitle: m.title,
        yesProbability: m.outcome1Price,
        totalOrders: m.totalOrders,
        liquidity: e.liquidity,
        category: e.category,
        feeRate: m.feeRate ?? e.feeRate ?? 0.1,
      })),
    );

    // Step 3: Compute Absolute Market Math Benchmarks
    // Targets: $50k Liquidity = 1.0, 500 Orders = 1.0
    const LIQUIDITY_BENCHMARK = 50000;
    const VOLUME_BENCHMARK = 500;

    const marketsWithMath = flattenedMarkets.map((m: any) => {
      const liquidityMath = Math.min(1, (m.liquidity ?? 0) / LIQUIDITY_BENCHMARK);
      const volumeMath = Math.min(1, (m.totalOrders ?? 0) / VOLUME_BENCHMARK);
      
      return { 
        ...m, 
        market_math: {
          liquidity_quality: parseFloat(liquidityMath.toFixed(2)),
          volume_quality: parseFloat(volumeMath.toFixed(2)),
          description: `Liquidity: $${(m.liquidity ?? 0).toLocaleString()}, Orders: ${m.totalOrders ?? 0}`
        }
      };
    });

    // Step 4: Construct the AI Prompt (The Alpha Filter)
    const prompt = `You are an elite macro analyst. Analyze these live prediction markets.
For each EVENT, you must identify and return ONLY the single most mispriced SELECTION (the "Alpha" trade).

STRICT RULES:
1. One Signal per Event: Even if an event has 10 markets, you only return ONE signal for that event—the one with the largest gap between your assessed probability and the market price.
2. Ignore Low-Alpha Trades: If a selection has no meaningful mispricing, do not generate a signal for it.
3. Unique Headline: The headline must be specific to the SELECTION you chose, not just the event title.
4. Reliability Fusion: Your "source_reliability" MUST be a fusion of your logical conviction AND the provided "market_math". If liquidity_quality is low (< 0.3), you MUST downgrade your reliability score regardless of how sure your logic is. Mention this in your logic.

LIVE MARKET DATA WITH MATH BENCHMARKS:
${JSON.stringify(marketsWithMath, null, 2)}

Return a JSON object:
{
  "global_confidence": <0-1>,
  "active_signals": <count>,
  "data_points": <total orders>,
  "signals": [
    {
      "eventId": <copy exact>,
      "eventTitle": <copy exact>,
      "marketId": <copy exact>,
      "marketTitle": <copy exact>,
      "headline": <unique headline for this alpha selection>,
      "probability": <your YES probability 0-1>,
      "sentiment": <"BULLISH" | "BEARISH" | "RISK_ALERT" | "NEUTRAL">,
      "direction": <"BUY_YES" | "BUY_NO" | "WAIT">,
      "logic": <2 paragraph reasoning. If reliability is low due to market_math, explain why.>,
      "source_reliability": <your 0-1 FUSED confidence score (Logic + Market Math)>,
      "historical_accuracy": <0-1>,
      "category": <copy exact>,
      "feeRate": <copy exact>,
      "yesProbability": <copy exact price>
    }
  ]
}

Find the alpha. Focus on Nigerian/African macro context.`;

    // Step 5: Invoke Vertex AI
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const responseText = result.text;
    if (!responseText) throw new Error("Vertex AI returned no text");

    const signals = JSON.parse(responseText);

    // Step 6: Post-Processing Deduplication & Stability Latching
    // Ensure we only have one signal per eventId even if AI hallucinated
    const seenEvents = new Set();
    signals.signals = signals.signals.filter((s: any) => {
      if (seenEvents.has(s.eventId)) return false;
      seenEvents.add(s.eventId);
      return true;
    });

    // Apply Stability Latch
    signals.signals = signals.signals.map((s: any) => {
      const prev = signalHistory[s.marketId];
      if (prev) {
        const delta = Math.abs(Number(s.probability) - Number(prev.probability));
        if (delta < STABILITY_THRESHOLD) {
          // Latch to previous probability and logic to maintain consistency
          console.log(`LATCH_ACTIVE: Stabilizing ${s.marketId} (delta: ${(delta * 100).toFixed(1)}%)`);
          return {
            ...s,
            probability: prev.probability,
            logic: prev.logic, // Keep reasoning consistent too
            market_question: s.marketTitle
          };
        }
      }
      
      // Significant change or new signal — update history
      signalHistory[s.marketId] = s;
      return { ...s, market_question: s.marketTitle };
    });

    // Update Cache
    cache[currency] = { data: signals, timestamp: Date.now() };
    console.log(`VERTEX_SUCCESS: Generated ${signals.signals.length} unique alpha signals for ${currency}.`);

    return Response.json(signals);
  } catch (err) {
    // Logic: Fallback to stale cache if AI call fails, ensuring uptime.
    if (cache[currency]) {
      console.warn(`VERTEX_FAILED: Serving stale ${currency} cache as fallback.`);
      return Response.json(cache[currency].data);
    }
    console.error("ANALYZE_ERROR:", err);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
