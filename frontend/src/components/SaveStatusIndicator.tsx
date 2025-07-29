import React from 'react';
import { Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SaveStatusIndicatorProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  autoSaveEnabled: boolean;
  onToggleAutoSave: (enabled: boolean) => void;
  className?: string;
}

export default function SaveStatusIndicator({
  saveStatus,
  isSaving,
  lastSaved,
  error,
  autoSaveEnabled,
  onToggleAutoSave,
  className = ''
}: SaveStatusIndicatorProps) {
  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'saved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Save className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Not saved';
    }
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Save Status */}
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className={`text-sm font-medium ${
          saveStatus === 'error' ? 'text-red-600' : 
          saveStatus === 'saved' ? 'text-green-600' : 
          saveStatus === 'saving' ? 'text-blue-600' : 
          'text-gray-500'
        }`}>
          {getStatusText()}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-500 max-w-xs truncate" title={error}>
          {error}
        </div>
      )}

      {/* Auto-save Toggle */}
      <div className="flex items-center space-x-2">
        <label className="flex items-center space-x-1 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => onToggleAutoSave(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-gray-600">Auto-save</span>
        </label>
      </div>

      {/* Manual Save Button */}
      {!autoSaveEnabled && (
        <button
          disabled={isSaving}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          onClick={() => {
            // This would trigger manual save - to be implemented
            console.log('Manual save triggered');
          }}
        >
          <Save className="w-3 h-3" />
          <span>Save</span>
        </button>
      )}
    </div>
  );
}
