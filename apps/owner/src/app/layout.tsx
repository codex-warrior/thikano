import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', weight: ['500', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'THIKANO Owner', template: '%s · THIKANO Owner' },
  description: 'Run your PG, fill vacant rooms, manage residents, and earn more.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'THIKANO Owner', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#0B1633', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
