'use client';

import { useState, useEffect } from 'react';
import { 
  PlayIcon, 
  DocumentDuplicateIcon, 
  DocumentTextIcon, 
  ArrowsRightLeftIcon, 
  BeakerIcon, 
  Cog6ToothIcon,
  EyeIcon,
  CheckCircleIcon,
  CheckIcon,
  XMarkIcon,
  FolderIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import PromptEditor from '@/components/admin/PromptEditor';
import StaticFileManager from '@/components/admin/StaticFileManager';
import SplitSimulationPanel from '@/components/admin/SplitSimulationPanel';
import HybridLayoutSplitter from '@/components/HybridLayoutSplitter';
import PromptVersionManager from '@/components/admin/PromptVersionManager';
import { WorkflowProvider } from '@/contexts/WorkflowContext';

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

export default function SplitDetectionPage() {
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activePromptContent, setActivePromptContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [promptVersions, setPromptVersions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'comparison' | 'results' | 'telemetry' | 'debug' | 'validation'>('editor');
  // Telemetry state: recent runs and aggregate metrics
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [aggregateMetrics, setAggregateMetrics] = useState<any | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  
  // Load active prompt and versions on mount
  useEffect(() => {
    (async () => {
      await Promise.all([loadCurrentPrompt(), loadPromptVersions(), loadRuns(), loadMetrics()]);
    })();
  }, []);
  
  // Helper: format processing time reliably without double suffixes
  const formatProcessingTime = (value?: number | string | null): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // If already has units, return as-is
      if (/\b(ms|s)\b$/i.test(trimmed)) return trimmed;
      const asNum = Number(trimmed);
      if (Number.isFinite(asNum)) return asNum < 1000 ? `${Math.round(asNum)}ms` : `${(asNum / 1000).toFixed(2)}s`;
      return trimmed; // unknown format, show raw
    }
    // numeric
    return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
  };

  // Map backend run rows to TestResult shape used by AI Logs/Debug panel
  const mapRunRowToTestResult = (row: any): TestResult => {
    return {
      id: row?.id || String(row?.timestamp || row?.createdAt || Date.now()),
      timestamp: row?.createdAt || row?.timestamp || new Date().toISOString(),
      fileName: row?.input?.fileName || row?.fileName || 'unknown',
      sectionsDetected: (row?.metrics && typeof row.metrics.sectionsDetected === 'number')
        ? row.metrics.sectionsDetected
        : (Array.isArray(row?.output?.sections) ? row.output.sections.length : 0),
      averageConfidence: (row?.metrics && typeof row.metrics.averageConfidence === 'number')
        ? row.metrics.averageConfidence
        : 0,
      processingTime: (row?.metrics && typeof row.metrics.processingTime === 'number')
        ? row.metrics.processingTime
        : (typeof row?.executionTime === 'number' ? row.executionTime : 0),
      accuracy: (row?.metrics && typeof row.metrics.accuracy === 'number') ? row.metrics.accuracy : undefined,
      sections: Array.isArray(row?.output?.sections) ? row.output.sections : []
    };
  };

  // Load recent runs for telemetry panel
  const loadRuns = async (limit: number = 20) => {
    setIsLoadingRuns(true);
    try {
      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/runs?limit=${encodeURIComponent(String(limit))}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      setRecentRuns(rows);
      // Also hydrate AI Logs list from DB so logs persist across refreshes
      const mapped: TestResult[] = rows.map(mapRunRowToTestResult);
      setTestResults(mapped);
    } catch (error) {
      console.warn('Failed to load recent runs:', error);
      setRecentRuns([]);
      // Keep current in-memory logs if fetch fails
    } finally {
      setIsLoadingRuns(false);
    }
  };

  // Load aggregate metrics for the process (and later by version if desired)
  const loadMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAggregateMetrics(json?.data ?? null);
    } catch (error) {
      console.warn('Failed to load aggregate metrics:', error);
      setAggregateMetrics(null);
    } finally {
      setIsLoadingMetrics(false);
    }
  };
  const [comparisonResults, setComparisonResults] = useState<TestResult[]>([]);
  const [showFileManager, setShowFileManager] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [validationMode, setValidationMode] = useState(false);
  const [groundTruth, setGroundTruth] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [optimizedPrompts, setOptimizedPrompts] = useState<string[]>([]);
  const [promptPerformance, setPromptPerformance] = useState<any[]>([]);
  const [validationDataset, setValidationDataset] = useState<any[]>([]);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [validationMetrics, setValidationMetrics] = useState<any>(null);
  const [debugActiveTab, setDebugActiveTab] = useState<'Details' | 'Performance' | 'Prompt' | 'Response'>('Details');
  const [editorActiveTab, setEditorActiveTab] = useState<'prompt' | 'visual'>('prompt');
  
  // Undo/Redo functionality for prompt editor
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // (removed duplicate initial load useEffect; consolidated above)

  const loadCurrentPrompt = async () => {
    try {
      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/active`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const active = json?.data;
      const content = active?.content || active?.promptContent || '';
      const pid = active?.id || null;
      setActivePromptId(pid);
      setActivePromptContent(content);
      setCurrentPrompt(content);
    } catch (error) {
      console.error('Failed to load current prompt:', error);
    }
  };

  const loadPromptVersions = async () => {
    try {
      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/versions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const versions = Array.isArray(json?.data) ? json.data : [];
      setPromptVersions(versions);
    } catch (error) {
      console.error('Failed to load prompt versions:', error);
    }
  };

  // ... rest of your code remains the same ...

  const handleSaveVersion = async () => {
    const version = prompt('Enter version name (e.g., v1.2.4):');
    const description = prompt('Enter version description:');
    if (!version || !description) return;

    try {
      const body: any = {
        version,
        promptContent: currentPrompt,
        title: description,
        description,
        author: 'Admin',
        tags: [],
        metadata: currentResult ? {
          metrics: {
            accuracy: currentResult.accuracy || 0,
            averageConfidence: currentResult.averageConfidence,
            sectionsDetected: currentResult.sectionsDetected
          }
        } : {}
      };

      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadPromptVersions();
      alert(`Version ${version} saved successfully!`);
    } catch (error) {
      console.error('Failed to save version:', error);
      alert('Failed to save version. Please try again.');
    }
  };

  const handleSetAsDefault = async () => {
    if (!confirm('Set this prompt as the default for split detection?')) return;
    try {
      // Strategy: create a version if needed and set as active in one step
      const version = prompt('Enter version label to activate (e.g., v1.2.4):');
      if (!version) return;
      const res = await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          promptContent: currentPrompt,
          title: `Activated ${version}`,
          description: `Set active via UI on ${new Date().toISOString()}`,
          author: 'Admin',
          setAsActive: true
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Promise.all([loadCurrentPrompt(), loadPromptVersions()]);
      alert('Prompt set as default successfully!');
    } catch (error) {
      console.error('Failed to set as default:', error);
      alert('Failed to set as default. Please try again.');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Prompt editor helper functions
  const addToHistory = (prompt: string) => {
    if (prompt !== promptHistory[historyIndex]) {
      const newHistory = promptHistory.slice(0, historyIndex + 1);
      newHistory.push(prompt);
      setPromptHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handlePromptChange = (value: string) => {
    setCurrentPrompt(value);
    // Add to history after a delay to avoid too many history entries
    setTimeout(() => addToHistory(value), 1000);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentPrompt(promptHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < promptHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentPrompt(promptHistory[newIndex]);
    }
  };

  // Run a single test of the current prompt against the selected file (or default)
  const handleTestPrompt = async () => {
    if (!currentPrompt.trim()) {
      alert('Please enter a prompt first.');
      return;
    }
    if (!selectedFile) {
      alert('Please select an image to test.');
      return;
    }
    setIsTestingPrompt(true);
    const requestId = `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let status: 'success' | 'error' = 'error';
    let data: any = null;
    let errorMessage: string | undefined;
    try {
      const imageDataUrl = await fileToBase64(selectedFile);
      const payload: any = {
        image: imageDataUrl,
        fileName: selectedFile.name,
        customPrompt: currentPrompt,
        debug: true,
        requestId
      };

      const res = await fetch(`${backendBase}/api/ai-enhancement/detect-sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let info: any = null;
        try { info = await res.json(); } catch {}
        const msg = info?.error || res.statusText || 'Unknown error';
        const code = info?.code ? ` (${info.code})` : '';
        const rid = info?.requestId || requestId;
        throw new Error(`HTTP ${res.status}: ${msg}${code} [requestId=${rid}]`);
      }
      const json = await res.json();
      data = json?.data ?? json;
      status = 'success';

      const sections = Array.isArray(data?.sections) ? data.sections : [];
      const avgConf = typeof data?.averageConfidence === 'number' ? data.averageConfidence : 0;
      const procTime = typeof data?.processingTime === 'number' ? data.processingTime : 0;

      const result: TestResult = {
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
        fileName: selectedFile?.name || 'default',
        sectionsDetected: sections.length,
        averageConfidence: avgConf,
        processingTime: procTime,
        accuracy: typeof data?.metrics?.accuracy === 'number' ? data.metrics.accuracy : undefined,
        sections
      };

      setTestResults(prev => [result, ...prev]);
      setCurrentResult(result);
      setDebugInfo({
        request: { prompt: currentPrompt, fileName: selectedFile?.name },
        response: data,
        rawResponse: JSON.stringify(json, null, 2)
      });
      setActiveTab('results');
    } catch (error: any) {
      console.error('Failed to test prompt:', error);
      errorMessage = error?.message || 'Unknown error';
      alert('Failed to test prompt. Check console for details.');
    } finally {
      // Always record the run for telemetry and KPIs, even on error
      try {
        const isCustom = activePromptContent && currentPrompt.trim() !== activePromptContent.trim();
        const recordPayload: any = {
          status,
          errorMessage,
          promptMode: isCustom ? 'custom' : 'active',
          promptContent: isCustom ? currentPrompt : undefined,
          activePromptId: activePromptId || undefined,
          userId: undefined,
          requestId,
          inputMeta: { fileName: selectedFile?.name },
          detectResponse: data,
          groundTruth: validationMode && groundTruth && Array.isArray(groundTruth) ? { sections: groundTruth } : undefined,
          datasetCaseId: undefined,
          promptParts: {
            system: activePromptContent || '',
            user: currentPrompt || '',
            model: undefined,
            provider: undefined,
            messages: undefined
          }
        };
        await fetch(`${backendBase}/api/admin/ai-prompts/processes/split-detection/record-run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordPayload)
        });
        await Promise.all([loadRuns(), loadMetrics()]);
      } catch (e) {
        console.warn('Failed to record prompt run (non-fatal):', e);
      }
      setIsTestingPrompt(false);
    }
  };

  // Load a validation dataset for batch evaluation (MVP endpoint; falls back gracefully)
  const loadValidationDataset = async () => {
    // Split-detection does NOT use the golden-set validation dataset endpoint.
    // It relies on the AI Quality dataset/routes instead (not wired here yet).
    console.warn('[SplitDetection] Validation dataset is not provided by golden-set API. Using empty list.');
    setValidationDataset([]);
  };

  // Run validation over the loaded dataset using the detect endpoint (no mocks)
  const runValidationSuite = async () => {
    if (!currentPrompt.trim()) {
      alert('Please enter a prompt first.');
      return;
    }
    if (validationDataset.length === 0) {
      alert('Load a validation dataset first.');
      return;
    }
    setIsRunningValidation(true);
    try {
      const results: any[] = [];
      const iou = (a: any, b: any): number => {
        if (!a || !b) return 0;
        const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
        const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;
        const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
        const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
        const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
        const inter = iw * ih;
        const areaA = Math.max(0, a.width) * Math.max(0, a.height);
        const areaB = Math.max(0, b.width) * Math.max(0, b.height);
        const union = areaA + areaB - inter;
        return union > 0 ? inter / union : 0;
      };
      for (const item of validationDataset) {
        try {
          // Prefer provided base64; otherwise skip in MVP to avoid CORS issues
          if (!item?.imageBase64) {
            results.push({ id: item?.id ?? String(results.length + 1), name: item?.name ?? item?.fileName ?? `Case ${results.length + 1}`, f1Score: 0, skipped: true });
            continue;
          }
          const requestId = `ui-val-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const payload: any = {
            image: item.imageBase64,
            fileName: item?.fileName || item?.name || `case-${results.length + 1}.png`,
            customPrompt: currentPrompt,
            debug: true,
            requestId
          };

          const res = await fetch(`${backendBase}/api/ai-enhancement/detect-sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            let info: any = null;
            try { info = await res.json(); } catch {}
            const msg = info?.error || res.statusText || 'Unknown error';
            const code = info?.code ? ` (${info.code})` : '';
            const rid = info?.requestId || payload.requestId;
            throw new Error(`HTTP ${res.status}: ${msg}${code} [requestId=${rid}]`);
          }
          const json = await res.json();
          const data = json?.data ?? json;
          const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : (Array.isArray(data?.sections) ? data.sections : []);

          // Compute real metrics vs ground truth when available
          const gt = Array.isArray(item?.groundTruth?.sections) ? item.groundTruth.sections : [];
          let tp = 0, fp = 0, fn = 0, precision = 0, recall = 0, f1Score = 0;
          if (gt.length > 0 && suggestions.length > 0) {
            const matched = new Set<number>();
            for (let gi = 0; gi < gt.length; gi++) {
              let bestIdx = -1; let bestIoU = 0;
              for (let pi = 0; pi < suggestions.length; pi++) {
                if (matched.has(pi)) continue;
                const overlap = iou(gt[gi].bounds, suggestions[pi].bounds);
                if (overlap > bestIoU) { bestIoU = overlap; bestIdx = pi; }
              }
              if (bestIdx >= 0 && bestIoU >= 0.5) { tp++; matched.add(bestIdx); } else { fn++; }
            }
            fp = Math.max(0, suggestions.length - matched.size);
            precision = tp + fp > 0 ? tp / (tp + fp) : 0;
            recall = tp + fn > 0 ? tp / (tp + fn) : 0;
            f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
          } else if (gt.length === 0 && suggestions.length > 0) {
            // No ground truth; report counts only
            fp = 0; fn = 0; tp = suggestions.length; precision = 1; recall = 1; f1Score = 1;
          } else {
            tp = 0; fp = 0; fn = gt.length; precision = 0; recall = 0; f1Score = 0;
          }

          results.push({
            id: item?.id ?? String(results.length + 1),
            name: item?.name ?? item?.fileName ?? `Case ${results.length + 1}`,
            f1Score,
            precision,
            recall,
            tp,
            fp,
            fn,
            sectionsDetected: suggestions.length
          });
        } catch (innerErr) {
          console.warn('Validation case failed:', innerErr);
          results.push({
            id: item?.id ?? String(results.length + 1),
            name: item?.name ?? item?.fileName ?? `Case ${results.length + 1}`,
            f1Score: 0,
            error: true
          });
        }
      }

      setValidationMetrics({ totalTests: validationDataset.length, results });
      setActiveTab('validation');
    } catch (e) {
      console.error('Validation suite failed:', e);
      alert('Validation run failed. Check console for details.');
    } finally {
      setIsRunningValidation(false);
    }
  };

  const handleRunPrompt = async () => {
    console.log('🎯 Run Prompt button clicked!'); // Debug log
    
    if (!currentPrompt.trim()) {
      alert('Please enter a prompt to run');
      return;
    }

    console.log('🚀 About to call handleTestPrompt...');
    
    try {
      // Use the existing handleTestPrompt function to run the prompt
      await handleTestPrompt();
      console.log('✅ handleTestPrompt completed successfully');
    } catch (error) {
      console.error('❌ Error in handleRunPrompt:', error);
      alert('Failed to run prompt. Check console for details.');
    }
  };

  const tabs = [
    { id: 'editor', name: 'Prompt Editor', icon: DocumentTextIcon },
    { id: 'comparison', name: 'Compare Results', icon: ArrowsRightLeftIcon },
    { id: 'results', name: 'Test Results', icon: BeakerIcon },
    { id: 'debug', name: 'AI Debug', icon: Cog6ToothIcon },
    { id: 'validation', name: 'Quality Validation', icon: CheckCircleIcon }
  ];

  const pageContent: JSX.Element = (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Split Detection Testing</h2>
            <p className="mt-1 text-gray-600">
              Edit prompts, compare results, and refine AI section detection
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFileManager(!showFileManager)}
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                showFileManager 
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Cog6ToothIcon className="h-4 w-4 mr-2" />
              {selectedFile ? selectedFile.name : 'Select File'}
            </button>
            <button
              onClick={handleSaveVersion}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
              Save Version
            </button>
            <button
              onClick={handleSetAsDefault}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Set as Default
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* File Manager Overlay */}
      {showFileManager && (
        <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Select Test File</h3>
              <button
                onClick={() => setShowFileManager(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <StaticFileManager
                selectedFile={selectedFile}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  setShowFileManager(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'editor' && (
          <div className="h-full">
            {/* Sub-tabs for Editor */}
            <div className="bg-white border-b border-gray-200 mb-6">
              <nav className="flex space-x-8 px-4">
                {(['prompt', 'visual'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setEditorActiveTab(tab)}
                    className={`py-3 px-1 border-b-2 text-sm font-medium ${
                      editorActiveTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab === 'prompt' ? 'Prompt Editor' : 'Visual Results'}
                  </button>
                ))}
              </nav>
            </div>

            {editorActiveTab === 'prompt' && (
              <div className="h-full bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Prompt Editor</h3>
                  <p className="text-sm text-gray-600">Edit and test AI prompts for split detection</p>
                </div>
                
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex-1 relative">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Current Prompt
                      </label>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleUndo}
                          disabled={historyIndex <= 0}
                          className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Undo"
                        >
                          <ArrowUturnLeftIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={historyIndex >= promptHistory.length - 1}
                          className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Redo"
                        >
                          <ArrowUturnRightIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleRunPrompt}
                          disabled={isTestingPrompt || !currentPrompt.trim()}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-blue-500 rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          title="Run Prompt"
                        >
                          {isTestingPrompt ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </>
                          ) : (
                            <>
                              <PlayIcon className="h-4 w-4 mr-1" />
                              Run
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={currentPrompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      className="w-full h-full min-h-96 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your AI prompt here..."
                    />
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      {selectedFile ? `Testing with: ${selectedFile.name}` : 'No file selected - will use default test image'}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleTestPrompt}
                        disabled={isTestingPrompt || !currentPrompt.trim()}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isTestingPrompt ? 'Testing...' : 'Test Prompt'}
                      </button>
                    </div>
                </div>
              </div>
              </div>
            )}

            {editorActiveTab === 'visual' && (
              <div className="h-full">
                {currentResult && selectedFile ? (
                  <div className="h-full bg-white rounded-lg border border-gray-200">
                    <HybridLayoutSplitter
                      imageFile={selectedFile}
                      aiDetectedSections={currentResult.sections as any}
                      onSectionsConfirmed={(sections: any, splitLines?: number[]) => {
                        // Update local result to reflect user-confirmed sections
                        setCurrentResult((prev: any) => prev ? { ...prev, sections, sectionsDetected: Array.isArray(sections) ? sections.length : prev.sectionsDetected } : prev);
                      }}
                      onBack={() => {
                        // Return to prompt editor tab when user clicks back
                        setEditorActiveTab('prompt');
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center bg-white rounded-lg border border-gray-200">
                    <div className="text-center">
                      <EyeIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No Visual Results Available</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {selectedFile ? 'Click the "Run Prompt" button to test your prompt and see AI detection results' : 'Please select an image file and run the prompt to view visual detection with cutlines.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="h-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Prompt Telemetry</h3>
                <p className="text-sm text-gray-600">Recent runs and aggregate KPIs for split-detection</p>
              </div>
              <button
                onClick={async () => { try { await Promise.all([loadRuns(), loadMetrics()]); } catch {} }}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {(() => {
                const m = aggregateMetrics || {};
                const cards = [
                  { label: 'F1', value: (m.avgF1 ?? m.f1 ?? 0), fmt: (v: any) => (Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—') },
                  { label: 'Precision', value: (m.avgPrecision ?? m.precision ?? 0), fmt: (v: any) => (Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—') },
                  { label: 'Recall', value: (m.avgRecall ?? m.recall ?? 0), fmt: (v: any) => (Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—') },
                  { label: 'Avg IoU', value: (m.avgIoU ?? m.iou ?? 0), fmt: (v: any) => (Number.isFinite(v) ? v.toFixed(2) : '—') },
                  { label: 'Total Runs', value: (m.totalRuns ?? m.count ?? 0), fmt: (v: any) => (Number.isFinite(v) ? String(v) : '—') },
                  { label: 'Avg Proc.', value: (m.avgProcessingMs ?? m.processingMs ?? null), fmt: (v: any) => formatProcessingTime(v) }
                ];
                return cards.map((c) => (
                  <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm text-gray-500">{c.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {c.fmt(c.value)}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Recent Runs */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Recent Runs</h4>
                  <p className="text-sm text-gray-500">Latest executions recorded by the backend</p>
                </div>
                {(isLoadingRuns || isLoadingMetrics) && (
                  <div className="text-sm text-gray-500">Loading...</div>
                )}
              </div>
              {recentRuns.length > 0 ? (
                <div className="overflow-auto max-h-[calc(100vh-360px)]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precision</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recall</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F1</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg IoU</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processing</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {recentRuns.map((r: any) => {
                        const ts = r.timestamp || r.createdAt || r.time;
                        const prec = r.precision ?? r.metrics?.precision ?? null;
                        const rec = r.recall ?? r.metrics?.recall ?? null;
                        const f1 = r.f1 ?? r.metrics?.f1 ?? null;
                        const iou = r.avgIoU ?? r.iou ?? r.metrics?.avgIoU ?? null;
                        const proc = r.processingMs ?? r.processingTime ?? r.metrics?.processingMs ?? null;
                        return (
                          <tr key={r.id || `${ts}-${r.fileName || 'file'}`}
                              className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{ts ? new Date(ts).toLocaleString() : '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{r.fileName || r.input?.fileName || '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{Number.isFinite(prec) ? (prec * 100).toFixed(1) + '%' : '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{Number.isFinite(rec) ? (rec * 100).toFixed(1) + '%' : '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{Number.isFinite(f1) ? (f1 * 100).toFixed(1) + '%' : '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{Number.isFinite(iou) ? Number(iou).toFixed(2) : '—'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{formatProcessingTime(proc)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-500">No recent runs yet. Run a test to populate telemetry.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="h-full p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Compare Results</h3>
              <p className="text-sm text-gray-600">Select multiple test results to compare side by side</p>
            </div>
            
            {comparisonResults.length >= 2 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {comparisonResults.slice(0, 2).map((result, index) => (
                  <div key={result.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-900">{result.fileName}</h4>
                        <span className="text-sm text-gray-500">
                          {new Date(result.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {result.sectionsDetected} sections • {result.averageConfidence.toFixed(2)} confidence
                      </div>
                    </div>
                    <div className="p-4 flex-1">
                      <SplitSimulationPanel
                        result={result}
                        imageFile={selectedFile}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <ArrowsRightLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Comparison Available</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Run at least 2 tests to compare results side by side
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="h-full p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Results History</h3>
              <p className="text-sm text-gray-600">All test results with performance metrics</p>
            </div>
            
            {testResults.length > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
                  <div className="divide-y divide-gray-200">
                    {testResults.map((result) => (
                      <div
                        key={result.id}
                        className={`p-6 cursor-pointer transition-colors hover:bg-gray-50 ${
                          currentResult?.id === result.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                        onClick={() => {
                          setCurrentResult(result);
                          setActiveTab('editor');
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="font-medium text-gray-900">{result.fileName}</h4>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {result.accuracy}% accuracy
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Sections:</span>
                                <span className="ml-1 font-medium">{result.sectionsDetected}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Confidence:</span>
                                <span className="ml-1 font-medium">{result.averageConfidence.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Processing:</span>
                                <span className="ml-1 font-medium">{formatProcessingTime(result.processingTime)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm text-gray-500">
                              {new Date(result.timestamp).toLocaleString()}
                            </p>
                            <div className="mt-2 flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (comparisonResults.includes(result)) {
                                    setComparisonResults(prev => prev.filter(r => r.id !== result.id));
                                  } else if (comparisonResults.length < 2) {
                                    setComparisonResults(prev => [...prev, result]);
                                  }
                                }}
                                className={`text-xs px-2 py-1 rounded ${
                                  comparisonResults.includes(result)
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {comparisonResults.includes(result) ? 'Remove from Compare' : 'Add to Compare'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <BeakerIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Test Results</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Run some tests to see results and performance metrics here
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="h-full flex bg-gray-50">
            {/* Left Sidebar - Logs List */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">AI Logs</h3>
                <div className="mt-2 flex space-x-4 text-sm">
                  <button className="text-blue-600 border-b-2 border-blue-600 pb-1">All</button>
                  <button className="text-gray-500 hover:text-gray-700">Recent Tests</button>
                </div>
                {aggregateMetrics && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="uppercase tracking-wide">Sections</div>
                      <div className="font-semibold text-gray-900">
                        {Number.isFinite(aggregateMetrics.avgSections)
                          ? aggregateMetrics.avgSections.toFixed(1)
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="uppercase tracking-wide">Avg Conf</div>
                      <div className="font-semibold text-gray-900">
                        {Number.isFinite(aggregateMetrics.avgConfidence)
                          ? aggregateMetrics.avgConfidence.toFixed(2)
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="uppercase tracking-wide">Time</div>
                      <div className="font-semibold text-gray-900">
                        {formatProcessingTime(aggregateMetrics.avgProcessingTime)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {testResults.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {testResults.map((result, index) => (
                      <div 
                        key={result.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          debugInfo?.timestamp === result.timestamp ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                        onClick={() => {
                          // Set debug info for this result
                          setDebugInfo({
                            timestamp: result.timestamp,
                            request: {
                              prompt: currentPrompt,
                              imageSize: selectedFile?.size || 0,
                              fileName: result.fileName
                            },
                            response: {
                              sections: result.sections,
                              processingTime: result.processingTime,
                              accuracy: result.accuracy
                            }
                          });
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm font-medium text-blue-600">
                            #{result.id.slice(-6)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-900 mb-1">{result.fileName}</div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>sections: {result.sectionsDetected}</span>
                          <span>confidence: {result.averageConfidence.toFixed(2)}</span>
                          <span>{formatProcessingTime(result.processingTime)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p className="text-sm">No logs yet</p>
                    <p className="text-xs mt-1">Run a test to see AI conversation logs</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Log Details */}
            <div className="flex-1 flex flex-col">
              {debugInfo ? (
                <>
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">Log Details</h4>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span>Prompt: Split Detection</span>
                          <span>Created: {new Date(debugInfo.timestamp).toLocaleString()}</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Success</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Humanloop-style Single View */}
                  <div className="flex-1 overflow-y-auto bg-white">
                    <div className="p-6 space-y-6">
                      {/* Input/Output Header */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Input
                          </h5>
                          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">fileWelcome_to_The_Brandery_-_Logo_Design__Branding___Web_Design_.jpeg</span>
                              <span className="font-mono text-gray-900">{debugInfo.request.fileName}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">size</span>
                              <span className="font-mono text-gray-900">{(debugInfo.request.imageSize / 1024).toFixed(1)} KB</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">prompt_length</span>
                              <span className="font-mono text-gray-900">{debugInfo.request.prompt.length}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Output
                          </h5>
                          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">sections_detected</span>
                              <span className="font-mono text-gray-900">{debugInfo.response.sections?.length || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">avg_confidence</span>
                              <span className="font-mono text-gray-900">
                                {debugInfo.response.sections?.length > 0 
                                  ? (debugInfo.response.sections.reduce((acc: number, s: any) => acc + (s.aiConfidence || 0), 0) / debugInfo.response.sections.length).toFixed(3)
                                  : '0.000'
                                }
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">processing_time</span>
                              <span className="font-mono text-gray-900">{formatProcessingTime(debugInfo.response.processingTime)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Prompt Content */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Prompt Content</h5>
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-auto max-h-48">
{debugInfo.request.prompt}
                          </pre>
                        </div>
                      </div>

                      {/* AI Response */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">AI Response</h5>
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
                          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-auto max-h-48">
{debugInfo.rawResponse}
                          </pre>
                        </div>
                      </div>

                      {/* Parsed Output */}
                      {debugInfo.response.sections && debugInfo.response.sections.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3">
                            Parsed Sections ({debugInfo.response.sections.length})
                          </h5>
                          <div className="space-y-3">
                            {debugInfo.response.sections.map((section: any, index: number) => (
                              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium text-gray-900">{section.name || section.type}</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {section.type}
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium text-green-600">
                                    {((section.aiConfidence || 0) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                                  <div>
                                    <span className="text-gray-500">x:</span>
                                    <span className="ml-1 font-mono">{section.bounds?.x || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">y:</span>
                                    <span className="ml-1 font-mono">{section.bounds?.y || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">width:</span>
                                    <span className="ml-1 font-mono">{section.bounds?.width || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">height:</span>
                                    <span className="ml-1 font-mono">{section.bounds?.height || 0}</span>
                                  </div>
                                </div>
                                {section.detectionReason && (
                                  <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                                    <span className="font-medium">Reasoning:</span> {section.detectionReason}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Performance Metrics Footer */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Performance</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Response Time:</span>
                            <span className="ml-2 font-mono text-gray-900">{formatProcessingTime(debugInfo.response.processingTime)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Tokens:</span>
                            <span className="ml-2 font-mono text-gray-900">{debugInfo.response.tokensUsed || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Cost:</span>
                            <span className="ml-2 font-mono text-gray-900">${(debugInfo.response.costUsd || 0).toFixed(4)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Confidence:</span>
                            <span className="ml-2 font-mono text-gray-900">
                              {debugInfo.response.sections?.length > 0 
                                ? (debugInfo.response.sections.reduce((acc: number, s: any) => acc + (s.aiConfidence || 0), 0) / debugInfo.response.sections.length * 100).toFixed(1) + '%'
                                : '0%'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-white">
                  <div className="text-center">
                    <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Select a log to view details</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Choose a test result from the left sidebar to inspect the AI conversation
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="h-full p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Validation Framework</h3>
              <p className="text-sm text-gray-600">Measure prompt performance against ground truth data and industry metrics</p>
            </div>

            {/* Validation Controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">Validation Dataset</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {validationDataset.length} test cases loaded
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={loadValidationDataset}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Load Dataset
                  </button>
                  <button
                    onClick={runValidationSuite}
                    disabled={isRunningValidation || validationDataset.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunningValidation ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running Validation...
                      </>
                    ) : (
                      'Run Validation Suite'
                    )}
                  </button>
                </div>
              </div>

              {/* Dataset Preview */}
              {validationDataset.length > 0 && (
                <div className="border-t pt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Test Cases:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {validationDataset.map((testCase, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="text-sm font-medium text-gray-900">{testCase.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Ground truth: {testCase.groundTruth.length} sections
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {testCase.groundTruth.map((section: any, sIndex: number) => (
                            <span key={sIndex} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {section.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Validation Results */}
            {validationMetrics && (
              <div className="space-y-6">
                {/* Overall Metrics */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Overall Performance Metrics</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {(validationMetrics.overallPrecision * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Precision</div>
                      <div className="text-xs text-gray-500 mt-1">True Positives / (TP + FP)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(validationMetrics.overallRecall * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Recall</div>
                      <div className="text-xs text-gray-500 mt-1">True Positives / (TP + FN)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {(validationMetrics.overallF1 * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">F1 Score</div>
                      <div className="text-xs text-gray-500 mt-1">Harmonic mean of P & R</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {(validationMetrics.avgIoU * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Avg IoU</div>
                      <div className="text-xs text-gray-500 mt-1">Bounding box overlap</div>
                    </div>
                  </div>
                  
                  {/* Quality Assessment */}
                  <div className="mt-6 p-4 rounded-lg bg-gray-50">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Quality Assessment</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Overall Quality:</span>
                        <span className={`font-medium ${
                          validationMetrics.overallF1 > 0.85 ? 'text-green-600' :
                          validationMetrics.overallF1 > 0.7 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {validationMetrics.overallF1 > 0.85 ? 'Excellent' :
                           validationMetrics.overallF1 > 0.7 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Boundary Accuracy:</span>
                        <span className={`font-medium ${
                          validationMetrics.avgIoU > 0.7 ? 'text-green-600' :
                          validationMetrics.avgIoU > 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {validationMetrics.avgIoU > 0.7 ? 'High' :
                           validationMetrics.avgIoU > 0.5 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tests Passed:</span>
                        <span className="font-medium text-gray-900">
                          {validationMetrics.results.filter((r: any) => r.f1Score > 0.7).length} / {validationMetrics.totalTests}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Detailed Test Results</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Case</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sections</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precision</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recall</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F1 Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {validationMetrics.results.map((result: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {result.testCase}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {result.aiSections} / {result.gtSections}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(result.precision * 100).toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(result.recall * 100).toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {(result.f1Score * 100).toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                result.f1Score > 0.85 ? 'bg-green-100 text-green-800' :
                                result.f1Score > 0.7 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {result.f1Score > 0.85 ? 'Excellent' :
                                 result.f1Score > 0.7 ? 'Good' : 'Poor'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Improvement Recommendations</h4>
                  <div className="space-y-3">
                    {validationMetrics.overallPrecision < 0.8 && (
                      <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-red-800">High False Positive Rate</h5>
                          <p className="text-sm text-red-700 mt-1">The AI is detecting sections that don't exist. Consider refining the prompt to be more conservative in section detection.</p>
                        </div>
                      </div>
                    )}
                    
                    {validationMetrics.overallRecall < 0.8 && (
                      <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-yellow-800">Missing Sections</h5>
                          <p className="text-sm text-yellow-700 mt-1">The AI is missing important sections. Consider adding more detailed section type descriptions to the prompt.</p>
                        </div>
                      </div>
                    )}

                    {validationMetrics.avgIoU < 0.6 && (
                      <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-blue-800">Boundary Accuracy Issues</h5>
                          <p className="text-sm text-blue-700 mt-1">Section boundaries are not precise. Consider adding more specific instructions about boundary detection in the prompt.</p>
                        </div>
                      </div>
                    )}

                    {validationMetrics.overallF1 > 0.85 && (
                      <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-green-800">Excellent Performance</h5>
                          <p className="text-sm text-green-700 mt-1">Your prompt is performing very well! Consider this a baseline for future improvements.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!validationMetrics && (
              <div className="text-center py-12">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Validation Results</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Load a validation dataset and run the validation suite to see quality metrics
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <WorkflowProvider>
      {pageContent}
    </WorkflowProvider>
  );
}
