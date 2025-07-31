import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Windsurf MVP - Design to HubSpot Module Converter',
  description: 'Convert screen designs to HTML+Tailwind and generate HubSpot modules with live preview',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 flex flex-col min-h-screen">
          <div className="flex-1">
            {children}
          </div>
          <footer className="w-full py-2 px-4 bg-gray-100 text-xs text-gray-500 text-center border-t border-gray-200">
            <a href="/maintenance" className="hover:underline">🧪 Test Suite & Maintenance</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
