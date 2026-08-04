export interface Quote {
  symbol: string;
  description: string | null;
  last: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
}

export interface CallOption {
  symbol: string;
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  openInterest: number | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return Promise.resolve([]);
  const params = new URLSearchParams({ symbols: symbols.join(',') });
  return getJson<Quote[]>(`/api/quotes?${params}`);
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const quotes = await fetchQuotes([symbol]);
  return quotes.find((q) => q.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
}

export function fetchExpirations(symbol: string): Promise<string[]> {
  const params = new URLSearchParams({ symbol });
  return getJson<string[]>(`/api/expirations?${params}`);
}

export function fetchCallOptions(symbol: string, expiration: string): Promise<CallOption[]> {
  const params = new URLSearchParams({ symbol, expiration });
  return getJson<CallOption[]>(`/api/options?${params}`);
}

export function midPrice(option: CallOption): number | null {
  if (option.bid !== null && option.ask !== null && (option.bid > 0 || option.ask > 0)) {
    return (option.bid + option.ask) / 2;
  }
  return option.last ?? option.bid ?? option.ask ?? null;
}
