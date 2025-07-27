/**
 * Frontend service for interacting with the Component Assembly Engine
 * Connects to Phase 4 backend ComponentAssemblyEngine service
 */

import { API_ENDPOINTS } from '../config/api';

export interface AssemblyRequest {
  target_module_type: string;
  design_requirements: string;
  component_preferences: {
    preferred_components?: string[];
    excluded_components?: string[];
    complexity_preference?: 'simple' | 'moderate' | 'complex';
    style_preferences?: string[];
  };
  constraints: {
    max_components?: number;
    performance_requirements?: {
      max_load_time_ms?: number;
      max_bundle_size_kb?: number;
    };
    accessibility_level?: 'basic' | 'aa' | 'aaa';
    browser_support?: string[];
  };
  customization_options?: {
    allow_ai_modifications?: boolean;
    preserve_branding?: boolean;
    responsive_breakpoints?: string[];
  };
}

export interface AssemblyResult {
  assembly_id: string;
  status: 'success' | 'partial' | 'failed';
  assembled_module: {
    html_template: string;
    css_styles: string;
    hubspot_fields: any[];
    meta_config: any;
    component_manifest: {
      components_used: string[];
      assembly_strategy: string;
      compatibility_score: number;
      performance_metrics: {
        estimated_load_time_ms: number;
        bundle_size_kb: number;
        complexity_score: number;
      };
    };
  };
  assembly_log: {
    steps_completed: string[];
    ai_decisions: any[];
    compatibility_checks: any[];
    optimizations_applied: string[];
  };
  quality_metrics: {
    overall_score: number;
    component_compatibility: number;
    performance_score: number;
    maintainability_score: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface AssemblyStatus {
  assembly_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  current_step: string;
  estimated_completion_time?: string;
  error_message?: string;
}

export interface ComponentCompatibility {
  component_a_id: string;
  component_b_id: string;
  compatibility_score: number;
  compatibility_issues: string[];
  resolution_suggestions: string[];
}

class AssemblyEngineService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Start a new component assembly process
   */
  async assembleComponents(request: AssemblyRequest): Promise<AssemblyResult> {
    const response = await fetch(`${this.baseUrl}/api/assembly/assemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to assemble components: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get assembly status for a specific assembly ID
   */
  async getAssemblyStatus(assemblyId: string): Promise<AssemblyStatus> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get assembly status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed assembly result
   */
  async getAssemblyResult(assemblyId: string): Promise<AssemblyResult> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/result`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get assembly result: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check compatibility between components
   */
  async checkComponentCompatibility(
    componentIds: string[]
  ): Promise<ComponentCompatibility[]> {
    const response = await fetch(`${this.baseUrl}/api/assembly/compatibility`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ component_ids: componentIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check component compatibility: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get assembly suggestions based on requirements
   */
  async getAssemblySuggestions(requirements: {
    module_type: string;
    description: string;
    constraints?: any;
  }): Promise<{
    suggested_components: string[];
    assembly_strategies: string[];
    estimated_metrics: {
      complexity_score: number;
      performance_score: number;
      development_time_hours: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/api/assembly/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requirements),
    });

    if (!response.ok) {
      throw new Error(`Failed to get assembly suggestions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Optimize an existing assembly
   */
  async optimizeAssembly(
    assemblyId: string,
    optimizationGoals: {
      target_metrics?: {
        performance?: number;
        accessibility?: number;
        maintainability?: number;
      };
      constraints?: {
        preserve_functionality?: boolean;
        max_changes?: number;
      };
    }
  ): Promise<AssemblyResult> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(optimizationGoals),
    });

    if (!response.ok) {
      throw new Error(`Failed to optimize assembly: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Validate an assembly
   */
  async validateAssembly(assemblyId: string): Promise<{
    is_valid: boolean;
    validation_errors: any[];
    quality_score: number;
    performance_metrics: any;
    recommendations: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to validate assembly: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get assembly history for analytics
   */
  async getAssemblyHistory(filters?: {
    date_from?: string;
    date_to?: string;
    status?: string;
    module_type?: string;
  }): Promise<{
    assemblies: AssemblyStatus[];
    total_count: number;
    success_rate: number;
    average_completion_time_ms: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.module_type) params.append('module_type', filters.module_type);

    const response = await fetch(`${this.baseUrl}/api/assembly/history?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get assembly history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel an ongoing assembly
   */
  async cancelAssembly(assemblyId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel assembly: ${response.statusText}`);
    }
  }

  /**
   * Get assembly performance metrics
   */
  async getAssemblyMetrics(assemblyId: string): Promise<{
    performance_score: number;
    load_time_ms: number;
    bundle_size_kb: number;
    accessibility_score: number;
    seo_score: number;
    maintainability_score: number;
    detailed_metrics: any;
  }> {
    const response = await fetch(`${this.baseUrl}/api/assembly/${assemblyId}/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get assembly metrics: ${response.statusText}`);
    }

    return response.json();
  }
}

export const assemblyEngineService = new AssemblyEngineService();
export default assemblyEngineService;
