import { bayseRead } from "@/lib/bayse-server";

const TIME_PERIODS = ["1M", "3M", "6M", "1Y"];

async function fetchHistory(eventId: string, timePeriod: string, outcome: string) {
  const data = await bayseRead(
    `/v1/pm/events/${eventId}/price-history?timePeriod=${timePeriod}&outcome=${outcome}`
  );

  const allPoints: { t: string; p: number }[] = [];

  if (!data || typeof data !== "object" || data.error) {
    console.warn("Bayse API returned error or invalid data:", data);
    return [];
  }

  for (const marketId of Object.keys(data)) {
    const entries = data[marketId];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (typeof entry.price === "number" && entry.price >= 0 && entry.price <= 1) {
        allPoints.push({ t: entry.timestamp, p: entry.price });
      }
    }
  }

  allPoints.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

  // Deduplicate timestamps — average prices if multiple markets share one
  const deduped = new Map<string, number[]>();
  for (const { t, p } of allPoints) {
    if (!deduped.has(t)) deduped.set(t, []);
    deduped.get(t)!.push(p);
  }

  return Array.from(deduped.entries()).map(([t, prices]) => ({
    t,
    p: parseFloat((prices.reduce((sum, v) => sum + v, 0) / prices.length).toFixed(4)),
  }));
}

// @ts-ignore
export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { searchParams } = new URL(req.url);
  const requestedPeriod = searchParams.get("timePeriod") ?? "1M";
  const outcome = searchParams.get("outcome") ?? "YES";
  const { eventId } = await params;

  // Build the cascade: start from requested period and go longer if needed
  const startIdx = TIME_PERIODS.indexOf(requestedPeriod);
  const periodsToTry = TIME_PERIODS.slice(startIdx === -1 ? 0 : startIdx);

  try {
    let history: { t: string; p: number }[] = [];
    let usedPeriod = requestedPeriod;

    for (const period of periodsToTry) {
      history = await fetchHistory(eventId, period, outcome);
      usedPeriod = period;
      console.log(`PRICE_HISTORY [${period}]: ${history.length} points for event ${eventId}`);
      if (history.length >= 2) break; // enough to do something meaningful
    }

    return Response.json({ history, count: history.length, timePeriod: usedPeriod });
  } catch (err) {
    console.error("PRICE_HISTORY_ERROR:", err);
    return Response.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
