import { bayseRead } from "@/lib/bayse-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword') ?? '';
  const status = searchParams.get('status') ?? 'open';
  const limit = searchParams.get('limit') ?? '10';

  const data = await bayseRead(
    `/v1/pm/events?keyword=${encodeURIComponent(keyword)}&status=${status}&limit=${limit}`
  );
  return Response.json(data);
}