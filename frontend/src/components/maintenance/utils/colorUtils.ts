/**
 * Color Utilities for Maintenance Dashboard
 * Centralized color logic for consistent theming
 */

export interface ColorScheme {
  bg: string;
  text: string;
  icon: string;
  iconText: string;
  progress: string;
  chart: string;
}

/**
 * Get color scheme based on quality score
 */
export const getQualityColors = (score: number): ColorScheme => {
  if (score >= 85) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: 'bg-green-100',
      iconText: 'text-green-600',
      progress: 'bg-green-500',
      chart: 'bg-green-500'
    };
  } else if (score >= 70) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      icon: 'bg-orange-100',
      iconText: 'text-orange-600',
      progress: 'bg-orange-500',
      chart: 'bg-orange-500'
    };
  } else {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: 'bg-red-100',
      iconText: 'text-red-600',
      progress: 'bg-red-500',
      chart: 'bg-red-500'
    };
  }
};

/**
 * Get color scheme based on percentage value
 */
export const getPercentageColors = (percentage: number): ColorScheme => {
  if (percentage >= 90) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: 'bg-green-100',
      iconText: 'text-green-600',
      progress: 'bg-green-500',
      chart: 'bg-green-500'
    };
  } else if (percentage >= 75) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      icon: 'bg-orange-100',
      iconText: 'text-orange-600',
      progress: 'bg-orange-500',
      chart: 'bg-orange-500'
    };
  } else {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: 'bg-red-100',
      iconText: 'text-red-600',
      progress: 'bg-red-500',
      chart: 'bg-red-500'
    };
  }
};

/**
 * Get color scheme based on response time
 */
export const getResponseTimeColors = (responseTime: number): ColorScheme => {
  if (responseTime <= 100) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: 'bg-green-100',
      iconText: 'text-green-600',
      progress: 'bg-green-500',
      chart: 'bg-green-500'
    };
  } else if (responseTime <= 300) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      icon: 'bg-orange-100',
      iconText: 'text-orange-600',
      progress: 'bg-orange-500',
      chart: 'bg-orange-500'
    };
  } else {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: 'bg-red-100',
      iconText: 'text-red-600',
      progress: 'bg-red-500',
      chart: 'bg-red-500'
    };
  }
};

/**
 * Get status color based on health status
 */
export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'healthy':
    case 'success':
    case 'passed':
      return 'text-green-600';
    case 'warning':
    case 'degraded':
      return 'text-orange-600';
    case 'error':
    case 'failed':
    case 'unhealthy':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Get background color based on health status
 */
export const getStatusBgColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'healthy':
    case 'success':
    case 'passed':
      return 'bg-green-100';
    case 'warning':
    case 'degraded':
      return 'bg-orange-100';
    case 'error':
    case 'failed':
    case 'unhealthy':
      return 'bg-red-100';
    default:
      return 'bg-gray-100';
  }
};
