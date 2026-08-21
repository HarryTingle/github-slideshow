'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FictionPill } from './bits';
import { StartControls } from './StartControls';
import { UndoControls } from './UndoControls';

const NAV = [
  { href: '/plan', label: 'Delivery plan' },
  { href: '/commercials', label: 'Commercials' },
  { href: '/outputs', label: 'Outputs' },
  { href: '/overview', label: 'Overview' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/plan">
            <span className="brand-mark">Scope</span>
            <span className="brand-sub">Delivery &amp; commercials</span>
          </Link>
          <FictionPill />
          <UndoControls />
          <StartControls />
          <nav className="nav">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
