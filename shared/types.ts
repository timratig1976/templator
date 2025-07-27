// Shared TypeScript types for Windsurf MVP

export interface DetectedField {
  id: string;
  label: string;
  type: 'text' | 'richtext' | 'image' | 'url' | 'choice';
  selector: string;
  required: boolean;
  default: string;
}

export interface ModuleManifest {
  module_slug: string;
  fields: DetectedField[];
  version: string;
  exported_at: string;
}

export interface ParseRequest {
  source_type: 'html' | 'json_component';
  payload: string;
}

export interface ParseResponse {
  html_normalized: string;
  fields_detected: DetectedField[];
}

export interface ModuleRequest {
  html_normalized: string;
  fields_config?: Partial<DetectedField>[];
}

export interface ModuleResponse {
  module_zip_url: string;
  module_slug: string;
  manifest: ModuleManifest;
}

export interface PreviewRequest {
  html_normalized: string;
  sample_data?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  code: 'INPUT_INVALID' | 'FIELD_MAPPING_EMPTY' | 'EXPORT_FAILED' | 'PREVIEW_RENDER_ERROR' | 'INTERNAL_ERROR' | 'INVALID_SIZE' | 'BATCH_NOT_FOUND';
  details?: string;
  suggestion?: string;
}

export interface FieldMappingRule {
  selector: string;
  fieldType: DetectedField['type'];
  fieldId: string;
  label: string;
  required?: boolean;
}

export const DEFAULT_FIELD_MAPPING_RULES: FieldMappingRule[] = [
  { selector: 'h1, .headline, [data-field=headline]', fieldType: 'text', fieldId: 'headline', label: 'Headline', required: true },
  { selector: 'h2, h3, .subheadline, [data-field=subheadline]', fieldType: 'text', fieldId: 'subheadline', label: 'Subheadline' },
  { selector: 'p, .copy, [data-field=body]', fieldType: 'richtext', fieldId: 'body', label: 'Text' },
  { selector: 'img, [data-field=image]', fieldType: 'image', fieldId: 'image_main', label: 'Image' },
  { selector: 'a.btn, .button, [data-field=cta]', fieldType: 'url', fieldId: 'cta_primary', label: 'CTA Button' },
];
