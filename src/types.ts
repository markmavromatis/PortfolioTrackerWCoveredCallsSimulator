export interface Stock {
  id: string;
  ticker: string;
  quantity: number;
  currentPrice: number;
  priceChange: number;
  volume: number;
  costBasis?: number;
}

export interface SimulatedCoveredCall {
  id: string;
  ticker: string;
  contracts: number;
  strikePrice: number;
  premium: number;
  openDate: string;
  expirationDate: string;
  notes?: string;
}

export type CallStatus = 'Open' | 'Expired' | 'Assigned' | 'Closed';

export interface CoveredCallPosition {
  id: string;
  ticker: string;
  contracts: number;
  strikePrice: number;
  premium: number;
  openDate: string;
  expirationDate: string;
  status: CallStatus;
  closeDate?: string;
  closeCost?: number;
  notes?: string;
}
