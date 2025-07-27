/**
 * Frontend service for interacting with the Expert Review Dashboard
 * Connects to Phase 4 backend ExpertReviewDashboard service
 */

import { API_ENDPOINTS } from '../config/api';

export interface ReviewRequest {
  module_id: string;
  module_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  review_type: 'quality' | 'performance' | 'accessibility' | 'security' | 'comprehensive';
  deadline?: string;
  special_requirements?: string[];
  context: {
    project_name?: string;
    client_requirements?: string;
    target_audience?: string;
    business_goals?: string[];
  };
}

export interface ReviewAssignment {
  assignment_id: string;
  review_request_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_expertise: string[];
  assigned_at: string;
  due_date: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  estimated_hours: number;
}

export interface ReviewResult {
  review_id: string;
  assignment_id: string;
  reviewer_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  overall_score: number;
  category_scores: {
    code_quality: number;
    performance: number;
    accessibility: number;
    maintainability: number;
    security: number;
    user_experience: number;
  };
  findings: ReviewFinding[];
  recommendations: ReviewRecommendation[];
  approval_status: 'approved' | 'approved_with_conditions' | 'rejected';
  reviewer_notes: string;
  time_spent_hours: number;
  completed_at: string;
}

export interface ReviewFinding {
  finding_id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: {
    file_path?: string;
    line_number?: number;
    component?: string;
  };
  evidence: string[];
  impact_assessment: string;
  suggested_fix: string;
}

export interface ReviewRecommendation {
  recommendation_id: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  implementation_effort: 'low' | 'medium' | 'high';
  expected_impact: string;
  implementation_steps: string[];
}

export interface ReviewDashboardData {
  pending_reviews: number;
  in_progress_reviews: number;
  completed_reviews: number;
  overdue_reviews: number;
  average_review_time_hours: number;
  reviewer_workload: {
    reviewer_id: string;
    reviewer_name: string;
    active_reviews: number;
    avg_completion_time_hours: number;
    quality_score: number;
  }[];
  recent_activity: {
    activity_type: string;
    description: string;
    timestamp: string;
    reviewer_name?: string;
  }[];
  quality_trends: {
    date: string;
    average_score: number;
    review_count: number;
  }[];
}

export interface AIInsights {
  insights_id: string;
  module_id: string;
  generated_at: string;
  quality_prediction: {
    predicted_score: number;
    confidence: number;
    risk_factors: string[];
  };
  automated_findings: ReviewFinding[];
  optimization_suggestions: string[];
  complexity_analysis: {
    complexity_score: number;
    maintainability_risk: 'low' | 'medium' | 'high';
    technical_debt_indicators: string[];
  };
  performance_insights: {
    predicted_load_time_ms: number;
    optimization_opportunities: string[];
    performance_bottlenecks: string[];
  };
}

class ExpertReviewService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Submit a new review request
   */
  async submitReviewRequest(request: ReviewRequest): Promise<{
    request_id: string;
    estimated_completion_time: string;
    assigned_reviewer?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/review/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit review request: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get review request status
   */
  async getReviewStatus(requestId: string): Promise<{
    request_id: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    assignment?: ReviewAssignment;
    progress_percentage: number;
    estimated_completion: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/review/${requestId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get review status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get review result
   */
  async getReviewResult(reviewId: string): Promise<ReviewResult> {
    const response = await fetch(`${this.baseUrl}/api/review/${reviewId}/result`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get review result: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<ReviewDashboardData> {
    const response = await fetch(`${this.baseUrl}/api/review/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get dashboard data: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get AI insights for a module
   */
  async getAIInsights(moduleId: string): Promise<AIInsights> {
    const response = await fetch(`${this.baseUrl}/api/review/ai-insights/${moduleId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get AI insights: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get available reviewers
   */
  async getAvailableReviewers(expertise?: string[]): Promise<{
    reviewer_id: string;
    name: string;
    expertise_areas: string[];
    current_workload: number;
    average_review_time_hours: number;
    quality_rating: number;
    availability_status: 'available' | 'busy' | 'unavailable';
  }[]> {
    const params = new URLSearchParams();
    if (expertise) {
      expertise.forEach(exp => params.append('expertise', exp));
    }

    const response = await fetch(`${this.baseUrl}/api/review/reviewers?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get available reviewers: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get review history
   */
  async getReviewHistory(filters?: {
    date_from?: string;
    date_to?: string;
    reviewer_id?: string;
    status?: string;
    module_type?: string;
  }): Promise<{
    reviews: ReviewResult[];
    total_count: number;
    average_score: number;
    completion_rate: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.reviewer_id) params.append('reviewer_id', filters.reviewer_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.module_type) params.append('module_type', filters.module_type);

    const response = await fetch(`${this.baseUrl}/api/review/history?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get review history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update review priority
   */
  async updateReviewPriority(requestId: string, priority: 'low' | 'medium' | 'high' | 'urgent'): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/review/${requestId}/priority`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priority }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update review priority: ${response.statusText}`);
    }
  }

  /**
   * Cancel a review request
   */
  async cancelReviewRequest(requestId: string, reason?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/review/${requestId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel review request: ${response.statusText}`);
    }
  }

  /**
   * Get review analytics
   */
  async getReviewAnalytics(timeframe: 'week' | 'month' | 'quarter' | 'year'): Promise<{
    total_reviews: number;
    average_score: number;
    completion_rate: number;
    average_turnaround_hours: number;
    quality_trends: any[];
    reviewer_performance: any[];
    common_issues: any[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/review/analytics?timeframe=${timeframe}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get review analytics: ${response.statusText}`);
    }

    return response.json();
  }
}

export const expertReviewService = new ExpertReviewService();
export default expertReviewService;
