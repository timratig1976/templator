// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';

// API Endpoints
export const API_ENDPOINTS = {
  // Legacy endpoints (kept for backward compatibility)
  DESIGN_UPLOAD: `${API_BASE_URL}/api/design/upload`,
  DESIGN_REFINE: `${API_BASE_URL}/api/design/refine`,
  MODULE_GENERATE: `${API_BASE_URL}/api/module`,
  PREVIEW_GENERATE: `${API_BASE_URL}/api/preview`,
  SUPPORTED_TYPES: `${API_BASE_URL}/api/design/supported-types`,
  
  // New Modular Pipeline Endpoints
  PIPELINE_EXECUTE: `${API_BASE_URL}/api/pipeline/execute`,
  PIPELINE_STATUS: `${API_BASE_URL}/api/pipeline/status`,
  PIPELINE_QUALITY: `${API_BASE_URL}/api/pipeline/quality`,
  PIPELINE_ENHANCE: `${API_BASE_URL}/api/pipeline/enhance`,
  PIPELINE_REGENERATE_HTML: `${API_BASE_URL}/api/pipeline/regenerate-html`,
  PIPELINE_SUPPORTED_TYPES: `${API_BASE_URL}/api/pipeline/supported-types`,
  
  // System endpoints
  HEALTH: `${API_BASE_URL}/health`,
  LOGS: `${API_BASE_URL}/api/logs`,
  LOGS_STREAM: `${API_BASE_URL}/api/logs/stream`,
  LOGS_EXPORT: `${API_BASE_URL}/api/logs/export`,
  
  // Admin: Project Flows and Domain Phases
  ADMIN_PROJECT_FLOWS: `${API_BASE_URL}/api/admin/project-flows`,
  ADMIN_GENERATE_FLOW_FROM_BRIEF: `${API_BASE_URL}/api/admin/project-flows/generate-from-brief`,
  ADMIN_PROJECT_FLOW_PHASES: (flowId: string) => `${API_BASE_URL}/api/admin/project-flows/${flowId}/phases`,
  ADMIN_PHASES_REORDER: `${API_BASE_URL}/api/admin/project-flows/phases/reorder`,
  ADMIN_PHASE: (phaseId: string) => `${API_BASE_URL}/api/admin/project-flows/phases/${phaseId}`,
  ADMIN_PHASE_STEPS: (phaseId: string) => `${API_BASE_URL}/api/admin/project-flows/phases/${phaseId}/steps`,
  ADMIN_PHASE_STEPS_REORDER: (phaseId: string) => `${API_BASE_URL}/api/admin/project-flows/phases/${phaseId}/steps/reorder`,
  ADMIN_PHASE_STEP: (id: string) => `${API_BASE_URL}/api/admin/project-flows/phase-steps/${id}`,
  ADMIN_FLOW_ALLOWED_STEPS: (flowId: string) => `${API_BASE_URL}/api/admin/project-flows/${flowId}/allowed-steps`,

  // Admin: AI Steps (Step Definitions)
  ADMIN_AI_STEPS: `${API_BASE_URL}/api/admin/ai-steps`,

  // Admin: Pipelines (for binding flows to pipelines/versions)
  ADMIN_PIPELINES: `${API_BASE_URL}/api/admin/pipelines/pipelines`,
  ADMIN_PIPELINE_VERSIONS: (pipelineId: string) => `${API_BASE_URL}/api/admin/pipelines/pipelines/${pipelineId}/versions`,
  ADMIN_GENERATE_PIPELINE_FROM_FLOW: (flowId: string) => `${API_BASE_URL}/api/admin/pipelines/generate-from-flow/${flowId}`,
  ADMIN_FLOW_BIND_PIPELINE: (flowId: string) => `${API_BASE_URL}/api/admin/project-flows/${flowId}/pipeline`,
  ADMIN_FLOW_UNPIN_PIPELINE: (flowId: string) => `${API_BASE_URL}/api/admin/project-flows/${flowId}/pipeline/unpin`,

  // Admin: DomainPhaseStep params management (manual/uiHints)
  ADMIN_DPS_PARAMS: (id: string) => `${API_BASE_URL}/api/admin/pipelines/domain-phase-steps/${id}/params`,

  // UI: Flow runner (Stage 1)
  UI_FLOW_MANIFEST: (flowId: string) => `${API_BASE_URL}/api/ui/flows/${flowId}/manifest`,
  UI_FLOW_STEP_ACTION: (flowId: string, phaseStepId: string) => `${API_BASE_URL}/api/ui/flows/${flowId}/steps/${phaseStepId}/action`,
} as const;

export default API_ENDPOINTS;
