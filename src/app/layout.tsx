import './globals.css';
import { Schibsted_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

const display = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','500'], variable: '--font-mono' });

export const metadata = { title: 'Tradon' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
