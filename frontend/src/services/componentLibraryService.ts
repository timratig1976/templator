/**
 * Frontend service for interacting with the Module Component Library
 * Connects to Phase 4 backend ComponentRepository service
 */

import { API_ENDPOINTS } from '../config/api';

export interface Component {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'layout' | 'content' | 'interactive' | 'media' | 'form' | 'navigation';
  complexity_level: 'basic' | 'intermediate' | 'advanced';
  html_template: string;
  css_classes: string[];
  hubspot_fields: any[];
  dependencies: string[];
  tags: string[];
  quality_score: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  validation_status: 'valid' | 'invalid' | 'pending';
  validation_errors: any[];
}

export interface ComponentSearchFilters {
  category?: string;
  type?: string;
  complexity_level?: string;
  tags?: string[];
  min_quality_score?: number;
  validation_status?: string;
}

export interface ComponentSearchResult {
  components: Component[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

class ComponentLibraryService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Search for components with filters
   */
  async searchComponents(
    query?: string,
    filters?: ComponentSearchFilters,
    page: number = 1,
    perPage: number = 20
  ): Promise<ComponentSearchResult> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (query) params.append('query', query);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.complexity_level) params.append('complexity_level', filters.complexity_level);
    if (filters?.min_quality_score) params.append('min_quality_score', filters.min_quality_score.toString());
    if (filters?.validation_status) params.append('validation_status', filters.validation_status);
    if (filters?.tags) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await fetch(`${this.baseUrl}/api/components/search?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search components: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a specific component by ID
   */
  async getComponent(componentId: string, includeDetails: boolean = true): Promise<Component> {
    const params = new URLSearchParams();
    if (includeDetails) params.append('include_details', 'true');

    const response = await fetch(`${this.baseUrl}/api/components/${componentId}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get component: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get components by category
   */
  async getComponentsByCategory(category: string): Promise<Component[]> {
    const response = await fetch(`${this.baseUrl}/api/components/category/${category}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get components by category: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get recommended components based on context
   */
  async getRecommendedComponents(
    context: {
      module_type?: string;
      existing_components?: string[];
      user_preferences?: any;
    }
  ): Promise<Component[]> {
    const response = await fetch(`${this.baseUrl}/api/components/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(context),
    });

    if (!response.ok) {
      throw new Error(`Failed to get recommended components: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Rate a component
   */
  async rateComponent(componentId: string, rating: number, feedback?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/components/${componentId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating, feedback }),
    });

    if (!response.ok) {
      throw new Error(`Failed to rate component: ${response.statusText}`);
    }
  }

  /**
   * Get component categories
   */
  async getCategories(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/components/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get categories: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Validate a component
   */
  async validateComponent(componentId: string): Promise<{
    is_valid: boolean;
    validation_errors: any[];
    quality_score: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/components/${componentId}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to validate component: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get component usage statistics
   */
  async getComponentStats(componentId: string): Promise<{
    usage_count: number;
    average_rating: number;
    total_ratings: number;
    recent_usage: any[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/components/${componentId}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get component stats: ${response.statusText}`);
    }

    return response.json();
  }
}

export const componentLibraryService = new ComponentLibraryService();
export default componentLibraryService;
