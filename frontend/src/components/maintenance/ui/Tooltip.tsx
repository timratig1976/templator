/**
 * Reusable Tooltip Component for Maintenance Dashboard
 * Provides consistent tooltip behavior across the dashboard
 */

import React, { useState } from 'react';

export interface TooltipProps {
  id: string;
  title: string;
  description: string;
  measurement: string;
  children: React.ReactNode;
  showTooltip?: string | null;
  onTooltipChange?: (id: string | null) => void;
}

export const Tooltip: React.FC<TooltipProps> = ({
  id,
  title,
  description,
  measurement,
  children,
  showTooltip,
  onTooltipChange
}) => {
  const [localShowTooltip, setLocalShowTooltip] = useState<string | null>(null);
  
  // Use external state if provided, otherwise use local state
  const isVisible = showTooltip !== undefined ? showTooltip === id : localShowTooltip === id;
  const setTooltipVisible = onTooltipChange || setLocalShowTooltip;

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setTooltipVisible(id)}
        onMouseLeave={() => setTooltipVisible(null)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className="absolute z-50 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-lg -top-2 left-full ml-2">
          <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white"></div>
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <p className="text-sm text-gray-600">{description}</p>
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>Measurement:</strong> {measurement}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
