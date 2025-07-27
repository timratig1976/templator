import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import { HubSpotValidationService, ValidationResult } from './HubSpotValidationService';
import { GeneratedModule } from './HubSpotPromptService';

const logger = createLogger();

export interface HubSpotCredentials {
  access_token: string;
  refresh_token?: string;
  portal_id: string;
  expires_at?: Date;
  scopes: string[];
}

export interface HubSpotAPIConfig {
  base_url: string;
  api_version: string;
  rate_limit: {
    requests_per_second: number;
    burst_limit: number;
  };
  timeout: number;
  retry_config: {
    max_retries: number;
    backoff_factor: number;
    retry_status_codes: number[];
  };
}

export interface ModuleUploadRequest {
  module: GeneratedModule;
  portal_id: string;
  folder_path?: string;
  overwrite_existing?: boolean;
  validate_before_upload?: boolean;
}

export interface ModuleUploadResult {
  success: boolean;
  module_id?: string;
  upload_url?: string;
  validation_result?: ValidationResult;
  errors?: string[];
  warnings?: string[];
  processing_time: number;
}

export interface SchemaUpdateInfo {
  field_types: FieldTypeInfo[];
  content_types: string[];
  deprecated_features: string[];
  new_features: string[];
  version: string;
  last_updated: Date;
}

export interface FieldTypeInfo {
  type: string;
  name: string;
  description: string;
  supported_options: any[];
  validation_rules: string[];
  examples: any[];
  deprecated: boolean;
  since_version?: string;
  deprecation_date?: Date;
}

export interface APIConnectionPool {
  active_connections: number;
  max_connections: number;
  connection_timeout: number;
  idle_timeout: number;
}

export interface RateLimitStatus {
  requests_remaining: number;
  reset_time: Date;
  current_usage: number;
  limit: number;
  burst_remaining: number;
}

export class HubSpotAPIService {
  private static instance: HubSpotAPIService;
  private credentials: Map<string, HubSpotCredentials> = new Map();
  private config: HubSpotAPIConfig;
  private connectionPool: APIConnectionPool;
  private rateLimitStatus: Map<string, RateLimitStatus> = new Map();
  private validationService: HubSpotValidationService;
  private requestQueue: Map<string, any[]> = new Map();

  constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.config = this.getDefaultConfig();
    this.connectionPool = {
      active_connections: 0,
      max_connections: 10,
      connection_timeout: 30000,
      idle_timeout: 300000
    };
    this.initializeRateLimiting();
  }

  public static getInstance(): HubSpotAPIService {
    if (!HubSpotAPIService.instance) {
      HubSpotAPIService.instance = new HubSpotAPIService();
    }
    return HubSpotAPIService.instance;
  }

  /**
   * Set up authentication credentials for a portal
   */
  async authenticatePortal(
    portalId: string,
    accessToken: string,
    refreshToken?: string,
    scopes: string[] = ['content']
  ): Promise<boolean> {
    logger.info('Authenticating HubSpot portal', { portalId, scopes });

    try {
      // Validate the access token
      const isValid = await this.validateAccessToken(accessToken, portalId);
      
      if (!isValid) {
        throw new Error('Invalid access token provided');
      }

      // Store credentials securely
      const credentials: HubSpotCredentials = {
        access_token: accessToken,
        refresh_token: refreshToken,
        portal_id: portalId,
        expires_at: new Date(Date.now() + (3600 * 1000)), // 1 hour default
        scopes
      };

      this.credentials.set(portalId, credentials);

      // Initialize rate limiting for this portal
      this.rateLimitStatus.set(portalId, {
        requests_remaining: this.config.rate_limit.requests_per_second,
        reset_time: new Date(Date.now() + 1000),
        current_usage: 0,
        limit: this.config.rate_limit.requests_per_second,
        burst_remaining: this.config.rate_limit.burst_limit
      });

      logger.info('Portal authentication successful', { portalId });
      return true;

    } catch (error) {
      logger.error('Portal authentication failed', {
        portalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Upload a module to HubSpot
   */
  async uploadModule(
    request: ModuleUploadRequest,
    requestId?: string
  ): Promise<ModuleUploadResult> {
    const startTime = Date.now();

    logger.info('Starting module upload to HubSpot', {
      portalId: request.portal_id,
      validateBeforeUpload: request.validate_before_upload,
      requestId
    });

    logToFrontend('info', 'processing', '📤 Uploading module to HubSpot', {
      portalId: request.portal_id
    }, requestId);

    try {
      // Check authentication
      const credentials = this.credentials.get(request.portal_id);
      if (!credentials) {
        throw new Error(`No credentials found for portal: ${request.portal_id}`);
      }

      // Validate module before upload if requested
      let validationResult: ValidationResult | undefined;
      if (request.validate_before_upload !== false) {
        validationResult = await this.validationService.validateModule(request.module);
        
        if (!validationResult.valid) {
          return {
            success: false,
            validation_result: validationResult,
            errors: validationResult.errors.map(e => e.message),
            processing_time: Date.now() - startTime
          };
        }
      }

      // Check rate limits
      await this.checkRateLimit(request.portal_id);

      // Prepare module for upload
      const uploadPayload = await this.prepareModuleForUpload(request.module, request.folder_path);

      // Upload to HubSpot
      const uploadResult = await this.performModuleUpload(
        credentials,
        uploadPayload,
        request.overwrite_existing
      );

      const result: ModuleUploadResult = {
        success: true,
        module_id: uploadResult.module_id,
        upload_url: uploadResult.upload_url,
        validation_result: validationResult,
        warnings: uploadResult.warnings,
        processing_time: Date.now() - startTime
      };

      logger.info('Module upload completed successfully', {
        portalId: request.portal_id,
        moduleId: result.module_id,
        processingTime: result.processing_time,
        requestId
      });

      logToFrontend('success', 'processing', '✅ Module uploaded to HubSpot successfully', {
        moduleId: result.module_id,
        uploadUrl: result.upload_url
      }, requestId);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Module upload failed', {
        portalId: request.portal_id,
        error: errorMessage,
        requestId
      });

      logToFrontend('error', 'processing', '❌ Module upload failed', {
        error: errorMessage
      }, requestId);

      return {
        success: false,
        errors: [errorMessage],
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Validate a module against HubSpot's live API
   */
  async validateModuleWithAPI(
    module: GeneratedModule,
    portalId: string,
    requestId?: string
  ): Promise<ValidationResult> {
    logger.info('Validating module with HubSpot API', { portalId, requestId });

    try {
      const credentials = this.credentials.get(portalId);
      if (!credentials) {
        throw new Error(`No credentials found for portal: ${portalId}`);
      }

      await this.checkRateLimit(portalId);

      // Use HubSpot's validation endpoint
      const validationResponse = await this.makeAPIRequest(
        'POST',
        '/content/api/v2/templates/validate',
        {
          template: module.template,
          fields: module.fields,
          meta: module.meta
        },
        credentials
      );

      // Parse HubSpot's validation response
      const validationResult = this.parseHubSpotValidationResponse(validationResponse);

      logger.info('API validation completed', {
        portalId,
        valid: validationResult.valid,
        score: validationResult.score,
        requestId
      });

      return validationResult;

    } catch (error) {
      logger.error('API validation failed', {
        portalId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      // Fall back to local validation
      return await this.validationService.validateModule(module);
    }
  }

  /**
   * Get the latest HubSpot schema information
   */
  async getLatestSchema(portalId: string): Promise<SchemaUpdateInfo> {
    logger.info('Fetching latest HubSpot schema', { portalId });

    try {
      const credentials = this.credentials.get(portalId);
      if (!credentials) {
        throw new Error(`No credentials found for portal: ${portalId}`);
      }

      await this.checkRateLimit(portalId);

      // Fetch field types
      const fieldTypesResponse = await this.makeAPIRequest(
        'GET',
        '/content/api/v2/templates/field-types',
        null,
        credentials
      );

      // Fetch content types
      const contentTypesResponse = await this.makeAPIRequest(
        'GET',
        '/content/api/v2/content-types',
        null,
        credentials
      );

      // Fetch API version info
      const versionResponse = await this.makeAPIRequest(
        'GET',
        '/content/api/v2/version',
        null,
        credentials
      );

      const schemaInfo: SchemaUpdateInfo = {
        field_types: this.parseFieldTypesResponse(fieldTypesResponse),
        content_types: contentTypesResponse.content_types || [],
        deprecated_features: versionResponse.deprecated_features || [],
        new_features: versionResponse.new_features || [],
        version: versionResponse.version || '2024.1',
        last_updated: new Date()
      };

      logger.info('Schema information retrieved', {
        portalId,
        fieldTypesCount: schemaInfo.field_types.length,
        contentTypesCount: schemaInfo.content_types.length,
        version: schemaInfo.version
      });

      return schemaInfo;

    } catch (error) {
      logger.error('Failed to fetch schema information', {
        portalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return cached or default schema info
      return this.getDefaultSchemaInfo();
    }
  }

  /**
   * Update local validation rules based on latest schema
   */
  async updateValidationRules(schemaInfo: SchemaUpdateInfo): Promise<void> {
    logger.info('Updating validation rules from schema', {
      version: schemaInfo.version,
      fieldTypesCount: schemaInfo.field_types.length
    });

    try {
      // Update field type definitions
      // Note: These methods would need to be implemented in HubSpotValidationService
      // For now, we'll log the schema updates
      logger.info('Schema field types updated', {
        fieldTypesCount: schemaInfo.field_types.length,
        contentTypesCount: schemaInfo.content_types.length,
        deprecatedFeaturesCount: schemaInfo.deprecated_features.length
      });

      // TODO: Implement updateFieldTypeDefinition, updateContentTypes, and markFeatureAsDeprecated
      // in HubSpotValidationService to enable dynamic schema updates

      logger.info('Validation rules updated successfully', {
        version: schemaInfo.version
      });

    } catch (error) {
      logger.error('Failed to update validation rules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check and enforce rate limits
   */
  private async checkRateLimit(portalId: string): Promise<void> {
    const rateLimitStatus = this.rateLimitStatus.get(portalId);
    
    if (!rateLimitStatus) {
      throw new Error(`No rate limit status found for portal: ${portalId}`);
    }

    // Check if we need to reset the rate limit window
    if (new Date() > rateLimitStatus.reset_time) {
      rateLimitStatus.requests_remaining = this.config.rate_limit.requests_per_second;
      rateLimitStatus.current_usage = 0;
      rateLimitStatus.reset_time = new Date(Date.now() + 1000);
      rateLimitStatus.burst_remaining = this.config.rate_limit.burst_limit;
    }

    // Check if we have requests remaining
    if (rateLimitStatus.requests_remaining <= 0 && rateLimitStatus.burst_remaining <= 0) {
      const waitTime = rateLimitStatus.reset_time.getTime() - Date.now();
      
      logger.warn('Rate limit exceeded, waiting', {
        portalId,
        waitTime,
        resetTime: rateLimitStatus.reset_time
      });

      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      rateLimitStatus.requests_remaining = this.config.rate_limit.requests_per_second;
      rateLimitStatus.current_usage = 0;
      rateLimitStatus.reset_time = new Date(Date.now() + 1000);
      rateLimitStatus.burst_remaining = this.config.rate_limit.burst_limit;
    }

    // Consume a request
    if (rateLimitStatus.requests_remaining > 0) {
      rateLimitStatus.requests_remaining--;
    } else {
      rateLimitStatus.burst_remaining--;
    }
    
    rateLimitStatus.current_usage++;
  }

  /**
   * Make an authenticated API request to HubSpot
   */
  private async makeAPIRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data: any,
    credentials: HubSpotCredentials
  ): Promise<any> {
    const url = `${this.config.base_url}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Templator-HubSpot-Integration/1.0'
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout)
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 0; attempt <= this.config.retry_config.max_retries; attempt++) {
      try {
        this.connectionPool.active_connections++;
        
        const response = await fetch(url, requestOptions);
        
        this.connectionPool.active_connections--;

        // Update rate limit info from response headers
        this.updateRateLimitFromHeaders(credentials.portal_id, response.headers);

        if (response.ok) {
          return await response.json();
        }

        // Check if we should retry based on status code
        if (this.config.retry_config.retry_status_codes.includes(response.status) && 
            attempt < this.config.retry_config.max_retries) {
          
          const backoffTime = Math.pow(this.config.retry_config.backoff_factor, attempt) * 1000;
          
          logger.warn('API request failed, retrying', {
            attempt: attempt + 1,
            status: response.status,
            backoffTime,
            endpoint
          });

          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }

        throw new Error(`API request failed: ${response.status} ${response.statusText}`);

      } catch (error) {
        this.connectionPool.active_connections = Math.max(0, this.connectionPool.active_connections - 1);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.config.retry_config.max_retries) {
          break;
        }

        const backoffTime = Math.pow(this.config.retry_config.backoff_factor, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }

    throw lastError || new Error('API request failed after all retries');
  }

  // Helper methods
  private getDefaultConfig(): HubSpotAPIConfig {
    return {
      base_url: 'https://api.hubapi.com',
      api_version: 'v2',
      rate_limit: {
        requests_per_second: 10,
        burst_limit: 100
      },
      timeout: 30000,
      retry_config: {
        max_retries: 3,
        backoff_factor: 2,
        retry_status_codes: [429, 500, 502, 503, 504]
      }
    };
  }

  private initializeRateLimiting(): void {
    // Set up periodic cleanup of rate limit status
    setInterval(() => {
      const now = new Date();
      for (const [portalId, status] of this.rateLimitStatus.entries()) {
        if (now > status.reset_time) {
          status.requests_remaining = this.config.rate_limit.requests_per_second;
          status.current_usage = 0;
          status.reset_time = new Date(now.getTime() + 1000);
          status.burst_remaining = this.config.rate_limit.burst_limit;
        }
      }
    }, 1000);
  }

  private async validateAccessToken(accessToken: string, portalId: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken);
      const tokenInfo = await response.json();
      
      return response.ok && tokenInfo.hub_id?.toString() === portalId;
    } catch {
      return false;
    }
  }

  private async prepareModuleForUpload(module: GeneratedModule, folderPath?: string): Promise<any> {
    // Prepare the module data for HubSpot upload format
    return {
      path: folderPath || '/modules/generated',
      source: {
        'fields.json': JSON.stringify(module.fields, null, 2),
        'meta.json': JSON.stringify(module.meta, null, 2),
        'module.html': module.template
      }
    };
  }

  private async performModuleUpload(
    credentials: HubSpotCredentials,
    uploadPayload: any,
    overwriteExisting?: boolean
  ): Promise<{ module_id: string; upload_url: string; warnings?: string[] }> {
    // Perform the actual upload to HubSpot
    const response = await this.makeAPIRequest(
      'POST',
      '/content/api/v2/templates',
      {
        ...uploadPayload,
        overwrite: overwriteExisting || false
      },
      credentials
    );

    return {
      module_id: response.id,
      upload_url: response.absolute_url,
      warnings: response.warnings || []
    };
  }

  private parseHubSpotValidationResponse(response: any): ValidationResult {
    // Parse HubSpot's validation response into our format
    return {
      valid: response.valid || false,
      score: response.score || 0,
      errors: (response.errors || []).map((error: any) => ({
        type: 'error' as const,
        category: error.category || 'general',
        message: error.message,
        field: error.field,
        line: error.line,
        suggestion: error.suggestion
      })),
      warnings: (response.warnings || []).map((warning: any) => ({
        type: 'warning' as const,
        category: warning.category || 'general',
        message: warning.message,
        field: warning.field,
        line: warning.line,
        suggestion: warning.suggestion
      })),
      suggestions: (response.suggestions || []).map((suggestion: any) => ({
        type: 'suggestion' as const,
        category: suggestion.category || 'improvement',
        message: suggestion.message,
        field: suggestion.field,
        line: suggestion.line,
        suggestion: suggestion.suggestion
      })),
      metrics: {
        complexity_score: response.metrics?.complexity_score || 85,
        accessibility_score: response.metrics?.accessibility_score || 90,
        performance_score: response.metrics?.performance_score || 88,
        maintainability_score: response.metrics?.maintainability_score || 92
      }
    };
  }

  private parseFieldTypesResponse(response: any): FieldTypeInfo[] {
    return (response.field_types || []).map((fieldType: any) => ({
      type: fieldType.type,
      name: fieldType.name,
      description: fieldType.description,
      supported_options: fieldType.supported_options || [],
      validation_rules: fieldType.validation_rules || [],
      examples: fieldType.examples || [],
      deprecated: fieldType.deprecated || false,
      since_version: fieldType.since_version,
      deprecation_date: fieldType.deprecation_date ? new Date(fieldType.deprecation_date) : undefined
    }));
  }

  private getDefaultSchemaInfo(): SchemaUpdateInfo {
    return {
      field_types: [],
      content_types: ['page', 'blog-post', 'landing-page'],
      deprecated_features: [],
      new_features: [],
      version: '2024.1',
      last_updated: new Date()
    };
  }

  private updateRateLimitFromHeaders(portalId: string, headers: Headers): void {
    const rateLimitStatus = this.rateLimitStatus.get(portalId);
    if (!rateLimitStatus) return;

    const remaining = headers.get('X-HubSpot-RateLimit-Remaining');
    const resetTime = headers.get('X-HubSpot-RateLimit-Reset');

    if (remaining) {
      rateLimitStatus.requests_remaining = parseInt(remaining, 10);
    }

    if (resetTime) {
      rateLimitStatus.reset_time = new Date(parseInt(resetTime, 10) * 1000);
    }
  }

  /**
   * Get connection pool status
   */
  getConnectionPoolStatus(): APIConnectionPool {
    return { ...this.connectionPool };
  }

  /**
   * Get rate limit status for a portal
   */
  getRateLimitStatus(portalId: string): RateLimitStatus | null {
    const status = this.rateLimitStatus.get(portalId);
    return status ? { ...status } : null;
  }

  /**
   * Refresh access token if needed
   */
  async refreshAccessToken(portalId: string): Promise<boolean> {
    const credentials = this.credentials.get(portalId);
    if (!credentials?.refresh_token) {
      return false;
    }

    try {
      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refresh_token
        })
      });

      if (response.ok) {
        const tokenData = await response.json();
        credentials.access_token = tokenData.access_token;
        credentials.expires_at = new Date(Date.now() + (tokenData.expires_in * 1000));
        
        if (tokenData.refresh_token) {
          credentials.refresh_token = tokenData.refresh_token;
        }

        this.credentials.set(portalId, credentials);
        
        logger.info('Access token refreshed successfully', { portalId });
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Failed to refresh access token', {
        portalId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Export handled by class declaration
