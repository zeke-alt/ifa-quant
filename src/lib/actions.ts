import { bayse } from './api-client';

export async function executeTrade(params: {
  eventId?: string;
  marketId: string;
  amount: number;
  outcome: 'yes' | 'no';
}) {
  try {
    // If eventId is missing, we might have a problem with the URL structure
    // in the new orders route. For now, we provide the bridge.
    const response = await bayse('/v1/pm/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    return { success: true, data: response };
  } catch (error) {
    console.error("TRADE_EXECUTION_ERROR:", error);
    return { success: false };
  }
}
