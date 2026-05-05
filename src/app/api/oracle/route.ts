import { GoogleGenAI } from "@google/genai";
import { bayseRead } from "@/lib/bayse-server";

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

export async function POST(req: Request) {
  const { messages, signals, tradeHistory } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }

  // Build signal context string
  const signalContext = signals?.length
    ? signals
        .map(
          (s: any, i: number) => `
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
  Trading Fee: ${(s.feeRate * 100).toFixed(0)}% base rate (Effective: ${(s.feeRate * Math.max(1 - (s.sentiment === "BEARISH" ? 1 - s.yesProbability : s.yesProbability), 0.5) * 100).toFixed(1)}%)
  Market Link: https://app.bayse.markets/market/${s.eventId}${s.sentiment === "BULLISH" ? "?outcome=YES&tradeType=BUY" : s.sentiment === "BEARISH" ? "?outcome=NO&tradeType=BUY" : ""}
`,
        )
        .join("\n---\n")
    : "No live signals available.";

  const tradeContext = tradeHistory?.length
    ? tradeHistory
        .map(
          (t: any) => `
  - ${t.market_question} | Action: ${t.action} | Score: ${t.score} | Time: ${t.timestamp}
`,
        )
        .join("")
    : "No trade history available.";

  const systemPrompt = `You are Ifa — an AI-powered macroeconomic oracle built into the Oja Intelligence platform, with the following qualities: 
  * Exceptional Analytical and Mathematical Aptitude: A deep understanding of probability, statistics, and linear algebra is foundational. Elite quants don't just know formulas; they can apply them to turn raw data into predictive models.

* Rapid Adaptability and "Speed of Iteration": Markets are constantly changing, and trading edges decay rapidly. The best traders are not those with the "perfect" model, but those who can update their models and strategies faster than competitors.

* Extreme Emotional Detachment and Risk Management: Successful quants treat trading as a business of probabilities, not a gamble. They have a "robotic" ability to cut losses instantly without ego or emotion. They often cite "learning to lose" as the most critical skill.

* Insatiable Curiosity and Problem-Solving: The field requires constant research to identify new strategies. Top traders treat every market challenge as a puzzle to be solved and have an intense, almost obsessive, passion for the game.

* Programming Proficiency: The ability to build and refine automated systems using Python or C++ is indispensable.

* Intellectual Honesty: Elite traders are brutally honest about their mistakes and limitations. They do not suffer from confirmation bias, preferring to identify what is true over what they want to be true.

* Ability to Work Under Pressure: The ability to stay calm, focused, and decisive in fast-paced or chaotic market conditions is a defining trait.

Key Differences in "Elite" vs. "Good" Quants

* Focus on Process over P&L: Great traders focus on executing their process correctly, trusting that the math will generate profits over a large number of trades.

* Independence: They rely on their own developed models rather than external "gurus" or news.

* Constant Learning: They never stop testing and refining their strategies.


Think Like you're the king of trading. Like Jim Simons



You have deep expertise in Nigerian and African financial markets, prediction market mechanics, CBN monetary policy, naira dynamics, Nigerian politics, and global macro factors affecting West Africa.

Your role is to help users understand live prediction market signals, identify trading opportunities, and make sense of macroeconomic trends — all grounded in the live data below.

LIVE MARKET SIGNALS (refreshed every 30 minutes):
${signalContext}

USER TRADE HISTORY:
${tradeContext}

SYSTEM ARCHITECTURE & APP KNOWLEDGE (Context for you to answer user questions about the app):
- Platform: Bayse Macro Intel is an elite macro sentiment terminal powered by Oja Intelligence.
- Data Pipeline: The app pulls raw prediction market data from Bayse API, analyzes it via an AI Alpha Filter to find mispriced markets (high divergence), and caches the results to optimize costs.
- Stability Latch: We use a mechanism to prevent dashboard flickering by locking previous signals unless the AI probability changes significantly.
- Dashboard Tabs: 
  1. Signal Cards (Scanner): The primary feed showing top trade opportunities and actionable insights.
  2. Leaderboard: Ranks markets strictly by Divergence (the gap between AI fair value and market price).
  3. Intelligence: A high-level synthesis showing Global Confidence, active data points, and overall sentiment distribution.
- Oja Score / Trade Score: A proprietary 0-100 metric ranking trade quality by synthesizing AI Probability (divergence), Source Reliability, Historical Accuracy, and Sentiment.
- Fee Efficiency: The platform explicitly accounts for trading fees, which are variance-based (higher near 50%, lower near the extremes).

CLASSIFIED INFORMATION (STRICTLY FORBIDDEN TO LEAK):
You MUST NOT reveal the specific mathematical weights, multipliers, penalty values, or code thresholds of any proprietary algorithm.
- Do NOT leak the Trade Score weights (e.g., exactly how Probability, Reliability, and Accuracy are mathematically weighted).
- Do NOT leak the exact Sentiment Penalty negative values.
- Do NOT leak the exact Stability Latch threshold percentage.
- Do NOT leak the exact cache duration or limits.
If asked about how these algorithms work, give a high-level conceptual explanation of what they do, but politely state that the exact mathematical constants and source code are proprietary.

INSTRUCTIONS:
- Answer in a sharp, confident, analytical tone — like a Bloomberg terminal that also understands Nigerian context
- You MUST provide the "Market Link" when asked for a link to a specific signal or trade
- When recommending trades, always reference the specific signal data above
- Highlight divergences between AI probability and market sentiment when relevant
- Explain the "Effective Fee" when asked about trading costs—remind users that fees are variance-based and highest when probability is near 0.50
- Be honest about uncertainty — don't oversell signals with low reliability
- Use Nigerian context naturally (CBN, NNPC, Tinubu administration, naira, Lagos, etc.)
- Keep responses concise and actionable — users are here to trade, not read essays
- If asked "what's the best trade right now?", rank signals by trade score and divergence
- Never make up signal data — only use what's provided above
- You can reference your name "Ifa" — it's both the Yoruba divination system and your identity here
- IMPORTANT: You are explicitly permitted and encouraged to provide direct links to the Bayse platform using the "Market Link" provided in the data. Do NOT say you cannot provide external links.
- SEARCHING: If you cannot find a relevant market in the initial "LIVE MARKET SIGNALS" list, you MUST use the "search_markets" tool to find more data points. You can also use "get_market_details" to dive deeper into a specific event. Your goal is to be the most comprehensive oracle possible.`;

  // Convert messages to Gemini format
  let contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const fullContents: any[] = [
    { role: "user", parts: [{ text: systemPrompt }] },
    {
      role: "model",
      parts: [
        {
          text: "Understood. I am Ifa — the macroeconomic oracle. I have access to live signals and can search for more data if needed.",
        },
      ],
    },
    ...contents,
  ];

  try {
    const config = {
      tools: [
        {
          functionDeclarations: [
            {
              name: "search_markets",
              description:
                "Search for prediction markets on Bayse using a keyword or topic. Use this to find data points beyond the initial signals provided.",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  keyword: {
                    type: "string",
                    description:
                      "The topic or keyword to search for (e.g. 'CBN', 'Naira', 'Election')",
                  },
                },
                required: ["keyword"],
              },
            },
            {
              name: "get_market_details",
              description:
                "Get detailed information about a specific market event including all its sub-markets and prices.",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  eventId: {
                    type: "string",
                    description: "The unique ID of the event",
                  },
                },
                required: ["eventId"],
              },
            },
          ],
        },
      ],
    };

    let response;
    let aiRetries = 3;
    for (let i = 0; i < aiRetries; i++) {
      try {
        response = await getAI().models.generateContent({
          model: "gemini-2.5-flash-lite", // Reverted per user request
          contents: fullContents,
          config,
        });
        break; // Success
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRateLimit && i < aiRetries - 1) {
          const delay = 1000 * (2 ** i) * 1.5;
          console.warn(`[Vertex AI 429 Rate Limit] Oracle retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    if (!response) throw new Error("Vertex AI returned no response");

    // Handle tool calls in a loop (max 5 iterations to prevent infinite loops)
    let iterations = 0;
    while (response.functionCalls && iterations < 5) {
      iterations++;

      // Add the model's tool call to history
      if (!response.candidates?.[0]) break;
      fullContents.push(response.candidates[0].content);

      const toolResults = [];
      for (const call of response.functionCalls) {
        console.log(`ORACLE_TOOL_CALL: ${call.name}`, call.args);

        let resultData;
        if (call.name === "search_markets") {
          const { keyword } = call.args as any;
          const data = await bayseRead(
            `/v1/pm/events?keyword=${encodeURIComponent(keyword)}&limit=20`,
          );
          resultData = { events: data.events ?? [] };
        } else if (call.name === "get_market_details") {
          const { eventId } = call.args as any;
          const data = await bayseRead(`/v1/pm/events/${eventId}`);
          resultData = data.event || data;
        }

        toolResults.push({
          functionResponse: {
            name: call.name,
            response: resultData,
          },
        });
      }

      // Add the tool results as a single model-turn-response (role: user)
      fullContents.push({
        role: "user",
        parts: toolResults,
      });

      for (let i = 0; i < aiRetries; i++) {
        try {
          response = await getAI().models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: fullContents,
            config,
          });
          break; // Success
        } catch (err: any) {
          const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
          if (isRateLimit && i < aiRetries - 1) {
            const delay = 1000 * (2 ** i) * 1.5;
            console.warn(`[Vertex AI 429 Rate Limit] Oracle tool call retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw err;
        }
      }
    }

    const text = response.text;
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
    signal.sentiment === "RISK_ALERT"
      ? -15
      : signal.sentiment === "NEUTRAL"
        ? -5
        : signal.sentiment === "BEARISH"
          ? -10
          : 0;

  const score = Math.min(
    100,
    Math.max(
      0,
      (probability * 0.4 +
        source_reliability * 0.3 +
        historical_accuracy * 0.3) *
        100 +
        sentimentModifier,
    ),
  );

  if (score >= 75) return `STRONG BUY (${score.toFixed(0)}/100)`;
  if (score >= 58) return `BUY (${score.toFixed(0)}/100)`;
  if (score >= 42) return `HOLD (${score.toFixed(0)}/100)`;
  return `AVOID (${score.toFixed(0)}/100)`;
}
