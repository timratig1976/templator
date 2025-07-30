// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';

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
} as const;

export default API_ENDPOINTS;
