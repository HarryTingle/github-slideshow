'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ResetButton } from './ResetButton';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/plan', label: 'Delivery plan' },
  { href: '/commercials', label: 'Commercials' },
  { href: '/outputs', label: 'Outputs' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">Scope</span>
            <span className="brand-sub">Delivery &amp; commercials</span>
          </Link>
          <ResetButton />
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
