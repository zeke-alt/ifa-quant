/**
 * Market Analysis API Route
 *
 * This route orchestrates the core "intelligence" of the application.
 * It fetches live market data from Bayse, processes it for reliability,
 * and passes it to Gemini to generate actionable trading signals.
 */

import { bayseRead } from "@/lib/bayse-server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

console.log("ENV CHECK:", {
  hasGemini: !!process.env.GEMINI_API_KEY,
  hasBayseKey: !!process.env.BAYSE_PUBLIC_KEY,
  hasBayseSecret: !!process.env.BAYSE_SECRET_KEY,
});

// Initialize Gemini via Vertex AI (uses GCP billing)
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
const CACHE_DIR = path.join(process.cwd(), ".cache");

// ── Disk cache helpers ────────────────────────────────────────────────────────

function diskCachePath(currency: string) {
  return path.join(CACHE_DIR, `signals-${currency}.json`);
}

function readDiskCache(currency: string): { data: any; timestamp: number } | null {
  try {
    const raw = fs.readFileSync(diskCachePath(currency), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeDiskCache(currency: string, data: any, timestamp: number) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(diskCachePath(currency), JSON.stringify({ data, timestamp }), "utf-8");
  } catch (e) {
    console.warn("DISK_CACHE_WRITE_FAILED:", e);
  }
}

// ── In-memory cache (populated from disk on first hit) ────────────────────────
let memCache: Record<string, { data: any; timestamp: number }> = {};

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

  // ── Check memory cache first ──────────────────────────────────────────────
  if (!eventId && !force) {
    // 1. Memory
    if (memCache[currency] && Date.now() - memCache[currency].timestamp < CACHE_DURATION) {
      console.log(`MEM_CACHE_HIT: Serving ${currency} signals from memory.`);
      return Response.json(memCache[currency].data);
    }
    // 2. Disk — survives server restarts
    const disk = readDiskCache(currency);
    if (disk && Date.now() - disk.timestamp < CACHE_DURATION) {
      console.log(`DISK_CACHE_HIT: Serving ${currency} signals from disk (${Math.round((Date.now() - disk.timestamp) / 60000)}m old).`);
      memCache[currency] = disk; // promote to memory
      return Response.json(disk.data);
    }
  }

  try {
    let events: any[] = [];

    if (eventId) {
      console.log(
        `ANALYSIS_START: Fetching specific event ${eventId} from Bayse...`,
      );
      const data = await bayseRead(`/v1/pm/events/${eventId}`);
      // Handle both { event: {...} } and {...} formats
      const event = data.event || (data.id ? data : null);
      events = event ? [event] : [];
    } else {
      console.log(
        `ANALYSIS_START: Fetching live markets (${currency}) from Bayse...`,
      );
      const data = await bayseRead(
        `/v1/pm/events?status=open&limit=30&size=30&currency=${currency}`,
      );
      events = data.events ?? [];
    }

    if (events.length > 0) {
      console.log("[EVENT SAMPLE]", JSON.stringify(events[0], null, 2));
    }

    if (events.length === 0) {
      return Response.json({ error: "No open markets found" }, { status: 404 });
    }

    // Step 2: Flatten markets for individual analysis
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
      const liquidityMath = Math.min(
        1,
        (m.liquidity ?? 0) / LIQUIDITY_BENCHMARK,
      );
      const volumeMath = Math.min(1, (m.totalOrders ?? 0) / VOLUME_BENCHMARK);

      return {
        ...m,
        market_math: {
          liquidity_quality: parseFloat(liquidityMath.toFixed(2)),
          volume_quality: parseFloat(volumeMath.toFixed(2)),
          description: `Liquidity: $${(m.liquidity ?? 0).toLocaleString()}, Orders: ${m.totalOrders ?? 0}`,
        },
      };
    });

    // Step 4: Fetch Live News Context
    let recentNews: string[] = [];
    try {
      const { fetchMacroNews } = await import("@/lib/news-fetcher");
      recentNews = await fetchMacroNews(8);
    } catch (err) {
      console.warn("Could not fetch news, continuing without it.");
    }
    
    const newsContext = recentNews.length > 0 
      ? `\nLATEST MACRO NEWS HEADLINES (Use to adjust sentiment/conviction):\n${recentNews.map(n => `- ${n}`).join("\n")}\n` 
      : "";

    // Step 5: Construct the AI Prompt (The Alpha Filter)
    const prompt = `You are an elite macro analyst. Analyze these live prediction markets.
For each EVENT, you must identify and return ONLY the single most mispriced SELECTION (the "Alpha" trade).

STRICT RULES:
1. One Signal per Event: Even if an event has 10 markets, you only return ONE signal for that event—the one with the largest gap between your assessed probability and the market price.
2. Demo Mode (Provide 5 to 6 Signals): For the dashboard display, provide exactly 5 to 6 high-conviction trades. Do not filter too aggressively, but prioritize the best opportunities.
3. Unique Headline: The headline must be specific to the SELECTION you chose, not just the event title.
4. Reliability Fusion: Your "source_reliability" MUST be a fusion of your logical conviction AND the provided "market_math". If liquidity_quality is low (< 0.3), you MUST downgrade your reliability score regardless of how sure your logic is. Mention this in your logic.
5. News Context: Use the provided LATEST MACRO NEWS to inform your market sentiment and reasoning. If news directly relates to a market, reference it in your "logic".

LIVE MARKET DATA WITH MATH BENCHMARKS:
${JSON.stringify(marketsWithMath, null, 2)}
${newsContext}

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
      "liquidity": <copy the liquidity field exactly from the market data>,
    }
  ]
}

Find the alpha. Focus on Nigerian/African macro context.`;

    // Step 5: Invoke Vertex AI
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
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
        const delta = Math.abs(
          Number(s.probability) - Number(prev.probability),
        );
        if (delta < STABILITY_THRESHOLD) {
          // Latch to previous probability and logic to maintain consistency
          console.log(
            `LATCH_ACTIVE: Stabilizing ${s.marketId} (delta: ${(delta * 100).toFixed(1)}%)`,
          );
          return {
            ...s,
            probability: prev.probability,
            logic: prev.logic, // Keep reasoning consistent too
            market_question: s.marketTitle,
          };
        }
      }

      // Significant change or new signal — update history
      signalHistory[s.marketId] = s;
      return { ...s, market_question: s.marketTitle };
    });

    // Update both memory and disk cache
    const timestamp = Date.now();
    memCache[currency] = { data: signals, timestamp };
    writeDiskCache(currency, signals, timestamp);
    console.log(
      `GEMINI_SUCCESS: Generated ${signals.signals.length} unique alpha signals for ${currency}. Written to disk.`,
    );

    return Response.json(signals);
  } catch (err) {
    console.error("GEMINI_ACTUAL_ERROR:", err);
    // Fallback chain: memory → disk → error
    if (memCache[currency]) {
      console.warn(`GEMINI_FAILED: Serving stale ${currency} memory cache.`);
      return Response.json(memCache[currency].data);
    }
    const disk = readDiskCache(currency);
    if (disk) {
      console.warn(`GEMINI_FAILED: Serving stale ${currency} disk cache.`);
      return Response.json(disk.data);
    }
    console.error("ANALYZE_ERROR:", err);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
