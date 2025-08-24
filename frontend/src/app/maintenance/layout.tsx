"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import MaintenanceNav from '../../components/maintenance/ui/MaintenanceNav';
import MaintenanceHeadline from '../../components/maintenance/ui/MaintenanceHeadline';
import './maintenance.css';

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inAI = (pathname || '').startsWith('/maintenance/ai');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-transparent">
        <div className="flex justify-between items-center py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔧 Maintenance</h1>
            <p className="text-sm text-gray-500 mt-1">
              {inAI
                ? 'Explore AI tools and core maintenance utilities.'
                : 'System monitoring, AI maintenance and build tests'}
            </p>
          </div>
          <div className="flex items-center space-x-3"/>
        </div>
      </div>

      <MaintenanceNav />

      <MaintenanceHeadline />

      <main className="pt-2 pb-6">
        {children}
      </main>
    </div>
  );
}
