/**
 * /api/bayse/events/[eventId]/markets/[marketId]/quote/route.ts
 *
 * Signs and proxies POST /v1/pm/events/:eventId/markets/:marketId/quote
 * to the Bayse Markets API using HMAC-SHA256 request signing.
 *
 * Drop this file at:
 *   src/app/api/bayse/events/[eventId]/markets/[marketId]/quote/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ─── Env vars (set in .env.local) ────────────────────────────────────────────
const BAYSE_API_KEY = process.env.BAYSE_API_KEY!;
const BAYSE_API_SECRET = process.env.BAYSE_API_SECRET!;
const BAYSE_BASE_URL = process.env.BAYSE_BASE_URL ?? "https://api.bayse.markets";

// ─── HMAC-SHA256 signer (same as your existing BayseClient) ──────────────────

function signRequest(
  method: string,
  path: string,
  body: string,
  timestamp: string
): string {
  // Signing string format used by Bayse:
  // "{TIMESTAMP}\n{METHOD}\n{PATH}\n{BODY_SHA256}"
  const bodyHash = crypto
    .createHash("sha256")
    .update(body)
    .digest("hex");

  const signingString = `${timestamp}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;

  return crypto
    .createHmac("sha256", BAYSE_API_SECRET)
    .update(signingString)
    .digest("hex");
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string; marketId: string } }
) {
  const { eventId, marketId } = params;

  // Parse the body from the client (QuoteDrawer)
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  const { side, outcome, amount, currency = "USD" } = body;
  if (!side || !outcome || !amount) {
    return NextResponse.json(
      { message: "Missing required fields: side, outcome, amount" },
      { status: 400 }
    );
  }

  // Build the Bayse API path
  const baysePathBase = `/v1/pm/events/${eventId}/markets/${marketId}/quote`;

  // Append currency as query param (Bayse reads it from query, not body)
  const baysePath = `${baysePathBase}?currency=${currency}`;

  // Serialize body (only send fields Bayse expects)
  const requestBody: Record<string, unknown> = { side, outcome, amount };
  if (body.price !== undefined) requestBody.price = body.price; // CLOB limit price

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
      // Bubble up Bayse error messages
      return NextResponse.json(
        { message: data?.message ?? "Bayse API error" },
        { status: response.status }
      );
    }

    // Return the quote response directly to QuoteDrawer
    // Shape: { price, currentMarketPrice, quantity, costOfShares, fee, amount, completeFill }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/quote] Upstream error:", err);
    return NextResponse.json(
      { message: "Failed to reach Bayse API" },
      { status: 502 }
    );
  }
}

// ─── GET: forward orders route (same file handles both via route segments) ────
// Orders live at /api/bayse/events/[eventId]/markets/[marketId]/orders
// — that's a sibling route file, not this one.
