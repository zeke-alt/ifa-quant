import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

export async function POST(req: Request) {
  try {
    const { prompt, mode, history } = await req.json();

    let systemInstruction = "";
    let userPrompt = "";

    if (mode === "optimize") {
      systemInstruction = `
        You are a Quant Strategy Optimizer. You will be given a recent price history of a prediction market.
        Your goal is to suggest the best entry/exit strategy to maximize returns based on the trend.

        RULES:
        1. Direction: 'BUY' (bet YES) or 'SELL' (bet NO).
        2. entryThreshold: probability to enter (0.01 - 0.99).
        3. exitThreshold: probability to exit for profit (0.01 - 0.99).
        4. holdDays: max hold time (integer).

        Return ONLY valid JSON in this exact shape:
        {
          "direction": "BUY" | "SELL",
          "entryThreshold": number,
          "exitThreshold": number,
          "holdDays": number,
          "reasoning": "A one-sentence explanation of why this strategy fits the current chart trend."
        }
      `;
      userPrompt = `Price History (last 20 points): ${JSON.stringify(history?.slice(-20))}`;
    } else {
      systemInstruction = `
        You are a Quant Trading Strategy Parser. Extract trading parameters from natural language.
        
        Return ONLY valid JSON in this exact shape:
        {
          "direction": "BUY" | "SELL",
          "entryThreshold": number,
          "exitThreshold": number,
          "holdDays": number,
          "reasoning": "A short summary of the user's intent."
        }
      `;
      userPrompt = prompt;
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nUser Input: "${userPrompt}"` }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.text;
    if (!responseText) throw new Error("Gemini returned empty response");

    const data = JSON.parse(responseText);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Parse Strategy Error]:", err);
    return NextResponse.json({ error: "Failed to process strategy" }, { status: 500 });
  }
}
