import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', weight: ['500', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  title: { default: 'THIKANO — Find your PG. See the actual room.', template: '%s · THIKANO' },
  description: 'Find PGs and hostels near your college. See real rooms, real photos and live availability. Move in. Live better.',
  openGraph: { siteName: 'THIKANO', locale: 'en_IN', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0B1633', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
