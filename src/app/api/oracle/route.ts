// src/app/api/oracle/route.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

export async function POST(req: Request) {
  const { messages, signals, tradeHistory } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }

  // Build signal context string
  const signalContext = signals?.length
    ? signals.map((s: any, i: number) => `
SIGNAL ${i + 1}:
  Market: ${s.market_question}
  Headline: ${s.headline}
  Category: ${s.category ?? "N/A"}
  AI Probability: ${(s.probability * 100).toFixed(1)}%
  Sentiment: ${s.sentiment}
  Source Reliability: ${(s.source_reliability * 100).toFixed(0)}%
  Historical Accuracy: ${(s.historical_accuracy * 100).toFixed(0)}%
  Trade Score Action: ${computeAction(s)}
  AI Reasoning: ${s.logic}
`).join("\n---\n")
    : "No live signals available.";

  const tradeContext = tradeHistory?.length
    ? tradeHistory.map((t: any) => `
  - ${t.market_question} | Action: ${t.action} | Score: ${t.score} | Time: ${t.timestamp}
`).join("")
    : "No trade history available.";

  const systemPrompt = `You are Ifa — an AI-powered macroeconomic oracle built into the Oja Intelligence platform.

You have deep expertise in Nigerian and African financial markets, prediction market mechanics, CBN monetary policy, naira dynamics, Nigerian politics, and global macro factors affecting West Africa.

Your role is to help users understand live prediction market signals, identify trading opportunities, and make sense of macroeconomic trends — all grounded in the live data below.

LIVE MARKET SIGNALS (refreshed every 30 minutes):
${signalContext}

USER TRADE HISTORY:
${tradeContext}

INSTRUCTIONS:
- Answer in a sharp, confident, analytical tone — like a Bloomberg terminal that also understands Nigerian context
- When recommending trades, always reference the specific signal data above
- Highlight divergences between AI probability and market sentiment when relevant
- Be honest about uncertainty — don't oversell signals with low reliability
- Use Nigerian context naturally (CBN, NNPC, Tinubu administration, naira, Lagos, etc.)
- Keep responses concise and actionable — users are here to trade, not read essays
- If asked "what's the best trade right now?", rank signals by trade score and divergence
- Never make up signal data — only use what's provided above
- You can reference your name "Ifa" — it's both the Yoruba divination system and your identity here`;

  // Convert messages to Gemini format
  const contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am Ifa — ready to analyze your markets." }] },
        ...contents,
      ],
    });

    const text = result.text;
    return Response.json({ reply: text });
  } catch (err) {
    console.error("ORACLE_ERROR:", err);
    return Response.json({ error: "Oracle failed" }, { status: 500 });
  }
}

// Mirrors the computeTradeScore logic from MarketCard
function computeAction(signal: any): string {
  const probability = Number(signal.probability);
  const source_reliability = Number(signal.source_reliability);
  const historical_accuracy = Number(signal.historical_accuracy);

  const sentimentModifier =
    signal.sentiment === "RISK_ALERT" ? -15
      : signal.sentiment === "NEUTRAL" ? -5
        : signal.sentiment === "BEARISH" ? -10
          : 0;

  const score = Math.min(100, Math.max(0,
    (probability * 0.4 + source_reliability * 0.3 + historical_accuracy * 0.3) * 100
    + sentimentModifier
  ));

  if (score >= 75) return `STRONG BUY (${score.toFixed(0)}/100)`;
  if (score >= 58) return `BUY (${score.toFixed(0)}/100)`;
  if (score >= 42) return `HOLD (${score.toFixed(0)}/100)`;
  return `AVOID (${score.toFixed(0)}/100)`;
}
