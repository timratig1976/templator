/**
 * Shared types for the Templator application
 */

export interface DetectedField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'number' | 'boolean' | 'choice' | 'color' | 'font' | 'group';
  required?: boolean;
  default?: any;
  help_text?: string;
  choices?: Array<{ label: string; value: string }>;
  validation?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
  };
  display_conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains';
    value: any;
  }>;
}

export interface ModuleManifest {
  label: string;
  module_slug?: string;
  version?: string;
  css_assets: Array<{
    path: string;
    type: 'module' | 'external';
  }>;
  external_dependencies: Array<{
    name: string;
    version: string;
  }>;
  fields: DetectedField[];
  host_template_types: string[];
  module_id: number;
  smart_type: 'NOT_SMART' | 'SMART' | 'SMART_SLIDER';
  tags: string[];
  is_available_for_new_content: boolean;
  exported_at?: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  tags: string[];
  version: string;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: number; // in minutes
  preview_url?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  tags: string[];
  version: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  created_at: string;
  last_login?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    request_id: string;
    version: string;
  };
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface BuildResult {
  success: boolean;
  timestamp: string;
  duration: number;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    category: 'import' | 'type' | 'syntax' | 'other';
  }>;
  warnings: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }>;
  summary: {
    total_files: number;
    files_with_errors: number;
    total_errors: number;
    total_warnings: number;
  };
}
