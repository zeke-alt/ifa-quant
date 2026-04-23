/**
 * Bayse Server-Side Utility
 * 
 * Handles authenticated communication with the Bayse Relay API.
 * This file contains logic for request signing and secure API calls.
 */

import crypto from 'crypto';

// Environment configuration for Bayse API access
const BASE_URL = 'https://relay.bayse.markets';
const PUBLIC_KEY = process.env.BAYSE_PUBLIC_KEY!;
const SECRET_KEY = process.env.BAYSE_SECRET_KEY!;

/**
 * HMCA Signature Generator
 * 
 * Creates a secure signature for write operations using the Bayse protocol.
 * Logic: Combines timestamp, method, path, and body hash into a payload,
 * then signs it using the Secret Key with HMAC-SHA256.
 */
function createSignature(timestamp: number, method: string, path: string, body?: string) {
  // Step 1: Create a hash of the body if it exists
  const bodyHash = body
    ? crypto.createHash('sha256').update(body).digest('hex')
    : '';
  
  // Step 2: Construct the canonical payload string
  const payload = `${timestamp}.${method}.${path}.${bodyHash}`;
  
  // Step 3: Sign the payload using the Secret Key and return as Base64
  return crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64');
}

/**
 * Authenticated Read Operation
 * 
 * Performs a GET request to Bayse using only the Public Key.
 * @param path The endpoint path starting with /v1
 */
export async function bayseRead(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Public-Key': PUBLIC_KEY },
  });
  
  // Log the response status for server-side debugging
  console.log('Bayse Read Status:', res.status);
  
  return res.json();
}

/**
 * Signed Write Operation
 * 
 * Performs POST/PUT/DELETE requests that require a cryptographic signature.
 * 
 * @param method HTTP verb (POST, PUT, DELETE)
 * @param path The endpoint path
 * @param body The JSON object payload
 */
export async function bayseWrite(method: string, path: string, body: object) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyStr = JSON.stringify(body);
  
  // Generate the cryptographic signature required for write access
  const signature = createSignature(timestamp, method, path, bodyStr);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-Public-Key': PUBLIC_KEY,
      'X-Timestamp': String(timestamp),
      'X-Signature': signature,
      'Content-Type': 'application/json',
    },
    body: bodyStr,
  });
  
  return res.json();
}