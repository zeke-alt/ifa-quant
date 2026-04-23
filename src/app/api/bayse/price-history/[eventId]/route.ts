import { bayseRead } from "@/lib/bayse-server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { searchParams } = new URL(req.url);
  const timePeriod = searchParams.get("timePeriod") ?? "1W";
  const outcome = searchParams.get("outcome") ?? "YES";
  const { eventId } = await params; // 👈 await it

  try {
    const data = await bayseRead(
      `/v1/pm/events/${eventId}/price-history?interval=1h`,
    );
    return Response.json(data);
  } catch (err) {
    console.error("PRICE_HISTORY_ERROR:", err);
    return Response.json(
      { error: "Failed to fetch price history" },
      { status: 500 },
    );
  }
}
