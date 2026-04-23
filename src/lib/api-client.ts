/**
 * API Client Utilities
 * 
 * Provides functions for interacting with the local Next.js API routes,
 * which act as proxies to external services like Bayse and Vertex AI.
 */

const BASE = "/api/bayse";

/**
 * Bayse Proxy Wrapper
 * 
 * Interacts with Bayse Market endpoints through local proxy routes.
 * It remaps external V1 paths to internal Next.js route structures.
 * 
 * @param path The relative Bayse API path (e.g., /v1/pm/portfolio)
 * @param options Standard Fetch options
 */
export async function bayse(path: string, options?: RequestInit) {
  // Logic: Remap Bayse V1 standard paths to local Next.js proxy routes
  // This allows the frontend to call standard paths while the server handles
  // the actual routing and authentication.
  const mapped = path
    .replace("/v1/pm/portfolio", "/portfolio")
    .replace("/v1/pm/orders", "/orders")
    .replace("/v1/wallet/assets", "/wallet")
    .replace(/\/v1\/pm\/events(.*)/, "/events$1");

  const res = await fetch(`${BASE}${mapped}`, options);
  if (!res.ok) throw new Error(`Bayse API error: ${res.status}`);
  return res.json();
}

/**
 * AI Analysis Trigger
 * 
 * Calls the local /api/analyze route to generate fresh trading signals
 * using Vertex AI based on current market conditions.
 * 
 * @param force If true, bypasses server-side caching
 */
export async function analyzeMarkets(force = false) {
  const res = await fetch(`/api/analyze${force ? "?force=true" : ""}`);
  
  // Debug log to monitor raw response status in development
  console.log("Analysis fetch status:", res.status);
  
  if (!res.ok) throw new Error(`Analysis error: ${res.status}`);
  return res.json();
}
