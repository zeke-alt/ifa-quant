import { bayseRead, bayseWrite } from '@/lib/bayse-server';

export async function GET() {
  const data = await bayseRead('/v1/pm/orders');
  return Response.json(data);
}

export async function POST(req: Request) {
  const { eventId, marketId, ...order } = await req.json();
  const data = await bayseWrite(
    'POST',
    `/v1/pm/events/${eventId}/markets/${marketId}/orders`,
    order
  );
  return Response.json(data);
}
