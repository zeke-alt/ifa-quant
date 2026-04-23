// types/bayse.ts
export interface BayseEvent {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'resolved' | 'canceled';
  markets: BayseMarket[];
}

export interface BayseMarket {
  id: string;
  question: string;
  outcomes: {
    id: string;
    name: string;
    price: number; // The current trading price
  }[];
}