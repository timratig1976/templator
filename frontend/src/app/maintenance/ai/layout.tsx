"use client";
import React from 'react';

export default function AILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation and headline are provided by parent maintenance layout */}
      <main className="pt-2 pb-6">
        {children}
      </main>
    </div>
  );
}
