'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Move, Edit3, Plus, Trash2, Save, RotateCcw, ArrowLeft, ArrowRight, Zap, Undo2, Redo2 } from 'lucide-react';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { createCrops, listSplitAssets, getSignedUrl } from '@/services/aiEnhancementService';
import { aiLogger } from '@/services/aiLogger';
import GenerateButton from '@/components/common/GenerateButton';

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
  html?: string;
  editableFields?: any[];
  aiConfidence?: number;
}

interface HybridLayoutSplitterProps {
  imageFile: File;
  aiDetectedSections: Section[];
  onSectionsConfirmed: (sections: Section[], splitLines?: number[]) => void;
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
  // Ensure each section has a unique id; some AI outputs may miss ids or duplicate them
  const normalizeSections = (list: Section[]) => {
    const seen = new Set<string>();
    return list.map((s, idx) => {
      let id = s.id && !seen.has(s.id) ? s.id : '';
      if (!id) id = `section_${idx}_${Date.now()}`;
      seen.add(id);
      return { ...s, id };
    });
  };

  const [sections, setSections] = useState<Section[]>(() => normalizeSections(aiDetectedSections));
  // Keep local sections in sync when props.aiDetectedSections changes (e.g., hydration or regeneration)
  useEffect(() => {
    setSections(normalizeSections(aiDetectedSections));
  }, [aiDetectedSections]);

  // Convert bounds to percent units based on rendered image size.
  // If values are normalized (0..1), multiply by 100. If pixels (>1), convert relative to image size.
  const toPercentBounds = (
    bounds: { x: number; y: number; width: number; height: number },
    imgWidth: number,
    imgHeight: number
  ) => {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const clampPct = (v: number) => Math.max(0, Math.min(100, v));
    const { x, y, width, height } = bounds;
    const xIsNorm = x <= 1 && width <= 1;
    const yIsNorm = y <= 1 && height <= 1;
    const pxToPctX = imgWidth > 0 ? (v: number) => (v / imgWidth) * 100 : (_: number) => 0;
    const pxToPctY = imgHeight > 0 ? (v: number) => (v / imgHeight) * 100 : (_: number) => 0;
    const xp = xIsNorm ? clampPct(clamp01(x) * 100) : clampPct(pxToPctX(x));
    const yp = yIsNorm ? clampPct(clamp01(y) * 100) : clampPct(pxToPctY(y));
    const wp = xIsNorm ? clampPct(clamp01(width) * 100) : clampPct(pxToPctX(width));
    const hp = yIsNorm ? clampPct(clamp01(height) * 100) : clampPct(pxToPctY(height));
    return { x: xp, y: yp, width: wp, height: hp };
  };

  // Normalize cut lines: clamp, sort, dedupe
  const normalizeCutLines = (lines: number[], imgHeight: number) => {
    const eps = 0.5;
    const clamped = lines
      .map((y) => Math.max(0, Math.min(imgHeight, Math.round(y))))
      .filter((y) => y > eps && y < imgHeight - eps)
      .sort((a, b) => a - b);
    const unique: number[] = [];
    for (const y of clamped) {
      if (unique.length === 0 || Math.abs(y - unique[unique.length - 1]) > eps) unique.push(y);
    }
    return unique;
  };
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
  // Removed preview feature for a more compact UI
  const [cutLinesInitialized, setCutLinesInitialized] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [creatingCrops, setCreatingCrops] = useState(false);
  const { hybridAnalysisResult } = useWorkflow();
  const [generatedPreviewUrls, setGeneratedPreviewUrls] = useState<string[]>([]);
  const [canContinueAfterGen, setCanContinueAfterGen] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; kind: 'success' | 'error' } | null>(null);
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Initial snapshots for diff
  const initialSectionsRef = useRef<Section[] | null>(null);
  const initialCutLinesRef = useRef<number[] | null>(null);

  // Diff details for modal
  type SectionDiff = {
    typeChanged: Array<{ index: number; from: string; to: string }>;
    nameChanged: Array<{ index: number; from: string; to: string }>;
    countChanged?: { from: number; to: number } | null;
    movedCutLines: number;
  };
  const [pendingDiff, setPendingDiff] = useState<SectionDiff | null>(null);

  // Initialize initial snapshots the first time both sections and cutLines are ready
  useEffect(() => {
    const ih = imageRef.current?.clientHeight || 0;
    if (initialSectionsRef.current == null && sections.length > 0) {
      initialSectionsRef.current = JSON.parse(JSON.stringify(sections));
    }
    if (initialCutLinesRef.current == null && ih > 0) {
      initialCutLinesRef.current = [...cutLines];
    }
  }, [sections, cutLines]);

  // Compute a diff between initial and current state
  const computeDiff = (): SectionDiff | null => {
    const ih = imageRef.current?.clientHeight || 0;
    const initialSections = initialSectionsRef.current;
    const initialCuts = initialCutLinesRef.current;
    if (!initialSections || ih <= 0) return null; // not ready yet

    const current = sections;
    const diff: SectionDiff = {
      typeChanged: [],
      nameChanged: [],
      countChanged: null,
      movedCutLines: 0,
    };

    if (initialSections.length !== current.length) {
      diff.countChanged = { from: initialSections.length, to: current.length };
    }
    const minLen = Math.min(initialSections.length, current.length);
    for (let i = 0; i < minLen; i++) {
      if (initialSections[i].type !== current[i].type) {
        diff.typeChanged.push({ index: i, from: initialSections[i].type, to: current[i].type });
      }
      if ((initialSections[i].name || '') !== (current[i].name || '')) {
        diff.nameChanged.push({ index: i, from: initialSections[i].name, to: current[i].name });
      }
    }
    if (initialCuts) {
      const eps = 1;
      const a = initialCuts;
      const b = cutLines;
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        const av = a[i];
        const bv = b[i];
        if (av == null || bv == null) diff.movedCutLines += 1; else if (Math.abs(av - bv) > eps) diff.movedCutLines += 1;
      }
    }
    return diff;
  };

  // Handle Next: skip modal if no changes; otherwise show modal with details
  const handleNext = () => {
    const diff = computeDiff();
    if (!diff) {
      // Baseline not ready (e.g., initial refs or image height not resolved yet)
      // Treat as unchanged and proceed to keep UX smooth
      onSectionsConfirmed(sections, cutLines);
      return;
    }
    const noCount = !diff.countChanged;
    const noType = diff.typeChanged.length === 0;
    const noName = diff.nameChanged.length === 0;
    const noMoves = diff.movedCutLines === 0;
    const unchanged = noCount && noType && noName && noMoves;
    if (unchanged) {
      onSectionsConfirmed(sections, cutLines);
    } else {
      setPendingDiff(diff);
      setShowConfirmModal(true);
    }
  };
  
  // Compute initial cut lines from sections given image height.
  // Default assumption: bounds are in pixels.
  // If both y and height are <= 1, treat as normalized 0..1.
  // If many sections have small values (<= 100) but not normalized, infer percentage (0..100).
  const computeInitialCutLinesFromSections = (sections: Section[], imgHeight: number) => {
    if (!sections?.length || imgHeight <= 0) return [] as number[];
    // Heuristic: check if the majority look like percentages
    const smallCount = sections.filter(s => (s.bounds?.y ?? 0) <= 100 && (s.bounds?.height ?? 0) <= 100).length;
    const normalizedCount = sections.filter(s => (s.bounds?.y ?? 0) <= 1 && (s.bounds?.height ?? 0) <= 1).length;
    const assumePercent = normalizedCount === 0 && smallCount >= Math.ceil(sections.length * 0.6);

    const raw = sections.map(s => {
      const by = Number(s.bounds?.y ?? 0);
      const bh = Number(s.bounds?.height ?? 0);
      // Only handle normalized 0..1. Do NOT assume percent; many real px heights are < 100.
      const isNormalized = by >= 0 && by <= 1 && bh >= 0 && bh <= 1;
      let endY = by + bh;
      if (isNormalized) endY = (by + bh) * imgHeight;
      else if (assumePercent) endY = ((by + bh) / 100) * imgHeight;
      return endY;
    });
    // Clamp to (0, imgHeight) and dedupe with epsilon to avoid collapsing nearly-identical values
    const eps = 0.25; // quarter pixel tolerance
    const arr = raw
      .map(y => Math.max(0, Math.min(imgHeight, y)))
      .filter(y => y > 0 + eps && y < imgHeight - eps)
      .sort((a, b) => a - b);
    const unique: number[] = [];
    for (const y of arr) {
      if (unique.length === 0 || Math.abs(y - unique[unique.length - 1]) > eps) {
        unique.push(y);
      }
    }
    return unique;
  };

  // Keep sections list synchronized with cut lines (each band between lines is a section)
  const syncSectionsWithCutLines = (imageHeight: number) => {
    const sorted = [...cutLines].filter(v => v >= 0 && v <= imageHeight).sort((a,b) => a-b);
    const edges = [0, ...sorted, imageHeight];
    const newCount = Math.max(0, edges.length - 1);

    setSections(prev => {
      const next: Section[] = [];
      for (let i = 0; i < newCount; i++) {
        const y = Math.round(edges[i]);
        const h = Math.max(1, Math.round(edges[i+1] - edges[i]));
        const existing = prev[i];
        if (existing) {
          next.push({
            ...existing,
            name: existing.name || `Section ${i + 1}`,
            bounds: { ...existing.bounds, y, height: h },
          });
        } else {
          next.push({
            id: `section_${i}_${Date.now()}`,
            name: `Section ${i + 1}`,
            type: 'content',
            bounds: { x: 0, y, width: imageDimensions.width || 0, height: h },
            html: '',
            editableFields: [],
            aiConfidence: 0,
          });
        }
      }
      return next;
    });
  };

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
      const initialCutLines = computeInitialCutLinesFromSections(aiDetectedSections, h);
      setCutLines(initialCutLines);
      saveToHistory(initialCutLines);
      setCutLinesInitialized(true);
      // Also ensure sections reflect these lines
      syncSectionsWithCutLines(h);
    }
  }, [aiDetectedSections, cutLinesInitialized]);

  // Observe image size to initialize cut lines as soon as height becomes available
  useEffect(() => {
    if (cutLinesInitialized) return;
    const imgEl = imageRef.current;
    if (!imgEl) return; // Will re-run when imageUrl changes and ref mounts
    const ro = new ResizeObserver(() => {
      const h = imgEl.clientHeight || 0;
      if (h > 0 && aiDetectedSections.length > 0 && !cutLinesInitialized) {
        const initial = computeInitialCutLinesFromSections(aiDetectedSections, h);
        setCutLines(initial);
        saveToHistory(initial);
        setCutLinesInitialized(true);
        syncSectionsWithCutLines(h);
      }
    });
    ro.observe(imgEl);
    return () => ro.disconnect();
  }, [aiDetectedSections, cutLinesInitialized, imageUrl]);

  // After initialization, keep sections in sync if the rendered image height changes (e.g., container resize)
  useEffect(() => {
    if (!cutLinesInitialized) return;
    const imgEl = imageRef.current;
    if (!imgEl) return;
    const ro = new ResizeObserver(() => {
      const h = imgEl.clientHeight || 0;
      if (h > 0 && cutLines.length > 0) {
        syncSectionsWithCutLines(h);
      }
    });
    ro.observe(imgEl);
    return () => ro.disconnect();
  }, [cutLinesInitialized, cutLines]);

  // Sync sections whenever cut lines change and image height is known
  useEffect(() => {
    const h = imageRef.current?.clientHeight || 0;
    if (h > 0) {
      syncSectionsWithCutLines(h);
    }
  }, [cutLines]);


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
            // Set original image dimensions (for backend crop generation)
            setImageDimensions({ width: img.width, height: img.height });
            console.log('🖼️ Original image dimensions:', { width: img.width, height: img.height });
          };
          img.onerror = () => {
            console.error('Failed to load image from data URL');
            setImageUrl('');
            setImageDimensions({ width: 0, height: 0 });
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
  // Guard: do NOT run on first mount to avoid wiping initial init due to effect ordering
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
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
  const handleMouseUp = (event: React.MouseEvent) => {
    setIsDragging(false);
    setSelectedSection(null);
  };

  // Add new section by inserting a new cut line at the midpoint of the largest band
  const addNewSection = () => {
    const ih = imageRef.current?.clientHeight || imageSize.height || 0;
    if (ih <= 0) return;

    const sorted = [...cutLines].filter(v => v > 0 && v < ih).sort((a,b) => a-b);
    const edges = [0, ...sorted, ih];

    let maxGap = -1;
    let maxIdx = 0;
    for (let i = 0; i < edges.length - 1; i++) {
      const gap = edges[i+1] - edges[i];
      if (gap > maxGap) {
        maxGap = gap;
        maxIdx = i;
      }
    }
    const y0 = edges[maxIdx];
    const y1 = edges[maxIdx + 1];
    const mid = Math.round(y0 + (y1 - y0) / 2);

    const nextCutLines = normalizeCutLines([...cutLines, mid], ih);
    setCutLines(nextCutLines);
    saveToHistory(nextCutLines);

    // Build next sections immediately and select the new (lower) split band
    const sorted2 = [...nextCutLines].filter(v => v >= 0 && v <= ih).sort((a,b) => a-b);
    const edges2 = [0, ...sorted2, ih];
    const newCount = Math.max(0, edges2.length - 1);
    const nextSections: Section[] = [];
    for (let i = 0; i < newCount; i++) {
      const yb = Math.round(edges2[i]);
      const hb = Math.max(1, Math.round(edges2[i+1] - edges2[i]));
      const existing = sections[i];
      if (existing) {
        nextSections.push({
          ...existing,
          name: existing.name || `Section ${i + 1}`,
          bounds: { ...existing.bounds, y: yb, height: hb },
        });
      } else {
        nextSections.push({
          id: `section_${i}_${Date.now()}`,
          name: `Section ${i + 1}`,
          type: 'content',
          bounds: { x: 0, y: yb, width: imageDimensions.width || 0, height: hb },
          html: '',
          editableFields: [],
          aiConfidence: 0,
        });
      }
    }
    setSections(nextSections);
    const selectIdx = Math.min(maxIdx + 1, nextSections.length - 1);
    if (selectIdx >= 0) setSelectedSection(nextSections[selectIdx].id);
  };

  // Delete a section by removing the nearest separating cut line
  const deleteSection = (sectionId: string) => {
    const ih = imageRef.current?.clientHeight || imageSize.height || 0;
    if (ih <= 0) return;

    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;

    // Sections map to bands between edges = [0, ...cutLines, ih]
    // For section idx, prefer removing its lower edge cut line cutLines[idx] when possible,
    // otherwise remove the upper one cutLines[idx-1]. If no cut lines, nothing to remove.
    if (cutLines.length === 0) return;

    let removeIndex = idx < cutLines.length ? idx : cutLines.length - 1;
    if (removeIndex < 0) return;

    const next = cutLines.filter((_, i) => i !== removeIndex);
    const normalized = normalizeCutLines(next, ih);
    setCutLines(normalized);
    saveToHistory(normalized);
    syncSectionsWithCutLines(ih);

    // Clear selection if the deleted section was selected
    if (selectedSection === sectionId) setSelectedSection(null);
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
    setSections(normalizeSections(aiDetectedSections));
    setSelectedSection(null);
    
    // Reset cut lines to match AI-detected sections
    if (aiDetectedSections.length > 0) {
      const imageHeight = imageRef.current?.clientHeight || containerRef.current?.offsetHeight || 600;
      const resetCutLines = computeInitialCutLinesFromSections(aiDetectedSections, imageHeight);
      
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
        
        // Generate new cut lines from AI suggestions using the RENDERED IMAGE HEIGHT
        // This ensures first-load and regenerate behaviors match exactly.
        let imgHeight = imageRef.current?.clientHeight || 0;
        if (imgHeight <= 0) {
          // Fallback to natural size if not yet rendered; will be re-synced by effects
          imgHeight = imageSize.height || 0;
        }
        const newCutLines = computeInitialCutLinesFromSections(newSections, imgHeight);
        
        setCutLines(newCutLines);
        saveToHistory(newCutLines);
        if (imgHeight > 0) {
          syncSectionsWithCutLines(imgHeight);
        }
        
        console.log('AI regeneration successful:', newSections.length, 'sections detected');
      } else {
        throw new Error('AI service returned no suggestions');
      }
      
    } catch (error) {
      console.error('Failed to regenerate with AI:', error);
      setToast({ visible: true, message: 'Failed to regenerate sections', kind: 'error' });
      setTimeout(() => setToast(null), 3000);
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
    <div className="w-full p-4">
      {/* Compact top toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-9 w-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <GenerateButton onClick={regenerateWithAI} loading={isRegenerating} />
          <button
            onClick={redo}
            disabled={historyIndex >= cutLineHistory.length - 1}
            className="h-9 w-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={resetToAISuggestions}
            className="h-9 w-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center"
            title="Revert to AI suggestions"
            aria-label="Revert to AI suggestions"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const splitId = hybridAnalysisResult?.splitId;
              if (splitId) {
                router.push(`/split-assets?splitId=${encodeURIComponent(String(splitId))}`);
              }
            }}
            disabled={!hybridAnalysisResult?.splitId}
            className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title={hybridAnalysisResult?.splitId ? 'Manage Parts' : 'No split id yet'}
            aria-label="Manage Parts"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Main Canvas Area */}
        <div className="w-full min-w-0 lg:col-span-3">
          <div className="bg-white rounded-lg shadow w-full">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">{sections.length} sections</div>
                <button
                  onClick={addNewSection}
                  className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                  title="Add section"
                  aria-label="Add section"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </button>
              </div>
            </div>
            
            <div 
              ref={containerRef}
              className="relative overflow-hidden bg-gray-100 border border-gray-300 w-full"
              style={{
                width: '100%',
                minWidth: '100%',
                maxWidth: 'none',
                height: (imageRef.current?.clientHeight || 'auto') as number | 'auto'
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
                      const ih = imageRef.current?.clientHeight || 0;
                      const normalized = normalizeCutLines([...cutLines, y], ih || Number.MAX_SAFE_INTEGER);
                      setCutLines(normalized);
                      saveToHistory(normalized);
                      if (ih > 0) syncSectionsWithCutLines(ih);
                    }
                  }}
                />
              )}
              
              {/* Section bands (visual identification between cut lines) */}
              {(() => {
                const imgEl = imageRef.current;
                const height = imgEl?.clientHeight || 0;
                const sorted = [...cutLines].filter(v => v >= 0 && v <= height).sort((a,b) => a-b);
                const edges = [0, ...sorted, height];
                return edges.slice(0, Math.max(0, edges.length - 1)).map((top, i) => {
                  const bottom = edges[i+1];
                  const h = Math.max(0, bottom - top);
                  const alt = i % 2 === 0;
                  return (
                    <div key={`band-${i}`} className={`absolute left-0 right-0 pointer-events-none ${alt ? 'bg-yellow-50/40' : 'bg-blue-50/40'} z-10`} style={{ top, height: h }}>
                      <div className="absolute left-2 top-2 text-[11px] px-2 py-0.5 rounded bg-black/50 text-white">
                        {sections[i]?.name || `Section ${i + 1}`}: {Math.round(top)}px → {Math.round(bottom)}px
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Horizontal Cut Lines */}
              {cutLines.map((y, index) => (
                <div
                  key={index}
                  className="absolute left-0 right-0 group cursor-ns-resize z-20"
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
                      // Normalize, save, and sync after drag is complete
                      if (imageRef.current) {
                        const ih = imageRef.current.clientHeight;
                        setCutLines((prev) => {
                          const normalized = normalizeCutLines(prev, ih || Number.MAX_SAFE_INTEGER);
                          saveToHistory(normalized);
                          syncSectionsWithCutLines(ih);
                          return normalized;
                        });
                      }
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
                  <div className="absolute left-2 -top-6 bg-white px-2 py-1 rounded shadow-sm border text-xs font-medium flex items-center gap-2 opacity-95 group-hover:opacity-100 transition-opacity z-30">
                    <span>
                      {(() => {
                        // Show both above and below section names so the first split line displays the header name.
                        const above = sections[index];
                        const below = sections[index + 1];
                        const aboveName = above?.name || `Section ${index + 1}`;
                        const belowName = below?.name || `Section ${index + 2}`;
                        // Prefer showing both; if one side is missing, show the other.
                        return `${aboveName} ⇵ ${belowName}`;
                      })()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ih = imageRef.current?.clientHeight || 0;
                        const filtered = cutLines.filter((_, i) => i !== index);
                        const normalized = normalizeCutLines(filtered, ih || Number.MAX_SAFE_INTEGER);
                        setCutLines(normalized);
                        saveToHistory(normalized);
                        if (ih > 0) syncSectionsWithCutLines(ih);
                      }}
                      className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-30"
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Drag handle */}
                  <div className="absolute right-2 -top-2 w-4 h-4 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
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
        <div className="space-y-6 lg:col-span-1">
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
                      <p className="text-xs text-gray-600 capitalize">{section.type} • y: {Math.round(section.bounds.y)}px, h: {Math.round(section.bounds.height)}px</p>
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

          {/* Spacer for bottom toolbar */}
          <div className="h-16" />
        </div>
      </div>

      {/* Bottom navigation toolbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur px-3 py-2 rounded-full shadow border">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700"
            aria-label="Next step"
            title="Next step"
          >
            <span className="text-sm">Next step</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

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
                    {sections.map((s) => {
                      const ih = imageRef.current?.clientHeight || imageSize.height || 0;
                      const iw = imageRef.current?.clientWidth || imageSize.width || 0;
                      const pct = toPercentBounds(s.bounds, iw, ih);
                      return (
                        <tr key={s.id} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{s.name}</td>
                          <td className="px-3 py-2 capitalize text-gray-700">{s.type}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {`${Math.round(s.bounds.y)}px (${Math.round(pct.y)}%) / ${Math.round(s.bounds.height)}px (${Math.round(pct.height)}%)`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {generatedPreviewUrls.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-900 mt-2 mb-2">Generated Previews</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generatedPreviewUrls.map((url, idx) => (
                      <div key={idx} className="border border-gray-200 rounded overflow-hidden bg-gray-50">
                        <img src={url} alt={`Section ${idx + 1}`} className="w-full h-24 object-contain bg-white" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                disabled={creatingCrops}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // If already generated, continue without regenerating
                  if (canContinueAfterGen) {
                    setShowConfirmModal(false);
                    onSectionsConfirmed(sections, cutLines);
                    return;
                  }
                  try {
                    setCreatingCrops(true);
                    setGeneratedPreviewUrls([]);
                    setCanContinueAfterGen(false);
                    const splitId = hybridAnalysisResult?.splitId;
                    if (splitId) {
                      aiLogger.logFlowStep('processing', 'Creating crops from confirmed sections', 'start', { splitId, count: sections.length });
                      const ih = imageRef.current?.clientHeight || imageSize.height || 0;
                      const iw = imageRef.current?.clientWidth || imageSize.width || 0;
                      const inputs = sections.map((s, i) => {
                        const pct = toPercentBounds(s.bounds, iw, ih);
                        return {
                          id: s.id,
                          index: i,
                          unit: 'percent' as const,
                          bounds: pct,
                        };
                      });
                      await createCrops(String(splitId), inputs, { force: true });
                      aiLogger.logFlowStep('processing', 'Crops created successfully', 'complete', { splitId });

                      // Load generated assets and sign URLs for preview
                      try {
                        console.log('🔍 Loading split assets for preview generation...', { splitId });
                        const assetsRes = await listSplitAssets(String(splitId), 'image-crop');
                        console.log('📊 Assets response:', assetsRes);
                        
                        const assets = assetsRes?.data?.assets || [];
                        console.log(`📦 Found ${assets.length} assets:`, assets);
                        
                        const urls: string[] = [];
                        for (const a of assets) {
                          const key = a?.meta?.key || a?.key;
                          console.log('🔑 Processing asset key:', { key, asset: a });
                          
                          if (!key) {
                            console.warn('⚠️ Asset missing key:', a);
                            continue;
                          }
                          
                          try {
                            const signed = await getSignedUrl(key, 5 * 60 * 1000);
                            console.log('✍️ Signed URL response:', { key, signed });
                            
                            if (signed?.data?.url) {
                              urls.push(signed.data.url);
                              console.log('✅ Added URL to previews:', signed.data.url);
                            } else {
                              console.warn('⚠️ No URL in signed response:', signed);
                            }
                          } catch (signError) {
                            console.error('❌ Failed to sign URL for key:', key, signError);
                          }
                        }
                        
                        console.log(`🎯 Final preview URLs (${urls.length}):`, urls);
                        setGeneratedPreviewUrls(urls);
                        
                        if (urls.length > 0) {
                          setToast({ visible: true, message: `Generated ${urls.length} parts successfully`, kind: 'success' });
                        } else {
                          setToast({ visible: true, message: 'Generated crops but no preview URLs available', kind: 'error' });
                        }
                        setTimeout(() => setToast(null), 3000);
                      } catch (e) {
                        console.error('❌ Failed to load preview assets:', e);
                        aiLogger.error('processing', 'Failed to load preview assets', { error: String(e), splitId });
                        setToast({ visible: true, message: 'Failed to load section previews', kind: 'error' });
                        setTimeout(() => setToast(null), 3000);
                      }
                      setCanContinueAfterGen(true);
                    } else {
                      aiLogger.logFlowStep('processing', 'Skipping crop creation (no splitId)', 'complete');
                      setToast({ visible: true, message: 'No split id found. Skipped part generation.', kind: 'error' });
                      setTimeout(() => setToast(null), 3000);
                    }
                  } catch (err) {
                    console.error('Crop creation during confirm failed:', err);
                    aiLogger.error('processing', 'Crop creation during confirm failed', { error: String(err) });
                    setToast({ visible: true, message: 'Failed to generate parts', kind: 'error' });
                    setTimeout(() => setToast(null), 3000);
                  } finally {
                    setCreatingCrops(false);
                    // Keep modal open; allow user to review previews, then continue
                  }
                }}
                className={`px-4 py-2 rounded text-white ${creatingCrops ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                disabled={creatingCrops}
              >
                {creatingCrops ? 'Generating parts…' : (canContinueAfterGen ? 'Continue' : 'Confirm & Generate')}
              </button>

            </div>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast?.visible && (
        <div className={`fixed bottom-4 right-4 z-[60] px-4 py-3 rounded shadow-lg text-white ${toast.kind === 'success' ? 'bg-green-600' : 'bg-red-600'}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
