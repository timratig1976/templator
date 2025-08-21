# 🚀 Templator 5-Phase Pipeline Implementation Plan

## Overview

This document outlines the comprehensive implementation plan to transform the current simple workflow into the full 5-phase pipeline architecture described in `APPLICATION_FLOW.md`.

**Current Status**: Basic upload → AI analysis → download workflow  
**Target**: Comprehensive 5-phase pipeline with validation, refinement, and quality assurance  
**Timeline**: 4-6 weeks for full implementation

---

## 📊 Gap Analysis

### ✅ **Already Implemented**
- **Phase 1**: Basic file upload and preprocessing (`designController.ts`)
- **Phase 2**: OpenAI integration and HTML generation (`openaiService.ts`)
- **Basic Frontend**: Simple upload/download workflow (`page.tsx`)

### ⚠️ **Partially Implemented** (Service files exist but not integrated)
- `HubSpotValidationService.ts` - Validation logic exists
- `IterativeRefinementService.ts` - Refinement logic exists
- `ComponentAssemblyEngine.ts` - Assembly logic exists
- `AutoErrorCorrectionService.ts` - Error correction exists
- Various other services in `/services/` directory

### ❌ **Missing Implementation**
- **Pipeline Orchestration**: No central pipeline controller
- **Frontend Integration**: No UI for multi-phase workflow
- **Service Integration**: Services exist but aren't connected
- **Error Handling**: No comprehensive error recovery
- **Progress Tracking**: No real-time pipeline progress
- **Quality Metrics**: No quality scoring dashboard

---

## 🏗️ Implementation Phases

## Phase A: Pipeline Orchestration (Week 1-2)

### A1. Create Pipeline Controller
**File**: `backend/src/controllers/PipelineController.ts`

```typescript
export class PipelineController {
  private phases: PipelinePhase[] = [
    new InputProcessingPhase(),
    new AIAnalysisPhase(), 
    new ValidationPhase(),
    new EnhancementPhase(),
    new ExportPhase()
  ];

  async executePipeline(input: PipelineInput): Promise<PipelineResult> {
    // Orchestrate all 5 phases with error handling and progress tracking
  }
}
```

**Features**:
- Sequential phase execution
- Error handling and recovery
- Progress tracking and reporting
- State persistence between phases
- Rollback capability

### A2. Create Phase Interfaces
**File**: `backend/src/interfaces/PipelinePhases.ts`

```typescript
export interface PipelinePhase {
  name: string;
  execute(input: PhaseInput, context: PipelineContext): Promise<PhaseResult>;
  validate(input: PhaseInput): ValidationResult;
  rollback(context: PipelineContext): Promise<void>;
}
```

### A3. Pipeline State Management
**File**: `backend/src/services/PipelineStateManager.ts`

```typescript
export class PipelineStateManager {
  async saveState(pipelineId: string, state: PipelineState): Promise<void>;
  async getState(pipelineId: string): Promise<PipelineState>;
  async updateProgress(pipelineId: string, progress: ProgressUpdate): Promise<void>;
}
```

## Phase B: Service Integration (Week 2-3)

### B1. Integrate Existing Services

#### B1.1 HubSpot Validation Integration
**File**: `backend/src/phases/ValidationPhase.ts`

```typescript
export class ValidationPhase implements PipelinePhase {
  private validationService = HubSpotValidationService.getInstance();
  
  async execute(input: PhaseInput): Promise<PhaseResult> {
    const validationResult = await this.validationService.validateModule(input.module);
    return {
      success: validationResult.valid,
      data: validationResult,
      nextPhase: validationResult.valid ? 'enhancement' : 'refinement'
    };
  }
}
```

#### B1.2 Iterative Refinement Integration
**File**: `backend/src/phases/RefinementPhase.ts`

```typescript
export class RefinementPhase implements PipelinePhase {
  private refinementService = IterativeRefinementService.getInstance();
  
  async execute(input: PhaseInput): Promise<PhaseResult> {
    const refinedModule = await this.refinementService.refineModule(
      input.module, 
      input.validationErrors
    );
    return {
      success: true,
      data: refinedModule,
      nextPhase: 'validation' // Re-validate after refinement
    };
  }
}
```

#### B1.3 Component Assembly Integration
**File**: `backend/src/phases/EnhancementPhase.ts`

```typescript
export class EnhancementPhase implements PipelinePhase {
  private assemblyEngine = ComponentAssemblyEngine.getInstance();
  private errorCorrection = AutoErrorCorrectionService.getInstance();
  
  async execute(input: PhaseInput): Promise<PhaseResult> {
    // 1. Auto error correction
    const correctedModule = await this.errorCorrection.correctErrors(input.module);
    
    // 2. Component assembly optimization
    const optimizedModule = await this.assemblyEngine.optimizeComponents(correctedModule);
    
    return {
      success: true,
      data: optimizedModule,
      nextPhase: 'export'
    };
  }
}
```

### B2. Create Missing Services

#### B2.1 Pipeline Progress Service
**File**: `backend/src/services/PipelineProgressService.ts`

```typescript
export class PipelineProgressService {
  async updateProgress(pipelineId: string, phase: string, progress: number): Promise<void>;
  async getProgress(pipelineId: string): Promise<PipelineProgress>;
  async subscribeToProgress(pipelineId: string, callback: ProgressCallback): void;
}
```

#### B2.2 Quality Metrics Service
**File**: `backend/src/services/QualityMetricsService.ts`

```typescript
export class QualityMetricsService {
  calculateOverallQuality(module: HubSpotModule, validationResult: ValidationResult): QualityScore;
  generateQualityReport(pipelineResult: PipelineResult): QualityReport;
  trackQualityTrends(results: PipelineResult[]): QualityTrends;
}
```

## Phase C: Frontend Integration (Week 3-4)

### C1. Multi-Phase UI Components

#### C1.1 Pipeline Progress Component
**File**: `frontend/src/components/PipelineProgress.tsx`

```typescript
export const PipelineProgress: React.FC<{pipelineId: string}> = ({pipelineId}) => {
  const [progress, setProgress] = useState<PipelineProgress>();
  
  return (
    <div className="pipeline-progress">
      <div className="phases">
        {progress?.phases.map(phase => (
          <PhaseIndicator key={phase.name} phase={phase} />
        ))}
      </div>
      <ProgressBar progress={progress?.overall || 0} />
      <PhaseDetails currentPhase={progress?.currentPhase} />
    </div>
  );
};
```

#### C1.2 Validation Results Component
**File**: `frontend/src/components/ValidationResults.tsx`

```typescript
export const ValidationResults: React.FC<{results: ValidationResult}> = ({results}) => {
  return (
    <div className="validation-results">
      <QualityScore score={results.score} />
      <ErrorList errors={results.errors} />
      <SuggestionsList suggestions={results.suggestions} />
      <MetricsDisplay metrics={results.metrics} />
    </div>
  );
};
```

#### C1.3 Quality Dashboard Component
**File**: `frontend/src/components/QualityDashboard.tsx`

```typescript
export const QualityDashboard: React.FC<{pipelineResult: PipelineResult}> = ({pipelineResult}) => {
  return (
    <div className="quality-dashboard">
      <OverallQualityScore score={pipelineResult.qualityScore} />
      <QualityBreakdown metrics={pipelineResult.qualityMetrics} />
      <ImprovementSuggestions suggestions={pipelineResult.suggestions} />
      <PerformanceMetrics metrics={pipelineResult.performance} />
    </div>
  );
};
```

### C2. Enhanced Workflow Pages

#### C2.1 Multi-Step Workflow
**File**: `frontend/src/app/pipeline/page.tsx`

```typescript
export default function PipelinePage() {
  const [currentPhase, setCurrentPhase] = useState<PipelinePhase>('upload');
  const [pipelineId, setPipelineId] = useState<string>();
  const [pipelineResult, setPipelineResult] = useState<PipelineResult>();
  
  const phases = [
    { id: 'upload', name: 'Upload & Processing', component: UploadPhase },
    { id: 'analysis', name: 'AI Analysis', component: AnalysisPhase },
    { id: 'validation', name: 'Quality Validation', component: ValidationPhase },
    { id: 'enhancement', name: 'Enhancement & Optimization', component: EnhancementPhase },
    { id: 'export', name: 'Module Export', component: ExportPhase }
  ];
  
  return (
    <div className="pipeline-workflow">
      <PipelineNavigation phases={phases} currentPhase={currentPhase} />
      <PipelineProgress pipelineId={pipelineId} />
      <PhaseContent phase={currentPhase} pipelineResult={pipelineResult} />
    </div>
  );
}
```

## Phase D: Advanced Features (Week 4-5)

### D1. Real-time Progress Tracking

#### D1.1 WebSocket Integration
**File**: `backend/src/services/WebSocketService.ts`

```typescript
export class WebSocketService {
  broadcastProgress(pipelineId: string, progress: ProgressUpdate): void;
  subscribeToProgress(pipelineId: string, socket: WebSocket): void;
  broadcastQualityUpdates(pipelineId: string, quality: QualityUpdate): void;
}
```

#### D1.2 Frontend WebSocket Client
**File**: `frontend/src/services/pipelineWebSocket.ts`

```typescript
export class PipelineWebSocket {
  subscribe(pipelineId: string, callbacks: {
    onProgress: (progress: ProgressUpdate) => void;
    onQuality: (quality: QualityUpdate) => void;
    onError: (error: PipelineError) => void;
  }): void;
}
```

### D2. Advanced Error Handling

#### D2.1 Error Recovery System
**File**: `backend/src/services/ErrorRecoveryService.ts`

```typescript
export class ErrorRecoveryService {
  async recoverFromError(error: PipelineError, context: PipelineContext): Promise<RecoveryResult>;
  async suggestFixes(error: PipelineError): Promise<FixSuggestion[]>;
  async autoFix(error: PipelineError, context: PipelineContext): Promise<boolean>;
}
```

### D3. Quality Assurance Dashboard

#### D3.1 Analytics Service
**File**: `backend/src/services/AnalyticsService.ts`

```typescript
export class AnalyticsService {
  trackPipelineMetrics(pipelineResult: PipelineResult): void;
  generateQualityTrends(): QualityTrends;
  getPerformanceInsights(): PerformanceInsights;
  exportAnalyticsReport(): AnalyticsReport;
}
```

## Phase E: Testing & Optimization (Week 5-6)

### E1. Comprehensive Testing

#### E1.1 Pipeline Integration Tests
**File**: `backend/src/__tests__/integration/pipeline.test.ts`

```typescript
describe('Pipeline Integration', () => {
  it('should execute full 5-phase pipeline successfully', async () => {
    const input = createTestInput();
    const result = await pipelineController.executePipeline(input);
    expect(result.success).toBe(true);
    expect(result.qualityScore).toBeGreaterThan(80);
  });
  
  it('should handle validation failures with refinement', async () => {
    const input = createInvalidInput();
    const result = await pipelineController.executePipeline(input);
    expect(result.refinementIterations).toBeGreaterThan(0);
    expect(result.finalQualityScore).toBeGreaterThan(result.initialQualityScore);
  });
});
```

#### E1.2 Frontend E2E Tests
**File**: `frontend/src/__tests__/e2e/pipeline.test.tsx`

```typescript
describe('Pipeline E2E', () => {
  it('should complete full pipeline workflow', async () => {
    render(<PipelinePage />);
    
    // Upload phase
    await uploadDesignFile('test-design.png');
    await waitFor(() => expect(screen.getByText('AI Analysis')).toBeVisible());
    
    // Validation phase
    await waitFor(() => expect(screen.getByText('Quality Validation')).toBeVisible());
    
    // Enhancement phase
    await waitFor(() => expect(screen.getByText('Enhancement & Optimization')).toBeVisible());
    
    // Export phase
    await waitFor(() => expect(screen.getByText('Module Export')).toBeVisible());
    
    // Download
    const downloadButton = screen.getByText('Download Module');
    expect(downloadButton).toBeEnabled();
  });
});
```

### E2. Performance Optimization

#### E2.1 Pipeline Performance Monitoring
**File**: `backend/src/services/PerformanceMonitor.ts`

```typescript
export class PerformanceMonitor {
  trackPhasePerformance(phase: string, duration: number, success: boolean): void;
  getPerformanceMetrics(): PerformanceMetrics;
  identifyBottlenecks(): Bottleneck[];
  suggestOptimizations(): Optimization[];
}
```

---

## 🔧 Implementation Details

### API Endpoints to Add

```typescript
// Pipeline Management
POST /api/pipeline/start          // Start new pipeline
GET  /api/pipeline/:id/status     // Get pipeline status
GET  /api/pipeline/:id/progress   // Get real-time progress
POST /api/pipeline/:id/retry      // Retry failed phase
DELETE /api/pipeline/:id          // Cancel pipeline

// Quality & Validation
GET  /api/validation/:id/results  // Get validation results
POST /api/validation/:id/fix      // Apply suggested fixes
GET  /api/quality/:id/metrics     // Get quality metrics
GET  /api/quality/:id/report      // Generate quality report

// Analytics
GET  /api/analytics/trends        // Quality trends
GET  /api/analytics/performance   // Performance metrics
GET  /api/analytics/export        // Export analytics
```

### Database Schema Extensions

```sql
-- Pipeline execution tracking
CREATE TABLE pipeline_executions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  status VARCHAR(50),
  current_phase VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  input_data JSONB,
  result_data JSONB,
  quality_score INTEGER,
  error_log JSONB
);

-- Phase execution details
CREATE TABLE phase_executions (
  id UUID PRIMARY KEY,
  pipeline_id UUID REFERENCES pipeline_executions(id),
  phase_name VARCHAR(100),
  status VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  input_data JSONB,
  output_data JSONB,
  metrics JSONB,
  errors JSONB
);

-- Quality metrics tracking
CREATE TABLE quality_metrics (
  id UUID PRIMARY KEY,
  pipeline_id UUID REFERENCES pipeline_executions(id),
  overall_score INTEGER,
  field_accuracy INTEGER,
  template_quality INTEGER,
  accessibility_score INTEGER,
  performance_score INTEGER,
  hubspot_compliance INTEGER,
  created_at TIMESTAMP
);
```

### Configuration Updates

#### Environment Variables
```bash
# Pipeline Configuration
PIPELINE_MAX_CONCURRENT=5
PIPELINE_TIMEOUT_MINUTES=30
PIPELINE_RETRY_ATTEMPTS=3

# Quality Thresholds
QUALITY_MIN_SCORE=70
VALIDATION_CRITICAL_THRESHOLD=0
VALIDATION_HIGH_THRESHOLD=2

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
ANALYTICS_RETENTION_DAYS=90
```

### Unified Pipeline Telemetry & Legacy Tables Strategy

#### Goal
Use the existing unified pipeline schema for all AI process telemetry and keep legacy/domain tables (e.g., `DesignSplit`, `ModuleComponent`) as business data. Avoid creating new tables per AI process.

#### Core Decisions
- All AI processes are represented via `PipelineDefinition` → `PipelineVersion` → `PipelineRun` and `StepDefinition` → `StepVersion` → `StepRun`.
- Step outputs and intermediates are stored in `IRArtifact.irJson` validated by `IRSchema`.
- Quality/validation results are stored in `MetricResult`.
- Links from process outputs to domain entities use `StepOutputLink { targetType, targetId, meta }`.
- No new per-process tables for telemetry. New tables are only for new domain entities with their own lifecycle.

#### Mapping Examples
- Layout Splitter process → `StepDefinition.key = 'layout_split'` emits `IRArtifact` with split details; creates domain rows in `DesignSplit` and links via `StepOutputLink('DesignSplit', id)`.
- Module Generation process → `StepDefinition.key = 'generate_module'` emits module spec `IRArtifact`; writes to `ModuleTemplate`/`GeneratedArtifact` and links via `StepOutputLink`.

#### Migration Plan
1. Write-through: Update AI services to emit `PipelineRun`/`StepRun`, `IRArtifact`, `MetricResult`, and `StepOutputLink` while continuing to write domain rows.
2. Backfill (optional): Create backfill scripts to generate synthetic runs/steps for important historical operations.
3. Read path: Monitoring/UI read exclusively from pipeline tables; domain UIs read domain tables.
4. Deprecation: Retire any legacy process-logging tables; keep domain tables.

#### Implementation Tasks
- Define/confirm `StepDefinition` and `StepVersion` entries for key processes (layout split, module generation, validation, export).
- Add `IRSchema` definitions per `StepVersion` for validation and forward-compatibility.
- Create a small helper module to standardize writes of `StepRun` + artifacts + metrics + links.
- Update services to use the helper and link to domain rows via `StepOutputLink`.
- Add seed/backfill scripts for sample runs to support dev/testing.

#### Checklist Additions
- [ ] Register step definitions/versions for all existing AI processes
- [ ] Implement `StepOutputLink` usage for `DesignSplit`, `ModuleComponent`, etc.
- [ ] Emit `IRArtifact` and `MetricResult` from each process
- [ ] Add IR schema validation where applicable
- [ ] Optional: backfill historical runs for analytics

---

## 📋 Implementation Checklist

### Week 1-2: Pipeline Foundation
- [ ] Create `PipelineController.ts`
- [ ] Implement `PipelinePhase` interfaces
- [ ] Create `PipelineStateManager.ts`
- [ ] Set up pipeline database schema
- [ ] Implement basic phase execution
- [ ] Add pipeline API endpoints
- [ ] Create pipeline progress tracking

### Week 2-3: Service Integration
- [ ] Integrate `HubSpotValidationService`
- [ ] Integrate `IterativeRefinementService`
- [ ] Integrate `ComponentAssemblyEngine`
- [ ] Integrate `AutoErrorCorrectionService`
- [ ] Create `QualityMetricsService`
- [ ] Implement error recovery system
- [ ] Add comprehensive logging

### Week 3-4: Frontend Development
- [ ] Create `PipelineProgress` component
- [ ] Create `ValidationResults` component
- [ ] Create `QualityDashboard` component
- [ ] Implement multi-step workflow UI
- [ ] Add real-time progress updates
- [ ] Create error handling UI
- [ ] Add quality metrics visualization

### Week 4-5: Advanced Features
- [ ] Implement WebSocket for real-time updates
- [ ] Add advanced error recovery
- [ ] Create analytics dashboard
- [ ] Implement performance monitoring
- [ ] Add pipeline optimization features
- [ ] Create quality trend analysis

### Week 5-6: Testing & Polish
- [ ] Write comprehensive integration tests
- [ ] Create E2E test suite
- [ ] Performance testing and optimization
- [ ] Security review and hardening
- [ ] Documentation updates
- [ ] User acceptance testing

---

## Phase F: Hybrid AI + User-Driven Layout Splitting (Week 7-8)

### F1. Enhanced Layout Analysis

#### F1.1 OpenAI Vision Integration for Layout Analysis
**File**: `backend/src/services/layout/LayoutAnalysisService.ts`

```typescript
export class LayoutAnalysisService {
  async analyzeLayout(imageBuffer: Buffer): Promise<LayoutAnalysisResult> {
    const prompt = `
      Analyze this PNG layout and return a JSON array of Y-axis positions (in pixels) 
      where horizontal section boundaries should be placed. Focus on visual breaks 
      between components like headers, hero sections, image blocks, text blocks, CTAs, 
      and footers. Look for whitespace gaps, color/background changes, repeated patterns, 
      and typography changes.
      
      Return format: {
        "cutLines": [120, 450, 780, 1200], 
        "confidence": 0.85, 
        "sections": ["header", "hero", "features", "footer"]
      }
    `;
    
    const analysis = await this.openaiService.analyzeImage(imageBuffer, prompt);
    return this.parseLayoutAnalysis(analysis);
  }
  
  private parseLayoutAnalysis(response: string): LayoutAnalysisResult {
    // Parse OpenAI response and validate Y-positions
  }
}
```

#### F1.2 Interactive Canvas Component
**File**: `frontend/src/components/LayoutSplitter.tsx`

```typescript
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';

export const LayoutSplitter: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [image] = useImage(imageUrl || '');
  const [cutLines, setCutLines] = useState<CutLine[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<number[]>([]);
  const stageRef = useRef<any>(null);
  
  const handleImageUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    
    // Get AI suggestions for cut lines
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/layout/analyze', {
      method: 'POST',
      body: formData
    });
    
    const analysis = await response.json();
    setAiSuggestions(analysis.cutLines);
    setCutLines(analysis.cutLines.map((y: number, i: number) => ({
      id: `ai-${i}`,
      y,
      type: 'suggested',
      sectionType: analysis.sections[i]
    })));
  };
  
  const addCutLine = (y: number) => {
    const newLine = {
      id: `user-${Date.now()}`,
      y,
      type: 'user-added',
      sectionType: 'custom'
    };
    setCutLines(prev => [...prev, newLine]);
  };
  
  const exportSections = async () => {
    if (!image || !stageRef.current) return;
    
    const sortedLines = [...cutLines.map(l => l.y), 0, image.height]
      .sort((a, b) => a - b);
    
    const sections = [];
    for (let i = 0; i < sortedLines.length - 1; i++) {
      const top = sortedLines[i];
      const bottom = sortedLines[i + 1];
      const height = bottom - top;
      
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(image, 0, top, image.width, height, 0, 0, image.width, height);
        const blob = await new Promise<Blob>(resolve => 
          canvas.toBlob(resolve as BlobCallback, 'image/png')
        );
        
        sections.push({
          index: i,
          blob,
          sectionType: cutLines.find(l => l.y === top)?.sectionType || 'unknown'
        });
      }
    }
    
    // Send sections to backend for HTML generation
    await processSections(sections);
  };
  
  return (
    <div className="layout-splitter">
      <div className="upload-area">
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
        />
      </div>
      
      {image && (
        <div className="canvas-container">
          <Stage
            ref={stageRef}
            width={Math.min(image.width, 1200)}
            height={Math.min(image.height, 800)}
            scaleX={Math.min(1200 / image.width, 1)}
            scaleY={Math.min(800 / image.height, 1)}
            onClick={(e) => {
              const y = e.evt.offsetY / (Math.min(800 / image.height, 1));
              addCutLine(y);
            }}
          >
            <Layer>
              <KonvaImage image={image} />
              {cutLines.map((line) => (
                <Line
                  key={line.id}
                  points={[0, line.y, image.width, line.y]}
                  stroke={line.type === 'suggested' ? '#3b82f6' : '#ef4444'}
                  strokeWidth={2}
                  dash={[10, 5]}
                  draggable
                  onDragEnd={(e) => {
                    const newY = e.target.y();
                    setCutLines(prev => 
                      prev.map(l => l.id === line.id ? {...l, y: newY} : l)
                    );
                  }}
                />
              ))}
            </Layer>
          </Stage>
          
          <div className="controls">
            <button onClick={exportSections} className="export-btn">
              Split & Generate HTML
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### F1.3 Image Splitting Service
**File**: `backend/src/services/layout/ImageSplittingService.ts`

```typescript
export class ImageSplittingService {
  async splitImage(imageBuffer: Buffer, cutLines: number[]): Promise<ImageSection[]> {
    const image = await sharp(imageBuffer);
    const { width, height } = await image.metadata();
    
    const sortedLines = [0, ...cutLines, height].sort((a, b) => a - b);
    const sections: ImageSection[] = [];
    
    for (let i = 0; i < sortedLines.length - 1; i++) {
      const top = sortedLines[i];
      const sectionHeight = sortedLines[i + 1] - top;
      
      const sectionBuffer = await image
        .extract({ left: 0, top, width, height: sectionHeight })
        .png()
        .toBuffer();
      
      sections.push({
        index: i,
        buffer: sectionBuffer,
        dimensions: { width, height: sectionHeight },
        position: { x: 0, y: top }
      });
    }
    
    return sections;
  }
  
  async generateHtmlForSections(sections: ImageSection[]): Promise<SectionHtmlResult[]> {
    const results: SectionHtmlResult[] = [];
    
    for (const section of sections) {
      // Process each section through the existing pipeline
      const htmlResult = await this.pipelineController.processSingleSection(section);
      results.push({
        sectionIndex: section.index,
        html: htmlResult.html,
        quality: htmlResult.quality,
        metadata: htmlResult.metadata
      });
    }
    
    return results;
  }
}
```

### F2. API Endpoints for Layout Splitting

```typescript
// Layout Analysis & Splitting
POST /api/layout/analyze         // Analyze image with OpenAI vision
POST /api/layout/split           // Split image into sections
POST /api/layout/generate        // Generate HTML for split sections
GET  /api/layout/sections/:id    // Retrieve section data
DELETE /api/layout/sections/:id  // Delete section
```

### F3. Enhanced Pipeline Integration

#### F3.1 Section-Aware Pipeline Processing
**File**: `backend/src/controllers/PipelineController.ts` (Enhanced)

```typescript
export class PipelineController {
  // Existing methods...
  
  async processSectionedLayout(sections: ImageSection[]): Promise<SectionedPipelineResult> {
    const sectionResults: SectionResult[] = [];
    
    for (const section of sections) {
      const result = await this.processSingleSection(section);
      sectionResults.push(result);
    }
    
    // Combine sections into cohesive module
    const combinedModule = await this.combineSection(sectionResults);
    
    return {
      sections: sectionResults,
      combinedModule,
      overallQuality: this.calculateOverallQuality(sectionResults)
    };
  }
  
  private async processSingleSection(section: ImageSection): Promise<SectionResult> {
    // Process section through modified pipeline with section context
    const context = {
      sectionType: section.metadata?.sectionType || 'unknown',
      position: section.position,
      isPartOfLargerLayout: true
    };
    
    return await this.executePhases(section, context);
  }
}
```

## 🎯 Success Metrics

### Technical Metrics
- **Pipeline Success Rate**: >95% successful completions
- **Quality Score**: Average >85 for generated modules
- **Performance**: <2 minutes end-to-end processing
- **Error Recovery**: >90% automatic error resolution
- **Layout Splitting Accuracy**: >90% user satisfaction with AI suggestions
- **Section Processing**: <30 seconds per section

### User Experience Metrics
- **User Satisfaction**: >4.5/5 rating
- **Time to Module**: <5 minutes from upload to download
- **Error Rate**: <5% user-reported issues
- **Adoption Rate**: >80% users complete full pipeline
- **Layout Splitting Usage**: >70% users utilize interactive splitting

---

## 🚀 Next Steps

1. **Review and Approve Plan**: Stakeholder review of implementation approach
2. **Resource Allocation**: Assign development team and timeline
3. **Environment Setup**: Prepare development and testing environments
4. **Phase A Kickoff**: Begin pipeline orchestration implementation
5. **Weekly Reviews**: Track progress and adjust timeline as needed

This implementation plan will transform Templator from a simple upload-download tool into a sophisticated, enterprise-grade design-to-HubSpot-module conversion platform with comprehensive quality assurance and optimization capabilities.
