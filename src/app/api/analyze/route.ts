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
  const eventId = searchParams.get("eventId");

  // Check if we can serve from cache (only for global feed)
  if (!eventId && !force && cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log("CACHE_HIT: Serving existing intelligence signals");
    return Response.json(cache.data);
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
      console.log("ANALYSIS_START: Fetching live markets from Bayse...");
      const data = await bayseRead(
        "/v1/pm/events?status=open&limit=10&size=10&currency=USD",
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
      })),
    );

    // Step 3: Compute Reliability
    const maxLiquidity = Math.max(...flattenedMarkets.map((m: any) => m.liquidity ?? 0));
    const maxOrders = Math.max(...flattenedMarkets.map((m: any) => m.totalOrders ?? 0));

    const marketsWithReliability = flattenedMarkets.map((m: any) => {
      const liquidityScore = maxLiquidity > 0 ? Math.log1p(m.liquidity) / Math.log1p(maxLiquidity) : 0;
      const volumeScore = maxOrders > 0 ? Math.log1p(m.totalOrders) / Math.log1p(maxOrders) : 0;
      const source_reliability = parseFloat((liquidityScore * 0.6 + volumeScore * 0.4).toFixed(2));
      return { ...m, source_reliability };
    });

    // Step 4: Construct the AI Prompt (The Alpha Filter)
    const prompt = `You are an elite macro analyst. Analyze these live prediction markets.
For each EVENT, you must identify and return ONLY the single most mispriced SELECTION (the "Alpha" trade).

STRICT RULES:
1. One Signal per Event: Even if an event has 10 markets, you only return ONE signal for that event—the one with the largest gap between your assessed probability and the market price.
2. Ignore Low-Alpha Trades: If a selection has no meaningful mispricing, do not generate a signal for it.
3. Unique Headline: The headline must be specific to the SELECTION you chose, not just the event title.

LIVE MARKET DATA:
${JSON.stringify(marketsWithReliability, null, 2)}

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
      "logic": <2 paragraph reasoning explaining why THIS selection is the best play>,
      "source_reliability": <copy exact>,
      "historical_accuracy": <0-1>,
      "category": <copy exact>,
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

    // Step 6: Post-Processing Deduplication (Safety First)
    // Ensure we only have one signal per eventId even if AI hallucinated
    const seenEvents = new Set();
    signals.signals = signals.signals.filter((s: any) => {
      if (seenEvents.has(s.eventId)) return false;
      seenEvents.add(s.eventId);
      return true;
    });

    // Map compatibility fields
    signals.signals = signals.signals.map((s: any) => ({
      ...s,
      market_question: s.marketTitle
    }));

    // Update Cache
    cache = { data: signals, timestamp: Date.now() };
    console.log(`VERTEX_SUCCESS: Generated ${signals.signals.length} unique alpha signals.`);

    return Response.json(signals);

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
