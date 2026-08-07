import { useEffect, useMemo, useState } from 'react';
import type { SimulatedCoveredCall, Stock } from '../types';
import { calculateCoveredCallMetrics } from '../utils/coveredCall';
import {
  formatCurrency,
  formatCurrencyWhole,
  formatOptionSymbol,
  formatPercent,
} from '../utils/format';
import { fetchExpirations, fetchCallOptions, fetchQuotes, midPrice, type CallOption } from '../api/market';
import { Modal } from './Modal';

interface SimulateCoveredCallsTabProps {
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  simulations: SimulatedCoveredCall[];
  setSimulations: React.Dispatch<React.SetStateAction<SimulatedCoveredCall[]>>;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  ticker: '',
  contracts: '1',
  strikePrice: '',
  premium: '',
  openDate: today(),
  expirationDate: '',
  notes: '',
};

export function SimulateCoveredCallsTab({
  stocks,
  setStocks,
  simulations,
  setSimulations,
}: SimulateCoveredCallsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [expirations, setExpirations] = useState<string[]>([]);
  const [loadingExpirations, setLoadingExpirations] = useState(false);
  const [expirationsError, setExpirationsError] = useState<string | null>(null);

  const [callOptions, setCallOptions] = useState<CallOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const selectedStock = stocks.find((s) => s.ticker === form.ticker);

  useEffect(() => {
    if (!showForm || !form.ticker) {
      setExpirations([]);
      return;
    }
    let cancelled = false;
    setLoadingExpirations(true);
    setExpirationsError(null);
    fetchExpirations(form.ticker)
      .then((dates) => {
        if (cancelled) return;
        setExpirations(dates);
      })
      .catch((err) => {
        if (cancelled) return;
        setExpirationsError(err instanceof Error ? err.message : 'Failed to load expirations.');
      })
      .finally(() => {
        if (!cancelled) setLoadingExpirations(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form.ticker]);

  useEffect(() => {
    if (!showForm || !form.ticker || !form.expirationDate) {
      setCallOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingOptions(true);
    setOptionsError(null);
    fetchCallOptions(form.ticker, form.expirationDate)
      .then((options) => {
        if (cancelled) return;
        setCallOptions(options);
      })
      .catch((err) => {
        if (cancelled) return;
        setOptionsError(err instanceof Error ? err.message : 'Failed to load option chain.');
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form.ticker, form.expirationDate]);

  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setExpirations([]);
    setCallOptions([]);
    setShowForm(true);
  }

  function openEditForm(sim: SimulatedCoveredCall) {
    setForm({
      ticker: sim.ticker,
      contracts: String(sim.contracts),
      strikePrice: String(sim.strikePrice),
      premium: String(sim.premium),
      openDate: sim.openDate,
      expirationDate: sim.expirationDate,
      notes: sim.notes ?? '',
    });
    setEditingId(sim.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setSimulations((prev) => prev.filter((s) => s.id !== id));
  }

  function handleDragEnter(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setSimulations((prev) => {
      const fromIndex = prev.findIndex((s) => s.id === draggedId);
      const toIndex = prev.findIndex((s) => s.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleTickerChange(ticker: string) {
    const stock = stocks.find((s) => s.ticker === ticker);
    const maxContracts = stock ? Math.floor(stock.quantity / 100) : 0;
    setForm({
      ...form,
      ticker,
      contracts: maxContracts > 0 ? String(maxContracts) : '1',
      expirationDate: '',
      strikePrice: '',
      premium: '',
    });
  }

  function handleExpirationChange(expirationDate: string) {
    setForm({ ...form, expirationDate, strikePrice: '', premium: '' });
  }

  function handleStrikeChange(strike: string) {
    const option = callOptions.find((o) => String(o.strike) === strike);
    const mid = option ? midPrice(option) : null;
    setForm({
      ...form,
      strikePrice: strike,
      premium: mid !== null ? mid.toFixed(2) : form.premium,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticker || !form.strikePrice || !form.premium || !form.expirationDate) return;

    const data: Omit<SimulatedCoveredCall, 'id'> = {
      ticker: form.ticker.toUpperCase(),
      contracts: Number(form.contracts) || 1,
      strikePrice: Number(form.strikePrice) || 0,
      premium: Number(form.premium) || 0,
      openDate: form.openDate,
      expirationDate: form.expirationDate,
      notes: form.notes || undefined,
    };

    if (editingId) {
      setSimulations((prev) => prev.map((s) => (s.id === editingId ? { ...data, id: editingId } : s)));
    } else {
      setSimulations((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    }
    setShowForm(false);
  }

  async function handleRefresh() {
    if (stocks.length === 0) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const uniqueContracts = Array.from(
        new Map(
          simulations.map((sim) => [`${sim.ticker}|${sim.expirationDate}`, sim])
        ).values()
      );

      const [quotes, optionChains] = await Promise.all([
        fetchQuotes(stocks.map((s) => s.ticker)),
        Promise.all(
          uniqueContracts.map((sim) =>
            fetchCallOptions(sim.ticker, sim.expirationDate)
              .then((options) => ({ ticker: sim.ticker, expirationDate: sim.expirationDate, options }))
              .catch(() => ({ ticker: sim.ticker, expirationDate: sim.expirationDate, options: [] as CallOption[] }))
          )
        ),
      ]);

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

      setSimulations((prev) =>
        prev.map((sim) => {
          const chain = optionChains.find(
            (c) => c.ticker === sim.ticker && c.expirationDate === sim.expirationDate
          );
          const option = chain?.options.find((o) => Math.abs(o.strike - sim.strikePrice) < 0.001);
          const mid = option ? midPrice(option) : null;
          if (mid === null) return sim;
          return {
            ...sim,
            premium: mid,
            premiumChangePercent: option?.changePercent ?? undefined,
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

  const previewMetrics = useMemo(() => {
    if (!selectedStock || !form.strikePrice || !form.premium || !form.expirationDate) return null;
    const costBasis = selectedStock.costBasis ?? selectedStock.currentPrice;
    return calculateCoveredCallMetrics({
      costBasis,
      contracts: Number(form.contracts) || 1,
      strikePrice: Number(form.strikePrice),
      premium: Number(form.premium),
      openDate: form.openDate,
      expirationDate: form.expirationDate,
    });
  }, [selectedStock, form]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between mb-6">
        <p className="text-sm text-slate-400 max-w-xl">
          Model hypothetical covered call trades against your holdings using live option chain
          data to compare premium income, breakeven, and annualized return before placing a real
          order.
        </p>
        <div className="flex items-center gap-3 whitespace-nowrap">
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
            disabled={stocks.length === 0}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            + New Simulation
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="shrink-0 mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {refreshError}
        </div>
      )}

      {stocks.length === 0 && (
        <div className="shrink-0 rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-slate-500 text-sm">
          Add stocks to your portfolio first, then simulate covered calls against them.
        </div>
      )}

      {stocks.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 text-slate-400 text-left">
                <th className="px-2 py-3 font-medium w-8">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-4 py-3 font-medium">Actions</th>
                <th className="px-4 py-3 font-medium">Option</th>
                <th className="px-4 py-3 font-medium text-right">#</th>
                <th className="px-4 py-3 font-medium text-right">Premium</th>
                <th className="px-4 py-3 font-medium text-right">Premium Collected</th>
                <th className="px-4 py-3 font-medium text-right">Capped Limit</th>
                <th className="px-4 py-3 font-medium text-right">Total Returns</th>
                <th className="px-4 py-3 font-medium text-right">Max Profit</th>
                <th className="px-4 py-3 font-medium text-right">Return (unchanged)</th>
                <th className="px-4 py-3 font-medium text-right">Annualized</th>
              </tr>
            </thead>
            <tbody>
              {simulations.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No simulations yet. Click "New Simulation" to model a trade.
                  </td>
                </tr>
              )}
              {simulations.map((sim) => {
                const stock = stocks.find((s) => s.ticker === sim.ticker);
                const costBasis = stock?.costBasis ?? stock?.currentPrice ?? 0;
                const metrics = calculateCoveredCallMetrics({
                  costBasis,
                  contracts: sim.contracts,
                  strikePrice: sim.strikePrice,
                  premium: sim.premium,
                  openDate: sim.openDate,
                  expirationDate: sim.expirationDate,
                });
                return (
                  <tr
                    key={sim.id}
                    className={`border-t border-slate-800 hover:bg-slate-900/50 ${
                      draggedId === sim.id ? 'opacity-40' : ''
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => handleDragEnter(sim.id)}
                    onDrop={(e) => e.preventDefault()}
                  >
                    <td
                      className="px-2 py-3 text-center text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing select-none"
                      draggable
                      onDragStart={() => setDraggedId(sim.id)}
                      onDragEnd={() => setDraggedId(null)}
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => openEditForm(sim)}
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sim.id)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-100 whitespace-nowrap">
                      {formatOptionSymbol(sim.ticker, sim.expirationDate, sim.strikePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">{sim.contracts}</td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      <div>
                        {formatCurrency(sim.premium)}
                        {stock && stock.currentPrice
                          ? ` (${((sim.premium / stock.currentPrice) * 100).toFixed(2)}%)`
                          : ''}
                      </div>
                      {sim.premiumChangePercent !== undefined && (
                        <div
                          className={`text-xs ${
                            sim.premiumChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {sim.premiumChangePercent >= 0 ? '+' : ''}
                          {sim.premiumChangePercent.toFixed(2)}%
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      {formatCurrency(metrics.premiumCollected)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatCurrencyWhole(metrics.cappedLimit)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatCurrencyWhole(metrics.totalReturns)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatCurrencyWhole(metrics.maxProfit)} ({formatPercent(metrics.maxProfitPercent)})
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatPercent(metrics.returnIfUnchangedPercent)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200">
                      {formatPercent(metrics.annualizedReturnPercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          title={editingId ? 'Edit Simulation' : 'New Covered Call Simulation'}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block col-span-2">
                <span className="block text-xs font-medium text-slate-400 mb-1">Stock</span>
                <select
                  className="input"
                  value={form.ticker}
                  onChange={(e) => handleTickerChange(e.target.value)}
                  required
                >
                  <option value="">Select a holding&hellip;</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.ticker}>
                      {s.ticker} &mdash; {s.quantity} shares @ {formatCurrency(s.currentPrice)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">
                  Contracts (1 = 100 sh)
                </span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={form.contracts}
                  onChange={(e) => setForm({ ...form, contracts: e.target.value })}
                  required
                />
                {selectedStock && (
                  <span className="text-xs text-slate-500">
                    Max: {Math.floor(selectedStock.quantity / 100)} contracts
                  </span>
                )}
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">
                  Expiration Date
                </span>
                <select
                  className="input"
                  value={form.expirationDate}
                  onChange={(e) => handleExpirationChange(e.target.value)}
                  disabled={!form.ticker || loadingExpirations}
                  required
                >
                  <option value="">
                    {loadingExpirations ? 'Loading…' : 'Select expiration…'}
                  </option>
                  {expirations.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
                {expirationsError && (
                  <span className="text-xs text-rose-400">{expirationsError}</span>
                )}
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">Strike Price</span>
                <select
                  className="input"
                  value={form.strikePrice}
                  onChange={(e) => handleStrikeChange(e.target.value)}
                  disabled={!form.expirationDate || loadingOptions}
                  required
                >
                  <option value="">{loadingOptions ? 'Loading…' : 'Select strike…'}</option>
                  {callOptions.map((option) => {
                    const mid = midPrice(option);
                    return (
                      <option key={option.symbol} value={option.strike}>
                        {formatCurrency(option.strike)}
                        {mid !== null ? ` — premium ${formatCurrency(mid)}` : ''}
                      </option>
                    );
                  })}
                </select>
                {optionsError && <span className="text-xs text-rose-400">{optionsError}</span>}
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">
                  Premium (per share)
                </span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.premium}
                  onChange={(e) => setForm({ ...form, premium: e.target.value })}
                  required
                />
                <span className="text-xs text-slate-500">
                  Pre-filled from the option's mid price; adjust if needed.
                </span>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">Open Date</span>
                <input
                  className="input"
                  type="date"
                  value={form.openDate}
                  onChange={(e) => setForm({ ...form, openDate: e.target.value })}
                  required
                />
              </label>
            </div>

            {previewMetrics && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 grid grid-cols-2 gap-2 text-sm">
                <Metric label="Premium Collected" value={formatCurrency(previewMetrics.premiumCollected)} />
                <Metric label="Capped Limit" value={formatCurrency(previewMetrics.cappedLimit)} />
                <Metric label="Total Returns" value={formatCurrency(previewMetrics.totalReturns)} />
                <Metric label="Breakeven" value={formatCurrency(previewMetrics.breakeven)} />
                <Metric
                  label="Max Profit"
                  value={`${formatCurrency(previewMetrics.maxProfit)} (${formatPercent(previewMetrics.maxProfitPercent)})`}
                />
                <Metric
                  label="Return if Unchanged"
                  value={formatPercent(previewMetrics.returnIfUnchangedPercent)}
                />
                <Metric
                  label="Downside Protection"
                  value={formatPercent(previewMetrics.downsideProtectionPercent)}
                />
                <Metric
                  label="Annualized Return"
                  value={formatPercent(previewMetrics.annualizedReturnPercent)}
                />
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-medium text-slate-400 mb-1">Notes (optional)</span>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Earnings before expiration, etc."
              />
            </label>

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
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                {editingId ? 'Save Changes' : 'Add Simulation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-100 font-medium">{value}</div>
    </div>
  );
}
