
import { bayseRead } from './lib/bayse-server.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSpecificMarket() {
  const eventId = '9ea9a8ab-5797-49b4-9e5f-d8e6206f9595';
  try {
    const data = await bayseRead(`/v1/pm/events/${eventId}`);
    const event = data.event || data;
    console.log("EVENT:", event.title);
    const market = event.markets?.find(m => m.id === '8a1d5f4f-cbc9-47dc-abbc-e8480939f2ea');
    if (market) {
      console.log("MARKET:", market.title);
      console.log("OUTCOMES:", JSON.stringify(market.outcomes, null, 2));
      console.log("OUTCOME1:", JSON.stringify(market.outcome1, null, 2));
      console.log("OUTCOME2:", JSON.stringify(market.outcome2, null, 2));
    } else {
      console.log("MARKET NOT FOUND IN EVENT");
    }
  } catch (err) {
    console.error("ERROR:", err);
  }
}

checkSpecificMarket();
