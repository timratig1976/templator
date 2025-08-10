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

// Common design width suggestions
const DESIGN_WIDTH_SUGGESTIONS = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop HD', width: 1366, height: 768 },
  { name: 'Desktop FHD', width: 1920, height: 1080 },
  { name: 'Desktop 4K', width: 3840, height: 2160 }
];

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
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  const [cutLines, setCutLines] = useState<number[]>([]);
  const [draggedCutLine, setDraggedCutLine] = useState<number | null>(null);
  const [cutLineHistory, setCutLineHistory] = useState<number[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [cutLinesInitialized, setCutLinesInitialized] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Undo/Redo functionality
  const saveToHistory = (newCutLines: number[]) => {
    const newHistory = cutLineHistory.slice(0, historyIndex + 1);
    newHistory.push([...newCutLines]);
    setCutLineHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCutLines([...cutLineHistory[historyIndex - 1]]);
    }
  };

  const redo = () => {
    if (historyIndex < cutLineHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCutLines([...cutLineHistory[historyIndex + 1]]);
    }
  };

  // Initialize cut lines from AI detected sections when image is measured
  useEffect(() => {
    if (aiDetectedSections.length === 0 || cutLinesInitialized) return;
    const h = imageRef.current?.clientHeight || 0;
    if (h > 0) {
      const initialCutLines = aiDetectedSections
        .map(section => section.bounds.y + section.bounds.height)
        .filter((y, index, arr) => index === 0 || y !== arr[index - 1])
        .sort((a, b) => a - b)
        .map(y => (y / 100) * h);
      setCutLines(initialCutLines);
      saveToHistory(initialCutLines);
      setCutLinesInitialized(true);
    }
  }, [aiDetectedSections, cutLinesInitialized, imageSize]);

  // Fallback: observe image size and initialize when it becomes available
  useEffect(() => {
    if (cutLinesInitialized || aiDetectedSections.length === 0) return;
    const el = imageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (cr && cr.height > 0 && !cutLinesInitialized) {
        const initialCutLines = aiDetectedSections
          .map(section => section.bounds.y + section.bounds.height)
          .filter((y, index, arr) => index === 0 || y !== arr[index - 1])
          .sort((a, b) => a - b)
          .map(y => (y / 100) * cr.height);
        setCutLines(initialCutLines);
        saveToHistory(initialCutLines);
        setCutLinesInitialized(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aiDetectedSections, cutLinesInitialized]);

  // Load and display the image using data URL (more reliable than blob URL)
  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setImageUrl(result);
          
          // Load image to get dimensions
          const img = new Image();
          img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
          };
          img.onerror = () => {
            console.error('Failed to load image from data URL');
            setImageUrl('');
            setImageSize({ width: 0, height: 0 });
          };
          img.src = result;
        }
      };
      
      reader.onerror = () => {
        console.error('Failed to read image file');
        setImageUrl('');
        setImageSize({ width: 0, height: 0 });
      };
      
      // Read file as data URL
      reader.readAsDataURL(imageFile);
    } else {
      // Clear the image URL if no file
      setImageUrl('');
      setImageSize({ width: 0, height: 0 });
    }
  }, [imageFile]);

  // When a new image or a fresh set of AI-detected sections comes in, reset initialization state
  useEffect(() => {
    // Reset only when identity truly changes (new upload or regenerated set)
    setCutLinesInitialized(false);
    setCutLines([]);
    setCutLineHistory([]);
    setHistoryIndex(-1);
  }, [imageFile, aiDetectedSections]);

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
    
    // Reset cut lines to match AI-detected sections
    if (aiDetectedSections.length > 0) {
      const imageHeight = imageRef.current?.clientHeight || containerRef.current?.offsetHeight || 600;
      const resetCutLines = aiDetectedSections
        .map(section => section.bounds.y + section.bounds.height) // Bottom of each section
        .filter((y, index, arr) => index === 0 || y !== arr[index - 1]) // Remove duplicates
        .sort((a, b) => a - b)
        .map(y => (y / 100) * imageHeight); // Convert percentage to pixels based on rendered image
      
      setCutLines(resetCutLines);
      saveToHistory(resetCutLines);
    } else {
      // If no AI sections, clear all cut lines
      setCutLines([]);
      saveToHistory([]);
    }
  };

  // Regenerate with AI
  const regenerateWithAI = async () => {
    if (!imageFile) return;
    
    setIsRegenerating(true);
    
    try {
      // Convert image file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            // Send complete data URL (backend expects data:image/... format)
            resolve(result);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsDataURL(imageFile);
      });
      
      const base64Data = await base64Promise;
      
      // Call AI service to detect sections
      const response = await fetch('http://localhost:3009/api/ai-enhancement/detect-sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          fileName: imageFile.name
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.suggestions) {
        // Convert AI suggestions to Section format
        const newSections: Section[] = result.suggestions.map((suggestion: any, index: number) => ({
          id: `ai_section_${index + 1}`,
          name: suggestion.name || `${suggestion.type} Section`,
          type: suggestion.type,
          bounds: suggestion.bounds,
          html: '',
          editableFields: [],
          aiConfidence: suggestion.confidence || 0.8
        }));
        
        // Update sections
        setSections(newSections);
        
        // Generate new cut lines from AI suggestions
        // Get current container height dynamically
        const containerHeight = containerRef.current ? containerRef.current.offsetHeight : 
          (imageSize.width > 0 && imageSize.height > 0 
            ? Math.max(
                600, // Minimum height
                Math.min(
                  2000, // Maximum height
                  (imageSize.height / imageSize.width) * 1200 // Calculated height based on aspect ratio
                )
              )
            : 1000); // Default fallback
        
        const newCutLines = newSections
          .map(section => section.bounds.y + section.bounds.height)
          .filter((y, index, arr) => index === 0 || y !== arr[index - 1])
          .sort((a, b) => a - b)
          .map(y => (y / 100) * containerHeight);
        
        setCutLines(newCutLines);
        saveToHistory(newCutLines);
        
        console.log('AI regeneration successful:', newSections.length, 'sections detected');
      } else {
        throw new Error('AI service returned no suggestions');
      }
      
    } catch (error) {
      console.error('Failed to regenerate with AI:', error);
      alert('Failed to regenerate sections with AI. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
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
    <div className="w-full p-6">
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
              onClick={undo}
              disabled={historyIndex <= 0}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= cutLineHistory.length - 1}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4 mr-2 transform scale-x-[-1]" />
              Redo
            </button>
            <button
              onClick={regenerateWithAI}
              disabled={isRegenerating}
              className="flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4 mr-2" />
              {isRegenerating ? 'Regenerating...' : 'Regenerate with AI'}
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Canvas Area */}
        <div className="flex-1 w-full min-w-0">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full">
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
              className="relative overflow-hidden bg-gray-100 border border-gray-300 w-full"
              style={{
                width: '100%',
                minWidth: '100%',
                maxWidth: 'none',
                height: 'auto'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background Image */}
              {imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Design to analyze"
                  className="w-full h-auto block"
                  style={{
                    width: '100%',
                    height: 'auto'
                  }}
                  onClick={(e) => {
                    // Don't add new line if clicking near an existing cut line (within 10px)
                    const rect = e.currentTarget.getBoundingClientRect();
                    const imageTop = rect.top + window.scrollY;
                    const mouseY = e.pageY;
                    const y = mouseY - imageTop;
                    
                    const isNearExistingLine = cutLines.some(lineY => Math.abs(lineY - y) < 10);
                    
                    if (!isNearExistingLine && !draggedCutLine) {
                      const newCutLines = [...cutLines, y].sort((a, b) => a - b);
                      setCutLines(newCutLines);
                      saveToHistory(newCutLines);
                    }
                  }}
                />
              )}
              
              {/* Horizontal Cut Lines */}
              {cutLines.map((y, index) => (
                <div
                  key={index}
                  className="absolute left-0 right-0 group cursor-ns-resize"
                  style={{ top: y - 2 }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraggedCutLine(index);
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      if (containerRef.current) {
                        const imgEl = imageRef.current;
                        if (!imgEl) return;
                        const rect = imgEl.getBoundingClientRect();
                        const imageTop = rect.top + window.scrollY;
                        const mouseY = e.pageY; // scroll-aware
                        const newY = mouseY - imageTop;
                        const imageHeight = imgEl.clientHeight;
                        const clampedY = Math.max(0, Math.min(newY, imageHeight));
                        
                        setCutLines(prev => {
                          const newCutLines = [...prev];
                          newCutLines[index] = clampedY;
                          return newCutLines; // Don't sort during drag - allow free positioning
                        });
                      }
                    };
                    
                    const handleMouseUp = () => {
                      setDraggedCutLine(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      // Save to history after drag is complete
                      saveToHistory(cutLines);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  {/* Cut line */}
                  <div 
                    className={`w-full h-1 border-t-2 border-dashed transition-colors ${
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
                        const newCutLines = cutLines.filter((_, i) => i !== index);
                        setCutLines(newCutLines);
                        saveToHistory(newCutLines);
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
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              Confirm Sections
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

      {/* Confirm Sections Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Sections</h3>
              <p className="text-sm text-gray-600 mt-1">Please review the summary below before proceeding.</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                <span className="text-sm text-gray-600">Total Sections</span>
                <span className="text-base font-semibold text-gray-900">{sections.length}</span>
              </div>
              <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Y / H (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((s) => (
                      <tr key={s.id} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-gray-900">{s.name}</td>
                        <td className="px-3 py-2 capitalize text-gray-700">{s.type}</td>
                        <td className="px-3 py-2 text-gray-700">{Math.round(s.bounds.y)} / {Math.round(s.bounds.height)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); onSectionsConfirmed(sections); }}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
