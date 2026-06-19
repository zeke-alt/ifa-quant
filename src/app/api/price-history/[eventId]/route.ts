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

  // The Bayse Relay returns: { history: [ { marketId: string, history: [ { e: number, p: number } ] } ] }
const marketHistories = data.markets;
if (!Array.isArray(marketHistories)) {
  console.warn("Bayse API history is not an array:", data);
  return [];
}

for (const mHistory of marketHistories) {
  const points = mHistory.priceHistory;
  if (!Array.isArray(points)) continue;
  console.log("Sample point:", points[0])

    for (const point of points) {
      if (typeof point.p === "number" && point.p >= 0 && point.p <= 1) {
        allPoints.push({ 
          t: new Date(point.e).toISOString(), 
          p: point.p 
        });
      }
    }
  }

  if (allPoints.length === 0) return [];

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
