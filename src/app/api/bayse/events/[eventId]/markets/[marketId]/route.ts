
import { NextResponse } from "next/server";
import { bayseRead } from "@/lib/bayse-server";

// @ts-ignore
export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string; marketId: string }> }
) {
  const { eventId, marketId } = await params;

  // Try these one at a time until one returns data
  const data = await bayseRead(`/v1/pm/events/${eventId}/markets/${marketId}`);
  console.log('[BAYSE EVENT]', JSON.stringify(data, null, 2));

  return NextResponse.json(data);
}