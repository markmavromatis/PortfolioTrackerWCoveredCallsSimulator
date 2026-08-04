import { useEffect, useState } from 'react';
import type { CallStatus, CoveredCallPosition, Stock } from '../types';
import { formatCurrency, daysBetween } from '../utils/format';
import { fetchExpirations, fetchCallOptions, midPrice, type CallOption } from '../api/market';
import { Modal } from './Modal';

interface ActualCoveredCallsTabProps {
  stocks: Stock[];
  positions: CoveredCallPosition[];
  setPositions: React.Dispatch<React.SetStateAction<CoveredCallPosition[]>>;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  ticker: '',
  contracts: '1',
  strikePrice: '',
  premium: '',
  openDate: today(),
  expirationDate: '',
  status: 'Open' as CallStatus,
  closeDate: '',
  closeCost: '',
  notes: '',
};

const statusStyles: Record<CallStatus, string> = {
  Open: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Expired: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  Assigned: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Closed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function realizedPnl(pos: CoveredCallPosition): number | null {
  const premiumCollected = pos.premium * 100 * pos.contracts;
  if (pos.status === 'Open') return null;
  if (pos.status === 'Expired' || pos.status === 'Assigned') return premiumCollected;
  if (pos.status === 'Closed') {
    const closeCost = (pos.closeCost ?? 0) * 100 * pos.contracts;
    return premiumCollected - closeCost;
  }
  return null;
}

export function ActualCoveredCallsTab({ stocks, positions, setPositions }: ActualCoveredCallsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [expirations, setExpirations] = useState<string[]>([]);
  const [loadingExpirations, setLoadingExpirations] = useState(false);
  const [expirationsError, setExpirationsError] = useState<string | null>(null);

  const [callOptions, setCallOptions] = useState<CallOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // A position being edited may reference an expiration/strike that has
  // already rolled off the live chain (expired or closed trades) — keep it
  // selectable in the dropdown even if the API no longer returns it.
  const expirationOptions =
    form.expirationDate && !expirations.includes(form.expirationDate)
      ? [...expirations, form.expirationDate].sort()
      : expirations;

  const strikeOptions =
    form.strikePrice && !callOptions.some((o) => String(o.strike) === form.strikePrice)
      ? [
          ...callOptions,
          {
            symbol: 'manual',
            strike: Number(form.strikePrice),
            bid: null,
            ask: null,
            last: null,
            change: null,
            changePercent: null,
            volume: null,
            openInterest: null,
          },
        ]
      : callOptions;

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

  function openEditForm(pos: CoveredCallPosition) {
    setForm({
      ticker: pos.ticker,
      contracts: String(pos.contracts),
      strikePrice: String(pos.strikePrice),
      premium: String(pos.premium),
      openDate: pos.openDate,
      expirationDate: pos.expirationDate,
      status: pos.status,
      closeDate: pos.closeDate ?? '',
      closeCost: pos.closeCost !== undefined ? String(pos.closeCost) : '',
      notes: pos.notes ?? '',
    });
    setExpirations([]);
    setCallOptions([]);
    setEditingId(pos.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  function handleTickerChange(ticker: string) {
    setForm({ ...form, ticker, expirationDate: '', strikePrice: '', premium: '' });
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

    const data: Omit<CoveredCallPosition, 'id'> = {
      ticker: form.ticker.toUpperCase(),
      contracts: Number(form.contracts) || 1,
      strikePrice: Number(form.strikePrice) || 0,
      premium: Number(form.premium) || 0,
      openDate: form.openDate,
      expirationDate: form.expirationDate,
      status: form.status,
      closeDate: form.closeDate || undefined,
      closeCost: form.closeCost ? Number(form.closeCost) : undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      setPositions((prev) => prev.map((p) => (p.id === editingId ? { ...data, id: editingId } : p)));
    } else {
      setPositions((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    }
    setShowForm(false);
  }

  const totalPremium = positions.reduce((sum, p) => sum + p.premium * 100 * p.contracts, 0);
  const totalRealized = positions.reduce((sum, p) => sum + (realizedPnl(p) ?? 0), 0);
  const openCount = positions.filter((p) => p.status === 'Open').length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="flex gap-6">
          <div>
            <div className="text-sm text-slate-400">Open Positions</div>
            <div className="text-2xl font-semibold text-slate-100">{openCount}</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Total Premium Collected</div>
            <div className="text-2xl font-semibold text-slate-100">{formatCurrency(totalPremium)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Realized P&amp;L</div>
            <div
              className={`text-2xl font-semibold ${totalRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {formatCurrency(totalRealized)}
            </div>
          </div>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
        >
          + Add Covered Call
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium text-right">Contracts</th>
              <th className="px-4 py-3 font-medium text-right">Strike</th>
              <th className="px-4 py-3 font-medium text-right">Premium</th>
              <th className="px-4 py-3 font-medium text-right">Opened</th>
              <th className="px-4 py-3 font-medium text-right">Expiration</th>
              <th className="px-4 py-3 font-medium text-right">DTE</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">P&amp;L</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  No covered calls tracked yet. Click "Add Covered Call" to log a real position.
                </td>
              </tr>
            )}
            {positions.map((pos) => {
              const pnl = realizedPnl(pos);
              const dte = daysBetween(today(), pos.expirationDate);
              return (
                <tr key={pos.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-semibold text-slate-100">{pos.ticker}</td>
                  <td className="px-4 py-3 text-right text-slate-200">{pos.contracts}</td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatCurrency(pos.strikePrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatCurrency(pos.premium)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{pos.openDate}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{pos.expirationDate}</td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {pos.status === 'Open' ? dte : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[pos.status]}`}
                    >
                      {pos.status}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      pnl === null ? 'text-slate-500' : pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pnl === null ? '—' : formatCurrency(pnl)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(pos)}
                      className="text-indigo-400 hover:text-indigo-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pos.id)}
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
        <Modal
          title={editingId ? 'Edit Covered Call' : 'Add Covered Call'}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block col-span-2">
                <span className="block text-xs font-medium text-slate-400 mb-1">Stock</span>
                {stocks.length > 0 ? (
                  <select
                    className="input"
                    value={form.ticker}
                    onChange={(e) => handleTickerChange(e.target.value)}
                    required
                  >
                    <option value="">Select a holding&hellip;</option>
                    {stocks.map((s) => (
                      <option key={s.id} value={s.ticker}>
                        {s.ticker} &mdash; {s.quantity} shares
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={form.ticker}
                    onChange={(e) => handleTickerChange(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    required
                  />
                )}
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">Contracts</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={form.contracts}
                  onChange={(e) => setForm({ ...form, contracts: e.target.value })}
                  required
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">Status</span>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as CallStatus })}
                >
                  <option value="Open">Open</option>
                  <option value="Expired">Expired</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Closed">Closed</option>
                </select>
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
                  {expirationOptions.map((date) => (
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
                  {strikeOptions.map((option) => {
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
                  Pre-filled from the option's mid price; adjust to your actual fill.
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
              {form.status === 'Closed' && (
                <>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-400 mb-1">Close Date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.closeDate}
                      onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-400 mb-1">
                      Buy-to-Close Cost (per share)
                    </span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={form.closeCost}
                      onChange={(e) => setForm({ ...form, closeCost: e.target.value })}
                    />
                  </label>
                </>
              )}
            </div>

            <label className="block">
              <span className="block text-xs font-medium text-slate-400 mb-1">Notes (optional)</span>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                {editingId ? 'Save Changes' : 'Add Covered Call'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
