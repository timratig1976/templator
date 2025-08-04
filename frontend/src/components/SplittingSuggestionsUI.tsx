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
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Create image URL for display
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  // Update suggestions when props change
  useEffect(() => {
    setEditableSuggestions(suggestions);
  }, [suggestions]);

  // Handle image load to get dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  };

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
  const removeSuggestion = (index: number) => {
    setEditableSuggestions(prev => prev.filter((_, i) => i !== index));
    setSelectedSuggestion(null);
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
        {/* Image Preview with Overlays */}
        <div className="flex-1 p-6">
          <div className="relative bg-gray-50 rounded-lg overflow-hidden">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Design preview"
              className="w-full h-auto"
              onLoad={handleImageLoad}
            />
            
            {/* Section Overlays */}
            {imageRef.current && editableSuggestions.map((suggestion, index) => {
              const containerRect = imageRef.current!.getBoundingClientRect();
              const pixelBounds = getPixelBounds(
                suggestion, 
                imageRef.current!.offsetWidth, 
                imageRef.current!.offsetHeight
              );
              
              return (
                <div
                  key={index}
                  className={`absolute border-2 cursor-pointer transition-all ${
                    SECTION_COLORS[suggestion.type]
                  } ${selectedSuggestion === index ? 'ring-2 ring-blue-500' : ''}`}
                  style={{
                    left: `${pixelBounds.x}px`,
                    top: `${pixelBounds.y}px`,
                    width: `${pixelBounds.width}px`,
                    height: `${pixelBounds.height}px`
                  }}
                  onClick={() => setSelectedSuggestion(index)}
                >
                  <div className="absolute -top-6 left-0 bg-white rounded px-2 py-1 text-xs font-medium shadow-sm border">
                    {suggestion.type} ({Math.round(suggestion.confidence * 100)}%)
                  </div>
                </div>
              );
            })}
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
                        removeSuggestion(index);
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
