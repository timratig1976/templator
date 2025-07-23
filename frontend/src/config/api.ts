// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';

// API Endpoints
export const API_ENDPOINTS = {
  DESIGN_UPLOAD: `${API_BASE_URL}/api/design/upload`,
  DESIGN_REFINE: `${API_BASE_URL}/api/design/refine`,
  MODULE_GENERATE: `${API_BASE_URL}/api/module`,
  PREVIEW_GENERATE: `${API_BASE_URL}/api/preview`,
  SUPPORTED_TYPES: `${API_BASE_URL}/api/design/supported-types`,
  HEALTH: `${API_BASE_URL}/health`,
} as const;

export default API_ENDPOINTS;
