/**
 * Progress Tracking Service
 * Handles phase progress updates and callback management
 */

import type { AIPhaseProgress, PhaseProgressCallback } from './types';

export class ProgressTracker {
  private phaseProgressCallbacks: PhaseProgressCallback[] = [];
  
  /**
   * Register a progress callback
   */
  addProgressCallback(callback: PhaseProgressCallback): void {
    this.phaseProgressCallbacks.push(callback);
  }
  
  /**
   * Remove all progress callbacks
   */
  clearProgressCallbacks(): void {
    this.phaseProgressCallbacks = [];
  }
  
  /**
   * Update phase progress and notify callbacks
   */
  async updatePhaseProgress(
    phaseId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress: number,
    insights?: string[]
  ): Promise<void> {
    const phases: AIPhaseProgress[] = [
      {
        phaseId: 'upload',
        name: 'Design Upload',
        status: phaseId === 'upload' ? status : (this.isPhaseCompleted('upload', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'upload' ? progress : (this.isPhaseCompleted('upload', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'section-detection',
        name: 'Section Detection',
        status: phaseId === 'section-detection' ? status : (this.isPhaseCompleted('section-detection', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'section-detection' ? progress : (this.isPhaseCompleted('section-detection', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'ai-analysis',
        name: 'AI Vision Analysis',
        status: phaseId === 'ai-analysis' ? status : (this.isPhaseCompleted('ai-analysis', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'ai-analysis' ? progress : (this.isPhaseCompleted('ai-analysis', phaseId) ? 100 : 0),
        insights: phaseId === 'ai-analysis' ? insights : undefined
      },
      {
        phaseId: 'smart-splitting',
        name: 'Smart Section Processing',
        status: phaseId === 'smart-splitting' ? status : (this.isPhaseCompleted('smart-splitting', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'smart-splitting' ? progress : (this.isPhaseCompleted('smart-splitting', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'html-generation',
        name: 'AI HTML Generation',
        status: phaseId === 'html-generation' ? status : (this.isPhaseCompleted('html-generation', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'html-generation' ? progress : (this.isPhaseCompleted('html-generation', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'module-packaging',
        name: 'HubSpot Module Packaging',
        status: phaseId === 'module-packaging' ? status : 'pending',
        progress: phaseId === 'module-packaging' ? progress : 0
      }
    ];

    // Notify all registered callbacks
    this.phaseProgressCallbacks.forEach(callback => {
      try {
        callback(phases);
      } catch (error) {
        console.error('Error in phase progress callback:', error);
      }
    });

    // Small delay to allow UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Check if a phase is completed relative to current phase
   */
  private isPhaseCompleted(checkPhase: string, currentPhase: string): boolean {
    const phaseOrder = ['upload', 'section-detection', 'ai-analysis', 'smart-splitting', 'html-generation', 'module-packaging'];
    const checkIndex = phaseOrder.indexOf(checkPhase);
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return checkIndex < currentIndex;
  }
}
