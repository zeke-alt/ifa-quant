
import { bayseRead } from './src/lib/bayse-server.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
  try {
    const data = await bayseRead('/v1/pm/events?status=open&limit=5');
    console.log("EVENTS COUNT:", data.events?.length);
    if (data.events?.length > 0) {
      const e = data.events[0];
      console.log("EVENT TITLE:", e.title);
      console.log("MARKETS COUNT:", e.markets?.length);
      if (e.markets?.length > 0) {
        const m = e.markets[0];
        console.log("MARKET TITLE:", m.title);
        console.log("OUTCOMES:", JSON.stringify(m.outcomes, null, 2));
        console.log("OUTCOME1:", JSON.stringify(m.outcome1, null, 2));
        console.log("OUTCOME2:", JSON.stringify(m.outcome2, null, 2));
      }
    }
  } catch (err) {
    console.error("ERROR:", err);
  }
}

checkData();
