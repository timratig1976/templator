/**
 * Pipeline Progress Tracker
 * Real-time tracking and monitoring of pipeline execution progress
 * Provides WebSocket-based updates and detailed phase monitoring
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export interface PhaseProgress {
  phaseName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  errors?: string[];
  warnings?: string[];
  metrics?: Record<string, any>;
}

export interface PipelineProgress {
  pipelineId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number; // 0-100
  currentPhase: string;
  startTime: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  phases: PhaseProgress[];
  metadata: {
    fileName: string;
    fileSize: number;
    totalPhases: number;
    completedPhases: number;
    failedPhases: number;
  };
  qualityMetrics?: {
    current: number;
    target: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    avgPhaseTime: number;
  };
}

export interface ProgressUpdate {
  pipelineId: string;
  type: 'phase_started' | 'phase_progress' | 'phase_completed' | 'phase_failed' | 'pipeline_completed' | 'pipeline_failed';
  timestamp: Date;
  data: Partial<PipelineProgress>;
}

export class PipelineProgressTracker extends EventEmitter {
  private activePipelines: Map<string, PipelineProgress> = new Map();
  private phaseWeights: Record<string, number> = {
    inputProcessing: 10,
    aiGeneration: 35,
    qualityAssurance: 25,
    enhancement: 20,
    modulePackaging: 10
  };

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Initialize pipeline tracking
   */
  initializePipeline(
    pipelineId: string,
    fileName: string,
    fileSize: number,
    phases: string[] = ['inputProcessing', 'aiGeneration', 'qualityAssurance', 'enhancement', 'modulePackaging']
  ): PipelineProgress {
    const progress: PipelineProgress = {
      pipelineId,
      status: 'initializing',
      overallProgress: 0,
      currentPhase: 'initialization',
      startTime: new Date(),
      phases: phases.map(phaseName => ({
        phaseName,
        status: 'pending',
        progress: 0
      })),
      metadata: {
        fileName,
        fileSize,
        totalPhases: phases.length,
        completedPhases: 0,
        failedPhases: 0
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        avgPhaseTime: 0
      }
    };

    this.activePipelines.set(pipelineId, progress);
    
    logger.info('Pipeline tracking initialized', {
      pipelineId,
      fileName,
      totalPhases: phases.length
    });

    this.emitUpdate(pipelineId, 'phase_started', progress);
    return progress;
  }

  /**
   * Start a specific phase
   */
  startPhase(pipelineId: string, phaseName: string, totalSteps?: number): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) {
      logger.warn('Pipeline not found for phase start', { pipelineId, phaseName });
      return;
    }

    const phase = progress.phases.find(p => p.phaseName === phaseName);
    if (!phase) {
      logger.warn('Phase not found in pipeline', { pipelineId, phaseName });
      return;
    }

    // Update phase status
    phase.status = 'running';
    phase.startTime = new Date();
    phase.progress = 0;
    phase.totalSteps = totalSteps;
    phase.completedSteps = 0;
    phase.errors = [];
    phase.warnings = [];

    // Update pipeline status
    progress.status = 'running';
    progress.currentPhase = phaseName;

    // Calculate estimated completion
    this.updateEstimatedCompletion(progress);

    logger.info('Phase started', {
      pipelineId,
      phaseName,
      totalSteps
    });

    this.emitUpdate(pipelineId, 'phase_started', progress);
  }

  /**
   * Update phase progress
   */
  updatePhaseProgress(
    pipelineId: string,
    phaseName: string,
    completedSteps: number,
    currentStep?: string,
    metrics?: Record<string, any>
  ): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    const phase = progress.phases.find(p => p.phaseName === phaseName);
    if (!phase || phase.status !== 'running') return;

    // Update phase progress
    phase.completedSteps = completedSteps;
    phase.currentStep = currentStep;
    if (metrics) {
      phase.metrics = { ...phase.metrics, ...metrics };
    }

    // Calculate phase progress percentage
    if (phase.totalSteps && phase.totalSteps > 0) {
      phase.progress = Math.min(100, (completedSteps / phase.totalSteps) * 100);
    }

    // Update overall pipeline progress
    this.updateOverallProgress(progress);

    // Update performance metrics
    this.updatePerformanceMetrics(progress);

    this.emitUpdate(pipelineId, 'phase_progress', progress);
  }

  /**
   * Complete a phase
   */
  completePhase(
    pipelineId: string,
    phaseName: string,
    metrics?: Record<string, any>,
    warnings?: string[]
  ): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    const phase = progress.phases.find(p => p.phaseName === phaseName);
    if (!phase) return;

    // Update phase status
    phase.status = 'completed';
    phase.endTime = new Date();
    phase.progress = 100;
    if (phase.startTime) {
      phase.duration = phase.endTime.getTime() - phase.startTime.getTime();
    }
    if (metrics) {
      phase.metrics = { ...phase.metrics, ...metrics };
    }
    if (warnings) {
      phase.warnings = [...(phase.warnings || []), ...warnings];
    }

    // Update pipeline metadata
    progress.metadata.completedPhases++;

    // Update overall progress
    this.updateOverallProgress(progress);

    // Check if pipeline is complete
    const allPhasesCompleted = progress.phases.every(p => 
      p.status === 'completed' || p.status === 'skipped'
    );

    if (allPhasesCompleted) {
      this.completePipeline(pipelineId);
    }

    logger.info('Phase completed', {
      pipelineId,
      phaseName,
      duration: phase.duration,
      warnings: warnings?.length || 0
    });

    this.emitUpdate(pipelineId, 'phase_completed', progress);
  }

  /**
   * Fail a phase
   */
  failPhase(pipelineId: string, phaseName: string, error: string): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    const phase = progress.phases.find(p => p.phaseName === phaseName);
    if (!phase) return;

    // Update phase status
    phase.status = 'failed';
    phase.endTime = new Date();
    if (phase.startTime) {
      phase.duration = phase.endTime.getTime() - phase.startTime.getTime();
    }
    phase.errors = [...(phase.errors || []), error];

    // Update pipeline metadata
    progress.metadata.failedPhases++;
    progress.status = 'failed';

    logger.error('Phase failed', {
      pipelineId,
      phaseName,
      error,
      duration: phase.duration
    });

    this.emitUpdate(pipelineId, 'phase_failed', progress);
  }

  /**
   * Skip a phase
   */
  skipPhase(pipelineId: string, phaseName: string, reason: string): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    const phase = progress.phases.find(p => p.phaseName === phaseName);
    if (!phase) return;

    phase.status = 'skipped';
    phase.progress = 100;
    phase.warnings = [...(phase.warnings || []), `Phase skipped: ${reason}`];

    this.updateOverallProgress(progress);

    logger.info('Phase skipped', {
      pipelineId,
      phaseName,
      reason
    });

    this.emitUpdate(pipelineId, 'phase_progress', progress);
  }

  /**
   * Complete entire pipeline
   */
  completePipeline(pipelineId: string): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    progress.status = 'completed';
    progress.endTime = new Date();
    progress.overallProgress = 100;

    // Calculate final performance metrics
    this.calculateFinalMetrics(progress);

    logger.info('Pipeline completed', {
      pipelineId,
      duration: progress.endTime.getTime() - progress.startTime.getTime(),
      completedPhases: progress.metadata.completedPhases,
      failedPhases: progress.metadata.failedPhases
    });

    this.emitUpdate(pipelineId, 'pipeline_completed', progress);
  }

  /**
   * Fail entire pipeline
   */
  failPipeline(pipelineId: string, error: string): void {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return;

    progress.status = 'failed';
    progress.endTime = new Date();

    logger.error('Pipeline failed', {
      pipelineId,
      error,
      completedPhases: progress.metadata.completedPhases
    });

    this.emitUpdate(pipelineId, 'pipeline_failed', progress);
  }

  /**
   * Get pipeline progress
   */
  getProgress(pipelineId: string): PipelineProgress | undefined {
    return this.activePipelines.get(pipelineId);
  }

  /**
   * Get all active pipelines
   */
  getAllActiveProgresses(): PipelineProgress[] {
    return Array.from(this.activePipelines.values());
  }

  /**
   * Cancel pipeline
   */
  cancelPipeline(pipelineId: string): boolean {
    const progress = this.activePipelines.get(pipelineId);
    if (!progress) return false;

    progress.status = 'cancelled';
    progress.endTime = new Date();

    // Mark running phases as cancelled
    progress.phases.forEach(phase => {
      if (phase.status === 'running') {
        phase.status = 'failed';
        phase.endTime = new Date();
        phase.errors = [...(phase.errors || []), 'Pipeline cancelled'];
      }
    });

    logger.info('Pipeline cancelled', { pipelineId });
    return true;
  }

  /**
   * Private helper methods
   */
  private updateOverallProgress(progress: PipelineProgress): void {
    let totalWeight = 0;
    let completedWeight = 0;

    progress.phases.forEach(phase => {
      const weight = this.phaseWeights[phase.phaseName] || 20;
      totalWeight += weight;
      
      if (phase.status === 'completed' || phase.status === 'skipped') {
        completedWeight += weight;
      } else if (phase.status === 'running') {
        completedWeight += (weight * phase.progress / 100);
      }
    });

    progress.overallProgress = totalWeight > 0 ? 
      Math.round((completedWeight / totalWeight) * 100) : 0;
  }

  private updateEstimatedCompletion(progress: PipelineProgress): void {
    const completedPhases = progress.phases.filter(p => p.status === 'completed');
    if (completedPhases.length === 0) return;

    const avgPhaseTime = completedPhases.reduce((sum, phase) => 
      sum + (phase.duration || 0), 0) / completedPhases.length;

    const remainingPhases = progress.phases.filter(p => 
      p.status === 'pending' || p.status === 'running').length;

    const estimatedRemainingTime = remainingPhases * avgPhaseTime;
    progress.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
  }

  private updatePerformanceMetrics(progress: PipelineProgress): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    progress.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    progress.performance.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // seconds

    const completedPhases = progress.phases.filter(p => p.status === 'completed');
    if (completedPhases.length > 0) {
      progress.performance.avgPhaseTime = completedPhases.reduce((sum, phase) => 
        sum + (phase.duration || 0), 0) / completedPhases.length;
    }
  }

  private calculateFinalMetrics(progress: PipelineProgress): void {
    const totalDuration = progress.endTime!.getTime() - progress.startTime.getTime();
    const completedPhases = progress.phases.filter(p => p.status === 'completed');
    
    progress.performance.avgPhaseTime = completedPhases.length > 0 ?
      completedPhases.reduce((sum, phase) => sum + (phase.duration || 0), 0) / completedPhases.length : 0;

    // Calculate quality trend if metrics are available
    const phasesWithQuality = progress.phases.filter(p => p.metrics?.qualityScore);
    if (phasesWithQuality.length > 1) {
      const firstQuality = phasesWithQuality[0].metrics!.qualityScore;
      const lastQuality = phasesWithQuality[phasesWithQuality.length - 1].metrics!.qualityScore;
      
      progress.qualityMetrics = {
        current: lastQuality,
        target: 80, // Default target
        trend: lastQuality > firstQuality ? 'improving' : 
               lastQuality < firstQuality ? 'declining' : 'stable'
      };
    }
  }

  private emitUpdate(pipelineId: string, type: ProgressUpdate['type'], progress: PipelineProgress): void {
    const update: ProgressUpdate = {
      pipelineId,
      type,
      timestamp: new Date(),
      data: progress
    };

    this.emit('progress-update', update);
    this.emit(type, update);
  }

  private setupCleanupInterval(): void {
    // Clean up completed pipelines older than 1 hour
    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const [pipelineId, progress] of this.activePipelines) {
        if (progress.endTime && progress.endTime.getTime() < oneHourAgo) {
          this.activePipelines.delete(pipelineId);
          logger.debug('Cleaned up old pipeline progress', { pipelineId });
        }
      }
    }, 10 * 60 * 1000); // Run every 10 minutes
  }
}

export default PipelineProgressTracker;
