import { useState } from 'react';
import type { Stock } from '../types';
import { fetchQuote, fetchQuotes } from '../api/market';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import { Modal } from './Modal';

interface PortfolioTabProps {
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
}

const emptyForm = {
  ticker: '',
  quantity: '',
  costBasis: '',
};

export function PortfolioTab({ stocks, setStocks }: PortfolioTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const totalValue = stocks.reduce((sum, s) => sum + s.currentPrice * s.quantity, 0);
  const totalDayChange = stocks.reduce((sum, s) => sum + s.priceChange * s.quantity, 0);

  function openAddForm() {
    setForm(emptyForm);
    setFormError(null);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(stock: Stock) {
    setForm({
      ticker: stock.ticker,
      quantity: String(stock.quantity),
      costBasis: stock.costBasis !== undefined ? String(stock.costBasis) : '',
    });
    setFormError(null);
    setEditingId(stock.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setStocks((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const quote = await fetchQuote(ticker);
      if (!quote || quote.last === null) {
        setFormError(`No quote found for "${ticker}". Check the ticker and try again.`);
        return;
      }

      const stockData: Omit<Stock, 'id'> = {
        ticker,
        quantity: Number(form.quantity) || 0,
        currentPrice: quote.last,
        priceChange: quote.change ?? 0,
        volume: quote.volume ?? 0,
        costBasis: form.costBasis ? Number(form.costBasis) : undefined,
      };

      if (editingId) {
        setStocks((prev) =>
          prev.map((s) => (s.id === editingId ? { ...stockData, id: editingId } : s))
        );
      } else {
        setStocks((prev) => [...prev, { ...stockData, id: crypto.randomUUID() }]);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to fetch quote.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    if (stocks.length === 0) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const quotes = await fetchQuotes(stocks.map((s) => s.ticker));
      setStocks((prev) =>
        prev.map((s) => {
          const quote = quotes.find((q) => q.symbol.toUpperCase() === s.ticker.toUpperCase());
          if (!quote || quote.last === null) return s;
          return {
            ...s,
            currentPrice: quote.last,
            priceChange: quote.change ?? s.priceChange,
            volume: quote.volume ?? s.volume,
          };
        })
      );
      setLastRefreshed(new Date());
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Failed to refresh prices.');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="flex gap-6">
          <div>
            <div className="text-sm text-slate-400">Total Value</div>
            <div className="text-2xl font-semibold text-slate-100">
              {formatCurrency(totalValue)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Today's Change</div>
            <div
              className={`text-2xl font-semibold ${
                totalDayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalDayChange >= 0 ? '+' : ''}
              {formatCurrency(totalDayChange)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-slate-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || stocks.length === 0}
            className="rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 px-4 py-2 text-sm font-medium transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh Prices'}
          </button>
          <button
            onClick={openAddForm}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            + Add Stock
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {refreshError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">Change</th>
              <th className="px-4 py-3 font-medium text-right">Quantity</th>
              <th className="px-4 py-3 font-medium text-right">Market Value</th>
              <th className="px-4 py-3 font-medium text-right">Volume</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No stocks yet. Click "Add Stock" to build your portfolio.
                </td>
              </tr>
            )}
            {stocks.map((stock) => {
              const previousClose = stock.currentPrice - stock.priceChange;
              const changePercent =
                previousClose !== 0 ? (stock.priceChange / previousClose) * 100 : 0;
              return (
                <tr
                  key={stock.id}
                  className="border-t border-slate-800 hover:bg-slate-900/50"
                >
                  <td className="px-4 py-3 font-semibold text-slate-100">{stock.ticker}</td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatCurrency(stock.currentPrice)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      stock.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {stock.priceChange >= 0 ? '+' : ''}
                    {formatCurrency(stock.priceChange)} ({formatPercent(changePercent)})
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatNumber(stock.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatCurrency(stock.currentPrice * stock.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {formatNumber(stock.volume)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(stock)}
                      className="text-indigo-400 hover:text-indigo-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(stock.id)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editingId ? 'Edit Stock' : 'Add Stock'} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ticker">
                <input
                  className="input"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                  placeholder="AAPL"
                  required
                />
              </Field>
              <Field label="Quantity">
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="100"
                  required
                />
              </Field>
              <Field label="Cost Basis (optional)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.costBasis}
                  onChange={(e) => setForm({ ...form, costBasis: e.target.value })}
                  placeholder="140.00"
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Current price, today's change, and volume are pulled live from the market data API
              when you save.
            </p>
            {formError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium"
              >
                {submitting ? 'Fetching quote…' : editingId ? 'Save Changes' : 'Add Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
