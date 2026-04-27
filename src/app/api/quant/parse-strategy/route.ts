import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const systemInstruction = `
      You are a Quant Trading Strategy Parser for prediction markets.
      Extract trading parameters from the user's natural language.
      
      RULES:
      1. Direction: 'BUY' means the user wants the event to happen (YES), 'SELL' means they want to bet against it (NO).
      2. Thresholds: Must be between 0.01 and 0.99. 
         - entryThreshold: the probability at which they want to enter.
         - exitThreshold: the probability at which they want to exit for profit.
      3. holdDays: Number of days to hold the position before forced exit. Default is 14 if not mentioned.

      Return ONLY valid JSON in this exact shape:
      {
        "direction": "BUY" | "SELL",
        "entryThreshold": number,
        "exitThreshold": number,
        "holdDays": number
      }
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nUser Prompt: "${prompt}"` }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.text;
    if (!responseText) throw new Error("Gemini returned empty response");

    const strategy = JSON.parse(responseText);
    return NextResponse.json(strategy);
  } catch (err) {
    console.error("[Parse Strategy Error]:", err);
    return NextResponse.json({ error: "Failed to parse strategy" }, { status: 500 });
  }
}
