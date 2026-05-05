
import fs from 'fs';
import path from 'path';

async function checkCache() {
  const cachePath = path.join(process.cwd(), '.cache', 'signals-GLOBAL-v2.json');
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(raw);
    console.log("CACHE LOADED");
    const signals = cache.data.signals;
    const sample = signals.find(s => s.marketId === '8a1d5f4f-cbc9-47dc-abbc-e8480939f2ea');
    console.log("SAMPLE SIGNAL:", JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  }
}

checkCache();
