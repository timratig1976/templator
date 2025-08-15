import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin - Templator',
  description: 'Administrative tools and maintenance for Templator AI systems',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Templator Admin</h1>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                Maintenance Area
              </span>
            </div>
            <nav className="flex space-x-8">
              <a href="/admin/ai-maintenance" className="text-gray-600 hover:text-gray-900">
                AI Maintenance
              </a>
              <a href="/admin/metrics" className="text-gray-600 hover:text-gray-900">
                Metrics
              </a>
              <a href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to App
              </a>
            </nav>
          </div>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
