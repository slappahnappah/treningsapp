import { useState } from 'react';
import { DataProvider, useData } from './data';
import { RestBar } from './RestBar';
import { DiaryTab, ExercisesTab, RoutinesTab, SettingsTab, StartTab } from './tabs';
import { useWakeLock } from './wakeLock';

type Tab = 'routines' | 'diary' | 'start' | 'exercises' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'routines', label: 'Rutiner', icon: 'M5 6h14M5 12h14M5 18h9' },
  { id: 'diary', label: 'Dagbok', icon: 'M6 4h12v16H6zM9 9h6M9 13h6' },
  { id: 'start', label: 'Økt', icon: 'M9 4v16M15 4v16M9 8h6M9 12h6M9 16h6' },
  { id: 'exercises', label: 'Øvelser', icon: 'M3 12h3m12 0h3M6 7v10M18 7v10M6 12h12' },
  { id: 'settings', label: 'Innstillinger', icon: 'M4 7h10m4 0h2M4 17h2m4 0h10M16 5v4M8 15v4' },
];

function Shell() {
  const { active } = useData();
  const [tab, setTab] = useState<Tab>('start');
  // Skjermen holdes våken under hele økta, så hviletimeren kan gi lyd.
  useWakeLock(!!active);

  return (
    <div className="app">
      <main className="main">
        {tab === 'routines' && <RoutinesTab onStarted={() => setTab('start')} />}
        {tab === 'diary' && <DiaryTab />}
        {tab === 'start' && <StartTab />}
        {tab === 'exercises' && <ExercisesTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <div className="bottom">
        <RestBar />
        <nav className="tabbar" aria-label="Hovedmeny">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' tab-on' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              <span>{t.label}</span>
              {t.id === 'start' && active && <i className="tab-dot" />}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
