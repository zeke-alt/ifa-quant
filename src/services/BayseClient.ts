/**
 * Bayse Client Service
 * 
 * A client-side or server-side utility class for interacting with the 
 * Bayse Relay API. Encapsulates base URL, authentication headers,
 * and common request logic.
 */
import { BayseEvent } from '../types/bayse';

export class BayseClient {
  // Base endpoint for the Bayse Market Relay
  private readonly baseUrl = 'https://relay.bayse.markets/v1';
  
  /**
   * @param publicKey Your unique Bayse application identifier
   */
  constructor(private publicKey: string) {}

  /**
   * Internal Request Handler
   * 
   * Orchestrates the fetch call, applies security headers, and handles
   * common error responses from the relay.
   * 
   * @param endpoint The API path to append to the base URL
   * @param options Fetch overrides (headers, body, etc.)
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-Public-Key': this.publicKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Logic: If the API returns a non-OK status, attempt to parse the 
    // error message from the JSON body for better debugging.
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Bayse API Error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Fetch Active Events
   * 
   * Retrieves a list of open prediction markets from the relay.
   * 
   * @param limit Number of events to return (default 50)
   */
  async getEvents(limit: number = 50): Promise<BayseEvent[]> {
    // Logic: Request events from the /pm/events endpoint with a limit filter
    return this.request<BayseEvent[]>(`/pm/events?limit=${limit}`);
  }
}