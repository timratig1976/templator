import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LogsSidebar from '@/components/LogsSidebar';

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
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <header className="w-full bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="text-sm font-semibold text-gray-900">Templator</a>
              <nav className="flex items-center gap-4 text-sm">
                <a href="/" className="text-gray-700 hover:text-black">Home</a>
                <a href="/uploads" className="text-gray-700 hover:text-black">Uploads</a>
                <a href="/prompts" className="text-gray-700 hover:text-black">Prompts</a>
                <a href="/maintenance" className="text-gray-700 hover:text-black">Maintenance</a>
              </nav>
            </div>
          </header>
          <div className="flex-1">
            {children}
          </div>
          <footer className="w-full py-2 px-4 bg-gray-100 text-xs text-gray-500 text-center border-t border-gray-200">
            <a href="/maintenance" className="hover:underline">🧪 Test Suite & Maintenance</a>
          </footer>
          {/* Global Logs Sidebar */}
          <LogsSidebar />
        </div>
      </body>
    </html>
  );
}
