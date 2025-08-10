'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface SplittingSuggestion {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  type: 'header' | 'hero' | 'content' | 'sidebar' | 'footer' | 'navigation' | 'form' | 'gallery' | 'testimonial' | 'cta' | 'other';
  description: string;
}

interface SplittingSuggestionsUIProps {
  imageFile: File;
  suggestions: SplittingSuggestion[];
  onConfirm: (confirmedSuggestions: SplittingSuggestion[]) => void;
  onRegenerate: () => void;
  isLoading?: boolean;
  error?: string;
}

const SECTION_COLORS = {
  header: 'bg-blue-500/20 border-blue-500',
  hero: 'bg-purple-500/20 border-purple-500',
  content: 'bg-green-500/20 border-green-500',
  sidebar: 'bg-yellow-500/20 border-yellow-500',
  footer: 'bg-gray-500/20 border-gray-500',
  navigation: 'bg-indigo-500/20 border-indigo-500',
  form: 'bg-pink-500/20 border-pink-500',
  gallery: 'bg-orange-500/20 border-orange-500',
  testimonial: 'bg-teal-500/20 border-teal-500',
  cta: 'bg-red-500/20 border-red-500',
  other: 'bg-gray-400/20 border-gray-400'
};

// Common design width suggestions
const DESIGN_WIDTH_SUGGESTIONS = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop HD', width: 1366, height: 768 },
  { name: 'Desktop FHD', width: 1920, height: 1080 },
  { name: 'Desktop 4K', width: 3840, height: 2160 }
];

export default function SplittingSuggestionsUI({
  imageFile,
  suggestions,
  onConfirm,
  onRegenerate,
  isLoading = false,
  error
}: SplittingSuggestionsUIProps) {
  const [editableSuggestions, setEditableSuggestions] = useState<SplittingSuggestion[]>(suggestions);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  const [draggedCutLine, setDraggedCutLine] = useState<number | null>(null);
  const [cutLines, setCutLines] = useState<number[]>([]);
  const [showSectionOverlay, setShowSectionOverlay] = useState<boolean>(true);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDisplayHeightRef = useRef<number>(0);

  // Helper: build pixel cut lines from suggestions (use section boundaries: top and bottom)
  const buildCutLines = (suggests: SplittingSuggestion[], dispHeight: number) => {
    if (!dispHeight || !suggests?.length) return [] as number[];
    // Collect boundaries as percentages
    const boundariesPct: number[] = [];
    suggests.forEach(s => {
      const top = s.bounds.y;
      const bottom = s.bounds.y + s.bounds.height;
      boundariesPct.push(top, bottom);
    });
    // Normalize: remove 0 and 100 and near-duplicates
    const uniquePct = boundariesPct
      .sort((a, b) => a - b)
      .reduce<number[]>((acc, p) => {
        if (acc.length === 0 || Math.abs(p - acc[acc.length - 1]) > 0.5) acc.push(p);
        return acc;
      }, []);
    // Convert to pixels
    const pixels = uniquePct.map(p => (p / 100) * dispHeight);
    // Dedupe close pixel lines
    const minGapPx = 3;
    const deduped = pixels
      .sort((a, b) => a - b)
      .reduce<number[]>((acc, y) => {
        if (acc.length === 0 || Math.abs(y - acc[acc.length - 1]) >= minGapPx) acc.push(y);
        return acc;
      }, []);
    return deduped;
  };

  // Create image URL for display
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      
      // Clean up the URL when component unmounts or imageFile changes
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      // Clear the image URL if no file
      setImageUrl(null);
    }
  }, [imageFile]);

  // Update suggestions when props change
  useEffect(() => {
    setEditableSuggestions(suggestions);
  }, [suggestions]);

  // Handle image load to get dimensions and calculate optimal display size
  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      
      setImageDimensions({ width: naturalWidth, height: naturalHeight });
      
      // Calculate optimal display dimensions to fit container while maintaining aspect ratio
      const containerWidth = containerRef.current.offsetWidth; // Use actual container width
      const containerHeight = Math.min(800, window.innerHeight * 0.6); // Max height
      
      const aspectRatio = naturalWidth / naturalHeight;
      let displayWidth = containerWidth;
      let displayHeight = displayWidth / aspectRatio;
      
      // If height exceeds container, scale by height instead
      if (displayHeight > containerHeight) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * aspectRatio;
      }
      
      // Ensure minimum size for precise editing (upscale small images)
      const minWidth = 600;
      const minHeight = 400;
      
      if (displayWidth < minWidth) {
        displayWidth = minWidth;
        displayHeight = displayWidth / aspectRatio;
      }
      
      if (displayHeight < minHeight) {
        displayHeight = minHeight;
        displayWidth = displayHeight * aspectRatio;
      }
      
      setDisplayDimensions({ width: displayWidth, height: displayHeight });
      setScaleFactor(displayWidth / naturalWidth);
      
      // Initialize cut lines from suggestions (use section boundaries)
      setCutLines(buildCutLines(editableSuggestions, displayHeight));

      // Track initial display height for later scaling
      prevDisplayHeightRef.current = displayHeight;
    }
  };

  // Rescale cut lines if display height changes (e.g., window resize or design width change)
  useEffect(() => {
    const prevH = prevDisplayHeightRef.current;
    const currH = displayDimensions.height;
    if (prevH && currH && Math.abs(currH - prevH) > 0.5) {
      const factor = currH / prevH;
      setCutLines(prev => prev.map(y => y * factor));
      prevDisplayHeightRef.current = currH;
    }
  }, [displayDimensions.height]);

  // Recompute cut lines when suggestions or display height change
  useEffect(() => {
    if (displayDimensions.height > 0) setCutLines(buildCutLines(editableSuggestions, displayDimensions.height));
  }, [editableSuggestions, displayDimensions.height]);

  // Convert percentage bounds to pixel coordinates
  const getPixelBounds = (suggestion: SplittingSuggestion, containerWidth: number, containerHeight: number) => {
    return {
      x: (suggestion.bounds.x / 100) * containerWidth,
      y: (suggestion.bounds.y / 100) * containerHeight,
      width: (suggestion.bounds.width / 100) * containerWidth,
      height: (suggestion.bounds.height / 100) * containerHeight
    };
  };

  // Remove a suggestion
  const handleRemoveSuggestion = (index: number) => {
    const newSuggestions = editableSuggestions.filter((_, i) => i !== index);
    setEditableSuggestions(newSuggestions);
  };

  // Handle cut line dragging
  const handleCutLineMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedCutLine(index);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const clampedY = Math.max(0, Math.min(y, displayDimensions.height));
        
        setCutLines(prev => {
          const newCutLines = [...prev];
          newCutLines[index] = clampedY;
          return newCutLines.sort((a, b) => a - b);
        });
      }
    };
    
    const handleMouseUp = () => {
      setDraggedCutLine(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Add new cut line
  const handleAddCutLine = (y: number) => {
    const newCutLines = [...cutLines, y].sort((a, b) => a - b);
    setCutLines(newCutLines);
  };

  // Remove cut line
  const handleRemoveCutLine = (index: number) => {
    setCutLines(prev => prev.filter((_, i) => i !== index));
  };

  // Apply design width suggestion
  const handleApplyDesignWidth = (suggestion: typeof DESIGN_WIDTH_SUGGESTIONS[0]) => {
    if (imageRef.current && containerRef.current) {
      // Preserve the original image aspect ratio to keep AI cutlines aligned
      const aspectRatio = imageDimensions.width && imageDimensions.height
        ? imageDimensions.width / imageDimensions.height
        : (imageRef.current.naturalWidth / imageRef.current.naturalHeight);
      const containerWidth = containerRef.current.offsetWidth;
      
      // Try to use the suggested width, but never exceed the container width
      let newDisplayWidth = Math.min(containerWidth, suggestion.width);
      let newDisplayHeight = newDisplayWidth / aspectRatio;
      
      // Ensure minimum size
      if (newDisplayWidth < 600) {
        newDisplayWidth = 600;
        newDisplayHeight = newDisplayWidth / aspectRatio;
      }
      
      setDisplayDimensions({ width: newDisplayWidth, height: newDisplayHeight });
      setScaleFactor(newDisplayWidth / imageDimensions.width);
    }
  };

  // Update suggestion type
  const updateSuggestionType = (index: number, newType: SplittingSuggestion['type']) => {
    setEditableSuggestions(prev => prev.map((suggestion, i) => 
      i === index ? { ...suggestion, type: newType } : suggestion
    ));
  };

  // Confirm and proceed with AI analysis
  const handleConfirm = () => {
    onConfirm(editableSuggestions);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="font-semibold text-red-900">Section Detection Failed</h3>
        </div>
        <p className="text-red-800 mb-4">{error}</p>
        <button
          onClick={onRegenerate}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Detecting Sections</h3>
          <p className="text-gray-600">
            AI is analyzing your design to suggest optimal section splits...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Review Section Splits</h2>
            <p className="text-blue-100">
              AI detected {editableSuggestions.length} sections. Review and adjust before generating HTML.
            </p>
          </div>
          <Eye className="w-8 h-8 text-blue-200" />
        </div>
      </div>

      <div className="flex">
        {/* Design Width Suggestions */}
        <div className="w-80 p-6 bg-gray-50 border-l border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Design Width Suggestions</h3>
          <div className="space-y-2 mb-6">
            {DESIGN_WIDTH_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleApplyDesignWidth(suggestion)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{suggestion.name}</div>
                <div className="text-sm text-gray-600">{suggestion.width} × {suggestion.height}</div>
              </button>
            ))}
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Current Dimensions</h4>
            <div className="text-sm text-gray-600">
              <div>Original: {imageDimensions.width} × {imageDimensions.height}</div>
              <div>Display: {Math.round(displayDimensions.width)} × {Math.round(displayDimensions.height)}</div>
              <div>Scale: {(scaleFactor * 100).toFixed(1)}%</div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <input id="overlayToggle" type="checkbox" className="accent-blue-600" checked={showSectionOverlay} onChange={() => setShowSectionOverlay(v => !v)} />
              <label htmlFor="overlayToggle" className="text-gray-700">Show section rectangles</label>
            </div>
          </div>
        </div>

        {/* Image Preview with Cut Lines */}
        <div className="flex-1 p-6">
          <div 
            ref={containerRef}
            className="relative bg-gray-50 rounded-lg overflow-hidden"
            style={{ 
              width: `${displayDimensions.width}px`, 
              height: `${displayDimensions.height}px`, 
              minHeight: displayDimensions.height ? undefined : '400px' 
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                handleAddCutLine(y);
              }
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Design preview"
              style={{
                width: displayDimensions.width,
                height: displayDimensions.height,
                maxWidth: 'none'
              }}
              className="block"
              onLoad={handleImageLoad}
            />
            {/* Section rectangles overlay */}
            {showSectionOverlay && editableSuggestions.map((s, idx) => {
              const px = getPixelBounds(s, displayDimensions.width, displayDimensions.height);
              const color = SECTION_COLORS[s.type as keyof typeof SECTION_COLORS] || SECTION_COLORS.other;
              return (
                <div
                  key={`rect-${idx}`}
                  className={`absolute border ${color} pointer-events-none`}
                  style={{
                    left: px.x,
                    top: px.y,
                    width: px.width,
                    height: px.height,
                    boxSizing: 'border-box'
                  }}
                />
              );
            })}
            
            {/* Horizontal Cut Lines */}
            {cutLines.map((y, index) => (
              <div
                key={index}
                className="absolute left-0 right-0 group cursor-ns-resize"
                style={{ top: y }}
                onMouseDown={(e) => handleCutLineMouseDown(index, e)}
              >
                {/* Cut line */}
                <div 
                  className={`w-full h-0 border-t-2 border-dashed transition-colors ${
                    draggedCutLine === index 
                      ? 'border-blue-500 bg-blue-100' 
                      : 'border-red-500 group-hover:border-red-600'
                  }`}
                />
                
                {/* Cut line label and controls */}
                <div className="absolute left-2 -top-6 bg-white px-2 py-1 rounded shadow-sm border text-xs font-medium flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Section {index + 1}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCutLine(index);
                    }}
                    className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
                
                {/* Drag handle */}
                <div className="absolute right-2 -top-2 w-4 h-4 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            ))}
            
            {/* Click instruction overlay */}
            {cutLines.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                  Click anywhere on the image to add horizontal cut lines
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions Panel */}
        <div className="w-80 border-l border-gray-200 bg-gray-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Detected Sections</h3>
            <p className="text-sm text-gray-600">
              Click on sections to edit or remove them
            </p>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {editableSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSuggestion === index 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setSelectedSuggestion(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">
                    {suggestion.type}
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSuggestion(index);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                
                <select
                  value={suggestion.type}
                  onChange={(e) => updateSuggestionType(index, e.target.value as SplittingSuggestion['type'])}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="header">Header</option>
                  <option value="hero">Hero</option>
                  <option value="content">Content</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="footer">Footer</option>
                  <option value="navigation">Navigation</option>
                  <option value="form">Form</option>
                  <option value="gallery">Gallery</option>
                  <option value="testimonial">Testimonial</option>
                  <option value="cta">Call to Action</option>
                  <option value="other">Other</option>
                </select>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <button
              onClick={onRegenerate}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Regenerate Suggestions</span>
            </button>
            
            <button
              onClick={handleConfirm}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Continue with AI Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
