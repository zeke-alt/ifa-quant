/**
 * Market Analysis API Route
 *
 * This route orchestrates the core "intelligence" of the application.
 * It fetches live market data from Bayse, processes it for reliability,
 * and passes it to Gemini to generate actionable trading signals.
 *
 * v2 Changes:
 * - USDNGN Sensitivity Filter: News headlines are scored and ranked by their
 *   historical relevance to USDNGN movement before being passed to the AI.
 * - Expanded Data Sources: Live FX rates, oil prices, CBN rates, and fear/greed
 *   index are fetched and injected into the prompt as structured macro context.
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

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) {
    _ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.GOOGLE_CLOUD_LOCATION!,
    });
  }
  return _ai;
}

const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
const CACHE_DIR = path.join(process.cwd(), ".cache");

function diskCachePath(currency: string) {
  return path.join(CACHE_DIR, `signals-${currency}-v2.json`);
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

const HISTORY_CACHE_PATH = path.join(CACHE_DIR, 'signal-history.json');

function loadSignalHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSignalHistory(history: any) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_CACHE_PATH, JSON.stringify(history), 'utf-8');
  } catch (e) {
    console.warn("HISTORY_CACHE_WRITE_FAILED:", e);
  }
}

let memCache: Record<string, { data: any; timestamp: number }> = {};

// Logic: The "Stability Latch"
// We store a global history of signals to prevent AI jitter.
// If a new prediction is within 4% of the old one, we stick with the old one.
const STABILITY_THRESHOLD = 0.04;
let signalHistory: Record<string, any> = loadSignalHistory();

// ─────────────────────────────────────────────
// USDNGN SENSITIVITY FILTER
// Headlines are scored by how likely they are to move the USDNGN pair.
// This prevents low-relevance news from polluting confidence scores.
// ─────────────────────────────────────────────
const USDNGN_SENSITIVITY_WEIGHTS: { keywords: string[]; weight: number }[] = [
  {
    keywords: ["cbn", "central bank of nigeria", "monetary policy committee", "fx intervention", "naira devaluation", "naira", "fx window", "official rate", "parallel market"],
    weight: 1.0,
  },
  {
    keywords: ["federal reserve", "fed rate", "fomc", "us interest rate", "powell", "rate hike", "rate cut", "us inflation"],
    weight: 0.95,
  },
  {
    keywords: ["oil price", "brent crude", "opec", "nnpc", "crude production", "petroleum", "oil output"],
    weight: 0.9,
  },
  {
    keywords: ["foreign reserve", "external reserve", "imf nigeria", "world bank nigeria", "nigeria debt", "eurobond", "nigeria loan"],
    weight: 0.85,
  },
  {
    keywords: ["nigeria inflation", "cpi nigeria", "nbs report", "nigeria gdp", "trade balance nigeria", "current account"],
    weight: 0.75,
  },
  {
    keywords: ["dollar index", "dxy", "em currencies", "emerging market", "global risk", "usd strength"],
    weight: 0.65,
  },
  {
    keywords: ["africa", "nigeria", "lagos", "abuja", "west africa", "ecowas", "subsaharan"],
    weight: 0.5,
  },
];

const DEFAULT_SENSITIVITY_WEIGHT = 0.3;

function getUSDNGNSensitivity(headline: string): number {
  const lower = headline.toLowerCase();
  for (const { keywords, weight } of USDNGN_SENSITIVITY_WEIGHTS) {
    if (keywords.some((k) => lower.includes(k))) return weight;
  }
  return DEFAULT_SENSITIVITY_WEIGHT;
}

// ─────────────────────────────────────────────
// EXPANDED DATA SOURCES
// These fetch live macro data points to give the AI more context
// beyond just prediction market prices and news headlines.
// ─────────────────────────────────────────────

interface MacroDataPoint {
  label: string;
  value: string | number;
  source: string;
  note?: string;
}

function getFetchOptions() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  return { signal: controller.signal, next: { revalidate: 1800 } };
}

/**
 * Fetches live FX rates relevant to Nigeria from exchangerate-api (free tier).
 * Targets: USDNGN, EURUSD, DXY proxy pairs.
 */
async function fetchFXRates(): Promise<MacroDataPoint[]> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", getFetchOptions());
    if (!res.ok) throw new Error(`FX API status: ${res.status}`);
    const data = await res.json();
    const rates = data.rates ?? {};

    const points: MacroDataPoint[] = [];

    if (rates.NGN) {
      points.push({
        label: "USDNGN (Official/Market Rate)",
        value: parseFloat(rates.NGN.toFixed(2)),
        source: "open.er-api.com",
        note: "Spot rate. Parallel market may differ by 5-15%.",
      });
    }
    if (rates.EUR) {
      points.push({
        label: "EURUSD",
        value: parseFloat((1 / rates.EUR).toFixed(4)),
        source: "open.er-api.com",
      });
    }
    if (rates.GBP) {
      points.push({
        label: "GBPUSD",
        value: parseFloat((1 / rates.GBP).toFixed(4)),
        source: "open.er-api.com",
      });
    }
    if (rates.ZAR) {
      points.push({
        label: "USDZAR (EM peer proxy)",
        value: parseFloat(rates.ZAR.toFixed(2)),
        source: "open.er-api.com",
        note: "ZAR often correlates with NGN under EM risk-off moves.",
      });
    }

    return points;
  } catch (err) {
    console.warn("FX_FETCH_FAILED:", err);
    return [];
  }
}

/**
 * Fetches Brent crude oil price from a public commodities API.
 * Oil is the single biggest driver of Nigeria's FX reserves.
 */
async function fetchOilPrice(): Promise<MacroDataPoint[]> {
  try {
    const res = await fetch(
      "https://api.allorigins.win/raw?url=" +
        encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?interval=1d&range=1d"),
      getFetchOptions()
    );
    if (!res.ok) throw new Error(`Oil API status: ${res.status}`);
    const data = await res.json();
    const price =
      data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!price) throw new Error("No oil price in response");

    return [
      {
        label: "Brent Crude (USD/barrel)",
        value: parseFloat(price.toFixed(2)),
        source: "Yahoo Finance / BZ=F",
        note: "Critical for NNPC revenue and CBN FX supply. Nigeria budget benchmark ~$65-75/bbl.",
      },
    ];
  } catch (err) {
    console.warn("OIL_FETCH_FAILED:", err);
    return [];
  }
}

/**
 * Fetches BTC/ETH prices as a crypto risk-sentiment proxy.
 * Relevant because crypto is a significant parallel FX channel in Nigeria.
 */
async function fetchCryptoPrices(): Promise<MacroDataPoint[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
      getFetchOptions()
    );
    if (!res.ok) throw new Error(`Crypto API status: ${res.status}`);
    const data = await res.json();

    const points: MacroDataPoint[] = [];

    if (data.bitcoin?.usd) {
      points.push({
        label: "Bitcoin (USD)",
        value: `$${data.bitcoin.usd.toLocaleString()} (24h: ${data.bitcoin.usd_24h_change?.toFixed(2)}%)`,
        source: "CoinGecko",
        note: "Nigeria is a top-5 global P2P crypto market. BTC sentiment affects NGN parallel demand.",
      });
    }
    if (data.ethereum?.usd) {
      points.push({
        label: "Ethereum (USD)",
        value: `$${data.ethereum.usd.toLocaleString()} (24h: ${data.ethereum.usd_24h_change?.toFixed(2)}%)`,
        source: "CoinGecko",
      });
    }

    return points;
  } catch (err) {
    console.warn("CRYPTO_FETCH_FAILED:", err);
    return [];
  }
}

/**
 * Fetches the Fear & Greed Index as a global risk sentiment proxy.
 * Risk-off environments typically pressure EM currencies including NGN.
 */
async function fetchFearGreedIndex(): Promise<MacroDataPoint[]> {
  try {
    const res = await fetch(
      "https://api.alternative.me/fng/?limit=1",
      getFetchOptions()
    );
    if (!res.ok) throw new Error(`F&G API status: ${res.status}`);
    const data = await res.json();
    const latest = data?.data?.[0];
    if (!latest) throw new Error("No F&G data");

    return [
      {
        label: "Crypto Fear & Greed Index",
        value: `${latest.value} / 100 — ${latest.value_classification}`,
        source: "alternative.me",
        note: "Global risk proxy. Extreme Fear = risk-off = EM currency pressure.",
      },
    ];
  } catch (err) {
    console.warn("FEAR_GREED_FETCH_FAILED:", err);
    return [];
  }
}

/**
 * Aggregates all macro data sources in parallel.
 * Failures are soft — missing data just reduces context, doesn't crash.
 */
async function fetchMacroDataPoints(): Promise<MacroDataPoint[]> {
  const [fx, oil, crypto, fearGreed] = await Promise.allSettled([
    fetchFXRates(),
    fetchOilPrice(),
    fetchCryptoPrices(),
    fetchFearGreedIndex(),
  ]);

  const all: MacroDataPoint[] = [];

  if (fx.status === "fulfilled") all.push(...fx.value);
  if (oil.status === "fulfilled") all.push(...oil.value);
  if (crypto.status === "fulfilled") all.push(...crypto.value);
  if (fearGreed.status === "fulfilled") all.push(...fearGreed.value);

  console.log(`MACRO_DATA: Fetched ${all.length} live data points.`);
  return all;
}

function formatMacroDataForPrompt(points: MacroDataPoint[]): string {
  if (points.length === 0) return "";

  return (
    `\nLIVE MACRO DATA POINTS (Use to ground your analysis in current market reality):\n` +
    points
      .map(
        (p) =>
          `• ${p.label}: ${p.value}${p.note ? ` | NOTE: ${p.note}` : ""} [src: ${p.source}]`
      )
      .join("\n") +
    "\n"
  );
}

// ─────────────────────────────────────────────
// MAIN ROUTE HANDLER
// ─────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";
  const eventId = searchParams.get("eventId");
  const currency = searchParams.get("currency") || "USD";
  const query = searchParams.get("query");
  const isVault = searchParams.get("vault") === "true";
  if (isVault) {
    return Response.json({ signals: Object.values(signalHistory) });
  }

  const cacheKey = !eventId && !query ? "GLOBAL" : (eventId ? `EVENT_${eventId}` : `QUERY_${query}_${currency}`);

  if (!force) {
    // 1. Memory
    if (memCache[cacheKey] && Date.now() - memCache[cacheKey].timestamp < CACHE_DURATION) {
      console.log(`MEM_CACHE_HIT: Serving ${cacheKey} signals from memory.`);
      return Response.json(memCache[cacheKey].data);
    }
    // 2. Disk — survives server restarts
    const disk = readDiskCache(cacheKey);
    if (disk && Date.now() - disk.timestamp < CACHE_DURATION) {
      console.log(
        `DISK_CACHE_HIT: Serving ${cacheKey} signals from disk (${Math.round((Date.now() - disk.timestamp) / 60000)}m old).`
      );
      memCache[cacheKey] = disk;
      return Response.json(disk.data);
    }
  }

  try {
    let events: any[] = [];

    if (eventId) {
      console.log(`ANALYSIS_START: Fetching specific event ${eventId} (${currency}) from Bayse...`);
      const data = await bayseRead(`/v1/pm/events/${eventId}?currency=${currency}`);
      const event = data.event || (data.id ? data : null);
      events = event ? [event] : [];
    } else if (query) {
      console.log(`ANALYSIS_START: Searching for "${query}" markets (${currency}) from Bayse...`);
      const data = await bayseRead(
        `/v1/pm/events?status=open&limit=40&size=40&currency=${currency}&search=${encodeURIComponent(query)}`
      );
      events = data.events ?? [];
    } else {
      console.log(`ANALYSIS_START: Fetching global macro markets for stable synthesis...`);
      const data = await bayseRead(`/v1/pm/events?status=open&limit=40&size=40`);
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
        yesOutcomeId: m.outcomes?.find((o: any) => o.title.toLowerCase().includes('yes'))?.id || m.outcome1?.id || m.outcomes?.[0]?.id,
        noOutcomeId: m.outcomes?.find((o: any) => o.title.toLowerCase().includes('no'))?.id || m.outcome2?.id || m.outcomes?.[1]?.id,
        yesProbability: m.outcome1Price,
        totalOrders: m.totalOrders,
        liquidity: e.liquidity,
        category: e.category,
        feeRate: m.feeRate ?? e.feeRate ?? 0.1,
        closingDate: e.closingDate || null,
        resolutionDate: e.resolutionDate || null,
        endDate: e.closingDate || e.resolutionDate || null,
      }))
    );

    // Step 3: Compute Absolute Market Math Benchmarks
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
          description: `Liquidity: $${(m.liquidity ?? 0).toLocaleString()}, Orders: ${m.totalOrders ?? 0}`,
        },
      };
    });

    // Step 3.1: Create a verified ID map to enforce Source of Truth (Don't trust AI with UUIDs)
    const verifiedIdMap = new Map<string, { yes?: string, no?: string }>();
    marketsWithMath.forEach((m: any) => {
      // Ensure we don't accidentally use the market ID as an outcome ID
      const y = m.yesOutcomeId !== m.marketId ? m.yesOutcomeId : undefined;
      const n = m.noOutcomeId !== m.marketId ? m.noOutcomeId : undefined;
      
      if (y || n) {
        verifiedIdMap.set(m.marketId, { yes: y, no: n });
      }
    });

    // Step 4a: Fetch Live News Context
    let recentNews: string[] = [];
    try {
      const { fetchMacroNews } = await import("@/lib/news-fetcher");
      recentNews = await fetchMacroNews(8);
    } catch (err) {
      console.warn("Could not fetch news, continuing without it.");
    }

    // Step 4b: Score news by USDNGN sensitivity and rank
    const scoredNews = recentNews.map((n) => ({
      headline: n,
      sensitivity: getUSDNGNSensitivity(n),
    }));

    const rankedNews = scoredNews.sort((a, b) => b.sensitivity - a.sensitivity).slice(0, 8);

    const newsContext =
      rankedNews.length > 0
        ? `\nLATEST MACRO NEWS (ranked by USDNGN relevance, sensitivity 0-1):\n` +
          rankedNews.map((n) => `- [sensitivity:${n.sensitivity}] ${n.headline}`).join("\n") +
          "\n"
        : "";

    // Step 4c: Fetch expanded live macro data points
    const macroDataPoints = await fetchMacroDataPoints();
    const macroDataContext = formatMacroDataForPrompt(macroDataPoints);

    // Step 5: Construct the AI Prompt (The Alpha Filter)
    const prompt = `You are an elite macro analyst with deep expertise in Nigerian and African markets. Analyze these live prediction markets${query ? ` specifically looking for signals related to "${query}"` : ""}.
For each EVENT, you must identify and return ONLY the single most mispriced SELECTION (the "Alpha" trade).

STRICT RULES:
1. One Signal per Event: Even if an event has 10 markets, you only return ONE signal for that event—the one with the largest gap between your assessed probability and the market price.
2. ${
      query
        ? `Search Mode: Return ALL interesting signals related to "${query}" from the provided data.`
        : `Demo Mode (Provide 10 to 12 Signals): For the dashboard display, provide exactly 10 to 12 high-conviction trades. Do not filter too aggressively, but prioritize the best opportunities.`
    }
3. Unique Headline: The headline must be specific to the SELECTION you chose, not just the event title.
4. Reliability Fusion: Your "source_reliability" MUST be a fusion of your logical conviction AND the provided "market_math". If liquidity_quality is low (< 0.3), you MUST downgrade your reliability score regardless of how sure your logic is. Mention this in your logic.
5. News Sensitivity: Each news headline has a [sensitivity] score (0-1) indicating how historically relevant it is to USDNGN movement. Weight your reasoning accordingly — a sensitivity:1.0 CBN headline should significantly shift your conviction; a sensitivity:0.3 headline is background noise. Reference sensitivity scores in your logic when relevant.
6. Live Macro Data: You have been given live FX rates, oil prices, crypto prices, and risk sentiment data. These are ground truth — use them to validate or challenge market prices. If the live USDNGN rate contradicts a market's implied probability, flag it. Reference specific data points (e.g. "Brent at $X suggests...") in your reasoning.
7. Nigerian Context: Always filter your analysis through Nigerian macro reality — parallel FX market, CBN intervention patterns, oil dependency, crypto as a dollar-access channel. A signal that looks neutral in a US context may be high-conviction in a Nigerian context.

LIVE MARKET DATA WITH MATH BENCHMARKS:
${JSON.stringify(marketsWithMath, null, 2)}
${macroDataContext}${newsContext}

Return a JSON object:
{
  "global_confidence": <0-1>,
  "active_signals": <count>,
  "data_points": <total orders>,
  "macro_snapshot": {
    "usdngn": <live rate if available, else null>,
    "brent_crude": <live price if available, else null>,
    "risk_sentiment": <"RISK_ON" | "RISK_OFF" | "NEUTRAL">,
    "summary": <1 sentence macro environment summary>
  },
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
      "recommendation": <A short, 1-sentence actionable summary>,
      "logic": <2-3 sentences of concise reasoning, referencing live data points and news sensitivity scores where relevant>,
      "source_reliability": <your 0-1 FUSED confidence score (Logic + Market Math + Data Coverage)>,
      "usdngn_sensitivity": <0-1 score for how directly this signal is tied to USDNGN movement>,
      "historical_accuracy": <0-1>,
      "category": <copy exact>,
      "feeRate": <copy exact>,
      "yesProbability": <copy exact price>,
      "yesOutcomeId": <copy exact>,
      "noOutcomeId": <copy exact>,
      "liquidity": <copy the liquidity field exactly from the market data>,
      "endDate": <copy exact closingDate if present, else resolutionDate, else null>,
      "closingDate": <copy exact closingDate if present, else null>,
      "resolutionDate": <copy exact resolutionDate if present, else null>
    }
  ]
}

Find the alpha. Focus on Nigerian/African macro context. Let the live data speak.`;

    // Step 6: Invoke Vertex AI
    let result;
    let aiRetries = 3;
    for (let i = 0; i < aiRetries; i++) {
      try {
        result = await getAI().models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        });
        break; // Success, exit retry loop
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRateLimit && i < aiRetries - 1) {
          const delay = 1000 * (2 ** i) * 1.5; // 1.5s, 3s
          console.warn(`[Vertex AI 429 Rate Limit] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    let responseText = result?.text;
    if (!responseText) throw new Error("Vertex AI returned no text");

    // Clean response text
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    let signals: any;
    try {
      signals = JSON.parse(responseText);
    } catch (parseErr) {
      console.warn("JSON_PARSE_FAILED, attempting repair...", parseErr);
      try {
        let repaired = responseText;
        const lastBoundary = repaired.lastIndexOf("},{");
        if (lastBoundary !== -1) {
          repaired = repaired.substring(0, lastBoundary + 1) + "]}";
          signals = JSON.parse(repaired);
          console.log("JSON_REPAIR_SUCCESS: Recovered partial signals.");
        } else {
          throw new Error("No safe recovery point found.");
        }
      } catch (retryErr) {
        console.error("REPAIR_FAILED:", retryErr);
        throw parseErr;
      }
    }

    // Step 7: Post-Processing Deduplication & Stability Latching
    const seenEvents = new Set();
    signals.signals = signals.signals.filter((s: any) => {
      if (seenEvents.has(s.eventId)) return false;
      seenEvents.add(s.eventId);
      return true;
    });

    // Apply Stability Latch & Strict ID Enforcement
    signals.signals = signals.signals.map((s: any) => {
      // 1. FORCED ENFORCEMENT: Always get the verified IDs from the current live data
      const verified = verifiedIdMap.get(s.marketId);

      const prev = signalHistory[s.marketId];
      if (prev && prev.yesOutcomeId && prev.noOutcomeId) {
        const delta = Math.abs(Number(s.probability) - Number(prev.probability));
        if (delta < STABILITY_THRESHOLD) {
          console.log(`LATCH_ACTIVE: Stabilizing ${s.marketId} (delta: ${(delta * 100).toFixed(1)}%)`);
          
          // Re-inject verified IDs even into the stabilized signal
          const stabilizedSignal = {
            ...s,
            probability: prev.probability,
            logic: prev.logic,
            recommendation: prev.recommendation,
            yesOutcomeId: verified?.yes || prev.yesOutcomeId,
            noOutcomeId: verified?.no || prev.noOutcomeId,
            endDate: prev.endDate,
            market_question: s.marketTitle,
            hasChanged: false,
          };

          return stabilizedSignal;
        }
        // Significant change detected
        console.log(`LATCH_BROKEN: Significant shift in ${s.marketId} (delta: ${(delta * 100).toFixed(1)}%)`);
        s.hasChanged = true;
      }

      // If not latched, ensure we still use verified IDs if available
      if (verified) {
        if (verified.yes) s.yesOutcomeId = verified.yes;
        if (verified.no) s.noOutcomeId = verified.no;
      }

      signalHistory[s.marketId] = s;
      return { ...s, market_question: s.marketTitle };
    });

    saveSignalHistory(signalHistory);

    // Update both memory and disk cache
    const timestamp = Date.now();
    memCache[cacheKey] = { data: signals, timestamp };
    writeDiskCache(cacheKey, signals, timestamp);
    console.log(
      `GEMINI_SUCCESS: Generated ${signals.signals.length} unique alpha signals for ${cacheKey}. Written to disk.`
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