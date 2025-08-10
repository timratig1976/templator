'use client';

import React from 'react';
import DesignUploadsManager from '@/components/DesignUploadsManager';

export default function UploadsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Uploads</h1>
      <p className="text-sm text-gray-600 mb-4">Browse, filter, and manage your uploaded design files.</p>
      <DesignUploadsManager />
    </main>
  );
}
