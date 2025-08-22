import React, { useState } from 'react';
import Link from 'next/link';

interface DeadCodeSummary {
  generatedAt: string | null;
  deadFiles: number;
  unusedExports: number;
  unusedDependencies: number;
  items?: Array<{
    type: 'file' | 'export' | 'dependency';
    path?: string;
    symbol?: string;
    packageName?: string;
    severity?: 'low' | 'medium' | 'high';
    signals?: string[];
    lastSeen?: string;
    notes?: string;
  }>;
}

interface DeadCodeCardProps {
  deadCodeSummary: DeadCodeSummary | null;
  onRawDataClick: (endpoint: string, title: string) => void;
  onRunScan: () => Promise<void> | void;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-xl font-semibold text-gray-900">{value}</span>
  </div>
);

export const DeadCodeCard: React.FC<DeadCodeCardProps> = ({
  deadCodeSummary,
  onRawDataClick,
  onRunScan
}) => {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const total = (deadCodeSummary?.deadFiles ?? 0) + (deadCodeSummary?.unusedExports ?? 0) + (deadCodeSummary?.unusedDependencies ?? 0);

  return (
    <div className="bg-white shadow rounded-lg p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18l6-6-6-6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6l-6 6 6 6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 4l-4 16" />
            </svg>
            <span>Dead Code</span>
          </h3>
          <div className="flex items-center space-x-2">
            <Link
              href="/maintenance/dead-code"
              className="text-blue-600 hover:text-blue-700 text-sm"
              title="Open Dead Code maintenance page"
            >
              Open Page ↗
            </Link>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Non-destructive
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">Static analysis signals for unused files, exports, and dependencies.</p>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total" value={total} />
          <Stat label="Files" value={deadCodeSummary?.deadFiles ?? 0} />
          <Stat label="Exports" value={deadCodeSummary?.unusedExports ?? 0} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Stat label="Dependencies" value={deadCodeSummary?.unusedDependencies ?? 0} />
          <Stat label="Last Scan" value={fmtDate(deadCodeSummary?.generatedAt)} />
          <div className="flex items-end justify-end">
            <button
              onClick={() => onRawDataClick('/api/monitoring/dead-code/report', 'Dead Code Report (Raw)')}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              View Raw Data
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={async () => {
            try {
              setScanError(null);
              setScanning(true);
              await onRunScan();
            } catch (e: any) {
              setScanError(e?.message || 'Failed to start scan');
            } finally {
              setScanning(false);
            }
          }}
          disabled={scanning}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${scanning ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-white bg-blue-600 hover:bg-blue-700'}`}
        >
          {scanning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-200 mr-2"></div>
              Running...
            </>
          ) : (
            'Run Scan'
          )}
        </button>
        {scanError && (
          <div className="mt-2 text-sm text-red-600">{scanError}</div>
        )}
      </div>

      {/* Items list */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Found Candidates</h4>
        {(!deadCodeSummary?.items || deadCodeSummary.items.length === 0) && (
          <p className="text-sm text-gray-500">No candidates found yet. Run a scan to update.</p>
        )}
        {deadCodeSummary?.items && deadCodeSummary.items.length > 0 && (
          <ul className="space-y-2">
            {deadCodeSummary.items.slice(0, 6).map((it, idx) => (
              <li key={idx} className="flex items-start justify-between bg-gray-50 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800 capitalize">
                      {it.type}
                    </span>
                    {it.severity && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {it.severity}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 truncate mt-1">
                    {it.type === 'dependency' ? (it.packageName || 'unknown package') : (it.path || 'unknown path')}
                    {it.symbol ? <span className="text-gray-500"> · {it.symbol}</span> : null}
                  </div>
                  {it.signals && it.signals.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500 truncate">signals: {it.signals.join(', ')}</div>
                  )}
                </div>
                <div className="ml-3 shrink-0 text-xs text-gray-500">{it.lastSeen ? fmtDate(it.lastSeen) : ''}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <button
            onClick={() => onRawDataClick('/api/monitoring/dead-code/report', 'Dead Code Report (Raw)')}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            View All (Raw)
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeadCodeCard;
