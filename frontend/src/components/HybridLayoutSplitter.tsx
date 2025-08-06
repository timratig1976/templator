'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Move, Edit3, Plus, Trash2, Eye, Save, RotateCcw, Zap } from 'lucide-react';

interface Section {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  html: string;
  editableFields: any[];
  aiConfidence: number;
}

interface HybridLayoutSplitterProps {
  imageFile: File;
  aiDetectedSections: Section[];
  onSectionsConfirmed: (sections: Section[]) => void;
  onBack: () => void;
  enhancedAnalysis?: {
    recommendations: {
      suggestedAdjustments: string[];
      qualityScore: number;
      improvementTips: string[];
    };
    detectionMetrics: {
      averageConfidence: number;
      processingTime: number;
    };
  };
}

export default function HybridLayoutSplitter({ 
  imageFile, 
  aiDetectedSections, 
  onSectionsConfirmed, 
  onBack 
}: HybridLayoutSplitterProps) {
  const [sections, setSections] = useState<Section[]>(aiDetectedSections);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showPreview, setShowPreview] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load and display the image
  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = url;
    
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Handle section selection
  const handleSectionClick = (sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedSection(selectedSection === sectionId ? null : sectionId);
  };

  // Handle section dragging
  const handleMouseDown = (sectionId: string, event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left mouse button
    
    setSelectedSection(sectionId);
    setIsDragging(true);
    setDragStart({
      x: event.clientX,
      y: event.clientY
    });
    
    event.preventDefault();
  };

  // Handle mouse move for dragging
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !selectedSection) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    setSections(prev => prev.map(section => 
      section.id === selectedSection 
        ? {
            ...section,
            bounds: {
              ...section.bounds,
              x: Math.max(0, section.bounds.x + deltaX),
              y: Math.max(0, section.bounds.y + deltaY)
            }
          }
        : section
    ));
    
    setDragStart({
      x: event.clientX,
      y: event.clientY
    });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Add new section
  const addNewSection = () => {
    const newSection: Section = {
      id: `section_${Date.now()}`,
      name: 'New Section',
      type: 'content',
      bounds: {
        x: 50,
        y: 50,
        width: 200,
        height: 150
      },
      html: '<div class="p-4"><h2>New Section</h2><p>Content goes here</p></div>',
      editableFields: [],
      aiConfidence: 0 // User-created section
    };
    
    setSections(prev => [...prev, newSection]);
    setSelectedSection(newSection.id);
  };

  // Delete section
  const deleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    if (selectedSection === sectionId) {
      setSelectedSection(null);
    }
  };

  // Update section properties
  const updateSection = (sectionId: string, updates: Partial<Section>) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, ...updates }
        : section
    ));
  };

  // Reset to AI suggestions
  const resetToAISuggestions = () => {
    setSections(aiDetectedSections);
    setSelectedSection(null);
  };

  // Get section type color
  const getSectionTypeColor = (type: string) => {
    const colors = {
      header: 'bg-blue-500/20 border-blue-500',
      hero: 'bg-purple-500/20 border-purple-500',
      content: 'bg-green-500/20 border-green-500',
      footer: 'bg-gray-500/20 border-gray-500',
      sidebar: 'bg-yellow-500/20 border-yellow-500',
      navigation: 'bg-red-500/20 border-red-500'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500/20 border-gray-500';
  };

  // Get AI confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              🤖 + 👤 Hybrid Layout Splitting
            </h2>
            <p className="text-gray-600 mt-1">
              AI detected {aiDetectedSections.length} sections. Review, adjust, and refine before generating HTML.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button
              onClick={resetToAISuggestions}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to AI
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Canvas Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Interactive Layout Editor</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {sections.length} sections
                  </span>
                  <button
                    onClick={addNewSection}
                    className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Section
                  </button>
                </div>
              </div>
            </div>
            
            <div 
              ref={containerRef}
              className="relative overflow-auto bg-gray-100"
              style={{ height: '600px' }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background Image */}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Design to analyze"
                  className="absolute top-0 left-0 max-w-none"
                  style={{ 
                    width: 'auto',
                    height: '100%',
                    opacity: 0.7
                  }}
                />
              )}
              
              {/* Section Overlays */}
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={`
                    absolute border-4 cursor-move transition-all duration-200 hover:opacity-80
                    ${getSectionTypeColor(section.type)}
                    ${selectedSection === section.id ? 'ring-4 ring-blue-400 ring-offset-2 opacity-60' : 'opacity-40'}
                  `}
                  style={{
                    left: `${section.bounds.x}%`,
                    top: `${section.bounds.y}%`,
                    width: `${section.bounds.width}%`,
                    height: `${section.bounds.height}%`,
                  }}
                  onClick={(e) => handleSectionClick(section.id, e)}
                  onMouseDown={(e) => handleMouseDown(section.id, e)}
                >
                  {/* Section Label */}
                  <div className="absolute -top-6 left-0 bg-white px-2 py-1 rounded text-xs font-medium shadow-sm border">
                    <div className="flex items-center space-x-1">
                      <span>{section.name}</span>
                      {section.aiConfidence > 0 && (
                        <span className={`${getConfidenceColor(section.aiConfidence)}`}>
                          ({Math.round(section.aiConfidence * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Resize Handles */}
                  {selectedSection === section.id && (
                    <>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize"></div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize"></div>
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize"></div>
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize"></div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Section List */}
          <div className="bg-white rounded-lg shadow-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Detected Sections</h3>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedSection === section.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{section.name}</span>
                        {section.aiConfidence > 0 && (
                          <span className={`text-xs ${getConfidenceColor(section.aiConfidence)}`}>
                            AI: {Math.round(section.aiConfidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 capitalize">{section.type}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSection(section.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section Properties */}
          {selectedSection && (
            <div className="bg-white rounded-lg shadow-lg">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Section Properties</h3>
              </div>
              <div className="p-4 space-y-4">
                {(() => {
                  const section = sections.find(s => s.id === selectedSection);
                  if (!section) return null;
                  
                  return (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Section Name
                        </label>
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => updateSection(section.id, { name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Section Type
                        </label>
                        <select
                          value={section.type}
                          onChange={(e) => updateSection(section.id, { type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="header">Header</option>
                          <option value="hero">Hero</option>
                          <option value="content">Content</option>
                          <option value="footer">Footer</option>
                          <option value="sidebar">Sidebar</option>
                          <option value="navigation">Navigation</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Width
                          </label>
                          <input
                            type="number"
                            value={section.bounds.width}
                            onChange={(e) => updateSection(section.id, { 
                              bounds: { ...section.bounds, width: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Height
                          </label>
                          <input
                            type="number"
                            value={section.bounds.height}
                            onChange={(e) => updateSection(section.id, { 
                              bounds: { ...section.bounds, height: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                      
                      {section.aiConfidence > 0 && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">AI Analysis</span>
                          </div>
                          <p className="text-sm text-blue-800 mt-1">
                            Confidence: <span className={getConfidenceColor(section.aiConfidence)}>
                              {Math.round(section.aiConfidence * 100)}%
                            </span>
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            This section was automatically detected by AI. You can adjust its position, size, and properties.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => onSectionsConfirmed(sections)}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              Confirm Sections & Generate HTML
            </button>
            
            <button
              onClick={onBack}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Upload
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Section Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-96">
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{section.name}</h4>
                      <span className="text-sm text-gray-600 capitalize">{section.type}</span>
                    </div>
                    <div 
                      className="bg-gray-50 p-3 rounded text-sm font-mono text-gray-800 overflow-auto"
                      style={{ maxHeight: '150px' }}
                    >
                      {section.html}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
