/**
 * Standalone build.
 *
 * The same pages and the same engine as the Next.js app, wrapped in a hash router
 * so the whole thing can be served as a single self-contained HTML file. Nothing is
 * re-implemented here — if a number differs from `npm run dev`, this file is the bug.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ModelProvider } from '../lib/store';
import Overview from '../app/overview/page';
import Plan from '../app/plan/page';
import Commercials from '../app/commercials/page';
import Outputs from '../app/outputs/page';
import { FictionPill } from '../components/bits';
import { StartControls } from '../components/StartControls';
import { UndoControls } from '../components/UndoControls';

const ROUTES = [
  { hash: '#/plan', label: 'Delivery plan', Component: Plan },
  { hash: '#/commercials', label: 'Commercials', Component: Commercials },
  { hash: '#/outputs', label: 'Outputs', Component: Outputs },
  { hash: '#/overview', label: 'Overview', Component: Overview },
];

function App() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const route = ROUTES.find((entry) => entry.hash === hash) ?? ROUTES[0]!;
  const { Component } = route;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/plan">
            <span className="brand-mark">Scope</span>
            <span className="brand-sub">Delivery &amp; commercials</span>
          </a>
          <FictionPill />
          <UndoControls />
          <StartControls />
          <nav className="nav">
            {ROUTES.map((entry) => (
              <a
                key={entry.hash}
                href={entry.hash}
                aria-current={entry.hash === route.hash ? 'page' : undefined}
              >
                {entry.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="page">
        <Component />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModelProvider>
      <App />
    </ModelProvider>
  </StrictMode>,
);
