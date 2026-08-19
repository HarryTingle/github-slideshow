import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { ModelProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Scope — delivery & commercial modelling',
  description:
    'Build the delivery plan, resource it, then flex the commercials on top without rebuilding anything.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <ModelProvider>
          <Shell>{children}</Shell>
        </ModelProvider>
      </body>
    </html>
  );
}
