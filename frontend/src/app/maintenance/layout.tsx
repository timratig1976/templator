import Link from 'next/link';
import React from 'react';

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: '/maintenance', label: 'Overview', icon: '📊' },
    { href: '/admin/ai-maintenance', label: 'AI System', icon: '🤖' },
    { href: '/maintenance/build-tests', label: 'Build Tests', icon: '🧪' },
    { href: '/maintenance/jest-tests', label: 'JEST Tests', icon: '✅' },
    { href: '/maintenance/dead-code', label: 'Dead Code', icon: '🧹' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🔧 Maintenance</h1>
              <p className="text-sm text-gray-500 mt-1">System monitoring, AI maintenance and build tests</p>
            </div>
            <div className="flex items-center space-x-3"/>
          </div>
        </div>
      </div>

      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6" aria-label="Tabs">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="inline-flex items-center py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
                <span className="mr-2">{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
