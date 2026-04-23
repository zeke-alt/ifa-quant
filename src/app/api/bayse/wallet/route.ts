import { bayseRead } from '@/lib/bayse-server';

export async function GET() {
  const data = await bayseRead('/v1/wallet/assets');
  return Response.json(data);
}
