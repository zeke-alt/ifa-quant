/**
 * GET /api/markets
 *
 * Returns a normalized list of open Bayse events for the Quant Lab
 * market selector dropdown.
 */

import { NextResponse } from "next/server";
import { bayseRead } from "@/lib/bayse-server";

export async function GET() {
  try {
    // Fetch open events
    const data = await bayseRead("/v1/pm/events?status=open&size=50&page=1");
    const events: any[] = data.events ?? [];

    // Normalize to the shape the Quant Lab page expects
    const markets = events.map((event: any) => ({
      id: event.id,
      question: event.title,
      probability: event.markets?.[0]?.outcome1Price ?? 0.5,
    }));

    return NextResponse.json({ markets });
  } catch (err) {
    console.error("[/api/markets GET] CRITICAL_FAILURE:", err);
    return NextResponse.json(
      { error: "Failed to fetch markets" },
      { status: 502 }
    );
  }
}
