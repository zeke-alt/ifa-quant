
import { bayseRead } from './lib/bayse-server.js';
import dotenv from 'dotenv';
dotenv.config();

async function dumpRaw() {
  try {
    const data = await bayseRead('/v1/pm/events?status=open&limit=1');
    console.log("RAW MARKET DATA:");
    const m = data.events[0].markets[0];
    console.log(JSON.stringify(m, null, 2));
  } catch (err) {
    console.error(err);
  }
}

dumpRaw();
