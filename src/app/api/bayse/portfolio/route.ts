import { bayseRead } from '@/lib/bayse-server';

export async function GET() {
  const data = await bayseRead('/v1/pm/portfolio');
  return Response.json(data);
}
