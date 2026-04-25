import { NextResponse } from "next/server";
import { bayseRead } from "@/lib/bayse-server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string; marketId: string }> }
) {
  const { eventId, marketId } = await params;

  try {
    const data = await bayseRead(`/v1/pm/events/${eventId}/markets/${marketId}`);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bayse/markets GET]", err);
    return NextResponse.json({ message: "Failed to reach Bayse API" }, { status: 502 });
  }
}