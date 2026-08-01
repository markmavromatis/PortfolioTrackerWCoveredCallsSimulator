import { useState } from 'react';
import { PortfolioTab } from './components/PortfolioTab';
import { SimulateCoveredCallsTab } from './components/SimulateCoveredCallsTab';
import { ActualCoveredCallsTab } from './components/ActualCoveredCallsTab';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { CoveredCallPosition, SimulatedCoveredCall, Stock } from './types';

type Tab = 'portfolio' | 'simulate' | 'actual';

const TABS: { id: Tab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'simulate', label: 'Simulate Covered Calls' },
  { id: 'actual', label: 'Actual Covered Calls' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [stocks, setStocks] = useLocalStorage<Stock[]>('cch:stocks', []);
  const [simulations, setSimulations] = useLocalStorage<SimulatedCoveredCall[]>(
    'cch:simulations',
    []
  );
  const [positions, setPositions] = useLocalStorage<CoveredCallPosition[]>('cch:positions', []);

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-slate-800 bg-[#0f1117]/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-xl font-semibold text-slate-100">Portfolio Tracker w/Covered Call Simulator</h1>
          <p className="text-sm text-slate-400">Manage your portfolio and covered call income</p>
        </div>
      </header>

      <nav className="mx-auto max-w-6xl px-6 pt-4">
        <div className="flex gap-1 border-b border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {activeTab === 'portfolio' && <PortfolioTab stocks={stocks} setStocks={setStocks} />}
        {activeTab === 'simulate' && (
          <SimulateCoveredCallsTab
            stocks={stocks}
            simulations={simulations}
            setSimulations={setSimulations}
          />
        )}
        {activeTab === 'actual' && (
          <ActualCoveredCallsTab
            stocks={stocks}
            positions={positions}
            setPositions={setPositions}
          />
        )}
      </main>
    </div>
  );
}

export default App;
