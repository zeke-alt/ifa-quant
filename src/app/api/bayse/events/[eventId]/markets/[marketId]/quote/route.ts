/**
 * /api/bayse/events/[eventId]/markets/[marketId]/quote/route.ts
 *
 * Signs and proxies POST /v1/pm/events/:eventId/markets/:marketId/quote
 * to the Bayse Markets API using HMAC-SHA256 request signing.
 *
 * Drop this file at:
 *   src/app/api/bayse/events/[eventId]/markets/[marketId]/quote/route.ts
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bayseWrite } from "@/lib/bayse-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; marketId: string }> },
) {
  const { eventId, marketId } = await params;

  // Parse the body from the client (QuoteDrawer)
  let body: any;
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
      { status: 400 },
    );
  }

  // Build the Bayse API path (Bayse reads currency from query param)
  const baysePath = `/v1/pm/events/${eventId}/markets/${marketId}/quote?currency=${currency}`;

  // Serialize body (only send fields Bayse expects)
  const requestBody: Record<string, any> = {
    side,
    outcomeId: outcome, // was: outcome
    amount,
  };
  if (body.price !== undefined) requestBody.price = body.price;

  try {
    const data = await bayseWrite("POST", baysePath, requestBody);
    console.error("[/api/bayse/quote] Response:", JSON.stringify(data));
    console.error("[BAYSE QUOTE RAW]", JSON.stringify(data, null, 2));

    // If Bayse returns an error in the JSON (e.g., message field)
    if (data?.message && !data?.price) {
      return NextResponse.json({ message: data.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/quote] Upstream error:", err);
    return NextResponse.json(
      { message: "Failed to reach Bayse API" },
      { status: 502 },
    );
  }
}


// Orders live at /api/bayse/events/[eventId]/markets/[marketId]/orders
// — that's a sibling route file, not this one.
