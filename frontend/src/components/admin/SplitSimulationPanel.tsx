'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  EyeIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface TestResult {
  id: string;
  timestamp: string;
  fileName: string;
  sectionsDetected: number;
  averageConfidence: number;
  processingTime: number;
  accuracy?: number;
  sections: any[];
}

interface SplitSimulationPanelProps {
  result: TestResult;
  imageFile: File | null;
  fullHeight?: boolean; // New prop for maintenance area full-height mode
  showKPIs?: boolean; // New prop to control KPI display
}

// Helper to format processing time consistently
const formatProcessingTime = (value?: number | string | null): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/\b(ms|s)\b$/i.test(trimmed)) return trimmed;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return asNum < 1000 ? `${Math.round(asNum)}ms` : `${(asNum / 1000).toFixed(2)}s`;
    return trimmed;
  }
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
};

export default function SplitSimulationPanel({ 
  result, 
  imageFile, 
  fullHeight = false, 
  showKPIs = true 
}: SplitSimulationPanelProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      
      // Get actual image dimensions
      const actualDims = { width: img.naturalWidth, height: img.naturalHeight };
      setImageDimensions(actualDims);
      
      // Get displayed image dimensions
      const displayDims = { width: img.offsetWidth, height: img.offsetHeight };
      setDisplayDimensions(displayDims);
      
      // Debug logging
      console.log('Image loaded:', {
        actualDims,
        displayDims,
        sectionsCount: result.sections?.length || 0
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getSectionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      header: 'bg-blue-100 text-blue-800 border-blue-200',
      hero: 'bg-purple-100 text-purple-800 border-purple-200',
      content: 'bg-gray-100 text-gray-800 border-gray-200',
      feature: 'bg-green-100 text-green-800 border-green-200',
      testimonial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      contact: 'bg-red-100 text-red-800 border-red-200',
      footer: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      navigation: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      sidebar: 'bg-pink-100 text-pink-800 border-pink-200',
      gallery: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const calculateOverlayPosition = (bounds: any) => {
    // Ensure bounds object exists and has required properties
    if (!bounds || typeof bounds !== 'object') {
      console.warn('Invalid bounds object:', bounds);
      return { display: 'none' };
    }
    
    const x = Number(bounds.x) || 0;
    const y = Number(bounds.y) || 0;
    const width = Number(bounds.width) || 0;
    const height = Number(bounds.height) || 0;
    
    // Skip if bounds are invalid
    if (width <= 0 || height <= 0) {
      console.warn('Invalid bounds dimensions:', { x, y, width, height });
      return { display: 'none' };
    }
    
    // If we have proper dimensions, use accurate scaling
    if (imageDimensions.width > 0 && displayDimensions.width > 0) {
      const scaleX = displayDimensions.width / imageDimensions.width;
      const scaleY = displayDimensions.height / imageDimensions.height;
      
      return {
        left: `${x * scaleX}px`,
        top: `${y * scaleY}px`,
        width: `${width * scaleX}px`,
        height: `${height * scaleY}px`,
      };
    }
    
    // Fallback to percentage-based positioning (existing behavior)
    return {
      left: `${(x / 800) * 100}%`,
      top: `${(y / 600) * 100}%`,
      width: `${(width / 800) * 100}%`,
      height: `${(height / 600) * 100}%`,
    };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <EyeIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Detection Results</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <ChartBarIcon className="h-4 w-4" />
              <span>{result.sectionsDetected} sections</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircleIcon className="h-4 w-4" />
              <span>{Math.round(result.averageConfidence * 100)}% confidence</span>
            </div>
            <div className="flex items-center space-x-1">
              <ClockIcon className="h-4 w-4" />
              <span>{formatProcessingTime(result.processingTime)}</span>
            </div>
            {result.accuracy && (
              <div className="flex items-center space-x-1">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-600">{result.accuracy}% accuracy</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Preview with Overlays */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Visual Detection Results</h4>
            <div 
              ref={containerRef}
              className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50"
            >
              {imageUrl ? (
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Test image"
                    className="w-full h-auto max-h-96 object-contain"
                    onLoad={handleImageLoad}
                  />
                  
                  {/* Section Overlays */}
                  {result.sections.map((section, index) => {
                    const isSelected = selectedSection === section.id;
                    const sectionColor = getSectionTypeColor(section.type);
                    const overlayStyle = calculateOverlayPosition(section.bounds);
                    
                    // Debug logging
                    console.log(`Section ${index}:`, {
                      name: section.name || section.type,
                      bounds: section.bounds,
                      overlayStyle,
                      imageDimensions,
                      displayDimensions
                    });
                    
                    return (
                      <div
                        key={section.id || `section-${index}`}
                        className={`absolute border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-500 bg-opacity-20' 
                            : 'border-red-500 bg-red-500 bg-opacity-10 hover:bg-opacity-20'
                        }`}
                        style={overlayStyle}
                        onClick={() => setSelectedSection(isSelected ? null : section.id)}
                      >
                        <div className={`absolute -top-6 left-0 px-2 py-1 text-xs font-medium rounded ${sectionColor}`}>
                          {section.name || section.type}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <EyeIcon className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-2">No image selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Detected Sections</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.sections.map((section, index) => {
                const isSelected = selectedSection === section.id;
                
                return (
                  <div
                    key={section.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedSection(isSelected ? null : section.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {section.name || `Section ${index + 1}`}
                        </h5>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSectionTypeColor(section.type)}`}>
                          {section.type}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(section.aiConfidence)}`}>
                        {Math.round(section.aiConfidence * 100)}%
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <strong>Bounds:</strong> x:{section.bounds.x}, y:{section.bounds.y}, 
                        w:{section.bounds.width}, h:{section.bounds.height}
                      </div>
                      {section.detectionReason && (
                        <div>
                          <strong>Reason:</strong> {section.detectionReason}
                        </div>
                      )}
                    </div>

                    {section.suggestedImprovements && section.suggestedImprovements.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-start space-x-2">
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-yellow-700">
                            <strong>Suggestions:</strong>
                            <ul className="mt-1 space-y-1">
                              {section.suggestedImprovements.map((suggestion: string, i: number) => (
                                <li key={i}>• {suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>



        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Instructions:</strong> Click on sections in the image or list to highlight them. 
            Red overlays show detected section boundaries. Use this to evaluate prompt accuracy.
          </p>
        </div>
      </div>
    </div>
  );
}
