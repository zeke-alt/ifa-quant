/**
 * /api/bayse/events/[eventId]/markets/[marketId]/orders/route.ts
 *
 * Signs and proxies POST /v1/pm/events/:eventId/markets/:marketId/orders
 * to the Bayse Markets API.
 *
 * Drop this file at:
 *   src/app/api/bayse/events/[eventId]/markets/[marketId]/orders/route.ts
 */

import { NextResponse } from "next/server";
import { bayseWrite } from "@/lib/bayse-server";

export async function POST(
  req: Request,
  { params }: { params: { eventId: string; marketId: string } }
) {
  const { eventId, marketId } = params;

  let body: any;
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

  const requestBody: Record<string, any> = { side, outcome, amount };
  if (price !== undefined) requestBody.price = price;
  if (timeInForce !== undefined) requestBody.timeInForce = timeInForce;

  try {
    const data = await bayseWrite("POST", baysePath, requestBody);

    if (data?.message && !data?.id) {
      return NextResponse.json(
        { message: data.message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/orders] Upstream error:", err);
    return NextResponse.json({ message: "Failed to reach Bayse API" }, { status: 502 });
  }
}

