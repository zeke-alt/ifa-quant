/**
 * /api/bayse/events/[eventId]/markets/[marketId]/orders/route.ts
 *
 * Signs and proxies POST /v1/pm/events/:eventId/markets/:marketId/orders
 * to the Bayse Markets API.
 *
 * Drop this file at:
 *   src/app/api/bayse/events/[eventId]/markets/[marketId]/orders/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BAYSE_API_KEY = process.env.BAYSE_API_KEY!;
const BAYSE_API_SECRET = process.env.BAYSE_API_SECRET!;
const BAYSE_BASE_URL = process.env.BAYSE_BASE_URL ?? "https://api.bayse.markets";

function signRequest(
  method: string,
  path: string,
  body: string,
  timestamp: string
): string {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const signingString = `${timestamp}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
  return crypto.createHmac("sha256", BAYSE_API_SECRET).update(signingString).digest("hex");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string; marketId: string } }
) {
  const { eventId, marketId } = params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { side, outcome, amount, currency = "USD", price, timeInForce } = body;

  if (!side || !outcome || !amount) {
    return NextResponse.json(
      { message: "Missing required fields: side, outcome, amount" },
      { status: 400 }
    );
  }

  const baysePath = `/v1/pm/events/${eventId}/markets/${marketId}/orders?currency=${currency}`;

  const requestBody: Record<string, unknown> = { side, outcome, amount };
  // CLOB-only fields — omit for AMM orders
  if (price !== undefined) requestBody.price = price;
  if (timeInForce !== undefined) requestBody.timeInForce = timeInForce;

  const bodyString = JSON.stringify(requestBody);
  const timestamp = Date.now().toString();
  const signature = signRequest("POST", baysePath, bodyString, timestamp);

  try {
    const response = await fetch(`${BAYSE_BASE_URL}${baysePath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": BAYSE_API_KEY,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body: bodyString,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Bayse API error" },
        { status: response.status }
      );
    }

    // Returns: { id, status, side, outcome, amount, price?, timeInForce?, ... }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/orders] Upstream error:", err);
    return NextResponse.json({ message: "Failed to reach Bayse API" }, { status: 502 });
  }
}
