/**
 * /api/bayse/events/[eventId]/markets/[marketId]/quote/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { bayseWrite } from "@/lib/bayse-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; marketId: string }> },
) {
  const { eventId, marketId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { side, outcome, amount, currency = "USD" } = body;

  if (!side || !outcome || !amount) {
    return NextResponse.json(
      { message: "Missing required fields: side, outcome, amount" },
      { status: 400 },
    );
  }

  const baysePath = `/v1/pm/events/${eventId}/markets/${marketId}/quote?currency=${currency}`;

  // outcome coming from the frontend is already the resolved UUID
  const requestBody: Record<string, any> = {
    side,
    outcomeId: outcome,
    amount,
  };

  if (body.price !== undefined) requestBody.price = body.price;

  try {
    const data = await bayseWrite("POST", baysePath, requestBody);
    console.log("[/api/bayse/quote] Response:", JSON.stringify(data));

    if (data?.statusCode && data.statusCode >= 400) {
      return NextResponse.json(
        { message: data.message ?? "Bayse error" },
        { status: data.statusCode },
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[/api/bayse/quote] Upstream error details:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    return NextResponse.json(
      { message: "Failed to reach Bayse API", error: err.message },
      { status: 502 },
    );
  }
}