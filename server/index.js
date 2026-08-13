import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';

const PORT = process.env.API_PORT || 4000;

// Unofficial client for Yahoo Finance's undocumented endpoints — no API key,
// but no guarantees either. See yahoo-finance2's own docs: don't assume data
// availability, freshness, or shape, and expect occasional breakage.
const yahooFinance = new YahooFinance();

const app = express();
app.use(cors());

function toDateString(date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
}

app.get('/api/quotes', async (req, res) => {
  const symbolsParam = req.query.symbols;
  if (!symbolsParam) return res.status(400).json({ error: 'symbols query param is required' });
  const symbols = String(symbolsParam)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const quotes = await yahooFinance.quote(symbols);
    const list = Array.isArray(quotes) ? quotes : [quotes];
    res.json(
      list.map((q) => ({
        symbol: q.symbol,
        description: q.shortName ?? q.longName ?? null,
        last: q.regularMarketPrice ?? null,
        change: q.regularMarketChange ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
        volume: q.regularMarketVolume ?? null,
      }))
    );
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/expirations', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol query param is required' });
  try {
    const data = await yahooFinance.options(symbol);
    res.json(data.expirationDates.map(toDateString));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/options', async (req, res) => {
  const { symbol, expiration } = req.query;
  if (!symbol || !expiration) {
    return res.status(400).json({ error: 'symbol and expiration query params are required' });
  }
  try {
    const data = await yahooFinance.options(symbol, { date: new Date(`${expiration}T00:00:00Z`) });
    const chain = data.options[0];
    const calls = (chain?.calls ?? [])
      .map((o) => ({
        symbol: o.contractSymbol,
        strike: o.strike,
        bid: o.bid ?? null,
        ask: o.ask ?? null,
        last: o.lastPrice ?? null,
        change: o.change ?? null,
        changePercent: o.percentChange ?? null,
        volume: o.volume ?? null,
        openInterest: o.openInterest ?? null,
      }))
      .sort((a, b) => a.strike - b.strike);
    res.json(calls);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Yahoo Finance proxy server listening on http://localhost:${PORT}`);
});
